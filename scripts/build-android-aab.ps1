param(
  [string]$BuildName = "1.0.0",
  [int]$BuildNumber = 1
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' is not available in PATH."
  }
}

function Require-Path([string]$PathValue) {
  if (-not (Test-Path $PathValue)) {
    throw "Required path '$PathValue' does not exist."
  }
}

Write-Host "Building signed Android App Bundle (AAB)..."
Require-Command flutter
Require-Path "pubspec.yaml"
Require-Path "android"
Require-Path "android/app"

if (-not (Test-Path "android/key.properties")) {
  throw "Missing android/key.properties. Create it from android/key.properties.example."
}

if (-not (Test-Path "android/app/upload-keystore.jks")) {
  throw "Missing android/app/upload-keystore.jks."
}

$requiredEnv = @(
  "FIREBASE_ANDROID_API_KEY",
  "FIREBASE_ANDROID_APP_ID",
  "FIREBASE_ANDROID_MESSAGING_SENDER_ID",
  "MEDQ_PRIVACY_URL",
  "MEDQ_TERMS_URL",
  "MEDQ_SUPPORT_EMAIL"
)

foreach ($name in $requiredEnv) {
  $value = [Environment]::GetEnvironmentVariable($name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required environment variable: $name"
  }
}

flutter pub get

$buildArgs = @(
  "build", "appbundle",
  "--release",
  "--build-name=$BuildName",
  "--build-number=$BuildNumber",
  "--dart-define=FIREBASE_ANDROID_API_KEY=$($env:FIREBASE_ANDROID_API_KEY)",
  "--dart-define=FIREBASE_ANDROID_APP_ID=$($env:FIREBASE_ANDROID_APP_ID)",
  "--dart-define=FIREBASE_ANDROID_MESSAGING_SENDER_ID=$($env:FIREBASE_ANDROID_MESSAGING_SENDER_ID)",
  "--dart-define=FIREBASE_ANDROID_PROJECT_ID=$($env:FIREBASE_ANDROID_PROJECT_ID)",
  "--dart-define=FIREBASE_ANDROID_STORAGE_BUCKET=$($env:FIREBASE_ANDROID_STORAGE_BUCKET)",
  "--dart-define=MEDQ_PRIVACY_URL=$($env:MEDQ_PRIVACY_URL)",
  "--dart-define=MEDQ_TERMS_URL=$($env:MEDQ_TERMS_URL)",
  "--dart-define=MEDQ_SUPPORT_EMAIL=$($env:MEDQ_SUPPORT_EMAIL)"
)

Write-Host "Running: flutter $($buildArgs -join ' ')"
flutter @buildArgs

$output = "build/app/outputs/bundle/release/app-release.aab"
Require-Path $output
Write-Host "AAB ready: $output"
