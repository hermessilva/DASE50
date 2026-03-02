# ============================================
# DASE - Build Package Script
# Generates a VSIX package locally
# ============================================

param(
    [string]$Version = "",
    [switch]$SkipTests,
    [switch]$SkipTFX,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

# Colors
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Warn { Write-Host $args -ForegroundColor Yellow }
function Write-Err { Write-Host $args -ForegroundColor Red }

# Help
if ($Help) {
    Write-Host @"

DASE Build Package Script
=========================

Usage: .\build-package.ps1 [options]

Options:
  -Version <string>  Version for the package (default: from package.json + timestamp)
  -SkipTests         Skip running tests
  -SkipTFX           Skip rebuilding TFX (use existing dist/)
  -Help              Show this help message

Examples:
  .\build-package.ps1                    # Build with auto-generated version
  .\build-package.ps1 -Version 1.2.3     # Build with specific version
  .\build-package.ps1 -SkipTests         # Build without running tests
  .\build-package.ps1 -SkipTFX -SkipTests # Quick rebuild (DASE only, no tests)

Output:
  DASE/dase-<version>.vsix

"@
    exit 0
}

# Header
Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "  DASE - Build Package" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""

$RootDir = $PSScriptRoot
$TfxDir = Join-Path $RootDir "TFX"
$DaseDir = Join-Path $RootDir "DASE"

# Check directories
if (-not (Test-Path $TfxDir)) {
    Write-Err "TFX directory not found: $TfxDir"
    exit 1
}
if (-not (Test-Path $DaseDir)) {
    Write-Err "DASE directory not found: $DaseDir"
    exit 1
}

# ============================================
# Step 1: Build TFX
# ============================================
if (-not $SkipTFX) {
    Write-Info "[1/5] Building TFX..."
    
    Push-Location $TfxDir
    try {
        Write-Host "  Installing dependencies..."
        npm ci --silent 2>$null
        if ($LASTEXITCODE -ne 0) {
            npm install --silent
        }
        
        Write-Host "  Compiling TypeScript..."
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Err "TFX build failed!"
            exit 1
        }
        
        Write-Success "  TFX built successfully"
    }
    finally {
        Pop-Location
    }
} else {
    Write-Warn "[1/5] Skipping TFX build (--SkipTFX)"
}

# ============================================
# Step 2: Test TFX
# ============================================
if (-not $SkipTests -and -not $SkipTFX) {
    Write-Info "[2/5] Testing TFX..."
    
    Push-Location $TfxDir
    try {
        npm run test
        if ($LASTEXITCODE -ne 0) {
            Write-Err "TFX tests failed!"
            exit 1
        }
        Write-Success "  TFX tests passed"
    }
    finally {
        Pop-Location
    }
} else {
    Write-Warn "[2/5] Skipping TFX tests"
}

# ============================================
# Step 3: Build DASE
# ============================================
Write-Info "[3/5] Building DASE..."

Push-Location $DaseDir
try {
    Write-Host "  Installing dependencies..."
    npm ci --silent 2>$null
    if ($LASTEXITCODE -ne 0) {
        npm install --silent
    }
    
    # Copy TFX to node_modules (required for VSIX packaging)
    # npm creates symlinks for file: dependencies which vsce doesn't follow
    Write-Host "  Copying TFX to node_modules (replacing symlink)..."
    $TfxTarget = Join-Path $DaseDir "node_modules\@tootega\tfx"
    
    # Remove symlink/junction (special handling for Windows junctions)
    if (Test-Path $TfxTarget) {
        $item = Get-Item $TfxTarget -Force
        if ($item.LinkType) {
            # It's a symlink/junction - use cmd to remove it
            cmd /c "rmdir `"$TfxTarget`"" 2>$null
        } else {
            Remove-Item $TfxTarget -Recurse -Force
        }
    }
    
    # Create directory and copy files (maintain dist/ structure as package.json expects)
    New-Item -ItemType Directory -Path $TfxTarget -Force | Out-Null
    $TfxDistTarget = Join-Path $TfxTarget "dist"
    New-Item -ItemType Directory -Path $TfxDistTarget -Force | Out-Null
    Copy-Item (Join-Path $TfxDir "dist\*") $TfxDistTarget -Recurse -Force
    Copy-Item (Join-Path $TfxDir "package.json") $TfxTarget -Force
    
    # Verify copy
    $tfxIndex = Join-Path $TfxDistTarget "index.js"
    if (-not (Test-Path $tfxIndex)) {
        Write-Err "TFX copy failed - dist/index.js not found!"
        exit 1
    }
    Write-Host "  TFX copied successfully to node_modules"
    
    # Update package.json to use actual TFX version (not file: reference)
    # This prevents npm from flagging it as "invalid" during vsce packaging
    $PackageJsonPath = Join-Path $DaseDir "package.json"
    $PackageJson = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
    $TfxPackageJson = Get-Content (Join-Path $TfxTarget "package.json") -Raw | ConvertFrom-Json
    $TfxVersion = $TfxPackageJson.version
    $PackageJson.dependencies.'@tootega/tfx' = $TfxVersion
    $PackageJson | ConvertTo-Json -Depth 10 | Set-Content $PackageJsonPath -Encoding UTF8
    Write-Host "  Updated @tootega/tfx dependency to version $TfxVersion"
    
    # Determine version
    if ([string]::IsNullOrEmpty($Version)) {
        $PackageJson = Get-Content "package.json" | ConvertFrom-Json
        $BaseVersion = $PackageJson.version
        # Use timestamp as build number for local builds
        $Timestamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
        $BuildNumber = $Timestamp % 100000
        $VersionParts = $BaseVersion -split '\.'
        $Version = "$($VersionParts[0]).$($VersionParts[1]).$BuildNumber"
    }
    
    Write-Host "  Version: $Version"
    
    # Update package.json version
    npm version $Version --no-git-tag-version --allow-same-version 2>$null
    
    Write-Host "  Compiling TypeScript..."
    npm run compile
    if ($LASTEXITCODE -ne 0) {
        Write-Err "DASE build failed!"
        exit 1
    }
    
    Write-Success "  DASE built successfully"
}
finally {
    Pop-Location
}

# ============================================
# Step 4: Test DASE
# ============================================
if (-not $SkipTests) {
    Write-Info "[4/5] Testing DASE..."
    
    Push-Location $DaseDir
    try {
        npm test
        if ($LASTEXITCODE -ne 0) {
            Write-Err "DASE tests failed!"
            exit 1
        }
        Write-Success "  DASE tests passed"
    }
    finally {
        Pop-Location
    }
} else {
    Write-Warn "[4/5] Skipping DASE tests"
}

# ============================================
# Step 5: Package VSIX
# ============================================
Write-Info "[5/5] Packaging VSIX..."

Push-Location $DaseDir
try {
    # Check if vsce is installed
    $VsceInstalled = Get-Command vsce -ErrorAction SilentlyContinue
    if (-not $VsceInstalled) {
        Write-Host "  Installing vsce..."
        npm install -g @vscode/vsce
    }
    
    # Remove old VSIX files
    Get-ChildItem "dase-*.vsix" -ErrorAction SilentlyContinue | Remove-Item -Force
    
    # Verify TFX is in node_modules before packaging
    $tfxCheck = Join-Path $DaseDir "node_modules\@tootega\tfx\dist\index.js"
    if (-not (Test-Path $tfxCheck)) {
        Write-Err "TFX not found in node_modules - cannot package!"
        exit 1
    }
    
    # Package (include dependencies)
    $VsixFile = "dase-$Version.vsix"
    $PackagingFailed = $false
    
    try {
        vsce package --out $VsixFile --allow-missing-repository --allow-star-activation
        
        if ($LASTEXITCODE -ne 0) {
            $PackagingFailed = $true
        }
    }
    finally {
        # Restore original file: reference in package.json (always, even on failure)
        $PackageJsonPath = Join-Path $DaseDir "package.json"
        $PackageJson = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
        $PackageJson.dependencies.'@tootega/tfx' = "file:../TFX"
        $PackageJson | ConvertTo-Json -Depth 10 | Set-Content $PackageJsonPath -Encoding UTF8
        Write-Host "  Restored @tootega/tfx dependency to file:../TFX"
    }
    
    if ($PackagingFailed) {
        Write-Err "Packaging failed!"
        exit 1
    }
    
    $VsixPath = Join-Path $DaseDir $VsixFile
    $VsixSize = [math]::Round((Get-Item $VsixPath).Length / 1KB, 2)
    
    Write-Success "  Package created: $VsixFile ($VsixSize KB)"
}
finally {
    Pop-Location
}

# ============================================
# Summary
# ============================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Version:  $Version" -ForegroundColor White
Write-Host "  Package:  DASE\$VsixFile" -ForegroundColor White
Write-Host "  Size:     $VsixSize KB" -ForegroundColor White
Write-Host ""
Write-Host "To install:" -ForegroundColor Cyan
Write-Host "  1. Open VS Code"
Write-Host "  2. Press Ctrl+Shift+P"
Write-Host "  3. Type 'Extensions: Install from VSIX...'"
Write-Host "  4. Select: DASE\$VsixFile"
Write-Host ""
