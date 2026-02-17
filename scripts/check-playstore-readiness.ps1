param(
  [string]$PrivacyUrl = "",
  [string]$TermsUrl = "",
  [switch]$SkipUrlCheck
)

$ErrorActionPreference = "Stop"

$fails = 0
$warnings = 0

function Pass([string]$msg) {
  Write-Host "[PASS] $msg" -ForegroundColor Green
}

function Warn([string]$msg) {
  $script:warnings++
  Write-Host "[WARN] $msg" -ForegroundColor Yellow
}

function Fail([string]$msg) {
  $script:fails++
  Write-Host "[FAIL] $msg" -ForegroundColor Red
}

function Check-Path([string]$path, [string]$label) {
  if (Test-Path $path) {
    Pass "$label exists ($path)"
  } else {
    Fail "$label missing ($path)"
  }
}

Write-Host "Checking Play Store + consumer readiness..." -ForegroundColor Cyan

Check-Path "pubspec.yaml" "Flutter project root"
Check-Path ".github/workflows/android-release.yml" "Android release workflow"
Check-Path "scripts/build-android-aab.ps1" "AAB build script"
Check-Path "scripts/create-upload-keystore.ps1" "Keystore script"
Check-Path "docs/PLAY_STORE_READINESS.md" "Play Store guide"
Check-Path "lib/src/core/constants/app_links.dart" "Legal link config"
Check-Path "lib/src/features/settings/screens/settings_screen.dart" "Settings legal/access screen"
Check-Path "lib/src/features/auth/screens/login_screen.dart" "Login screen"
Check-Path "lib/src/features/auth/screens/signup_screen.dart" "Signup screen"

if (Test-Path "android") {
  Pass "android/ platform folder exists"
} else {
  Warn "android/ platform folder is missing. Run scripts/playstore-bootstrap.ps1 when Flutter SDK is installed."
}

$gitignore = ".gitignore"
if (Test-Path $gitignore) {
  $content = Get-Content $gitignore -Raw
  foreach ($line in @("android/key.properties", "android/app/upload-keystore.jks", "android/app/google-services.json")) {
    if ($content -match [regex]::Escape($line)) {
      Pass ".gitignore protects $line"
    } else {
      Fail ".gitignore missing secret path: $line"
    }
  }
}

$appLinksFile = "lib/src/core/constants/app_links.dart"
if (Test-Path $appLinksFile) {
  $links = Get-Content $appLinksFile -Raw
  if ($links -match "https://") {
    Pass "App links contain HTTPS defaults"
  } else {
    Fail "App links missing HTTPS defaults"
  }
}

if (-not $SkipUrlCheck) {
  $urls = @()
  if (-not [string]::IsNullOrWhiteSpace($PrivacyUrl)) { $urls += $PrivacyUrl }
  if (-not [string]::IsNullOrWhiteSpace($TermsUrl)) { $urls += $TermsUrl }
  if ($urls.Count -eq 0) {
    Warn "Skipping URL reachability checks (pass -PrivacyUrl and -TermsUrl to enable)."
  } else {
    foreach ($url in $urls) {
      try {
        $res = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 20
        if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 400) {
          Pass "Reachable URL: $url ($($res.StatusCode))"
        } else {
          Fail "URL returned non-success code: $url ($($res.StatusCode))"
        }
      } catch {
        Fail "URL not reachable: $url ($($_.Exception.Message))"
      }
    }
  }
} else {
  Warn "URL reachability checks skipped by flag."
}

Write-Host ""
Write-Host "Summary: $fails fail(s), $warnings warning(s)." -ForegroundColor Cyan

if ($fails -gt 0) {
  exit 1
}
