#Requires -Version 5.1
<#
.SYNOPSIS
    Runs all tests for TFX and DASE and displays code coverage.
.DESCRIPTION
    Executes the Vitest suite (TFX) and the Jest suite (DASE), shows a combined
    coverage summary, and exits with a non-zero code if either suite fails.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root    = $PSScriptRoot
$TfxDir  = Join-Path $Root "TFX"
$DaseDir = Join-Path $Root "DASE"

$TfxFailed    = $false
$DaseFailed   = $false
$LASTEXITCODE = 0

function Write-Header([string]$Text)
{
    $line = "-" * 72
    Write-Host ""
    Write-Host $line           -ForegroundColor Cyan
    Write-Host "  $Text"       -ForegroundColor Cyan
    Write-Host $line           -ForegroundColor Cyan
}

function Write-Result([string]$Suite, [bool]$Failed)
{
    if ($Failed)
        { Write-Host "  [FAIL]  $Suite" -ForegroundColor Red }
    else
        { Write-Host "  [ OK ]  $Suite" -ForegroundColor Green }
}

# --- TFX (Vitest) -------------------------------------------------------------

Write-Header "TFX -- Vitest + v8 coverage"

Push-Location $TfxDir
try
{
    npx vitest run --coverage
    if ($LASTEXITCODE -ne 0) { $TfxFailed = $true }
}
finally
{
    Pop-Location
}

# --- DASE (Jest) --------------------------------------------------------------

Write-Header "DASE -- Jest + ts-jest coverage"

Push-Location $DaseDir
try
{
    npx jest --coverage --forceExit
    if ($LASTEXITCODE -ne 0) { $DaseFailed = $true }
}
finally
{
    Pop-Location
}

# --- Summary ------------------------------------------------------------------

Write-Header "Results"
Write-Result "TFX  (TFX/coverage/)"  $TfxFailed
Write-Result "DASE (DASE/coverage/)" $DaseFailed
Write-Host ""

if ($TfxFailed -or $DaseFailed)
{
    Write-Host "One or more suites FAILED." -ForegroundColor Red
    exit 1
}

Write-Host "All suites passed." -ForegroundColor Green
exit 0