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
