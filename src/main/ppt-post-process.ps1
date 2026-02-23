# =====================================================
# PowerPoint Post-Processing Script
# VERSION: 2.4 - Enhanced logging for DG/DTO sorting debug
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

Write-Output "=============================================="
Write-Output "ppt-post-process.ps1 VERSION 2.4"
Write-Output "Enhanced logging for DG/DTO sorting debug"
Write-Output "=============================================="

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

Write-Output "Connecting to PowerPoint..."
Write-Output "Looking for presentation: $PresentationPath"

try {
    $ppApp = [System.Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
    Write-Output "Connected to PowerPoint. Open presentations: $($ppApp.Presentations.Count)"
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
    Write-Output "Open presentation: $($p.FullName)"
    if ($p.FullName -eq $PresentationPath) {
        $presentation = $p
        Write-Output "MATCH FOUND!"
        break
    }
}

if (-not $presentation) {
    Write-Output "Presentation not found in open windows. Trying to open..."
    try {
        $presentation = $ppApp.Presentations.Open($PresentationPath, $false, $false, $true)
        Write-Output "Presentation opened successfully"
    } catch {
        Write-Error "Failed to open presentation: $_"
        exit 1
    }
}

if (-not $presentation) {
    Write-Error "Could not open presentation: $PresentationPath"
    exit 1
}

Write-Output "Working with presentation: $($presentation.FullName)"
Write-Output "Total slides: $($presentation.Slides.Count)"

# =====================================================
# 1. DG/DTO REPLACEMENT (ARRAY-PAIRING - VBA PORT)
# =====================================================

Write-Output "Processing DG/DTO replacements (array-pairing algorithm)..."
Write-Output "DepartureDate parameter received: '$DepartureDate'"

$baseDate = $null
$hasDate = $false

if ($DepartureDate -and $DepartureDate.Trim() -ne '') {
    $cleanDate = $DepartureDate.Trim()
    try {
        $baseDate = [DateTime]::ParseExact($cleanDate, "yyyy-MM-dd", [System.Globalization.CultureInfo]::InvariantCulture)
        $hasDate = $true
        Write-Output "SUCCESS: Parsed departure date: $baseDate"
    } catch {
        try {
            $baseDate = [DateTime]::Parse($cleanDate, [System.Globalization.CultureInfo]::InvariantCulture)
            $hasDate = $true
            Write-Output "SUCCESS (fallback): Parsed departure date: $baseDate"
        } catch {
            Write-Warning "All date parsing failed for: '$cleanDate'"
        }
    }
} else {
    Write-Output "No departure date provided - DTO will be removed"
}

# STEP 1: COLLECT all DG and DTO shapes (like VBA Collections)
$dgShapes = @()
$dtoShapes = @()

Write-Output "STEP 1: Collecting all DG and DTO shapes..."

foreach ($slide in $presentation.Slides) {
    Write-Output "  Scanning slide $($slide.SlideIndex)..."
    
    foreach ($shape in $slide.Shapes) {
        # Check text frames
        if ($shape.HasTextFrame -and $shape.TextFrame.HasText) {
            $txt = $shape.TextFrame.TextRange.Text
            if ($txt -like "*DG*") { 
                $dgShapes += @{Shape = $shape; Top = $shape.Top; Left = $shape.Left; Slide = $slide.SlideIndex; Text = $txt}
                Write-Output "    Found DG in shape (Slide $($slide.SlideIndex), Top=$([int]$shape.Top))"
            }
            if ($txt -like "*DTO*") { 
                $dtoShapes += @{Shape = $shape; Top = $shape.Top; Left = $shape.Left; Slide = $slide.SlideIndex; Text = $txt}
                Write-Output "    Found DTO in shape (Slide $($slide.SlideIndex), Top=$([int]$shape.Top))"
            }
        }
        
        # Check groups (like VBA GroupItems)
        if ($shape.Type -eq 6) { # msoGroup
            foreach ($item in $shape.GroupItems) {
                if ($item.HasTextFrame -and $item.TextFrame.HasText) {
                    $txt = $item.TextFrame.TextRange.Text
                    if ($txt -like "*DG*") { 
                        $dgShapes += @{Shape = $item; Top = $item.Top; Left = $item.Left; Slide = $slide.SlideIndex; Text = $txt}
                        Write-Output "    Found DG in group item (Slide $($slide.SlideIndex), Top=$([int]$item.Top))"
                    }
                    if ($txt -like "*DTO*") { 
                        $dtoShapes += @{Shape = $item; Top = $item.Top; Left = $item.Left; Slide = $slide.SlideIndex; Text = $txt}
                        Write-Output "    Found DTO in group item (Slide $($slide.SlideIndex), Top=$([int]$item.Top))"
                    }
                }
            }
        }
        
        # Check tables (like VBA table cells)
        if ($shape.HasTable) {
            $tbl = $shape.Table
            for ($r = 1; $r -le $tbl.Rows.Count; $r++) {
                for ($c = 1; $c -le $tbl.Columns.Count; $c++) {
                    $cell = $tbl.Cell($r, $c).Shape
                    if ($cell.HasTextFrame -and $cell.TextFrame.HasText) {
                        $txt = $cell.TextFrame.TextRange.Text
                        if ($txt -like "*DG*") { 
                            $dgShapes += @{Shape = $cell; Top = $cell.Top; Left = $cell.Left; Slide = $slide.SlideIndex; Text = $txt}
                            Write-Output "    Found DG in table R${r}C${c} (Slide $($slide.SlideIndex), Top=$([int]$cell.Top))"
                        }
                        if ($txt -like "*DTO*") { 
                            $dtoShapes += @{Shape = $cell; Top = $cell.Top; Left = $cell.Left; Slide = $slide.SlideIndex; Text = $txt}
                            Write-Output "    Found DTO in table R${r}C${c} (Slide $($slide.SlideIndex), Top=$([int]$cell.Top))"
                        }
                    }
                }
            }
        }
    }
}

Write-Output "STEP 2: Sorting by visual position (Slide, Top, Left)..."
Write-Output "  Found $($dgShapes.Count) DG shapes and $($dtoShapes.Count) DTO shapes"

# LOG BEFORE SORTING
Write-Output "  BEFORE SORTING:"
for ($i = 0; $i -lt $dgShapes.Count; $i++) {
    Write-Output "    DG[$i]: Slide=$($dgShapes[$i].Slide) Top=$([int]$dgShapes[$i].Top) Left=$([int]$dgShapes[$i].Left) Text='$($dgShapes[$i].Text.Trim())'"
}
for ($i = 0; $i -lt $dtoShapes.Count; $i++) {
    Write-Output "    DTO[$i]: Slide=$($dtoShapes[$i].Slide) Top=$([int]$dtoShapes[$i].Top) Left=$([int]$dtoShapes[$i].Left) Text='$($dtoShapes[$i].Text.Trim())'"
}

# STEP 2: SORT by visual position - CRITICAL for chronological order!
$dgShapes = $dgShapes | Sort-Object { $_.Slide }, { $_.Top }, { $_.Left }
$dtoShapes = $dtoShapes | Sort-Object { $_.Slide }, { $_.Top }, { $_.Left }

# LOG AFTER SORTING
Write-Output "  AFTER SORTING:"
for ($i = 0; $i -lt $dgShapes.Count; $i++) {
    Write-Output "    DG[$i]: Slide=$($dgShapes[$i].Slide) Top=$([int]$dgShapes[$i].Top) Left=$([int]$dgShapes[$i].Left) Text='$($dgShapes[$i].Text.Trim())'"
}
for ($i = 0; $i -lt $dtoShapes.Count; $i++) {
    Write-Output "    DTO[$i]: Slide=$($dtoShapes[$i].Slide) Top=$([int]$dtoShapes[$i].Top) Left=$([int]$dtoShapes[$i].Left) Text='$($dtoShapes[$i].Text.Trim())'"
}

# STEP 3: PAIR and replace (like VBA For i = 1 To Min(dgShapes.Count, dtoShapes.Count))
$pairCount = [Math]::Min($dgShapes.Count, $dtoShapes.Count)
$dagNr = 1

Write-Output "STEP 3: Processing $pairCount DG/DTO pairs..."

for ($i = 0; $i -lt $pairCount; $i++) {
    $dgObj = $dgShapes[$i]
    $dtoObj = $dtoShapes[$i]
    
    # Replace DG with "Dag X" (like VBA Replace function)
    if ($dgObj.Shape.HasTextFrame) {
        $dgObj.Shape.TextFrame.TextRange.Text = 
            $dgObj.Shape.TextFrame.TextRange.Text -replace "DG", ("Dag " + $dagNr)
        Write-Output "  [$i] DG (Slide $($dgObj.Slide), Top $([int]$dgObj.Top)) ? Dag $dagNr"
    }
    
    # Replace or remove DTO (like VBA conditional)
    if ($dtoObj.Shape.HasTextFrame) {
        if ($hasDate) {
            $currentDate = $baseDate.AddDays($dagNr - 1)
            $formatted = Format-NorwegianDate -Date $currentDate -Lang $Language
            $dtoObj.Shape.TextFrame.TextRange.Text = 
                $dtoObj.Shape.TextFrame.TextRange.Text -replace "DTO", $formatted
            Write-Output "  [$i] DTO (Slide $($dtoObj.Slide), Top $([int]$dtoObj.Top)) ? $formatted"
        } else {
            # NO DATE: Remove DTO completely
            $dtoObj.Shape.TextFrame.TextRange.Text = 
                $dtoObj.Shape.TextFrame.TextRange.Text -replace "DTO", ""
            Write-Output "  [$i] DTO (Slide $($dtoObj.Slide), Top $([int]$dtoObj.Top)) ? (removed)"
        }
    }
    
    $dagNr++
}

Write-Output "DG/DTO processing complete: $pairCount pairs processed"

# =====================================================
# 2. FLIGHT TABLE POPULATION (SEGMENTS-BASED)
# =====================================================

Write-Output "Processing flight information..."

$FlightDataJson = ""
if ($FlightDataPath -and (Test-Path $FlightDataPath)) {
    Write-Output "Reading flight data from: $FlightDataPath"
    $FlightDataJson = Get-Content $FlightDataPath -Raw
    Write-Output "Loaded flight JSON (length: $($FlightDataJson.Length) characters)"
} else {
    Write-Output "No flight data file: $FlightDataPath"
}

if ($FlightDataJson -and $FlightDataJson -ne "") {
    try {
        $flightData = $FlightDataJson | ConvertFrom-Json
        Write-Output "JSON parsed successfully"

        if ($flightData.flights -and $flightData.flights.Count -gt 0) {
            $flight = $flightData.flights[0]

            # Find slide with FLYINFORMATION placeholder
            $flightSlide = $null
            foreach ($slide in $presentation.Slides) {
                foreach ($shape in $slide.Shapes) {
                    if ($shape.HasTextFrame -and $shape.TextFrame.HasText) {
                        $text = $shape.TextFrame.TextRange.Text
                        if ($text -match "FLYINFORMATION" -or $text -match "Flyinformasjon" -or $text -match "FLYINFORMASJON") {
                            $flightSlide = $slide
                            break
                        }
                    }
                }
                if ($flightSlide) { break }
            }

            if ($flightSlide) {
                $flightTable = $null
                foreach ($shape in $flightSlide.Shapes) {
                    if ($shape.HasTable) { $flightTable = $shape.Table; break }
                }

                if ($flightTable -and $flight.segments -and $flight.segments.Count -gt 0) {
                    Write-Output "Populating flight table with $($flight.segments.Count) segments"

                    # Clear existing data rows (keep header row 1)
                    $currentRows = $flightTable.Rows.Count
                    for ($i = $currentRows; $i -gt 1; $i--) {
                        $flightTable.Rows.Item($i).Delete()
                    }

                    foreach ($segment in $flight.segments) {
                        $newRow = $flightTable.Rows.Add()
                        if ($flightTable.Columns.Count -ge 5) {
                            $newRow.Cells.Item(1).Shape.TextFrame.TextRange.Text = $segment.date
                            $newRow.Cells.Item(2).Shape.TextFrame.TextRange.Text = $segment.from
                            $newRow.Cells.Item(3).Shape.TextFrame.TextRange.Text = $segment.to
                            $newRow.Cells.Item(4).Shape.TextFrame.TextRange.Text = $segment.time
                            $newRow.Cells.Item(5).Shape.TextFrame.TextRange.Text = $segment.airline
                        }
                    }
                    Write-Output "Flight table populated"
                } else {
                    Write-Output "No flight table or segments found - skipping"
                }
            } else {
                Write-Output "No FLYINFORMATION slide found - skipping flight table"
            }
        } else {
            Write-Output "No flights in flight data"
        }
    } catch {
        Write-Warning "Flight data processing error: $_"
    }
} else {
    Write-Output "No flight data provided"
}

# =====================================================
# DONE
# =====================================================

Write-Output "Post-processing complete"

# Force a clean exit to ensure success is reported
try {
    # Give PowerPoint a moment to finalize any operations
    Start-Sleep -Milliseconds 500
    Write-Output "ԣ� Script completed successfully"
    exit 0
} catch {
    Write-Output "��ᴩ� Minor issue during cleanup but main work completed"
    exit 0
}
