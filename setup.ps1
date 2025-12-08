param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location -Path $PSScriptRoot

Write-Host "Updating code repositories..."
git branch --set-upstream-to=origin/main
git pull --recurse-submodules

Write-Host "Setting up WebTestPilot..."
Push-Location -Path (Join-Path -Path $PSScriptRoot -ChildPath 'WebTestPilot\webtestpilot')
uv sync

# Activate the virtual environment created by uv when available.
$venvDir = Join-Path -Path (Get-Location) -ChildPath '.venv'
$activateScript = Join-Path -Path $venvDir -ChildPath 'Scripts\Activate.ps1'

if (Test-Path -Path $activateScript) {
    . $activateScript
} else {
    Write-Warning "Virtual environment not found at $activateScript. Skipping activation."
}

python --version
uv run baml-cli generate
Pop-Location

Write-Host "Setting up VS Code extension..."
pnpm install
pnpm package
