// src/main/ppt-dg-dto.js
// --------------------------------------------------
// DG / DTO – PARVIS ERSTATNING (VBA-LOGIKK)
// KJØRES KUN VIA POWERPOINT COM
// --------------------------------------------------

import { execSync } from "child_process";

/**
 * Kjører DG/DTO-erstatning i åpen PowerPoint
 * 1 DG + 1 DTO per dag (parvis)
 * Ingen lagring
 */
export function replaceDgDtoPairwise(departureDate) {
  const dateArg = departureDate ? `"${departureDate}"` : "";

  const psScript = `
$pp = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$pres = $pp.ActivePresentation

$dgShapes = @()
$dtoShapes = @()

foreach ($slide in $pres.Slides) {
  foreach ($shape in $slide.Shapes) {

    if ($shape.HasTextFrame -and $shape.TextFrame.HasText) {
      $txt = $shape.TextFrame.TextRange.Text
      if ($txt -like "*DG*")  { $dgShapes += $shape }
      if ($txt -like "*DTO*") { $dtoShapes += $shape }
    }

    if ($shape.Type -eq 6) {
      foreach ($item in $shape.GroupItems) {
        if ($item.HasTextFrame -and $item.TextFrame.HasText) {
          $txt = $item.TextFrame.TextRange.Text
          if ($txt -like "*DG*")  { $dgShapes += $item }
          if ($txt -like "*DTO*") { $dtoShapes += $item }
        }
      }
    }

    if ($shape.HasTable) {
      $tbl = $shape.Table
      for ($r = 1; $r -le $tbl.Rows.Count; $r++) {
        for ($c = 1; $c -le $tbl.Columns.Count; $c++) {
          $cell = $tbl.Cell($r, $c).Shape
          if ($cell.HasTextFrame -and $cell.TextFrame.HasText) {
            $txt = $cell.TextFrame.TextRange.Text
            if ($txt -like "*DG*")  { $dgShapes += $cell }
            if ($txt -like "*DTO*") { $dtoShapes += $cell }
          }
        }
      }
    }
  }
}

$hasDate = $false
if (${dateArg}) {
  try {
    $baseDate = Get-Date ${dateArg}
    $hasDate = $true
  } catch {}
}

$pairCount = [Math]::Min($dgShapes.Count, $dtoShapes.Count)
$day = 1

for ($i = 0; $i -lt $pairCount; $i++) {

  $dg = $dgShapes[$i]
  $dto = $dtoShapes[$i]

  if ($dg.HasTextFrame) {
    $dg.TextFrame.TextRange.Text =
      $dg.TextFrame.TextRange.Text -replace "DG", ("Dag " + $day)
  }

  if ($dto.HasTextFrame) {
    if ($hasDate) {
      $d = $baseDate.AddDays($day - 1)
      $val = $d.ToString("dd MMM", [System.Globalization.CultureInfo]::GetCultureInfo("nb-NO")).ToLower()
      $dto.TextFrame.TextRange.Text =
        $dto.TextFrame.TextRange.Text -replace "DTO", $val
    } else {
      $dto.TextFrame.TextRange.Text =
        $dto.TextFrame.TextRange.Text -replace "DTO", ""
    }
  }

  $day++
}
`;

  execSync("powershell -NoProfile -ExecutionPolicy Bypass -Command " + JSON.stringify(psScript), {
    stdio: "ignore",
  });
}

/**
 * Setter inn flyinformasjon i tabell på Flyinformation-slide
 * Bruker placeholder-basert system: {{TYPE}}, {{RUTE}}, etc.
 */
export function insertFlightInformation(pres, flightData, language) {
  const flightDataJson = JSON.stringify(flightData).replace(/"/g, '`"').replace(/\n/g, ' ');
  const lang = language || 'no';

  const psScript = `
$pp = [Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
$pres = $pp.ActivePresentation
$flightData = '${flightDataJson}' | ConvertFrom-Json

# Finn slide med "Flyinformation" eller "Flyinformasjon"
$flightSlide = $null
foreach ($slide in $pres.Slides) {
  foreach ($shape in $slide.Shapes) {
    if ($shape.HasTextFrame -and $shape.TextFrame.HasText) {
      $txt = $shape.TextFrame.TextRange.Text
      if ($txt -like "*Flyinformation*" -or $txt -like "*Flyinformasjon*" -or $txt -like "*FLYINFORMATION*") {
        $flightSlide = $slide
        break
      }
    }
  }
  if ($flightSlide) { break }
}

if (-not $flightSlide) {
  Write-Host "Ingen Flyinformation-slide funnet"
  exit
}

# Finn tabell på slide
$table = $null
foreach ($shape in $flightSlide.Shapes) {
  if ($shape.HasTable) {
    $table = $shape.Table
    break
  }
}

if (-not $table) {
  Write-Host "Ingen tabell funnet på Flyinformation-slide"
  exit
}

# Finn template-rad (rad med {{TYPE}} eller lignende placeholder)
$templateRowIndex = -1
for ($r = 1; $r -le $table.Rows.Count; $r++) {
  $cellText = $table.Cell($r, 1).Shape.TextFrame.TextRange.Text
  if ($cellText -like "*{{*}}*" -or $cellText -like "*TYPE*" -and $cellText -like "*{{*") {
    $templateRowIndex = $r
    break
  }
}

if ($templateRowIndex -eq -1) {
  Write-Host "Ingen template-rad funnet (må inneholde {{TYPE}} eller lignende)"
  exit
}

# Bygg flydata-rader fra segmenter
$newRows = @()
foreach ($flight in $flightData.flights) {
  if ($flight.segments) {
    foreach ($segment in $flight.segments) {
      $segmentRow = @(
        $segment.date,
        $segment.from,
        $segment.to,
        $segment.time,
        $segment.airline
      )
      $newRows += ,@($segmentRow)
    }
  }
}

# Sett inn nye rader UNDER template-raden
$insertIndex = $templateRowIndex + 1
foreach ($rowData in $newRows) {
  $table.Rows.Add($insertIndex)
  for ($c = 1; $c -le $rowData.Count; $c++) {
    if ($c -le $table.Columns.Count) {
      $table.Cell($insertIndex, $c).Shape.TextFrame.TextRange.Text = $rowData[$c - 1]
    }
  }
  $insertIndex++
}

# Slett template-raden
$table.Rows.Item($templateRowIndex).Delete()

Write-Host "Flyinformasjon satt inn: $($newRows.Count) rader"
`;

  try {
    execSync("powershell -NoProfile -ExecutionPolicy Bypass -Command " + JSON.stringify(psScript), {
      stdio: "pipe",
    });
  } catch (err) {
    console.error("Flight information insert error:", err.message);
  }
}
