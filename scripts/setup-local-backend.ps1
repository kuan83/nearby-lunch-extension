$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $root "backend"
$envPath = Join-Path $backendPath ".env"
$envExamplePath = Join-Path $backendPath ".env.example"
$keyPath = Join-Path $backendPath "certs\localhost-key.pem"
$certPath = Join-Path $backendPath "certs\localhost-cert.pem"

function Test-Tool {
  param([string]$Name)

  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Install-WithWinget {
  param([string]$PackageId, [string]$DisplayName)

  if (-not (Test-Tool "winget")) {
    throw "${DisplayName} is required, but Windows Package Manager (winget) was not found. Install it from Microsoft Store, then run Setup-Nearby-Lunch.cmd again."
  }

  Write-Host "Installing ${DisplayName}..."
  & winget install --id $PackageId --exact --source winget --accept-source-agreements --accept-package-agreements
  if ($LASTEXITCODE -ne 0) {
    throw "${DisplayName} installation did not finish. Complete any installer prompts, then run Setup-Nearby-Lunch.cmd again."
  }
}

function Get-PlainText {
  param([Security.SecureString]$Value)

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

if (-not (Test-Path -LiteralPath $backendPath -PathType Container)) {
  throw "Backend folder not found: $backendPath"
}

$installedPrerequisite = $false
if (-not (Test-Tool "node") -or -not (Test-Tool "npm.cmd")) {
  Install-WithWinget -PackageId "OpenJS.NodeJS.LTS" -DisplayName "Node.js LTS"
  $installedPrerequisite = $true
}

if (-not (Test-Tool "mkcert")) {
  Install-WithWinget -PackageId "FiloSottile.mkcert" -DisplayName "mkcert"
  $installedPrerequisite = $true
}

if ($installedPrerequisite) {
  Write-Host ""
  Write-Host "A prerequisite was installed. Close this window, then double-click Setup-Nearby-Lunch.cmd once more so Windows can refresh its command paths."
  exit 0
}

if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
  Copy-Item -LiteralPath $envExamplePath -Destination $envPath
  Write-Host "Created backend/.env."
}

$envContent = Get-Content -LiteralPath $envPath -Raw
$keyMatch = [regex]::Match($envContent, "(?m)^GOOGLE_PLACES_API_KEY=(.*)$")
$existingKey = if ($keyMatch.Success) { $keyMatch.Groups[1].Value.Trim() } else { "" }

if ([string]::IsNullOrWhiteSpace($existingKey) -or $existingKey -eq "your_google_places_api_key_here") {
  Write-Host ""
  Write-Host "Paste your own Google Places API key. It is stored only in backend/.env on this computer."
  $secureKey = Read-Host "Google Places API key" -AsSecureString
  $apiKey = Get-PlainText -Value $secureKey
  if ([string]::IsNullOrWhiteSpace($apiKey)) {
    throw "No API key was provided. Run Setup-Nearby-Lunch.cmd again when you have created a key."
  }

  if ($keyMatch.Success) {
    $envContent = [regex]::Replace($envContent, "(?m)^GOOGLE_PLACES_API_KEY=.*$", "GOOGLE_PLACES_API_KEY=$apiKey")
  } else {
    $envContent = "GOOGLE_PLACES_API_KEY=$apiKey`r`n$envContent"
  }
  Set-Content -LiteralPath $envPath -Value $envContent -NoNewline
  $apiKey = $null
}

Write-Host "Installing backend packages..."
Push-Location $backendPath
try {
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) {
    throw "npm could not install the backend packages."
  }
} finally {
  Pop-Location
}

if (-not ((Test-Path -LiteralPath $keyPath -PathType Leaf) -and (Test-Path -LiteralPath $certPath -PathType Leaf))) {
  Write-Host "Creating a trusted HTTPS certificate for localhost..."
  & (Join-Path $PSScriptRoot "setup-local-https.ps1")
}

Write-Host ""
Write-Host "Setup complete. Your API key and certificate are local-only and ignored by Git."
