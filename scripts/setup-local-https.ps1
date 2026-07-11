param(
  [string]$MkcertPath = "mkcert"
)

$root = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $root "backend"
$certDirectory = Join-Path $backendPath "certs"
$keyPath = Join-Path $certDirectory "localhost-key.pem"
$certPath = Join-Path $certDirectory "localhost-cert.pem"

if (-not (Test-Path -LiteralPath $backendPath -PathType Container)) {
  throw "Backend directory not found: $backendPath"
}

try {
  & $MkcertPath -version | Out-Null
} catch {
  throw "mkcert was not found. Install it first, or pass -MkcertPath with the full path to mkcert.exe."
}

& $MkcertPath -install
if ($LASTEXITCODE -ne 0) {
  throw "mkcert could not install its local certificate authority. Run this script from an interactive PowerShell session and approve any certificate prompt."
}

New-Item -ItemType Directory -Path $certDirectory -Force | Out-Null
& $MkcertPath -key-file $keyPath -cert-file $certPath localhost 127.0.0.1 ::1
if ($LASTEXITCODE -ne 0) {
  throw "mkcert could not generate the localhost certificate."
}

Write-Host "Created trusted localhost certificate files in $certDirectory"
