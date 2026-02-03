param (
    [string]$DepartureDate,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ModulePaths
)

# --------------------------------------------------
# 🧠 Start PowerPoint
# --------------------------------------------------

$ppApp = New-Object -ComObject PowerPoint.Application
$ppApp.Visible = $true

$presentation = $null
$firstModuleOpened = $false

# --------------------------------------------------
# 📥 HENT MODULER – HELLIG METODE (VBA-ekvivalent)
# --------------------------------------------------

foreach ($modulePath in $ModulePaths) {

    if (-not (Test-Path $modulePath)) { continue }

    if (-not $firstModuleOpened) {
        # 🔒 Første modul = hovedpresentasjon (basefil)
        $presentation = $ppApp.Presentations.Open(
            $modulePath,
            $true,   # ReadOnly
            $false,  # Untitled
            $true    # WithWindow
        )
        $firstModuleOpened = $true
    }
    else {
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
}

if (-not $presentation) {
    Write-Host "Ingen moduler åpnet – avslutter"
    exit
}


# --------------------------------------------------
# ❗ IKKE lagre – brukeren lagrer selv
# --------------------------------------------------

Write-Host "PowerPoint ferdig bygget – layout bevart – ingen lagring utført"
