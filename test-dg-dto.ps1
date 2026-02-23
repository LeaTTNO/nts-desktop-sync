# Test DG/DTO replacement logic - VBA-compliant deterministic traversal
# This script tests the corrected DG/DTO algorithm

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

# Simulate slide structure with shapes containing DG/DTO in traversal order
$testShapes = @(
  "DG DTO",           # Slide 1, Shape 1
  "Header",           # Slide 1, Shape 2
  "DG DTO",           # Slide 2, Table Cell [1,1]
  "DG DTO",           # Slide 2, Table Cell [1,2]
  "DG",               # Slide 3, Shape 1 (no DTO)
  "Footer",           # Slide 3, Shape 2
  "DG DTO DG DTO"     # Slide 4, multiple pairs in same shape
)

Write-Host "[TEST] Testing deterministic traversal with $($testShapes.Count) shapes"
Write-Host ""

$dayNr = 1

foreach ($shapeText in $testShapes) {
  $txt = $shapeText
  $originalText = $txt
  $foundDG = $false
  
  # Process ALL DG/DTO pairs in this shape before moving to next shape
  while ($txt -like "*DG*") {
    $foundDG = $true
    
    # Replace first DG
    $idx = $txt.IndexOf("DG")
    if ($idx -ge 0) {
      $txt = $txt.Substring(0, $idx) + ("Dag " + $dayNr) + $txt.Substring($idx + 2)
      Write-Host "  [OK] DG replaced: 'DG' -> 'Dag $dayNr'"
    }
    
    # Handle DTO in SAME shape
    if ($txt -like "*DTO*") {
      $dtoIdx = $txt.IndexOf("DTO")
      if ($dtoIdx -ge 0) {
        if ($hasDate) {
          $d = $baseDate.AddDays($dayNr - 1)
          $val = $d.ToString("dd MMM", [System.Globalization.CultureInfo]::GetCultureInfo("nb-NO")).ToLower()
          $txt = $txt.Substring(0, $dtoIdx) + $val + $txt.Substring($dtoIdx + 3)
          Write-Host "  [OK] DTO replaced: 'DTO' -> '$val'"
        } else {
          $txt = $txt.Substring(0, $dtoIdx) + $txt.Substring($dtoIdx + 3)
          Write-Host "  [WARN] DTO cleared (no date)"
        }
      }
    }
    
    $dayNr++
  }
  
  if ($foundDG) {
    Write-Host "Shape: '$originalText' -> '$txt'"
    Write-Host ""
  }
}

Write-Host "[COMPLETE] DG/DTO test completed! Total days processed: $($dayNr - 1)"
