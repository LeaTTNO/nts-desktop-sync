$dayCounter = 0
$baseDate = [DateTime]::ParseExact("2026-03-05", "yyyy-MM-dd", $null)

$testCells = @("DG", "Arusha", "DTO", "", "DG", "Ndutu", "DTO", "")

foreach ($cellText in $testCells) {
  $cellText = $cellText.Trim()
  Write-Host "Cell: '$cellText'"
  if ($cellText -eq "DG") {
    $dayCounter++
    Write-Host "  -> Dag $dayCounter"
  } elseif ($cellText -eq "DTO") {
    $currentDate = $baseDate.AddDays($dayCounter - 1)
    $formatted = $currentDate.ToString("dd MMM", [System.Globalization.CultureInfo]::GetCultureInfo("nb-NO")).ToLower()
    Write-Host "  -> $formatted (dayCounter=$dayCounter)"
  }
}