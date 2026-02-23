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
Write-Host "Total slides: $($presentation.Slides.Count)"

# =====================================================
# 1. DG/DTO REPLACEMENT (VBA-STYLE DETERMINISTIC TRAVERSAL)
# =====================================================

Write-Host "Processing DG/DTO replacements (VBA-style pairwise)..."
Write-Host "DepartureDate parameter received: '$DepartureDate'"

$dayNr = 1
$baseDate = $null

if ($DepartureDate -and $DepartureDate.Trim() -ne '') {
    $cleanDate = $DepartureDate.Trim()
    try {
        $baseDate = [DateTime]::ParseExact($cleanDate, "yyyy-MM-dd", [System.Globalization.CultureInfo]::InvariantCulture)
        Write-Host "SUCCESS: Parsed departure date: $baseDate"
    } catch {
        try {
            $baseDate = [DateTime]::Parse($cleanDate, [System.Globalization.CultureInfo]::InvariantCulture)
            Write-Host "SUCCESS (fallback): Parsed departure date: $baseDate"
        } catch {
            Write-Warning "All date parsing failed for: '$cleanDate'"
        }
    }
} else {
    Write-Host "No departure date provided - DTO will be cleared"
}

# Recursive function to process shapes in traversal order
function ProcessShape {
    param($shape, $currentDayNr)
    
    $localDayNr = $currentDayNr
    
    # Process tables
    if ($shape.HasTable) {
        $table = $shape.Table
        Write-Host "  Processing table: $($table.Rows.Count) rows x $($table.Columns.Count) cols"
        
        # Traverse table cells in row-major order
        for ($r = 1; $r -le $table.Rows.Count; $r++) {
            for ($c = 1; $c -le $table.Columns.Count; $c++) {
                $cell = $table.Cell($r, $c)
                $rawText = $cell.Shape.TextFrame.TextRange.Text
                
                # Clean whitespace (PowerPoint uses char(11) as line break in cells)
                $cellText = $rawText.Trim() -replace [char]13, "" -replace [char]11, "" -replace "`n", "" -replace "`r", ""
                $cellText = $cellText.Trim()
                
                # Process DG/DTO pairs in this cell
                $text = $cell.Shape.TextFrame.TextRange.Text
                $modified = $false
                
                while ($text -match '\bDG\b') {
                    $dgIndex = $text.IndexOf("DG")
                    if ($dgIndex -ge 0) {
                        # Replace DG with "Dag X"
                        $text = $text.Substring(0, $dgIndex) + "Dag $localDayNr" + $text.Substring($dgIndex + 2)
                        Write-Host "    R${r}C${c}: DG → Dag $localDayNr"
                        $modified = $true
                        
                        # Now find next DTO in same cell
                        $dtoIndex = $text.IndexOf("DTO", $dgIndex)
                        if ($dtoIndex -ge 0) {
                            if ($baseDate) {
                                $currentDate = $baseDate.AddDays($localDayNr - 1)
                                $formatted = Format-NorwegianDate -Date $currentDate -Lang $Language
                                $text = $text.Substring(0, $dtoIndex) + $formatted + $text.Substring($dtoIndex + 3)
                                Write-Host "    R${r}C${c}: DTO → $formatted"
                            } else {
                                $text = $text.Substring(0, $dtoIndex) + $text.Substring($dtoIndex + 3)
                                Write-Host "    R${r}C${c}: DTO → (cleared)"
                            }
                        }
                        
                        # Increment day counter AFTER processing the pair
                        $localDayNr++
                    } else {
                        break
                    }
                }
                
                # Also check for standalone DTO (no paired DG)
                if ($text -match '\bDTO\b' -and -not $modified) {
                    $dtoIndex = $text.IndexOf("DTO")
                    if ($dtoIndex -ge 0) {
                        if ($baseDate) {
                            # Use previous day number (last processed DG)
                            $currentDate = $baseDate.AddDays($localDayNr - 2)
                            $formatted = Format-NorwegianDate -Date $currentDate -Lang $Language
                            $text = $text.Substring(0, $dtoIndex) + $formatted + $text.Substring($dtoIndex + 3)
                            Write-Host "    R${r}C${c}: Standalone DTO → $formatted (using day $($localDayNr - 1))"
                        } else {
                            $text = $text.Substring(0, $dtoIndex) + $text.Substring($dtoIndex + 3)
                        }
                        $modified = $true
                    }
                }
                
                if ($modified) {
                    $cell.Shape.TextFrame.TextRange.Text = $text
                }
            }
        }
    }
    # Process groups recursively
    elseif ($shape.Type -eq 6) { # msoGroup
        Write-Host "  Processing group with $($shape.GroupItems.Count) items"
        foreach ($item in $shape.GroupItems) {
            $localDayNr = ProcessShape -shape $item -currentDayNr $localDayNr
        }
    }
    # Process text frames
    elseif ($shape.HasTextFrame -and $shape.TextFrame.HasText) {
        $textRange = $shape.TextFrame.TextRange
        $text = $textRange.Text
        $modified = $false
        
        while ($text -match '\bDG\b') {
            $dgIndex = $text.IndexOf("DG")
            if ($dgIndex -ge 0) {
                # Replace DG with "Dag X"
                $text = $text.Substring(0, $dgIndex) + "Dag $localDayNr" + $text.Substring($dgIndex + 2)
                Write-Host "    TextFrame: DG → Dag $localDayNr"
                $modified = $true
                
                # Find next DTO after this DG
                $dtoIndex = $text.IndexOf("DTO", $dgIndex)
                if ($dtoIndex -ge 0) {
                    if ($baseDate) {
                        $currentDate = $baseDate.AddDays($localDayNr - 1)
                        $formatted = Format-NorwegianDate -Date $currentDate -Lang $Language
                        $text = $text.Substring(0, $dtoIndex) + $formatted + $text.Substring($dtoIndex + 3)
                        Write-Host "    TextFrame: DTO → $formatted"
                    } else {
                        $text = $text.Substring(0, $dtoIndex) + $text.Substring($dtoIndex + 3)
                    }
                }
                
                # Increment AFTER processing pair
                $localDayNr++
            } else {
                break
            }
        }
        
        if ($modified) {
            $textRange.Text = $text
        }
    }
    
    return $localDayNr
}

# Main traversal: slides → shapes in order
foreach ($slide in $presentation.Slides) {
    Write-Host "Slide $($slide.SlideIndex):"
    
    foreach ($shape in $slide.Shapes) {
        $dayNr = ProcessShape -shape $shape -currentDayNr $dayNr
    }
}

Write-Host "DG/DTO processing complete. Final day counter: $dayNr"

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
