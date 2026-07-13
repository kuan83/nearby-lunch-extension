$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $root "backend"
$envPath = Join-Path $backendPath ".env"
$keyPath = Join-Path $backendPath "certs\localhost-key.pem"
$certPath = Join-Path $backendPath "certs\localhost-cert.pem"

if ($null -eq (Get-Command node -ErrorAction SilentlyContinue) -or $null -eq (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js was not found. Double-click Setup-Nearby-Lunch.cmd first."
  exit 1
}

if (-not ((Test-Path -LiteralPath $envPath -PathType Leaf) -and (Test-Path -LiteralPath $keyPath -PathType Leaf) -and (Test-Path -LiteralPath $certPath -PathType Leaf))) {
  Write-Host "Local setup is incomplete. Double-click Setup-Nearby-Lunch.cmd first."
  exit 1
}

Write-Host "Starting Nearby Lunch backend at https://localhost:3000"
Write-Host "Keep this window open while using the extension. Press Ctrl+C here to stop it."
Push-Location $backendPath
try {
  & npm.cmd start
} finally {
  Pop-Location
}
