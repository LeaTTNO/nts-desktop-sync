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
    [string]$FlightDataJson,
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
    
    $day = $Date.Day
    $month = $months[$Date.Month]
    
    return "$day $month"
}

# =====================================================
# CONNECT TO POWERPOINT
# =====================================================

try {
    $ppApp = [System.Runtime.InteropServices.Marshal]::GetActiveObject("PowerPoint.Application")
} catch {
    Write-Error "PowerPoint is not running"
    exit 1
}

# =====================================================
# OPEN PRESENTATION
# =====================================================

$presentation = $null
foreach ($p in $ppApp.Presentations) {
    if ($p.FullName -eq $PresentationPath) {
        $presentation = $p
        break
    }
}

if (-not $presentation) {
    # If not already open, open it
    $presentation = $ppApp.Presentations.Open($PresentationPath, [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
}

if (-not $presentation) {
    Write-Error "Could not open presentation: $PresentationPath"
    exit 1
}

# =====================================================
# 1. DG/DTO REPLACEMENT (PAIRWISE)
# =====================================================

Write-Host "Processing DG/DTO replacements..."

$dayCounter = 0
$baseDate = $null

if ($DepartureDate) {
    try {
        $baseDate = [DateTime]::ParseExact($DepartureDate, "yyyy-MM-dd", $null)
    } catch {
        Write-Warning "Invalid departure date format: $DepartureDate"
    }
}

foreach ($slide in $presentation.Slides) {
    $modified = $true
    
    while ($modified) {
        $modified = $false
        
        foreach ($shape in $slide.Shapes) {
            if ($shape.HasTextFrame -and $shape.TextFrame.HasText) {
                $textRange = $shape.TextFrame.TextRange
                $text = $textRange.Text
                
                # Find first "DG" followed by first "DTO"
                $dgIndex = $text.IndexOf("DG")
                $dtoIndex = $text.IndexOf("DTO")
                
                if ($dgIndex -ge 0 -and $dtoIndex -gt $dgIndex) {
                    $dayCounter++
                    
                    # Replace DG with "Dag X"
                    $dgRange = $textRange.Characters($dgIndex + 1, 2)
                    $dgRange.Text = "Dag $dayCounter"
                    
                    # Re-get text after modification
                    $text = $shape.TextFrame.TextRange.Text
                    
                    # Find DTO again (position changed)
                    $dtoIndex = $text.IndexOf("DTO")
                    
                    if ($dtoIndex -ge 0) {
                        $dtoRange = $textRange.Characters($dtoIndex + 1, 3)
                        
                        if ($baseDate) {
                            $currentDate = $baseDate.AddDays($dayCounter - 1)
                            $formatted = Format-NorwegianDate -Date $currentDate -Lang $Language
                            $dtoRange.Text = $formatted
                        } else {
                            $dtoRange.Text = ""
                        }
                    }
                    
                    $modified = $true
                    break
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

if ($FlightDataJson -and $FlightDataJson -ne "") {
    try {
        $flightData = $FlightDataJson | ConvertFrom-Json
        
        if ($flightData.flights -and $flightData.flights.Count -gt 0) {
            # Find slide with "FLYINFORMATION" placeholder
            $flightSlide = $null
            
            foreach ($slide in $presentation.Slides) {
                foreach ($shape in $slide.Shapes) {
                    if ($shape.HasTextFrame -and $shape.TextFrame.HasText) {
                        if ($shape.TextFrame.TextRange.Text -match "FLYINFORMATION") {
                            $flightSlide = $slide
                            break
                        }
                    }
                }
                if ($flightSlide) { break }
            }
            
            if ($flightSlide) {
                Write-Host "Found FLYINFORMATION slide"
                
                # Find table in the slide
                $flightTable = $null
                foreach ($shape in $flightSlide.Shapes) {
                    if ($shape.HasTable) {
                        $flightTable = $shape.Table
                        break
                    }
                }
                
                if ($flightTable) {
                    Write-Host "Found flight table"
                    
                    # Get first flight (we're using segments structure)
                    $flight = $flightData.flights[0]
                    
                    if ($flight.segments -and $flight.segments.Count -gt 0) {
                        # Clear existing data rows (keep header row)
                        $currentRows = $flightTable.Rows.Count
                        if ($currentRows -gt 1) {
                            for ($i = $currentRows; $i -gt 1; $i--) {
                                $flightTable.Rows.Item($i).Delete()
                            }
                        }
                        
                        # Add rows for each segment
                        foreach ($segment in $flight.segments) {
                            $newRow = $flightTable.Rows.Add()
                            
                            # Columns: date, from, to, time, airline
                            $newRow.Cells.Item(1).Shape.TextFrame.TextRange.Text = $segment.date
                            $newRow.Cells.Item(2).Shape.TextFrame.TextRange.Text = $segment.from
                            $newRow.Cells.Item(3).Shape.TextFrame.TextRange.Text = $segment.to
                            $newRow.Cells.Item(4).Shape.TextFrame.TextRange.Text = $segment.time
                            $newRow.Cells.Item(5).Shape.TextFrame.TextRange.Text = $segment.airline
                        }
                        
                        Write-Host "Flight table populated with $($flight.segments.Count) segments"
                    } else {
                        Write-Warning "No segments found in flight data"
                    }
                } else {
                    Write-Warning "No table found on FLYINFORMATION slide"
                }
            } else {
                Write-Host "No FLYINFORMATION placeholder found (skipping flight table)"
            }
        } else {
            Write-Host "No flight data to process"
        }
    } catch {
        Write-Error "Flight data processing error: $_"
    }
} else {
    Write-Host "No flight data provided"
}

# =====================================================
# DONE
# =====================================================

Write-Host "Post-processing complete"
exit 0
