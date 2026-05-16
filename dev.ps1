<#
.SYNOPSIS
  Start the Vite dev server for the jig SPA.

.DESCRIPTION
  Installs dependencies on first run (or when package-lock.json is newer
  than node_modules), then runs `npm run dev` from src/web.
#>

[CmdletBinding()]
param(
  [switch]$Clean
)

$ErrorActionPreference = 'Stop'
Set-Location -Path (Join-Path $PSScriptRoot 'src/web')

if ($Clean -and (Test-Path node_modules)) {
  Write-Host "Removing node_modules..." -ForegroundColor Yellow
  Remove-Item -Recurse -Force node_modules
}

$lock = Get-Item package-lock.json -ErrorAction SilentlyContinue
$modules = Get-Item node_modules -ErrorAction SilentlyContinue
$needInstall = -not $modules -or ($lock -and $lock.LastWriteTime -gt $modules.LastWriteTime)

if ($needInstall) {
  Write-Host "Installing dependencies..." -ForegroundColor Cyan
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
}

npm run dev
