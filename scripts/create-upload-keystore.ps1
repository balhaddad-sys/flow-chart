param(
  [string]$Alias = "upload",
  [string]$OutputPath = "android/app/upload-keystore.jks"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) {
  throw "keytool not found. Install JDK 17+ and ensure keytool is in PATH."
}

if (-not (Test-Path "android/app")) {
  throw "android/app not found. Run scripts/playstore-bootstrap.ps1 first."
}

keytool -genkeypair `
  -v `
  -keystore $OutputPath `
  -alias $Alias `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000

Write-Host "Created keystore at $OutputPath"
