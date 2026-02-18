# Test DG/DTO replacement logic
# This script tests if the DG/DTO replacement would work in PowerPoint

$testDate = "2026-02-20"
$hasDate = $false

if ($testDate) {
  try {
    $baseDate = Get-Date $testDate
    $hasDate = $true
    Write-Host "✅ Base date parsed: $baseDate"
  } catch {
    Write-Host "❌ Failed to parse date: $testDate"
  }
}

# Simulate finding DG and DTO shapes
$dgShapes = @("DG 1", "DG 2", "DG 3")
$dtoShapes = @("DTO 1", "DTO 2", "DTO 3")

Write-Host "Found $($dgShapes.Count) DG shapes and $($dtoShapes.Count) DTO shapes"

$pairCount = [Math]::Min($dgShapes.Count, $dtoShapes.Count)
$day = 1

Write-Host "Will process $pairCount pairs"

for ($i = 0; $i -lt $pairCount; $i++) {
  $dg = $dgShapes[$i]
  $dto = $dtoShapes[$i]
  
  # Simulate DG replacement
  $newDg = $dg -replace "DG", ("Dag " + $day)
  Write-Host "DG replacement: '$dg' -> '$newDg'"
  
  # Simulate DTO replacement
  if ($hasDate) {
    $d = $baseDate.AddDays($day - 1)
    $val = $d.ToString("dd MMM", [System.Globalization.CultureInfo]::GetCultureInfo("nb-NO")).ToLower()
    $newDto = $dto -replace "DTO", $val
    Write-Host "DTO replacement: '$dto' -> '$newDto'"
  } else {
    $newDto = $dto -replace "DTO", ""
    Write-Host "DTO replacement (no date): '$dto' -> '$newDto'"
  }
  
  $day++
}

Write-Host "✅ DG/DTO test completed"