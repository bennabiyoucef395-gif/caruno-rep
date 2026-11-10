-- vehicle_ref: outside vehicle reference data (scripts/vehicle-ref/build.sh). Never joined into caruno_parts
-- tables; caruno_parts.models only holds reference columns pointing here.

-- One row per loaded source: which release is in the database, its licence and file checksum.
CREATE TABLE IF NOT EXISTS sources (
  name       VARCHAR(40) PRIMARY KEY,
  version    VARCHAR(40) NOT NULL,
  url        VARCHAR(255) NOT NULL,
  licence    VARCHAR(80) NOT NULL,
  sha256     CHAR(64) NOT NULL,
  loaded_at  DATETIME NOT NULL
) ENGINE=InnoDB;

-- Every vehicle-makes-models generation matched to each of our models (doors / body / facelift rows);
-- is_main = the one also in caruno_parts.models.vmm_generation_id. Written by scripts/parts/build.sh links
-- from scripts/parts/model_links.csv, at each rebuild of caruno_parts (model ids change). Internal only.
CREATE TABLE IF NOT EXISTS model_links (
  caruno_model_id    INT UNSIGNED NOT NULL,     -- caruno_parts.models.id
  vmm_generation_id  INT NOT NULL,              -- vmm_generations.id
  is_main            BOOLEAN NOT NULL,
  PRIMARY KEY (caruno_model_id, vmm_generation_id),
  KEY (vmm_generation_id)
) ENGINE=InnoDB;
