param (
    [string]$BasePath,
    [string]$DepartureDate,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ModulePaths
)

# --------------------------------------------------
# 🧠 Start PowerPoint
# --------------------------------------------------

$ppApp = New-Object -ComObject PowerPoint.Application
$ppApp.Visible = $true

# --------------------------------------------------
# 📥 ÅPNE BASEFIL
# --------------------------------------------------

$presentation = $ppApp.Presentations.Open(
    $BasePath,
    $false,  # ReadOnly = false (needed for DG/DTO post-processing)
    $false,  # Untitled
    $true    # WithWindow
)

# --------------------------------------------------
# 📥 HENT MODULER – HELLIG METODE (VBA-ekvivalent)
# --------------------------------------------------

# STEG 1: Finn flyinformasjon-modulen og sett den inn FØRST på nest siste posisjon i BASEFILEN
$flightModulePath = $null
foreach ($modulePath in $ModulePaths) {
    if ($modulePath -match 'flyinformasjon' -or $modulePath -match 'flight') {
        $flightModulePath = $modulePath
        break
    }
}

if ($flightModulePath -and (Test-Path $flightModulePath)) {
    Write-Host "📍 Setter inn Flyinformasjon på nest siste posisjon i basefilen..."
    
    $modulePres = $ppApp.Presentations.Open(
        $flightModulePath,
        $true,
        $false,
        $false
    )
    
    # Sett inn på nest siste posisjon i BASEFILEN (før andre moduler legges til)
    $flightInsertPos = [Math]::Max(1, $presentation.Slides.Count - 1)
    $slideIndex = 0
    foreach ($slide in $modulePres.Slides) {
        $slide.Copy()
        $presentation.Slides.Paste($flightInsertPos + $slideIndex)
        $slideIndex++
    }
    
    $modulePres.Close()
    Write-Host "✅ Flyinformasjon lagt til på posisjon $flightInsertPos i basefilen"
}

# STEG 2: Sett inn alle ANDRE moduler FØR de siste 2 slidene (Flyinformasjon + siste slide)
# Start posisjonen beregnes FØR flyinformasjon ble lagt til
$moduleInsertStart = if ($flightModulePath) {
    # Hvis flyinformasjon finnes: sett inn FØR den (som nå er nest sist)
    [Math]::Max(1, $presentation.Slides.Count - 2)
} else {
    # Ingen flyinformasjon: sett inn FØR siste slide
    [Math]::Max(1, $presentation.Slides.Count - 1)
}

$currentInsertPos = $moduleInsertStart

foreach ($modulePath in $ModulePaths) {

    if (-not (Test-Path $modulePath)) { continue }
    
    # Hopp over flyinformasjon (allerede satt inn)
    $isFlight = ($modulePath -match 'flyinformasjon' -or $modulePath -match 'flight')
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
        $currentInsertPos++  # Øk posisjonen for neste slide
    }

    $modulePres.Close()
}


# --------------------------------------------------
# ❗ IKKE lagre – brukeren lagrer selv
# --------------------------------------------------

Write-Host "PowerPoint ferdig bygget – layout bevart – ingen lagring utført"
