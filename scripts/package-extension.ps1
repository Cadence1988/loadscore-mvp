$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$extensionRoot = Join-Path $repoRoot "extension"
$manifest = Get-Content -Raw -LiteralPath (Join-Path $extensionRoot "manifest.json") | ConvertFrom-Json
$artifactRoot = Join-Path $repoRoot "artifacts"
$stagingRoot = Join-Path $artifactRoot "loadscore-extension-v$($manifest.version)"
$zipPath = Join-Path $artifactRoot "loadscore-extension-v$($manifest.version).zip"

$requiredFiles = @(
  "manifest.json", "popup.html", "popup.css", "popup.js", "loadScore.js",
  "evaluateAlertMatch.js", "analytics.js", "analyticsConfig.js", "shareResult.js",
  "loadLifecycle.js", "notificationEngine.js", "background.js",
  "operatingModes.js",
  "evaluationTrust.js",
  "icons\icon-16.png", "icons\icon-32.png", "icons\icon-48.png", "icons\icon-128.png"
)

if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -Recurse -Force -LiteralPath $stagingRoot }
New-Item -ItemType Directory -Path $stagingRoot | Out-Null

foreach ($relativePath in $requiredFiles) {
  $sourcePath = Join-Path $extensionRoot $relativePath
  if (-not (Test-Path -LiteralPath $sourcePath)) { throw "Required extension file is missing: $relativePath" }
  $destinationPath = Join-Path $stagingRoot $relativePath
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destinationPath) | Out-Null
  Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
}

if (Test-Path -LiteralPath $zipPath) { Remove-Item -Force -LiteralPath $zipPath }
Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -Recurse -Force -LiteralPath $stagingRoot
Write-Output "Created $zipPath"
