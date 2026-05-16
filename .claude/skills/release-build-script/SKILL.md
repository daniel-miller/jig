---
name: release-build-script
description: Release packaging conventions for this org — a single
  build/build.ps1 that builds the SPA, stages it into the API's wwwroot,
  publishes every .NET project in Release, and produces one
  dist/<project>.<version>.zip per project. Use when editing or scaffolding
  the build script, wiring a new project into release output, or changing
  versioning behaviour.
---

# Release Build Script

Reference: `bump/build/build.ps1`.

## Shape

- One PowerShell 7+ script at `build/build.ps1`.
- Takes a single `-Version <string>` parameter with a sensible default (last-shipped version is fine; CI always passes it explicitly).
- `$ErrorActionPreference = 'Stop'` at the top — any failure aborts the run.
- All paths derived from `$PSScriptRoot` / `Split-Path -Parent $PSScriptRoot`. No hard-coded absolute paths anywhere except the secrets directory (which is intentionally absolute and host-specific).

## Steps, in order

1. Resolve `$repoRoot`, `$solution`, `$distDir`, `$webDir`, `$apiDir`, `$wwwroot`.
2. List `$projects` as an ordered array of `@{ Name; Path }` hashtables. Commented entries are honoured (e.g. `Bump.Sdk` left commented when it's not part of the deploy bundle).
3. Wipe + recreate `$distDir`.
4. Build the SPA:
   - `Push-Location $webDir` / `Pop-Location` in a try/finally.
   - `npm ci --silent` first. Bail on non-zero exit (`if ($LASTEXITCODE -ne 0) { throw ... }`).
   - `$env:APP_VERSION = $Version` before `npm run build --silent`. Remove the env var in a `finally` block so subsequent steps see a clean environment. The Vite config reads `APP_VERSION` and bakes it into `__APP_VERSION__` so the SPA footer matches the release.
5. Wipe + recreate `$wwwroot`. Copy `$webDir/dist/*` into `$wwwroot`. The API's `dotnet publish` then ships the SPA as static content via `UseDefaultFiles` + `UseStaticFiles`.
6. `dotnet restore $solution --verbosity quiet` once for the whole solution.
7. For each project:
   - `dotnet publish $csproj --configuration Release --output $publishDir --no-restore --verbosity quiet -p:Version=$Version`.
   - `Compress-Archive` into `$distDir\<Name>.<Version>.zip` (delete any pre-existing zip first).
   - Remove the staged `$publishDir`.
   - Print the zip path + size in KB in cyan/green.
8. Optional: push each zip to the deployment server (Octopus, in bump's case). Read credentials from a host-local secrets directory (`c:\base\me\secrets`) — never commit them, never expand `$env:OCTOPUS_API_KEY` in log output.

## Conventions

- Status output uses `Write-Host` with colours (`-ForegroundColor Cyan` for section headers, `Green` for artifact lines). Errors throw — let PowerShell surface the stack.
- Every shell-out (`npm`, `dotnet`, `octopus`) is followed by an `if ($LASTEXITCODE -ne 0) { throw "..." }` check. PowerShell's `$ErrorActionPreference = 'Stop'` does not catch non-zero exit codes from native executables.
- `Remove-Item ... -Recurse -Force` is fine for build-output directories. Never reach for it on source paths.
- One `-Version` flows everywhere: SPA via `APP_VERSION`, .NET via `-p:Version=`, zip filename via `$Version`. No second source of truth.

## What not to do

- No `dotnet build` before `dotnet publish` — `publish` builds.
- No multi-project parallel builds in the script. PowerShell's serial loop is fast enough and the output is easier to read when something fails.
- No `dotnet pack` for the API/Worker. NuGet packaging is reserved for the SDK project (when it's part of the release bundle).
- No CI-specific code paths. The same script runs locally and on the build agent; CI passes `-Version` and reads the same secrets directory if it needs to upload.
