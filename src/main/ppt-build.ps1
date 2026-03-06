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

# STEG 2: Sett inn alle ANDRE moduler FOR siste slide i basefilen
# Dette er Safari, Zanzibar, osv. - de kommer FORST
# Bruk slides.Count som startposisjon slik at de skyves INN FORAN siste basefil-slide
$moduleInsertStart = $presentation.Slides.Count
$currentInsertPos = $moduleInsertStart

foreach ($modulePath in $ModulePaths) {

    if (-not (Test-Path $modulePath)) { continue }
    
    # Hopp over flyinformasjon (settes inn ETTER alle andre)
    $isFlight = ($modulePath -match 'flyinformasjon' -or $modulePath -match 'flyinformation' -or $modulePath -match 'flight')
    if ($isFlight) { continue }

    $modulePres = $ppApp.Presentations.Open(
        $modulePath,
        $true,
        $false,
        $false
    )

    # Sett inn slides sekvensielt fra $currentInsertPos
    foreach ($slide in $modulePres.Slides) {
        $slide.Copy()
        $presentation.Slides.Paste($currentInsertPos)
        $currentInsertPos++
    }

    $modulePres.Close()
}

# STEG 3: NÅ sett inn Flyinformasjon FØR siste slide (nest sist)
if ($flightModulePath -and (Test-Path $flightModulePath)) {
    Write-Host "Setter inn Flyinformasjon FOR siste basefil-slide..."
    
    $modulePres = $ppApp.Presentations.Open(
        $flightModulePath,
        $true,
        $false,
        $false
    )
    
    # KORREKT METODE: Sett inn på nest siste posisjon direkte
    $totalSlides = $presentation.Slides.Count
    $insertPos = [Math]::Max(1, $totalSlides)  # Insert BEFORE siste slide
    Write-Host "Setter inn flyinformasjon på posisjon: $insertPos (av $totalSlides slides totalt)"
    
    # Sett inn flyinformasjon slides på nest siste posisjon
    $slideOffset = 0
    foreach ($slide in $modulePres.Slides) {
        $slide.Copy()
        $presentation.Slides.Paste($insertPos + $slideOffset)
        $slideOffset++
    }
    
    $modulePres.Close()
    Write-Host "Flyinformasjon lagt til på posisjon $insertPos - siste slide er nå posisjon $($presentation.Slides.Count)"
}

# --------------------------------------------------
# IKKE lagre – brukeren lagrer selv
# --------------------------------------------------

Write-Host "PowerPoint ferdig bygget – layout bevart – ingen lagring utfort"
