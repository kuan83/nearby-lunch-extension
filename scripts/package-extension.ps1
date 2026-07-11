param(
  [string]$OutputPath = ""
)

$root = Split-Path -Parent $PSScriptRoot
$extensionPath = Join-Path $root "extension"

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $root "dist\nearby-lunch-extension.zip"
}

if (-not (Test-Path -LiteralPath $extensionPath -PathType Container)) {
  throw "Extension directory not found: $extensionPath"
}

$possibleSecrets = Get-ChildItem -Path $extensionPath -Recurse -File -Include *.js,*.json,*.html,*.css |
  Select-String -Pattern "AIza[0-9A-Za-z_-]{20,}" -ErrorAction SilentlyContinue
if ($possibleSecrets) {
  throw "Potential Google API key found in extension source. Remove it before packaging."
}

$certificateFiles = Get-ChildItem -Path $extensionPath -Recurse -File -Include *.pem,*.key,*.pfx,*.p12
if ($certificateFiles) {
  throw "Certificate files must not be included in the extension package."
}

$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

if (Test-Path -LiteralPath $OutputPath) {
  Remove-Item -LiteralPath $OutputPath -Force
}

Compress-Archive -Path (Join-Path $extensionPath "*") -DestinationPath $OutputPath -CompressionLevel Optimal
Write-Host "Created Chrome Web Store package: $OutputPath"
