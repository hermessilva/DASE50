# Check-Work.ps1 - Clean English Version (PS 5.1+ Compatible)

$FilePath = Join-Path (Get-Location) "work-mark.txt"
if (-not (Test-Path $FilePath)) { Write-Error "File not found: $FilePath"; exit 1 }

$Culture = [System.Globalization.CultureInfo]::InvariantCulture
$Format = "yyyy-MM-dd HH:mm:ss"

# Regex to capture the timestamp (YYYY-MM-DD HH:MM:SS)
$TimestampRegex = '(?<ts>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})'

# Corrected Line 12: Cleaned from citation markers
$Lines = Get-Content -Path $FilePath -Encoding UTF8 | Where-Object { $_.Trim() -ne "" }

$OpenStarts = New-Object System.Collections.Generic.Stack[datetime]
$Sessions = New-Object System.Collections.Generic.List[object]

[Nullable[datetime]]$FirstStamp = $null
[Nullable[datetime]]$LastStamp = $null
$StartCount = $EndCount = $OrphanEndCount = $IgnoredCount = 0

foreach ($Line in $Lines) {
    # 1. Split description from timestamp using the '|' character
    $Parts = $Line -split '\|'
    $Label = if ($Parts.Count -gt 1) { $Parts[0] } else { $Line }
    $StampPart = if ($Parts.Count -gt 1) { $Parts[1] } else { $Line }

    # 2. Extract and validate Timestamp
    $Match = [regex]::Match($StampPart, $TimestampRegex)
    if (-not $Match.Success) { $IgnoredCount++; continue }

    $StampText = $Match.Groups['ts'].Value.Replace('T', ' ')
    [datetime]$Stamp = [datetime]::MinValue
    
    if (-not [datetime]::TryParseExact($StampText, $Format, $Culture, [System.Globalization.DateTimeStyles]::None, [ref]$Stamp)) {
        $IgnoredCount++
        continue
    }

    # Update report boundaries
    if (-not $FirstStamp.HasValue -or $Stamp -lt $FirstStamp.Value) { $FirstStamp = $Stamp }
    if (-not $LastStamp.HasValue -or $Stamp -gt $LastStamp.Value) { $LastStamp = $Stamp }

    # 3. Identify Action (Start vs End)
    $IsStart = $Label -match '\b(start|begin|inicio)\b'
    $IsEnd   = $Label -match '\b(end|stop|fim)\b'

    if ($IsStart -and -not $IsEnd) {
        $OpenStarts.Push($Stamp)
        $StartCount++
    }
    elseif ($IsEnd -and -not $IsStart) {
        $EndCount++
        if ($OpenStarts.Count -eq 0) {
            Write-Warning "End mark without a previous Start mark: $Line"
            $OrphanEndCount++
            continue
        }
        $StartStamp = $OpenStarts.Pop()
        $Sessions.Add([pscustomobject]@{ Start = $StartStamp; End = $Stamp; Span = ($Stamp - $StartStamp) })
    }
    else {
        $IgnoredCount++
    }
}

# --- Helper Functions ---
function Format-TimeSpan([TimeSpan]$Ts) {
    $TotalHours = [Math]::Floor($Ts.TotalHours)
    return "{0:00}:{1:00}:{2:00}" -f $TotalHours, $Ts.Minutes, $Ts.Seconds
}

function Add-IntervalToDayTotals([hashtable]$Totals, [datetime]$S, [datetime]$E) {
    $Curr = $S
    while ($Curr.Date -lt $E.Date) {
        $Midnight = $Curr.Date.AddDays(1)
        $Key = $Curr.ToString("yyyy-MM-dd")
        
        if (-not $Totals.ContainsKey($Key)) { $Totals[$Key] = [TimeSpan]::Zero }
        $Totals[$Key] = $Totals[$Key].Add($Midnight - $Curr)
        
        $Curr = $Midnight
    }
    $KeyFinal = $Curr.ToString("yyyy-MM-dd")
    if (-not $Totals.ContainsKey($KeyFinal)) { $Totals[$KeyFinal] = [TimeSpan]::Zero }
    $Totals[$KeyFinal] = $Totals[$KeyFinal].Add($E - $Curr)
}

# --- Reports ---
$DayTotals = @{}
$TotalTime = [TimeSpan]::Zero
foreach ($S in $Sessions) {
    Add-IntervalToDayTotals $DayTotals $S.Start $S.End
    $TotalTime = $TotalTime.Add($S.Span)
}

Write-Host "`n=== Processing Summary ===" -ForegroundColor Cyan
Write-Host "Starts: $StartCount | Ends: $EndCount | Closed Sessions: $($Sessions.Count)"

if ($DayTotals.Count -gt 0) {
    Write-Host "`nWorked Time per Day (Closed Sessions)" -ForegroundColor Yellow
    $SortedKeys = $DayTotals.Keys | Sort-Object
    foreach ($K in $SortedKeys) {
        Write-Host "$K : $(Format-TimeSpan $DayTotals[$K])" 
    }
    Write-Host "-------------------------------"
    Write-Host "Total Worked: $(Format-TimeSpan $TotalTime)" -ForegroundColor Green
}

# Active Session Handling (for the last line in your file)
if ($OpenStarts.Count -gt 0) {
    $Now = Get-Date
    Write-Host "`n=== Open Sessions (Active) ===" -ForegroundColor Magenta
    foreach ($Start in $OpenStarts.ToArray()) {
        $TimeOpen = $Now - $Start
        Write-Host "Started at: $($Start.ToString('yyyy-MM-dd HH:mm:ss'))"
        Write-Host "Active for: $(Format-TimeSpan $TimeOpen)"
    }
}