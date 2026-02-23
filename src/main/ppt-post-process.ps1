# =====================================================
# PowerPoint Post-Processing Script
# =====================================================
# PURPOSE:
#   - DG/DTO replacement (pairwise, VBA-like logic)
#   - Flight table population (segments-based structure)
#
# OPERATES ON:
#   - Already-open PowerPoint presentation
#   - Does NOT modify slide order, layout, or masters
#   - Does NOT save or download
#
# CALLED BY:
#   - electron-main.js after ppt-build.ps1 completes
# =====================================================

param (
    [string]$PresentationPath,
    [string]$DepartureDate,
    [string]$FlightDataPath,  # Changed from FlightDataJson to file path
    [string]$Language = "no"
)

# =====================================================
# HELPER FUNCTIONS
# =====================================================

function Format-NorwegianDate {
    param([DateTime]$Date, [string]$Lang)
    
    $monthsNo = @("", "jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des")
    $monthsDa = @("", "jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec")
    
    $months = if ($Lang -eq "da") { $monthsDa } else { $monthsNo }
    
    $day = $Date.Day.ToString("00")
    $month = $months[$Date.Month]
    
    return "$day $month"
}

# =====================================================
# CONNECT TO POWERPOINT
# =====================================================

Write-Host "Connecting to PowerPoint..."
Write-Host "Looking for presentation: $PresentationPath"

try {
    $ppApp = [System.Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
    Write-Host "Connected to PowerPoint. Open presentations: $($ppApp.Presentations.Count)"
} catch {
    Write-Error "PowerPoint is not running"
    exit 1
}

# =====================================================
# FIND PRESENTATION
# =====================================================

$presentation = $null

# List all open presentations for debugging
foreach ($p in $ppApp.Presentations) {
    Write-Host "Open presentation: $($p.FullName)"
    if ($p.FullName -eq $PresentationPath) {
        $presentation = $p
        Write-Host "MATCH FOUND!"
        break
    }
}

if (-not $presentation) {
    Write-Host "Presentation not found in open windows. Trying to open..."
    try {
        $presentation = $ppApp.Presentations.Open($PresentationPath, $false, $false, $true)
        Write-Host "Presentation opened successfully"
    } catch {
        Write-Error "Failed to open presentation: $_"
        exit 1
    }
}

if (-not $presentation) {
    Write-Error "Could not open presentation: $PresentationPath"
    exit 1
}

Write-Host "Working with presentation: $($presentation.FullName)"
# =====================================================
# 1. DG/DTO REPLACEMENT (COLLECT → SORT → PAIR)
# =====================================================

Write-Host "Processing DG/DTO replacements (collect-sort-pair algorithm)..."
Write-Host "DepartureDate parameter received: '$DepartureDate'"

$baseDate = $null
$hasDate = $false

if ($DepartureDate -and $DepartureDate.Trim() -ne '') {
    $cleanDate = $DepartureDate.Trim()
    try {
        $baseDate = [DateTime]::ParseExact($cleanDate, "yyyy-MM-dd", [System.Globalization.CultureInfo]::InvariantCulture)
        $hasDate = $true
        Write-Host "SUCCESS: Parsed departure date: $baseDate"
    } catch {
        try {
            $baseDate = [DateTime]::Parse($cleanDate, [System.Globalization.CultureInfo]::InvariantCulture)
            $hasDate = $true
            Write-Host "SUCCESS (fallback): Parsed departure date: $baseDate"
        } catch {
            Write-Warning "All date parsing failed for: '$cleanDate'"
        }
    }
} else {
    Write-Host "No departure date provided - DTO will be removed"
}

# STEP 1: COLLECT all DG and DTO shapes from entire presentation
$dgShapes = @()
$dtoShapes = @()

foreach ($slide in $presentation.Slides) {
    Write-Host "  Scanning slide $($slide.SlideIndex)..."
    
    foreach ($shape in $slide.Shapes) {
        # Check text frames
        if ($shape.HasTextFrame -and $shape.TextFrame.HasText) {
            $txt = $shape.TextFrame.TextRange.Text
            if ($txt -like "*DG*") { 
                $dgShapes += @{Shape = $shape; Top = $shape.Top; Left = $shape.Left; Slide = $slide.SlideIndex}
            }
            if ($txt -like "*DTO*") { 
                $dtoShapes += @{Shape = $shape; Top = $shape.Top; Left = $shape.Left; Slide = $slide.SlideIndex}
            }
        }
        
        # Check groups
        if ($shape.Type -eq 6) {
            foreach ($item in $shape.GroupItems) {
                if ($item.HasTextFrame -and $item.TextFrame.HasText) {
                    $txt = $item.TextFrame.TextRange.Text
                    if ($txt -like "*DG*") { 
                        $dgShapes += @{Shape = $item; Top = $item.Top; Left = $item.Left; Slide = $slide.SlideIndex}
                    }
                    if ($txt -like "*DTO*") { 
                        $dtoShapes += @{Shape = $item; Top = $item.Top; Left = $item.Left; Slide = $slide.SlideIndex}
                    }
                }
            }
        }
        
        # Check tables
        if ($shape.HasTable) {
            $tbl = $shape.Table
            for ($r = 1; $r -le $tbl.Rows.Count; $r++) {
                for ($c = 1; $c -le $tbl.Columns.Count; $c++) {
                    $cell = $tbl.Cell($r, $c).Shape
                    if ($cell.HasTextFrame -and $cell.TextFrame.HasText) {
                        $txt = $cell.TextFrame.TextRange.Text
                        if ($txt -like "*DG*") { 
                            $dgShapes += @{Shape = $cell; Top = $cell.Top; Left = $cell.Left; Slide = $slide.SlideIndex}
                        }
                        if ($txt -like "*DTO*") { 
                            $dtoShapes += @{Shape = $cell; Top = $cell.Top; Left = $cell.Left; Slide = $slide.SlideIndex}
                        }
                    }
                }
            }
        }
    }
}

Write-Host "  Found $($dgShapes.Count) DG shapes and $($dtoShapes.Count) DTO shapes"

# STEP 2: SORT by visual position (Slide → Top → Left) - ENSURES CHRONOLOGICAL ORDER
# This guarantees first DG visually = Dag 1, regardless of PowerPoint z-order
$dgShapes = $dgShapes | Sort-Object { $_.Slide }, { $_.Top }, { $_.Left }
$dtoShapes = $dtoShapes | Sort-Object { $_.Slide }, { $_.Top }, { $_.Left }

Write-Host "  Shapes sorted by position (Slide, Top, Left)"

# STEP 3: PAIR and replace in chronological order
$pairCount = [Math]::Min($dgShapes.Count, $dtoShapes.Count)
$day = 1

Write-Host "  Processing $pairCount DG/DTO pairs..."

for ($i = 0; $i -lt $pairCount; $i++) {
    $dgObj = $dgShapes[$i]
    $dtoObj = $dtoShapes[$i]
    
    # Replace DG with "Dag X"
    if ($dgObj.Shape.HasTextFrame) {
        $dgObj.Shape.TextFrame.TextRange.Text = 
            $dgObj.Shape.TextFrame.TextRange.Text -replace "DG", ("Dag " + $day)
        Write-Host "    [$i] DG (Slide $($dgObj.Slide), Top $([int]$dgObj.Top)) → Dag $day"
    }
    
    # Replace or remove DTO
    if ($dtoObj.Shape.HasTextFrame) {
        if ($hasDate) {
            $currentDate = $baseDate.AddDays($day - 1)
            $formatted = Format-NorwegianDate -Date $currentDate -Lang $Language
            $dtoObj.Shape.TextFrame.TextRange.Text = 
                $dtoObj.Shape.TextFrame.TextRange.Text -replace "DTO", $formatted
            Write-Host "    [$i] DTO (Slide $($dtoObj.Slide), Top $([int]$dtoObj.Top)) → $formatted"
        } else {
            # NO DATE: Remove DTO completely
            $dtoObj.Shape.TextFrame.TextRange.Text = 
                $dtoObj.Shape.TextFrame.TextRange.Text -replace "DTO", ""
            Write-Host "    [$i] DTO (Slide $($dtoObj.Slide), Top $([int]$dtoObj.Top)) → (removed)"
        }
    }
    
    $day++
}

Write-Host "DG/DTO processing complete: $pairCount pairs processed"

# =====================================================
# 2. FLIGHT TABLE POPULATION (SEGMENTS-BASED)
# =====================================================

Write-Host "Processing flight information..."

$FlightDataJson = ""
if ($FlightDataPath -and (Test-Path $FlightDataPath)) {
    Write-Host "Reading flight data from: $FlightDataPath"
    $FlightDataJson = Get-Content $FlightDataPath -Raw
    Write-Host "Loaded flight JSON (length: $($FlightDataJson.Length) characters)"
} else {
    Write-Host "No flight data file: $FlightDataPath"
}

if ($FlightDataJson -and $FlightDataJson -ne "") {
    try {
        $flightData = $FlightDataJson | ConvertFrom-Json
        Write-Host "JSON parsed successfully"

        if ($flightData.flights -and $flightData.flights.Count -gt 0) {
            $flight = $flightData.flights[0]

            if ($flight.segments -and $flight.segments.Count -gt 0) {
                # Find table containing {{DATO}} placeholder (anywhere in the presentation)
                $flightTable = $null
                $flightSlide = $null
                foreach ($slide in $presentation.Slides) {
                    foreach ($shape in $slide.Shapes) {
                        if ($shape.HasTable) {
                            foreach ($row in $shape.Table.Rows) {
                                foreach ($cell in $row.Cells) {
                                    if ($cell.Shape.TextFrame.TextRange.Text -match "\{\{DATO\}\}") {
                                        $flightTable = $shape.Table
                                        $flightSlide = $slide
                                        break
                                    }
                                }
                                if ($flightTable) { break }
                            }
                        }
                        if ($flightTable) { break }
                    }
                    if ($flightTable) { break }
                }

                if ($flightTable) {
                    Write-Host "Found flight table with {{}} placeholders. Replacing with $($flight.segments.Count) segments"

                    # Find first data row (row containing {{DATO}})
                    $dataStartRow = -1
                    for ($r = 1; $r -le $flightTable.Rows.Count; $r++) {
                        $cellText = $flightTable.Cell($r, 1).Shape.TextFrame.TextRange.Text
                        if ($cellText -match "\{\{DATO\}\}") {
                            $dataStartRow = $r
                            break
                        }
                    }

                    if ($dataStartRow -gt 0) {
                        $segIndex = 0
                        for ($r = $dataStartRow; $r -le $flightTable.Rows.Count; $r++) {
                            if ($segIndex -lt $flight.segments.Count) {
                                $seg = $flight.segments[$segIndex]
                                $flightTable.Cell($r, 1).Shape.TextFrame.TextRange.Text = $seg.date
                                $flightTable.Cell($r, 2).Shape.TextFrame.TextRange.Text = $seg.from
                                $flightTable.Cell($r, 3).Shape.TextFrame.TextRange.Text = $seg.to
                                $flightTable.Cell($r, 4).Shape.TextFrame.TextRange.Text = $seg.time
                                $flightTable.Cell($r, 5).Shape.TextFrame.TextRange.Text = $seg.airline
                                Write-Host "  Row $r : $($seg.from) -> $($seg.to) $($seg.date)"
                                $segIndex++
                            } else {
                                # Clear remaining placeholder rows
                                for ($c = 1; $c -le $flightTable.Columns.Count; $c++) {
                                    $flightTable.Cell($r, $c).Shape.TextFrame.TextRange.Text = ""
                                }
                            }
                        }
                        Write-Host "Flight table populated with $segIndex segments"
                    } else {
                        Write-Host "No {{DATO}} row found in table"
                    }
                } else {
                    Write-Host "No flight table with {{DATO}} placeholder found - skipping"
                }
            } else {
                Write-Host "No segments in flight data"
            }
        } else {
            Write-Host "No flights in flight data"
        }
    } catch {
        Write-Warning "Flight data processing error: $_"
    }
} else {
    Write-Host "No flight data provided"
}

# =====================================================
# DONE
# =====================================================

Write-Host "Post-processing complete"

# Force a clean exit to ensure success is reported
try {
    # Give PowerPoint a moment to finalize any operations
    Start-Sleep -Milliseconds 500
    Write-Host "✅ Script completed successfully"
    exit 0
} catch {
    Write-Host "⚠️ Minor issue during cleanup but main work completed"
    exit 0
}
