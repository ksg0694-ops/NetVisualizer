param(
    [string]$RepoPath = "$PSScriptRoot\..\tools\external\real-estate-mcp",
    [string]$Python = "python",
    [string]$CodexPath = "codex"
)

$ErrorActionPreference = "Stop"

$repoFullPath = [System.IO.Path]::GetFullPath($RepoPath)
$venvPython = Join-Path $repoFullPath ".venv\Scripts\python.exe"
$serverPath = Join-Path $repoFullPath "src\real_estate\mcp_server\server.py"

if (-not (Test-Path $repoFullPath)) {
    New-Item -ItemType Directory -Force (Split-Path $repoFullPath) | Out-Null
    git clone --depth 1 https://github.com/tae0y/real-estate-mcp.git $repoFullPath
}

if (-not (Test-Path $venvPython)) {
    & $Python -m venv (Join-Path $repoFullPath ".venv")
}

& $venvPython -m pip install -e $repoFullPath

$alreadyRegistered = $false
try {
    & $CodexPath mcp get real-estate | Out-Null
    $alreadyRegistered = $true
} catch {
    $alreadyRegistered = $false
}

if (-not $alreadyRegistered) {
    & $CodexPath mcp add real-estate -- $venvPython $serverPath
}

Write-Host "real-estate MCP is installed."
Write-Host "Repo: $repoFullPath"
Write-Host "Server: $serverPath"
Write-Host "Next: run scripts\set-realestate-mcp-secrets.ps1 with your public-data key."
