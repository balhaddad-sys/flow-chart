param(
  [switch]$SkipWebBuild,
  [switch]$SkipDeploySmoke,
  [switch]$Fast,
  [switch]$Json,
  [string]$HealthCheckUrl = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$script:Results = [System.Collections.Generic.List[object]]::new()

function Add-Result {
  param(
    [string]$Category,
    [string]$Check,
    [string]$Status,
    [string]$Message
  )

  $script:Results.Add([pscustomobject]@{
    Category = $Category
    Check    = $Check
    Status   = $Status
    Message  = $Message
  })
}

function Invoke-Check {
  param(
    [string]$Category,
    [string]$Check,
    [scriptblock]$Action,
    [switch]$Skip,
    [string]$SkipReason = "Skipped by option."
  )

  if ($Skip) {
    Add-Result -Category $Category -Check $Check -Status "SKIP" -Message $SkipReason
    return
  }

  try {
    $output = & $Action
    $message = "OK"
    if ($null -ne $output) {
      if ($output -is [System.Array]) {
        $message = (($output | ForEach-Object { "$_" }) -join "; ").Trim()
      } else {
        $message = "$output".Trim()
      }
      if (-not $message) { $message = "OK" }
    }
    Add-Result -Category $Category -Check $Check -Status "PASS" -Message $message
  } catch {
    Add-Result -Category $Category -Check $Check -Status "FAIL" -Message $_.Exception.Message
  }
}

function Assert-FileContains {
  param(
    [string]$Path,
    [string]$RegexPattern
  )

  if (-not (Test-Path $Path)) {
    throw "File not found: $Path"
  }

  $content = Get-Content -Raw $Path
  if ($content -notmatch $RegexPattern) {
    throw "Pattern not found in $Path : $RegexPattern"
  }
}

function Assert-FileExists {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    throw "Missing file: $Path"
  }
}

function Invoke-Npm {
  param(
    [string]$WorkingDirectory,
    [string[]]$CommandArgs
  )

  Push-Location $WorkingDirectory
  try {
    & npm @CommandArgs
    if ($LASTEXITCODE -ne 0) {
      throw "npm $($CommandArgs -join ' ') failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

function Ensure-Dependencies {
  param([string]$WorkingDirectory)
  if (-not (Test-Path (Join-Path $WorkingDirectory "node_modules"))) {
    Write-Host "Installing dependencies in $WorkingDirectory ..."
    Invoke-Npm -WorkingDirectory $WorkingDirectory -CommandArgs @("ci")
  }
}

Write-Host "Launch readiness started at $(Get-Date -Format s)"
Write-Host "Project root: $ProjectRoot"

$webDir = Join-Path $ProjectRoot "medq-web"
$functionsDir = Join-Path $ProjectRoot "functions"

Ensure-Dependencies $webDir
Ensure-Dependencies $functionsDir

# ---------------------------------------------------------------------------
# Ops Reliability
# ---------------------------------------------------------------------------
Invoke-Check -Category "Ops Reliability" -Check "Firebase CLI >= 15" -Action {
  $versionRaw = (& firebase --version 2>$null).Trim()
  if (-not $versionRaw) { throw "firebase CLI not found in PATH." }
  $major = [int]($versionRaw.Split(".")[0])
  if ($major -lt 15) { throw "firebase-tools version $versionRaw is below required 15.x" }
  "firebase-tools $versionRaw"
}

Invoke-Check -Category "Ops Reliability" -Check "Deploy workflow includes control-plane diagnostics" -Action {
  $wf = Join-Path $ProjectRoot ".github/workflows/firebase-deploy.yml"
  Assert-FileContains $wf "print_cf_operation_errors"
  Assert-FileContains $wf "cloudfunctions\.serviceAgent"
  "Diagnostics and service-agent binding found."
}

Invoke-Check -Category "Ops Reliability" -Check "Health endpoint returns healthy" -Skip:($SkipDeploySmoke -or [string]::IsNullOrWhiteSpace($HealthCheckUrl)) -SkipReason "No health URL provided (or -SkipDeploySmoke set)." -Action {
  $res = Invoke-RestMethod -Uri $HealthCheckUrl -Method Get -TimeoutSec 20
  if ($null -eq $res) { throw "No response body." }
  if ($res.status -ne "healthy") {
    throw "Unexpected status: '$($res.status)'"
  }
  "healthy"
}

# ---------------------------------------------------------------------------
# Clinical Quality
# ---------------------------------------------------------------------------
Invoke-Check -Category "Clinical Quality" -Check "Sensitive/nuanced routing policy exists" -Action {
  $policy = Join-Path $webDir "src/lib/utils/explore-chat-policy.ts"
  Assert-FileContains $policy "claude-haiku"
  Assert-FileContains $policy "clinically delicate or nuanced"
  Assert-FileContains $policy "for education only, not clinical advice"
  "Routing and safety language present."
}

Invoke-Check -Category "Clinical Quality" -Check "Exam playbooks integrated into prompts" -Action {
  $playbook = Join-Path $functionsDir "ai/examPlaybooks.js"
  $prompts = Join-Path $functionsDir "ai/prompts.js"
  Assert-FileContains $playbook "MRCP_PART1"
  Assert-FileContains $playbook "USMLE_STEP2"
  Assert-FileContains $prompts "buildExamPlaybookPrompt"
  Assert-FileContains $prompts "minimum 3 distinct blueprint domains"
  "Playbook profiles and prompt injection validated."
}

Invoke-Check -Category "Clinical Quality" -Check "Targeted clinical tests pass" -Skip:$Fast -SkipReason "Fast mode skips targeted test run." -Action {
  Invoke-Npm -WorkingDirectory $functionsDir -CommandArgs @("run", "test", "--", "__tests__/exam-playbooks.test.js")
  Invoke-Npm -WorkingDirectory $webDir -CommandArgs @("run", "test", "--", "src/lib/utils/explore-chat-policy.test.ts")
  "Targeted tests passed."
}

# ---------------------------------------------------------------------------
# UX / Brand
# ---------------------------------------------------------------------------
Invoke-Check -Category "UX Brand" -Check "Core icon assets exist" -Action {
  $files = @(
    "docs/branding/app-icon-master.png",
    "medq-web/public/icons/icon.svg",
    "medq-web/public/icons/icon-192.png",
    "medq-web/public/icons/icon-512.png",
    "medq-web/src/app/favicon.ico",
    "medq-web/src/app/apple-icon.png",
    "web/icons/Icon-192.png",
    "web/icons/Icon-512.png",
    "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"
  )
  foreach ($file in $files) {
    Assert-FileExists (Join-Path $ProjectRoot $file)
  }
  "All expected icon assets are present."
}

Invoke-Check -Category "UX Brand" -Check "Splash and metadata use updated icon set" -Action {
  Assert-FileContains (Join-Path $ProjectRoot "web/index.html") "icons/Icon-192\.png"
  Assert-FileContains (Join-Path $ProjectRoot "medq-web/public/manifest.json") "icon-192\.png\?v=3"
  Assert-FileContains (Join-Path $ProjectRoot "medq-web/public/manifest.json") "icon-512\.png\?v=3"
  Assert-FileContains (Join-Path $ProjectRoot "medq-web/src/app/layout.tsx") "favicon\.ico\?v=3"
  "Web shell and metadata reference the refreshed branding assets."
}

# ---------------------------------------------------------------------------
# Core Product
# ---------------------------------------------------------------------------
Invoke-Check -Category "Core Product" -Check "Functions full test suite passes" -Skip:$Fast -SkipReason "Fast mode skips full functions test suite." -Action {
  Invoke-Npm -WorkingDirectory $functionsDir -CommandArgs @("test")
  "Functions tests passed."
}

Invoke-Check -Category "Core Product" -Check "Web lint passes" -Action {
  Invoke-Npm -WorkingDirectory $webDir -CommandArgs @("run", "lint")
  "Lint passed."
}

Invoke-Check -Category "Core Product" -Check "Web build passes" -Skip:$SkipWebBuild -SkipReason "Skipped by -SkipWebBuild." -Action {
  Invoke-Npm -WorkingDirectory $webDir -CommandArgs @("run", "build")
  "Build passed."
}

# ---------------------------------------------------------------------------
# Trust / Compliance
# ---------------------------------------------------------------------------
Invoke-Check -Category "Trust Compliance" -Check "Terms page contains explicit medical disclaimer" -Action {
  $termsPath = Join-Path $webDir "src/app/terms/page.tsx"
  Assert-FileContains $termsPath "Medical Disclaimer"
  Assert-FileContains $termsPath "not medical advice"
  Assert-FileContains $termsPath "should not be used for clinical"
  "Terms disclaimer language present."
}

Invoke-Check -Category "Trust Compliance" -Check "In-app disclaimer banner is wired in app shell" -Action {
  $bannerPath = Join-Path $webDir "src/components/layout/medical-disclaimer.tsx"
  $shellPath = Join-Path $webDir "src/components/layout/app-shell-v2.tsx"
  Assert-FileContains $bannerPath "education only"
  Assert-FileContains $bannerPath "must not be used for patient-care decisions"
  Assert-FileContains $shellPath "MedicalDisclaimer"
  "Banner text and app shell wiring validated."
}

Invoke-Check -Category "Trust Compliance" -Check "Privacy page exists" -Action {
  Assert-FileExists (Join-Path $webDir "src/app/privacy/page.tsx")
  "Privacy page exists."
}

# ---------------------------------------------------------------------------
# Score & gate
# ---------------------------------------------------------------------------
$activeResults = $script:Results | Where-Object { $_.Status -ne "SKIP" }
$categoryScores = @{}

$categories = ($script:Results | Select-Object -ExpandProperty Category -Unique)
foreach ($cat in $categories) {
  $catActive = @($script:Results | Where-Object { $_.Category -eq $cat -and $_.Status -ne "SKIP" })
  if ($catActive.Count -eq 0) {
    $categoryScores[$cat] = 0.0
    continue
  }
  $catPass = @($catActive | Where-Object { $_.Status -eq "PASS" }).Count
  $score = [math]::Round((10.0 * $catPass / $catActive.Count), 1)
  $categoryScores[$cat] = $score
}

$scoreValues = @($categoryScores.Values)
$overallScore = if ($scoreValues.Count -gt 0) {
  [math]::Round(($scoreValues | Measure-Object -Average).Average, 1)
} else {
  0.0
}

$failedChecks = @($activeResults | Where-Object { $_.Status -eq "FAIL" })
$categoriesBelowNine = @($categoryScores.GetEnumerator() | Where-Object { $_.Value -lt 9.0 })
$gatePass = ($failedChecks.Count -eq 0 -and $categoriesBelowNine.Count -eq 0 -and $overallScore -ge 9.0)

Write-Host ""
Write-Host "================ Launch Readiness Report ================"
$script:Results | Sort-Object Category, Check | Format-Table -AutoSize

Write-Host ""
Write-Host "Category scores:"
foreach ($entry in ($categoryScores.GetEnumerator() | Sort-Object Name)) {
  Write-Host ("- {0}: {1}/10" -f $entry.Name, $entry.Value)
}
Write-Host ("Overall: {0}/10" -f $overallScore)
Write-Host ("Launch gate: {0}" -f ($(if ($gatePass) { "PASS" } else { "FAIL" })))

if ($Json) {
  $payload = [pscustomobject]@{
    generatedAt = (Get-Date).ToString("o")
    overallScore = $overallScore
    gate = if ($gatePass) { "PASS" } else { "FAIL" }
    categoryScores = $categoryScores
    results = $script:Results
  }
  $payload | ConvertTo-Json -Depth 6
}

if (-not $gatePass) {
  exit 1
}
