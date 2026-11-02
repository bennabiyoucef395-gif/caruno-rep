# Extract the TiBAO PDF catalogues to a spreadsheet (Python runs in Docker, nothing to install).
# Usage: .\scripts\catalogue-pdf\extract-catalogue.ps1 [-PdfDir "C:\...\bdd pieces auto"] [-Photos]
#   -Photos: extract the part photos instead (export\photos\<n_id>.jpg)
param(
    [string]$PdfDir = "$env:USERPROFILE\Documents\bdd pieces auto",
    [string]$OutName = "catalogue-tibao-2025.xlsx",
    [switch]$Photos
)
# No $ErrorActionPreference = "Stop": PowerShell 5.1 would abort on docker's stderr output; exit codes are checked instead.
$OutDir = Join-Path $PdfDir "export"
New-Item -ItemType Directory -Force $OutDir | Out-Null

docker build -q -t caruno-catalogue-pdf $PSScriptRoot
if ($LASTEXITCODE -ne 0) { throw "docker build failed" }
if ($Photos) {
    docker run --rm --network none -v "${PdfDir}:/pdf:ro" -v "${OutDir}:/out" --entrypoint python caruno-catalogue-pdf -I /app/extract_photos.py /pdf /out/photos
    if ($LASTEXITCODE -ne 0) { throw "photo extraction failed" }
    Write-Host "OK -> $(Join-Path $OutDir 'photos')"
    exit 0
}
docker run --rm --network none -v "${PdfDir}:/pdf:ro" -v "${OutDir}:/out" caruno-catalogue-pdf /pdf "/out/$OutName"
if ($LASTEXITCODE -ne 0) { throw "extraction failed" }
Write-Host "OK -> $(Join-Path $OutDir $OutName)"
