# !! VIKTIG: IKKE bruk emojis eller spesialtegn i denne filen !!
# Emojis forarsaket parsing-feil i PowerShell og gjor at PowerPoint ikke apner.
# Bruk kun vanlig ASCII-tekst i alle Write-Host og kommentarer.

param (
    [string]$BasePath,
    [string]$DepartureDate,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ModulePaths
)

# --------------------------------------------------
# === Start PowerPoint ===
# --------------------------------------------------

$ppApp = New-Object -ComObject PowerPoint.Application
$ppApp.Visible = $true

# --------------------------------------------------
# === APNE BASEFIL ===
# --------------------------------------------------

$presentation = $ppApp.Presentations.Open(
    $BasePath,
    $false,  # ReadOnly = false (needed for DG/DTO post-processing)
    $false,  # Untitled
    $true    # WithWindow
)

function Set-InsertedSlideLayouts {
    param (
        $SourcePresentation,
        $TargetPresentation,
        [string]$SourcePath,
        [int]$TargetStartIndex
    )

    $sourceDesign = $TargetPresentation.Designs.Load($SourcePath)

    for ($i = 1; $i -le $SourcePresentation.Slides.Count; $i++) {
        $sourceSlide = $SourcePresentation.Slides.Item($i)
        $targetSlide = $TargetPresentation.Slides.Item($TargetStartIndex + $i - 1)
        $sourceLayout = $sourceDesign.SlideMaster.CustomLayouts.Item($sourceSlide.CustomLayout.Index)

        $targetSlide.Design = $sourceDesign
        $targetSlide.CustomLayout = $sourceLayout
    }
}

# --------------------------------------------------
# === HENT MODULER - HELLIG METODE (VBA-ekvivalent) ===
# --------------------------------------------------

# STEG 1: Finn flyinformasjon-modulen (settes inn SIST, men fortsatt før siste basefil-slide)
$flightModulePath = $null
foreach ($modulePath in $ModulePaths) {
    if ($modulePath -match 'flyinformasjon' -or $modulePath -match 'flyinformation' -or $modulePath -match 'flight') {
        $flightModulePath = $modulePath
        break
    }
}

# STEG 2: Sett inn alle ANDRE moduler FØR de 2 siste slidene i basefilen
# Dette er Safari, Zanzibar, osv. - de kommer FORST
# Paste(N) setter inn PAA posisjon N (ikke etter), saa bruk Slides.Count - 1 for aa havne foer de 2 siste
$moduleInsertStart = $presentation.Slides.Count - 1
$currentInsertPos = $moduleInsertStart

foreach ($modulePath in $ModulePaths) {

    if (-not (Test-Path $modulePath)) { continue }
    
    # Hopp over flyinformasjon (settes inn ETTER alle andre)
    $isFlight = ($modulePath -match 'flyinformasjon' -or $modulePath -match 'flyinformation' -or $modulePath -match 'flight')
    if ($isFlight) { continue }

    # Keep the source presentation open while restoring each inserted slide's layout.
    $tmpPres = $ppApp.Presentations.Open($modulePath, $true, $false, $false)
    try {
        $moduleSlideCount = $tmpPres.Slides.Count
        $presentation.Slides.InsertFromFile($modulePath, $currentInsertPos - 1, 1, $moduleSlideCount)
        Set-InsertedSlideLayouts $tmpPres $presentation $modulePath $currentInsertPos
    } finally {
        $tmpPres.Close()
    }

    $currentInsertPos += $moduleSlideCount
}

# STEG 3: NÅ sett inn Flyinformasjon FØR siste slide (nest sist)
if ($flightModulePath -and (Test-Path $flightModulePath)) {
    Write-Host "Setter inn Flyinformasjon FOR siste basefil-slide..."
    
    # NEST SIST: Flyinformasjon skal ALLTID vaere nest siste slide (N-1 av N)
    # InsertFromFile($path, afterIndex, ...) setter inn ETTER afterIndex
    # Saa afterIndex = totalSlides - 1 gir fly paa posisjon totalSlides, og siste slide skyves til totalSlides+1
    $totalSlides = $presentation.Slides.Count
    $insertPos = [Math]::Max(1, $totalSlides)
    Write-Host "Setter inn flyinformasjon paa posisjon: $insertPos (av $totalSlides slides totalt)"
    
    # Keep the source presentation open while restoring each inserted slide's layout.
    $tmpFlight = $ppApp.Presentations.Open($flightModulePath, $true, $false, $false)
    try {
        $flightSlideCount = $tmpFlight.Slides.Count
        $presentation.Slides.InsertFromFile($flightModulePath, $insertPos - 1, 1, $flightSlideCount)
        Set-InsertedSlideLayouts $tmpFlight $presentation $flightModulePath $insertPos
    } finally {
        $tmpFlight.Close()
    }

    Write-Host "Flyinformasjon lagt til paa posisjon $insertPos - siste slide er naa posisjon $($presentation.Slides.Count)"
}

# --------------------------------------------------
# Sett UserControl slik at PowerPoint IKKE lukker seg naar scriptet avsluttes
# --------------------------------------------------

$ppApp.UserControl = $true

Write-Host "PowerPoint ferdig bygget - layout bevart - ingen lagring utfort"
Write-Host "Slides totalt: $($presentation.Slides.Count)"
