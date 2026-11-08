# CARUNO on the desktop: icon "CARUNO" (shop logo) on the Desktop and in the Start menu, opening the counter app in
# its own window (Edge app mode, no address bar), maximized.
# The app itself is served by Docker (infra/app/docker-compose.yml) and starts with Windows.
# Usage (PowerShell): powershell -ExecutionPolicy Bypass -File scripts\desktop\install-desktop.ps1 [-Logo <png>] [-Url <url>]
param(
  [string]$Logo = 'C:\Users\TRETEC\caruno-data\branding\city-makoudi-2\logo-mark-512.png',
  [string]$Url = 'http://localhost:8082/',
  [string]$Name = 'CARUNO'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# 1. Windows icon (.ico) from the logo: 256 px as PNG, 64 / 48 / 32 / 24 / 16 px as classic 32-bit bitmaps
#    (read by every part of Windows).
$ico = Join-Path (Split-Path $Logo) 'caruno.ico'
$src = [System.Drawing.Image]::FromFile($Logo)
$pngs = @()
foreach ($s in 256, 64, 48, 32, 24, 16) {
  $bmp = New-Object System.Drawing.Bitmap $s, $s, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($src, 0, 0, $s, $s)
  $ms = New-Object System.IO.MemoryStream
  if ($s -eq 256) { $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png) }
  else {
    # BITMAPINFOHEADER (height x2: colour + mask), BGRA rows bottom-up, then an all-zero AND mask (alpha does the job).
    $bw = New-Object System.IO.BinaryWriter $ms
    $maskRow = [int]([math]::Ceiling($s / 32) * 4)
    $bw.Write([uint32]40); $bw.Write([int32]$s); $bw.Write([int32]($s * 2)); $bw.Write([uint16]1); $bw.Write([uint16]32)
    $bw.Write([uint32]0); $bw.Write([uint32]($s * $s * 4 + $maskRow * $s)); $bw.Write([int32]0); $bw.Write([int32]0); $bw.Write([uint32]0); $bw.Write([uint32]0)
    for ($y = $s - 1; $y -ge 0; $y--) { for ($x = 0; $x -lt $s; $x++) { $c = $bmp.GetPixel($x, $y); $bw.Write([byte]$c.B); $bw.Write([byte]$c.G); $bw.Write([byte]$c.R); $bw.Write([byte]$c.A) } }
    $bw.Write((New-Object byte[] ($maskRow * $s)))
    $bw.Flush()
  }
  $pngs += , @($s, $ms.ToArray())
  $g.Dispose(); $bmp.Dispose()
}
$src.Dispose()
$out = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter $out
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]$pngs.Count)
$offset = 6 + 16 * $pngs.Count
foreach ($p in $pngs) {
  $s = $p[0]; $len = $p[1].Length
  $w.Write([byte]($s % 256)); $w.Write([byte]($s % 256)); $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([uint16]1); $w.Write([uint16]32); $w.Write([uint32]$len); $w.Write([uint32]$offset)
  $offset += $len
}
foreach ($p in $pngs) { $w.Write($p[1]) }
[System.IO.File]::WriteAllBytes($ico, $out.ToArray())
$w.Dispose()
Write-Output "Icon: $ico"

# 2. Shortcuts: Desktop and Start menu.
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge not found.' }
$shell = New-Object -ComObject WScript.Shell
$startMenu = Join-Path ([Environment]::GetFolderPath('Programs')) "$Name.lnk"
foreach ($lnk in (Join-Path ([Environment]::GetFolderPath('Desktop')) "$Name.lnk"), $startMenu) {
  $sc = $shell.CreateShortcut($lnk)
  $sc.TargetPath = $edge
  $sc.Arguments = "--app=$Url --start-maximized"
  $sc.WorkingDirectory = Split-Path $edge
  $sc.IconLocation = "$ico,0"
  $sc.Description = 'CARUNO - comptoir du magasin'
  $sc.Save()
  Write-Output "Shortcut: $lnk"
}
