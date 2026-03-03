# =====================================================
# Build Verification Script
# =====================================================
# Verifiserer at alle nødvendige filer er kopiert
# til dist/ og pakket ut korrekt i app.asar.unpacked/
# =====================================================

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  BUILD VERIFICATION" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$exitCode = 0

# =====================================================
# 1. Sjekk dist/main/ filer
# =====================================================

Write-Host "[1/3] Sjekker dist/main/ filer..." -ForegroundColor Yellow
Write-Host ""

$requiredFiles = @(
    "dist/main/electron-main.js",
    "dist/main/preload.js",
    "dist/main/ppt-dg-dto.js",
    "dist/main/ppt-build.ps1",
    "dist/main/ppt-post-process.ps1"
)

$distMainOk = $true
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $filename = Split-Path $file -Leaf
        Write-Host "  OK  $($filename.PadRight(25)) ($size bytes)" -ForegroundColor Green
    } else {
        $filename = Split-Path $file -Leaf
        Write-Host "  MANGLER  $filename" -ForegroundColor Red
        $distMainOk = $false
        $exitCode = 1
    }
}

Write-Host ""

if ($distMainOk) {
    Write-Host "[OK] Alle filer i dist/main/" -ForegroundColor Green
} else {
    Write-Host "[FEIL] Noen filer mangler i dist/main/" -ForegroundColor Red
}

Write-Host ""

# =====================================================
# 2. Sjekk dist/renderer/ (Vite output)
# =====================================================

Write-Host "[2/3] Sjekker dist/renderer/..." -ForegroundColor Yellow
Write-Host ""

if (Test-Path "dist/renderer/index.html") {
    Write-Host "  OK  index.html" -ForegroundColor Green
} else {
    Write-Host "  MANGLER  index.html" -ForegroundColor Red
    $exitCode = 1
}

$assetsCount = (Get-ChildItem -Path "dist/renderer/assets" -File -ErrorAction SilentlyContinue).Count
if ($assetsCount -gt 0) {
    Write-Host "  OK  assets/ ($assetsCount filer)" -ForegroundColor Green
} else {
    Write-Host "  ADVARSEL  assets/ er tom eller mangler" -ForegroundColor Yellow
}

Write-Host ""

# =====================================================
# 3. Sjekk app.asar.unpacked/ (hvis production build)
# =====================================================

Write-Host "[3/3] Sjekker app.asar.unpacked/ (production)..." -ForegroundColor Yellow
Write-Host ""

$unpackedPath = "dist/win-unpacked/resources/app.asar.unpacked/dist/main"

if (Test-Path $unpackedPath) {
    $unpackedOk = $true
    foreach ($file in $requiredFiles) {
        $filename = Split-Path $file -Leaf
        $unpackedFile = Join-Path $unpackedPath $filename
        
        if (Test-Path $unpackedFile) {
            $size = (Get-Item $unpackedFile).Length
            Write-Host "  OK  $($filename.PadRight(25)) ($size bytes)" -ForegroundColor Green
        } else {
            Write-Host "  MANGLER  $filename" -ForegroundColor Red
            $unpackedOk = $false
            $exitCode = 1
        }
    }
    
    Write-Host ""
    
    if ($unpackedOk) {
        Write-Host "[OK] Alle filer pakket ut korrekt" -ForegroundColor Green
    } else {
        Write-Host "[FEIL] Noen filer mangler i app.asar.unpacked/" -ForegroundColor Red
        Write-Host "       Sjekk asarUnpack-konfigurasjon i electron-builder.yml" -ForegroundColor Yellow
    }
} else {
    Write-Host "  IKKE FUNNET  Production build er ikke bygget ennå" -ForegroundColor Cyan
    Write-Host "                Kjør 'npm run build' for å bygge production" -ForegroundColor Gray
}

Write-Host ""

# =====================================================
# Oppsummering
# =====================================================

Write-Host "================================" -ForegroundColor Cyan

if ($exitCode -eq 0) {
    Write-Host "  BUILD VERIFICATION OK!" -ForegroundColor Green
} else {
    Write-Host "  BUILD VERIFICATION FEILET" -ForegroundColor Red
}

Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

exit $exitCode
