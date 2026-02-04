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
    $true,   # ReadOnly
    $false,  # Untitled
    $true    # WithWindow
)

# --------------------------------------------------
# 📥 HENT MODULER – HELLIG METODE (VBA-ekvivalent)
# --------------------------------------------------

foreach ($modulePath in $ModulePaths) {

    if (-not (Test-Path $modulePath)) { continue }

    # 🔒 Sett inn moduler FØR de siste 2 slidene (bevarer layout)
    $modulePres = $ppApp.Presentations.Open(
        $modulePath,
        $true,
        $false,
        $false
    )

    # Beregn hvor vi skal sette inn (før de siste 2 slidene)
    $totalSlides = $presentation.Slides.Count
    $insertPosition = [Math]::Max(1, $totalSlides - 1)  # Før nest-siste slide

    # Kopier alle slides fra modulen
    foreach ($slide in $modulePres.Slides) {
        $slide.Copy()
        $presentation.Slides.Paste($insertPosition)
        $insertPosition++
    }

    $modulePres.Close()
}


# --------------------------------------------------
# ❗ IKKE lagre – brukeren lagrer selv
# --------------------------------------------------

Write-Host "PowerPoint ferdig bygget – layout bevart – ingen lagring utført"
