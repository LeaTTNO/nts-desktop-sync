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

    # Tell slides i modulen
    $tmpPres = $ppApp.Presentations.Open($modulePath, $true, $false, $false)
    $moduleSlideCount = $tmpPres.Slides.Count
    $tmpPres.Close()

    # InsertFromFile bevarer kildens design, layout og innhold fullstendig
    $presentation.Slides.InsertFromFile($modulePath, $currentInsertPos - 1, 1, $moduleSlideCount)
    $currentInsertPos += $moduleSlideCount
}

# STEG 3: NÅ sett inn Flyinformasjon FØR siste slide (nest sist)
if ($flightModulePath -and (Test-Path $flightModulePath)) {
    Write-Host "Setter inn Flyinformasjon FOR siste basefil-slide..."
    
    # KORREKT METODE: Sett inn foer de 2 siste slidene
    # Paste(N) setter inn PAA posisjon N (ikke etter), saa N-1 gir posisjon foer de 2 siste
    $totalSlides = $presentation.Slides.Count
    $insertPos = [Math]::Max(1, $totalSlides - 1)
    Write-Host "Setter inn flyinformasjon paa posisjon: $insertPos (av $totalSlides slides totalt)"
    
    # Tell slides i flyinformasjon-modulen
    $tmpFlight = $ppApp.Presentations.Open($flightModulePath, $true, $false, $false)
    $flightSlideCount = $tmpFlight.Slides.Count
    $tmpFlight.Close()

    # InsertFromFile bevarer kildens design, layout og innhold fullstendig
    $presentation.Slides.InsertFromFile($flightModulePath, $insertPos - 1, 1, $flightSlideCount)
    Write-Host "Flyinformasjon lagt til paa posisjon $insertPos - siste slide er naa posisjon $($presentation.Slides.Count)"
}

# --------------------------------------------------
# Sett UserControl slik at PowerPoint IKKE lukker seg naar scriptet avsluttes
# --------------------------------------------------

$ppApp.UserControl = $true

Write-Host "PowerPoint ferdig bygget - layout bevart - ingen lagring utfort"
Write-Host "Slides totalt: $($presentation.Slides.Count)"
