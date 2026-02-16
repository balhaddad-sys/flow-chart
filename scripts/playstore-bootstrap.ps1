param(
  [string]$AndroidOrg = "com.medq",
  [string]$ProjectName = "medq"
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' is not available in PATH."
  }
}

Write-Host "Bootstrapping Android support for Play Store readiness..."
Require-Command flutter

if (-not (Test-Path "pubspec.yaml")) {
  throw "Run this script from the Flutter project root (pubspec.yaml not found)."
}

if (-not (Test-Path "android")) {
  Write-Host "android/ not found. Generating Android platform files..."
  flutter create --platforms=android --org $AndroidOrg --project-name $ProjectName .
} else {
  Write-Host "android/ already exists. Skipping platform generation."
}

$keyTemplatePath = "android/key.properties.example"
if (-not (Test-Path $keyTemplatePath)) {
@"
storePassword=CHANGE_ME
keyPassword=CHANGE_ME
keyAlias=upload
storeFile=app/upload-keystore.jks
"@ | Set-Content -Path $keyTemplatePath -Encoding UTF8
  Write-Host "Created $keyTemplatePath"
}

Write-Host "Android bootstrap complete."
Write-Host "Next:"
Write-Host "1) Configure Firebase Android app and keep google-services.json in android/app/"
Write-Host "2) Create android/key.properties from android/key.properties.example"
Write-Host "3) Run scripts/build-android-aab.ps1"
