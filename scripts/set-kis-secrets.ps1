param(
    [string]$ProjectRef = "djwqcewsochlesjcouoi",
    [string]$EnvPath = "supabase/functions/.env"
)

$ErrorActionPreference = "Stop"

function Read-EnvFile {
    param([string]$Path)
    $result = @{}
    if (!(Test-Path $Path)) {
        throw "Missing env file: $Path"
    }

    Get-Content -Encoding UTF8 -Path $Path | ForEach-Object {
        $line = $_.Trim()
        if (!$line -or $line.StartsWith("#") -or !$line.Contains("=")) { return }
        $parts = $line -split "=", 2
        $result[$parts[0].Trim()] = $parts[1].Trim()
    }
    return $result
}

function Require-EnvValue {
    param(
        [hashtable]$Values,
        [string]$Name
    )
    $value = $Values[$Name]
    if (!$value -or $value -match "replace_with|your_|^\s*$") {
        throw "Missing or placeholder value: $Name"
    }
    return $value
}

$envValues = Read-EnvFile -Path $EnvPath

$provider = $envValues["MARKET_PRICE_PROVIDER"]
if (!$provider) { $provider = "kis" }
if ($provider -ne "kis") {
    throw "MARKET_PRICE_PROVIDER must be kis for KIS secret setup."
}

$requiredNames = @("MARKET_PRICE_PROVIDER", "KIS_APP_KEY", "KIS_APP_SECRET")
$optionalNames = @("KIS_BASE_URL")
$tempPath = Join-Path $env:TEMP "netvisualizer-kis-secrets.env"

try {
    $lines = @()
    foreach ($name in $requiredNames) {
        $lines += "$name=$(Require-EnvValue -Values $envValues -Name $name)"
    }
    foreach ($name in $optionalNames) {
        if ($envValues[$name]) {
            $lines += "$name=$($envValues[$name])"
        }
    }

    Set-Content -Encoding UTF8 -Path $tempPath -Value $lines
    Write-Host "Setting KIS secrets for project $ProjectRef"
    Write-Host "Secret names: $($requiredNames -join ', ')"
    npx.cmd --yes supabase@2.104.0 secrets set --env-file $tempPath --project-ref $ProjectRef
}
finally {
    if (Test-Path $tempPath) {
        Remove-Item -LiteralPath $tempPath -Force
    }
}
