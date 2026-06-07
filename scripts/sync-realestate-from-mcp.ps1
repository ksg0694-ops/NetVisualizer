param(
    [string]$RepoPath = "$PSScriptRoot\..\tools\external\real-estate-mcp",
    [string[]]$Keywords = @(),
    [int]$PerPage = 1000,
    [switch]$Fixture,
    [switch]$Apply
)

$ErrorActionPreference = "Stop"

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$repoFullPath = [System.IO.Path]::GetFullPath($RepoPath)
$venvPython = Join-Path $repoFullPath ".venv\Scripts\python.exe"
$syncScript = Join-Path $projectRoot "tools\sync_realestate_from_mcp.py"

if (-not (Test-Path $venvPython)) {
    throw "real-estate MCP venv not found. Run scripts\install-realestate-mcp.ps1 first."
}

$argsList = @(
    $syncScript,
    "--mcp-path", $repoFullPath,
    "--per-page", "$PerPage"
)

foreach ($keyword in $Keywords) {
    if ($keyword) {
        $argsList += @("--keyword", $keyword)
    }
}

if ($Fixture) {
    $argsList += "--fixture"
}

if ($Apply) {
    $argsList += "--apply"
} else {
    $argsList += "--dry-run"
}

& $venvPython @argsList
