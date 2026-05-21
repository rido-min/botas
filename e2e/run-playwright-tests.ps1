<#
.SYNOPSIS
  Run Playwright E2E tests against all 3 language bots.
  Each bot is started by its project setup, tested, and stopped by its teardown.
  The browser instance is reused across all 3 language runs.

.PARAMETER Language
  Which bot to test: dotnet, node, python, or all (default).

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

# Build the project filter based on language selection
$projectArgs = ""
if ($Language -eq "all") {
    $projectArgs = "--project=dotnet-tests --project=node-tests --project=python-tests"
} else {
    $projectArgs = "--project=$Language-tests"
}

# Build the Playwright command
$pwArgs = "playwright test $projectArgs"
if ($Headed) { 
    $pwArgs += " --headed" 
}

Write-Host ""
Write-Host "=============================="
Write-Host "  Running Playwright E2E Tests"
Write-Host "  Language(s): $Language"
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

