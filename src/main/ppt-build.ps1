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
        # 🔒 Første modul = hovedpresentasjon
        $presentation = $ppApp.Presentations.Open(
            $modulePath,
            $true,   # ReadOnly
            $false,  # Untitled
            $true    # WithWindow
        )
        $firstModuleOpened = $true
    }
    else {
        # 🔒 Alle andre moduler kopieres inn
        $modulePres = $ppApp.Presentations.Open(
            $modulePath,
            $true,
            $false,
            $false
        )

        $modulePres.Slides.Range().Copy()
        $presentation.Slides.Paste()

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
