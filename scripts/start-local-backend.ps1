$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $root "backend"
$envPath = Join-Path $backendPath ".env"
$keyPath = Join-Path $backendPath "certs\localhost-key.pem"
$certPath = Join-Path $backendPath "certs\localhost-cert.pem"
$healthCheckPath = Join-Path $PSScriptRoot "check-local-backend.js"
$expectedStrategyVersion = "lateNightHybridV1"

if ($null -eq (Get-Command node -ErrorAction SilentlyContinue) -or $null -eq (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js was not found. Double-click Setup-Nearby-Lunch.cmd first."
  exit 1
}

if (-not ((Test-Path -LiteralPath $envPath -PathType Leaf) -and (Test-Path -LiteralPath $keyPath -PathType Leaf) -and (Test-Path -LiteralPath $certPath -PathType Leaf))) {
  Write-Host "Local setup is incomplete. Double-click Setup-Nearby-Lunch.cmd first."
  exit 1
}

$portOwnerPids = @(
  netstat -ano -p tcp |
    Select-String -Pattern ":3000\s+.*LISTENING\s+(\d+)\s*$" |
    ForEach-Object { [int]$_.Matches[0].Groups[1].Value } |
    Sort-Object -Unique
)

if ($portOwnerPids.Count) {
  $health = $null
  try {
    $healthJson = & node $healthCheckPath 2>$null
    if ($LASTEXITCODE -eq 0 -and $healthJson) {
      $health = $healthJson | ConvertFrom-Json
    }
  } catch {
    # The port is occupied, but it is not a trusted compatible backend.
  }

  if ($null -ne $health -and $health.ok -and $health.searchStrategyVersion -eq $expectedStrategyVersion) {
    Write-Host "Nearby Food backend is already running on https://localhost:3000"
    Write-Host "Version: $($health.version)  PID: $($portOwnerPids -join ', ')"
    exit 0
  }

  Write-Host "Port 3000 is already in use by PID: $($portOwnerPids -join ', ')" -ForegroundColor Yellow
  if ($null -ne $health -and $health.ok) {
    Write-Host "An older Nearby Food backend is running. Stop it, then run this launcher again."
  } else {
    Write-Host "The process is not a compatible trusted Nearby Food backend."
  }
  Write-Host "You can stop it from Task Manager, or run: Stop-Process -Id $($portOwnerPids[0])"
  exit 1
}

Write-Host "Starting Nearby Food backend at https://localhost:3000"
Write-Host "Keep this window open while using the extension. Press Ctrl+C here to stop it."
Push-Location $backendPath
try {
  & npm.cmd start
} finally {
  Pop-Location
}
