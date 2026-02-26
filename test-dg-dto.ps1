# Deterministic DG/DTO test with explicit traversal order

$testDate = "2026-02-20"
$hasDate = $false

if ($testDate) {
  try {
    $baseDate = Get-Date $testDate
    $hasDate = $true
    Write-Host "[OK] Base date parsed: $baseDate"
  } catch {
    Write-Host "[ERROR] Failed to parse date: $testDate"
  }
}

# Simulated Z-order traversal (explicit order)
$testShapes = @(
  @{ Slide=1; Shape=1; Text="DG DTO" },
  @{ Slide=1; Shape=2; Text="Header" },
  @{ Slide=2; Shape=1; Text="DG DTO" },
  @{ Slide=2; Shape=2; Text="DG DTO" },
  @{ Slide=3; Shape=1; Text="DG" },
  @{ Slide=3; Shape=2; Text="Footer" },
  @{ Slide=4; Shape=1; Text="DG DTO DG DTO" }
)

Write-Host ""
Write-Host "[TEST] Deterministic traversal start"
Write-Host ""

$dayNr = 1

foreach ($entry in $testShapes) {

  $txt = $entry.Text
  $originalText = $txt

  Write-Host "Processing Slide $($entry.Slide), Shape $($entry.Shape)"
  Write-Host "  Original: $txt"

  # Process all DG/DTO pairs in same shape before moving on
  while ($txt.Contains("DG")) {

    $dgIndex = $txt.IndexOf("DG")
    if ($dgIndex -lt 0) { break }

    # Replace first DG
    $txt = $txt.Substring(0, $dgIndex) + ("Dag " + $dayNr) + $txt.Substring($dgIndex + 2)

    Write-Host "    DG -> Dag $dayNr"

    # Immediately pair DTO in same shape
    if ($txt.Contains("DTO")) {

      $dtoIndex = $txt.IndexOf("DTO")
      if ($dtoIndex -ge 0) {

        if ($hasDate) {
          $dateValue = $baseDate.AddDays($dayNr - 1)
          $formatted = $dateValue.ToString("dd MMM", [System.Globalization.CultureInfo]::GetCultureInfo("nb-NO")).ToLower()
          $txt = $txt.Substring(0, $dtoIndex) + $formatted + $txt.Substring($dtoIndex + 3)
          Write-Host "    DTO -> $formatted"
        }
        else {
          $txt = $txt.Substring(0, $dtoIndex) + $txt.Substring($dtoIndex + 3)
          Write-Host "    DTO cleared"
        }
      }
    }

    $dayNr++
  }

  Write-Host "  Result: $txt"
  Write-Host ""
}

Write-Host "[COMPLETE] Total days processed: $($dayNr - 1)"