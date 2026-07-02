# ============================================
# DASE - Publish to VS Code Marketplace
# Builds a VSIX (via build-package.ps1) and publishes it to the
# Marketplace under the publisher declared in DASE/package.json.
#
# Publishing requires a Personal Access Token (PAT) with the
# "Marketplace > Manage" scope, created at:
#   https://dev.azure.com/_usersSettings/tokens
#
# Provide it via -Pat, the VSCE_PAT environment variable, or a prior
# `vsce login <publisher>`. Without any of those the script builds the
# VSIX and points you at the manual-upload page.
# ============================================

param(
    [string]$Pat = "",
    [string]$Version = "",
    [switch]$SkipTests,
    [switch]$SkipTFX,
    [switch]$SkipBuild,   # reuse the existing dase-*.vsix, do not rebuild
    [switch]$Help
)

$ErrorActionPreference = "Stop"

function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Warn { Write-Host $args -ForegroundColor Yellow }
function Write-Err { Write-Host $args -ForegroundColor Red }

function Invoke-Native {
    param([string]$CommandLine)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { cmd /c "$CommandLine 2>&1" }
    finally { $ErrorActionPreference = $prev }
}

if ($Help) {
    Write-Host @"

DASE Publish Script
===================

Usage: .\publish-package.ps1 [options]

Options:
  -Pat <token>       Marketplace PAT (else uses `$env:VSCE_PAT or a prior vsce login)
  -Version <string>  Version to build (default: increment package.json patch)
  -SkipTests         Skip tests during build
  -SkipTFX           Skip rebuilding TFX
  -SkipBuild         Do not rebuild - publish the existing DASE/dase-*.vsix
  -Help              Show this help message

Examples:
  .\publish-package.ps1 -Pat abc123...          # Build + publish
  .\publish-package.ps1                          # Uses `$env:VSCE_PAT or vsce login
  .\publish-package.ps1 -SkipBuild -Pat abc123   # Publish the last built VSIX

"@
    exit 0
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "  DASE - Publish to Marketplace" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""

$RootDir = $PSScriptRoot
$DaseDir = Join-Path $RootDir "DASE"

# ============================================
# Step 1: Build (unless -SkipBuild)
# ============================================
if (-not $SkipBuild) {
    Write-Info "[1/3] Building VSIX..."
    $buildArgs = @()
    if ($Version)    { $buildArgs += @("-Version", $Version) }
    if ($SkipTests)  { $buildArgs += "-SkipTests" }
    if ($SkipTFX)    { $buildArgs += "-SkipTFX" }
    & (Join-Path $RootDir "build-package.ps1") @buildArgs
    if ($LASTEXITCODE -ne 0) { Write-Err "Build failed - aborting publish."; exit 1 }
} else {
    Write-Warn "[1/3] Skipping build (-SkipBuild)"
}

# ============================================
# Step 2: Locate the VSIX
# ============================================
Write-Info "[2/3] Locating VSIX..."
$Vsix = Get-ChildItem (Join-Path $DaseDir "dase-*.vsix") -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $Vsix) { Write-Err "No dase-*.vsix found in DASE/. Run without -SkipBuild first."; exit 1 }
Write-Host "  Using: $($Vsix.Name)"

# ============================================
# Step 3: Publish
# ============================================
Write-Info "[3/3] Publishing to Marketplace..."
Push-Location $DaseDir
try {
    if (-not (Get-Command vsce -ErrorAction SilentlyContinue)) {
        Write-Host "  Installing vsce..."
        npm install -g @vscode/vsce
    }

    if (-not $Pat -and $env:VSCE_PAT) { $Pat = $env:VSCE_PAT }

    $publisher = (Get-Content (Join-Path $DaseDir "package.json") -Raw | ConvertFrom-Json).publisher

    if ($Pat) {
        Invoke-Native "vsce publish --packagePath `"$($Vsix.Name)`" -p $Pat"
    } else {
        Write-Warn "  No PAT provided (-Pat / `$env:VSCE_PAT). Trying a prior 'vsce login'..."
        Invoke-Native "vsce publish --packagePath `"$($Vsix.Name)`""
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Err "  Publish failed."
        Write-Host ""
        Write-Warn "  No token? Upload the VSIX manually instead:"
        Write-Host "    1. Open https://marketplace.visualstudio.com/manage/publishers/$publisher"
        Write-Host "    2. DASE -> ... -> Update  (or 'New extension' the first time)"
        Write-Host "    3. Drag: $($Vsix.FullName)"
        Start-Process "https://marketplace.visualstudio.com/manage/publishers/$publisher"
        exit 1
    }

    Write-Success "  Published $($Vsix.Name) to publisher '$publisher'."
}
finally { Pop-Location }

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Publish Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
