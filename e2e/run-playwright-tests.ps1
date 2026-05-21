<#
.SYNOPSIS
  Run Playwright E2E tests against all 3 language bots in a SINGLE browser session.
  Bots are started/stopped dynamically within the test suite (not by Playwright projects).
  This approach uses ONE browser instance across all language runs.

.PARAMETER Language
  Which bot(s) to test: dotnet, node, python, or all (default).

.PARAMETER Headed
  Run Playwright in headed mode (visible browser).

.EXAMPLE
  .\run-playwright-tests.ps1
  .\run-playwright-tests.ps1 -Language node -Headed
  .\run-playwright-tests.ps1 -Headed
#>
param(
    [ValidateSet("all", "dotnet", "node", "python")]
    [string]$Language = "all",
    [switch]$Headed
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$EnvFile = Join-Path $RepoRoot ".env"
$PwDir = Join-Path $ScriptDir "playwright"

if (-not (Test-Path $EnvFile)) {
    Write-Error ".env not found at $EnvFile"
    return
}

if (-not (Test-Path (Join-Path $PwDir "storageState.json"))) {
    Write-Error "storageState.json not found. Run 'cd e2e/playwright && npm run setup' first."
    return
}

# Set E2E_LANGUAGES env var based on Language parameter
if ($Language -eq "all") {
    $env:E2E_LANGUAGES = "dotnet,node,python"
} else {
    $env:E2E_LANGUAGES = $Language
}

# Build the Playwright command
$pwArgs = "playwright test --project=teams-tests tests/cross-language.spec.ts"
if ($Headed) { 
    $pwArgs += " --headed" 
}

Write-Host ""
Write-Host "=============================="
Write-Host "  Running Playwright E2E Tests"
Write-Host "  Language(s): $($env:E2E_LANGUAGES)"
Write-Host "  Single browser instance"
Write-Host "=============================="
Write-Host ""

try {
    $npxProcess = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "npx $pwArgs" `
        -WorkingDirectory $PwDir `
        -NoNewWindow -Wait -PassThru
    
    if ($npxProcess.ExitCode -ne 0) { 
        throw "Playwright tests failed" 
    }

    Write-Host ""
    Write-Host "======================================="
    Write-Host "  All Playwright E2E tests passed ✅"
    Write-Host "======================================="
} catch {
    Write-Error $_.Exception.Message
    exit 1
}

