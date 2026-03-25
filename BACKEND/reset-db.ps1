param(
    [switch]$SkipEfToolsCheck
)

$ErrorActionPreference = "Stop"

Write-Host "== TimeTracker DB reset ==" -ForegroundColor Cyan
Write-Host "This will delete all existing data and recreate schema." -ForegroundColor Yellow

$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $backendDir

if (-not $SkipEfToolsCheck) {
    try {
        dotnet ef --version | Out-Null
    }
    catch {
        throw "dotnet-ef is not available. Install with: dotnet tool install --global dotnet-ef"
    }
}

Write-Host "Dropping database..." -ForegroundColor Cyan
dotnet ef database drop --force --no-build

Write-Host "Applying migrations..." -ForegroundColor Cyan
dotnet ef database update --no-build

$profilesDir = Join-Path $backendDir "wwwroot\uploads\profiles"
if (Test-Path $profilesDir) {
    Write-Host "Clearing uploaded profile images..." -ForegroundColor Cyan
    Get-ChildItem $profilesDir -File | Remove-Item -Force
}

$mailboxFile = Join-Path $backendDir "App_Data\dev-mailbox.log"
if (Test-Path $mailboxFile) {
    Write-Host "Removing dev mailbox log..." -ForegroundColor Cyan
    Remove-Item $mailboxFile -Force
}

Write-Host "Reset complete. Start the API once to reseed roles + admin/hr users." -ForegroundColor Green
