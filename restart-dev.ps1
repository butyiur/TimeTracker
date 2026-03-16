Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$rootScript = Join-Path (Split-Path -Parent $PSScriptRoot) 'restart-dev.ps1'

if (-not (Test-Path $rootScript)) {
    throw "Nem található a root restart script: $rootScript"
}

& $rootScript
