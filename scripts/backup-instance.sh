#!/usr/bin/env bash
# Hot, verified backup of a Dolibarr instance (method of doc/03 and doc/07).
# Usage: scripts/backup-instance.sh <label>
#   e.g. scripts/backup-instance.sh pre-config
# Env: HANOUT_ENV_FILE (instance env file), BACKUP_ROOT, DB_CONTAINER, APP_CONTAINER.
# Never prints secrets. Exits non-zero if any verification fails.
set -euo pipefail
export MSYS_NO_PATHCONV=1

label="${1:?usage: backup-instance.sh <label>}"
env_file="${HANOUT_ENV_FILE:-C:/Users/TRETEC/caruno-data/instances/hanout-vw/instance.env}"
backup_root="${BACKUP_ROOT:-C:/Users/TRETEC/caruno-backups/hanout-vw}"
db="${DB_CONTAINER:-dolibarr-db}"
app="${APP_CONTAINER:-dolibarr-app}"
repo="$(cd "$(dirname "$0")/.." && pwd)"

dir="$backup_root/$label-$(date +%Y%m%d-%H%M%S)"
[ -e "$dir" ] && { echo "Backup directory already exists: $dir" >&2; exit 1; }
mkdir -p "$dir"

{
  date -u +"start_utc=%Y-%m-%dT%H:%M:%SZ"
  date +"start_local=%Y-%m-%d %H:%M:%S %z"
  echo "label=$label"
} > "$dir/backup.log"

# Database: consistent InnoDB snapshot; the root password never leaves the container.
docker exec "$db" sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb-dump -uroot --single-transaction --quick --routines --triggers --events --hex-blob --default-character-set=utf8mb4 --databases "$MARIADB_DATABASE"' \
  > "$dir/db-dolibarr.sql" 2> "$dir/db-dump.stderr"

# Files. A folder bind-mounted from the host (the shop: documents, custom) is archived directly from the disk:
# through the container a Windows bind mount is very slow (58k product photos: 25+ min) and tar reports false
# "file changed as we read it" errors; on the disk it takes seconds. Owners on a Windows folder are not real
# anyway (restore: chown -R www-data). Anything else (conf, named volumes) is read through the container.
# Each archive stores its files under <name>/ (documents/..., custom/..., conf/...).
bind_src() { docker inspect "$app" --format '{{range .Mounts}}{{if and (eq .Type "bind") (eq .Destination "'"$1"'")}}{{.Source}}{{end}}{{end}}'; }
archive() {  # name container_parent
  local name="$1" parent="$2" src
  src="$(bind_src "$parent/$name")"
  if [ -n "$src" ] && [ -d "$src" ]; then
    src="$(cygpath -u "$src" 2>/dev/null || echo "$src")"   # Git Bash tar reads "C:/..." as a remote host
    tar --force-local -cf "$dir/$name.tar" -C "$src" --transform "s,^\.,$name," .
    echo "$name: host folder $src" >> "$dir/backup.log"
    (cd "$src" && find . -type f | wc -l) > "$dir/$name.files"
  else
    docker exec "$app" tar -cf - -C "$parent" "$name" > "$dir/$name.tar"
    echo "$name: through container $app:$parent/$name" >> "$dir/backup.log"
    docker exec "$app" sh -c "cd '$parent/$name' && find . -type f | wc -l" > "$dir/$name.files"
  fi
}
archive documents /var/www
archive custom /var/www/html
archive conf /var/www/html

# Configuration needed to rebuild the instance (instance.env holds secrets and the instance id).
mkdir "$dir/compose" "$dir/scripts"
cp -p "$repo/docker-compose.yml" "$repo/.env.example" "$repo/.gitignore" "$dir/compose/"
cp -p "$env_file" "$dir/compose/instance.env"
cp -p "$repo"/scripts/*.sh "$repo"/scripts/*.ps1 "$dir/scripts/" 2>/dev/null || true

# Exact row count of every table, query piped through stdin (no file written in the container).
rowcount_sql="SET SESSION group_concat_max_len=1000000;
SELECT CONCAT(GROUP_CONCAT(CONCAT('SELECT ', QUOTE(table_name), ', COUNT(*) FROM \`', table_name, '\`') SEPARATOR ' UNION ALL '), ';') FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE';"
dbq='MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot -N "$MARIADB_DATABASE"'
printf '%s\n' "$rowcount_sql" | docker exec -i "$db" sh -c "$dbq" | docker exec -i "$db" sh -c "$dbq" \
  | awk -F'\t' '$2>0{print $1" "$2}' | sort > "$dir/rowcounts-live.txt"
awk '/^INSERT INTO `/{match($0,/`[^`]+`/); t=substr($0,RSTART+1,RLENGTH-2); ins=1; next}
     ins&&/^\(/{c[t]++} ins&&/;$/{ins=0} END{for(t in c) print t" "c[t]}' "$dir/db-dolibarr.sql" | sort > "$dir/rowcounts-dump.txt"

{
  for c in "$app" "$db"; do
    docker inspect "$c" --format "$c image={{.Config.Image}} image_id={{.Image}} ports={{json .HostConfig.PortBindings}} mounts={{range .Mounts}}{{.Source}} -> {{.Destination}}; {{end}}"
  done
  echo "mariadb=$(docker exec "$db" mariadb --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
  echo "dolibarr=$(docker exec "$app" printenv DOLI_VERSION)"
} > "$dir/versions-manifest.txt"
date -u +"end_utc=%Y-%m-%dT%H:%M:%SZ" >> "$dir/backup.log"

# Verification
ok=1; cd "$dir"
tables=$(grep -c '^CREATE TABLE' db-dolibarr.sql || true)
tail -1 db-dolibarr.sql | grep -q '^-- Dump completed' || { echo "FAIL dump footer"; ok=0; }
[ -s db-dump.stderr ] && { echo "FAIL dump stderr not empty"; ok=0; }
[ "$tables" -ge 1 ] || { echo "FAIL no table"; ok=0; }
diff -q rowcounts-live.txt rowcounts-dump.txt >/dev/null || { echo "FAIL row counts differ between live and dump"; ok=0; }
tar -tf documents.tar | grep -x documents/install.lock >/dev/null || { echo "FAIL install.lock missing"; ok=0; }
tar -tf conf.tar | grep conf/conf.php >/dev/null || { echo "FAIL conf.php missing"; ok=0; }
for n in documents custom conf; do   # every file of the folder is in its archive
  want=$(tr -d ' \r\n' < "$n.files"); got=$(tar -tvf "$n.tar" | grep -c '^-' || true)
  [ "$want" = "$got" ] || { echo "FAIL $n: $got files in the archive, $want in the folder"; ok=0; }
done
find . -type f ! -name SHA256SUMS | sed 's#^\./##' | sort | xargs -d '\n' sha256sum > SHA256SUMS
sha256sum -c --quiet SHA256SUMS || { echo "FAIL checksums"; ok=0; }

echo "backup=$dir"
echo "tables=$tables non_empty_tables=$(wc -l < rowcounts-live.txt) rows=$(awk '{s+=$2}END{print s+0}' rowcounts-live.txt) files=$(wc -l < SHA256SUMS)"
[ "$ok" = 1 ] && echo "RESULT=OK" || { echo "RESULT=FAILED"; exit 1; }

# Protect: read-only files (Windows attribute when available).
if command -v powershell >/dev/null 2>&1; then
  powershell -NoProfile -Command "Get-ChildItem -LiteralPath '$(cygpath -w "$dir" 2>/dev/null || echo "$dir")' -Recurse -File -Force | ForEach-Object { \$_.IsReadOnly = \$true }" >/dev/null
fi
