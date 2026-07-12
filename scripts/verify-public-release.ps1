$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$javascriptFiles = @(
  "backend/server.js",
  "backend/src/config.js",
  "backend/src/googlePlaces.js",
  "backend/src/language.js",
  "backend/src/lunchService.js",
  "backend/src/searchPipeline.js",
  "extension/sidepanel.js"
)

foreach ($file in $javascriptFiles) {
  & node --check $file
  if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax check failed: $file" }
}

$powerShellFiles = @("scripts/package-extension.ps1", "scripts/setup-local-https.ps1")
foreach ($file in $powerShellFiles) {
  $tokens = $null
  $errors = $null
  [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $file), [ref]$tokens, [ref]$errors) | Out-Null
  if ($errors.Count) { throw "PowerShell syntax check failed: $file" }
}

Get-Content "extension/manifest.json" -Raw | ConvertFrom-Json | Out-Null
$english = Get-Content "extension/_locales/en/messages.json" -Raw | ConvertFrom-Json
$traditionalChinese = Get-Content "extension/_locales/zh_TW/messages.json" -Raw | ConvertFrom-Json
$englishKeys = @($english.psobject.Properties.Name)
$traditionalChineseKeys = @($traditionalChinese.psobject.Properties.Name)
$localeMismatch = @($englishKeys | Where-Object { $_ -notin $traditionalChineseKeys }) + @($traditionalChineseKeys | Where-Object { $_ -notin $englishKeys })
if ($localeMismatch) { throw "Locale message keys do not match: $localeMismatch" }

$env:HTTPS_KEY_PATH = "certs/ci-missing-key.pem"
$env:HTTPS_CERT_PATH = "certs/ci-missing-cert.pem"
$serverOutput = cmd.exe /c "node backend\server.js 2>&1"
$serverExitCode = $LASTEXITCODE
$serverOutputText = $serverOutput -join "`n"
if ($serverExitCode -eq 0 -or -not $serverOutputText.Contains("HTTPS certificate files are required")) {
  throw "Backend must reject startup when trusted certificate files are unavailable."
}

& powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\package-extension.ps1"
if ($LASTEXITCODE -ne 0) { throw "Extension package creation failed." }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = Resolve-Path ".\dist\nearby-lunch-extension.zip"
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
$entryNames = @($zip.Entries | Select-Object -ExpandProperty FullName)
$zip.Dispose()

$forbiddenPackageEntries = $entryNames | Where-Object { $_ -match "(^|\\)(backend|node_modules|certs)(\\|$)|\.env$|\.pem$|\.key$|\.pfx$|\.p12$|\.log$|(^|\\)\.git" }
if ($forbiddenPackageEntries) { throw "Forbidden package content: $forbiddenPackageEntries" }
if ("_locales\en\messages.json" -notin $entryNames -or "_locales\zh_TW\messages.json" -notin $entryNames) {
  throw "Extension package is missing a required locale file."
}

$trackedFiles = @(git ls-files)
$secretMatches = $trackedFiles | Where-Object { $_ -notmatch "(^|/)backend/\.env$" } | ForEach-Object {
  Select-String -Path $_ -Pattern "AIza[0-9A-Za-z_-]{20,}|BEGIN (RSA |EC |)PRIVATE KEY" -ErrorAction SilentlyContinue
}
if ($secretMatches) { throw "Potential secret found in a tracked file." }

Write-Host "Public release validation passed."
