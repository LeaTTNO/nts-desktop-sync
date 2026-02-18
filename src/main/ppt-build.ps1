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

foreach ($modulePath in $ModulePaths) {

    if (-not (Test-Path $modulePath)) { continue }

    $modulePres = $ppApp.Presentations.Open(
        $modulePath,
        $true,
        $false,
        $false
    )

    # Er dette flyinformasjon-modulen? Sjekk filnavnet
    $isFlight = ($modulePath -match 'flyinformasjon' -or $modulePath -match 'flight')

    if ($isFlight) {
        # Flyinformasjon skal alltid ligge som nest siste side:
        # Beregn posisjon FØR første slide kopieres, og hold den fast
        $flightInsertPos = [Math]::Max(1, $presentation.Slides.Count - 1)
        $slideIndex = 0
        foreach ($slide in $modulePres.Slides) {
            $slide.Copy()
            $presentation.Slides.Paste($flightInsertPos + $slideIndex)
            $slideIndex++
        }
    } else {
        # Vanlige moduler: sett inn FØR de siste 2 slidene (nest siste posisjon på det tidspunktet)
        $insertPosition = [Math]::Max(1, $presentation.Slides.Count - 1)
        foreach ($slide in $modulePres.Slides) {
            $slide.Copy()
            $presentation.Slides.Paste($insertPosition)
            $insertPosition++
        }
    }

    $modulePres.Close()
}


# --------------------------------------------------
# ❗ IKKE lagre – brukeren lagrer selv
# --------------------------------------------------

Write-Host "PowerPoint ferdig bygget – layout bevart – ingen lagring utført"
