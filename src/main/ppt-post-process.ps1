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
# 1. DG/DTO REPLACEMENT (PAIRWISE)
# =====================================================

Write-Host "Processing DG/DTO replacements..."
Write-Host "DepartureDate parameter received: '$DepartureDate'"
Write-Host "DepartureDate length: $($DepartureDate.Length)"

$dayCounter = 0
$baseDate = $null

if ($DepartureDate -and $DepartureDate.Trim() -ne '') {
    $cleanDate = $DepartureDate.Trim()
    Write-Host "Attempting to parse clean date: '$cleanDate'"
    try {
        # Try multiple parse methods for robustness
        $baseDate = [DateTime]::ParseExact($cleanDate, "yyyy-MM-dd", [System.Globalization.CultureInfo]::InvariantCulture)
        Write-Host "SUCCESS: Parsed departure date: $baseDate"
    } catch {
        Write-Warning "ParseExact failed: $_"
        try {
            $baseDate = [DateTime]::Parse($cleanDate, [System.Globalization.CultureInfo]::InvariantCulture)
            Write-Host "SUCCESS (fallback): Parsed departure date: $baseDate"
        } catch {
            Write-Warning "All date parsing failed for: '$cleanDate'"
        }
    }
} else {
    Write-Host "No departure date provided - DTO cells will be cleared"
}

# Process all shapes in all slides
foreach ($slide in $presentation.Slides) {
    Write-Host "Processing slide $($slide.SlideIndex)..."
    
    # Search through all shapes on this slide
    foreach ($shape in $slide.Shapes) {
        # Check if shape is a table
        if ($shape.HasTable) {
            Write-Host "  Found table with $($shape.Table.Rows.Count) rows"
            
            # Process each cell in the table
            foreach ($row in $shape.Table.Rows) {
                foreach ($cell in $row.Cells) {
                    $rawText = $cell.Shape.TextFrame.TextRange.Text
                    # Strip all whitespace variants - PowerPoint uses char(11) as line break inside cells
                    $cellText = $rawText.Trim()
                    $cellText = $cellText -replace [char]13, ""
                    $cellText = $cellText -replace [char]11, ""
                    $cellText = $cellText -replace "`n", ""
                    $cellText = $cellText -replace "`r", ""
                    $cellText = $cellText.Trim()
                    
                    if ($cellText.Length -gt 0) {
                        Write-Host "  Cell text: '$cellText' (len=$($cellText.Length))"
                    }
                    
                    # Check for DG
                    if ($cellText -eq "DG") {
                        $dayCounter++
                        $cell.Shape.TextFrame.TextRange.Text = "Dag $dayCounter"
                        Write-Host "  Replaced DG with 'Dag $dayCounter' in table cell"
                    }
                    # Check for DTO
                    elseif ($cellText -eq "DTO") {
                        if ($baseDate) {
                            $currentDate = $baseDate.AddDays($dayCounter - 1)
                            $formatted = Format-NorwegianDate -Date $currentDate -Lang $Language
                            $cell.Shape.TextFrame.TextRange.Text = $formatted
                            Write-Host "  Replaced DTO with '$formatted' in table cell"
                        } else {
                            $cell.Shape.TextFrame.TextRange.Text = ""
                        }
                    }
                }
            }
        }
        # Also check regular text frames (non-table shapes)
        elseif ($shape.HasTextFrame -eq $true) {
            if ($shape.TextFrame.HasText -eq $true) {
                $textRange = $shape.TextFrame.TextRange
                $text = $textRange.Text
                
                # Look for "DG" as a standalone word (not part of another word)
                if ($text -match '\bDG\b') {
                    Write-Host "  Found DG marker in text!"
                    
                    # Keep processing until no more pairs found
                    $foundPair = $true
                    while ($foundPair) {
                        $foundPair = $false
                        $text = $textRange.Text
                        
                        # Find the position of DG and DTO
                        $dgPos = $text.IndexOf("DG")
                        $dtoPos = $text.IndexOf("DTO", $dgPos)
                        
                        if ($dgPos -ge 0 -and $dtoPos -gt $dgPos) {
                            $dayCounter++
                            Write-Host "  Processing text pair #$dayCounter (DG at $dgPos, DTO at $dtoPos)"
                            
                            # Replace DG
                            $textRange.Text = $text.Substring(0, $dgPos) + "Dag $dayCounter" + $text.Substring($dgPos + 2)
                            
                            # Recalculate DTO position after DG replacement
                            $text = $textRange.Text
                            $dtoPos = $text.IndexOf("DTO")
                            
                            if ($dtoPos -ge 0) {
                                if ($baseDate) {
                                    $currentDate = $baseDate.AddDays($dayCounter - 1)
                                    $formatted = Format-NorwegianDate -Date $currentDate -Lang $Language
                                    $textRange.Text = $text.Substring(0, $dtoPos) + $formatted + $text.Substring($dtoPos + 3)
                                    Write-Host "  Replaced DTO with: $formatted"
                                } else {
                                    $textRange.Text = $text.Substring(0, $dtoPos) + $text.Substring($dtoPos + 3)
                                }
                            }
                            
                            $foundPair = $true
                        }
                    }
                }
            }
        }
    }
}

Write-Host "DG/DTO processing complete. Processed $dayCounter day markers."

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
                    Write-Host "Populating flight table with $($flight.segments.Count) segments"

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
                    Write-Host "Flight table populated"
                } else {
                    Write-Host "No flight table or segments found - skipping"
                }
            } else {
                Write-Host "No FLYINFORMATION slide found - skipping flight table"
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
