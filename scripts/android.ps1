param([ValidateSet('preflight','init','build')][string]$Action = 'preflight')
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
# This script never installs tools, deploys a website, uploads to Play, or creates a signing key automatically.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'BLOCKED: Node.js 24 must be on PATH.' }
node scripts/android-config.mjs
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED: explicit release identity is required.' }
foreach ($tool in @('java','bubblewrap','adb')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "BLOCKED: $tool is not installed/on PATH. See android/README.md; do not auto-download tools." }
}
if (-not $env:ANDROID_HOME -or -not (Test-Path -LiteralPath $env:ANDROID_HOME)) { throw 'BLOCKED: ANDROID_HOME must point to the installed SDK.' }
bubblewrap doctor
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED: Bubblewrap SDK/JDK check failed.' }
if ($Action -eq 'preflight') { Write-Output 'Android environment preflight passed; no project built or published.'; exit 0 }
$identity = Get-Content android/identity.json -Raw | ConvertFrom-Json
if ($Action -eq 'init') {
    if (Test-Path -LiteralPath android/app/twa-manifest.json) { throw 'Project already exists. Review and use Bubblewrap update explicitly.' }
    # Interactive Bubblewrap prompts: confirm the exact identity.packageId and owned signing key.
    Write-Output "Confirm package ID $($identity.packageId) at the Bubblewrap prompt. Do not accept a guessed identifier."
    bubblewrap init --manifest $identity.manifestUrl --directory android/app
    if ($LASTEXITCODE -ne 0) { throw 'Bubblewrap init failed.' }
}
if (-not (Test-Path -LiteralPath android/app/twa-manifest.json)) { throw 'BLOCKED: run init after deploying the HTTPS web manifest.' }
$twa = Get-Content android/app/twa-manifest.json -Raw | ConvertFrom-Json
if ($twa.packageId -ne $identity.packageId -or $twa.host -ne ([Uri]$identity.origin).Host) { throw 'BLOCKED: generated TWA package/domain differs from the approved identity.' }
if ($Action -eq 'build') {
    if (-not $env:ANDROID_KEYSTORE_PATH -or -not (Test-Path -LiteralPath $env:ANDROID_KEYSTORE_PATH) -or -not $env:ANDROID_KEY_ALIAS) { throw 'BLOCKED: ANDROID_KEYSTORE_PATH and ANDROID_KEY_ALIAS must identify the owned upload key.' }
    Push-Location android/app
    try {
        bubblewrap build --signingKeyPath $env:ANDROID_KEYSTORE_PATH --signingKeyAlias $env:ANDROID_KEY_ALIAS
        if ($LASTEXITCODE -ne 0) { throw 'Bubblewrap build failed.' }
        foreach ($artifact in @('app-release-signed.apk','app-release-bundle.aab')) { if (-not (Test-Path -LiteralPath $artifact)) { throw "Missing $artifact after build." } }
    } finally { Pop-Location }
}
