param(
    [string[]]$Tickers = @("005930"),
    [string]$FunctionUrl = "",
    [string]$AnonKey = "",
    [string]$EnvPath = "supabase/functions/.env"
)

$ErrorActionPreference = "Stop"

function Read-EnvFile {
    param([string]$Path)
    $result = @{}
    if (!(Test-Path $Path)) { return $result }

    Get-Content -Encoding UTF8 -Path $Path | ForEach-Object {
        $line = $_.Trim()
        if (!$line -or $line.StartsWith("#") -or !$line.Contains("=")) { return }
        $parts = $line -split "=", 2
        $result[$parts[0].Trim()] = $parts[1].Trim()
    }
    return $result
}

$envValues = Read-EnvFile -Path $EnvPath

if (!$FunctionUrl) {
    $FunctionUrl = $envValues["SUPABASE_FUNCTION_URL"]
}

if (!$FunctionUrl) {
    $projectUrl = $envValues["SUPABASE_URL"]
    if ($projectUrl) {
        $FunctionUrl = "$($projectUrl.TrimEnd('/'))/functions/v1/sync-market-prices"
    } else {
        $FunctionUrl = "http://127.0.0.1:54321/functions/v1/sync-market-prices"
    }
}

if (!$AnonKey) {
    $AnonKey = $envValues["SUPABASE_ANON_KEY"]
}

$headers = @{ "Content-Type" = "application/json" }
if ($AnonKey) {
    $headers["apikey"] = $AnonKey
    $headers["Authorization"] = "Bearer $AnonKey"
}

$body = @{
    tickers = $Tickers
    dryRun = $true
} | ConvertTo-Json -Depth 4

Write-Host "KIS dry-run request"
Write-Host "Function: $FunctionUrl"
Write-Host "Tickers : $($Tickers -join ', ')"
Write-Host "Auth    : $(if ($AnonKey) { 'anon key present' } else { 'none' })"

Invoke-RestMethod -Method Post -Uri $FunctionUrl -Headers $headers -Body $body
