<#
.SYNOPSIS
  Run Playwright E2E tests against all 3 language bots in a SINGLE browser session.
  The bot is started ONCE per language (externally) with env vars loaded from .env,
  and reused across all tests in that language to avoid restart overhead.

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

# Load .env into the current PowerShell session so spawned bots inherit env vars
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        Set-Item -Path "env:$key" -Value $value
    }
}

# Set E2E_LANGUAGES env var based on Language parameter
if ($Language -eq "all") {
    $env:E2E_LANGUAGES = "dotnet,node,python"
} else {
    $env:E2E_LANGUAGES = $Language
}

# Tell the playwright tests to use an externally-managed bot (no spawn/stop per test)
$env:E2E_BOT_EXTERNAL = "1"

# Build the Playwright command
$pwArgs = "playwright test --project=teams-tests tests/cross-language.spec.ts"
if ($Headed) {
    $pwArgs += " --headed"
}

# Snapshot current env vars (loaded from .env) into a hashtable for job propagation
$envSnapshot = @{}
Get-ChildItem env: | ForEach-Object { $envSnapshot[$_.Key] = $_.Value }

# Bot startup commands per language
function Start-BotForLanguage([string]$Lang) {
    $repoRoot = $RepoRoot
    $envBlock = $envSnapshot
    $script:BotJob = $null
    switch ($Lang) {
        "node" {
            Write-Host "Starting Node.js test-bot externally (background job)..."
            $script:BotJob = Start-Job -Name "botas-e2e-bot" -ScriptBlock {
                param($cwd, $envBlock)
                foreach ($k in $envBlock.Keys) { Set-Item -Path "env:$k" -Value $envBlock[$k] }
                Set-Location $cwd
                & cmd /c "npx tsx samples/test-bot/index.ts 2>&1"
            } -ArgumentList (Join-Path $repoRoot "node"), $envBlock
        }
        "dotnet" {
            Write-Host "Starting .NET test-bot externally (background job)..."
            # Map shared CLIENT_ID/CLIENT_SECRET/TENANT_ID to the AzureAd:* keys the .NET bot uses,
            # so the same .env works across all three languages.
            if ($envBlock.ContainsKey("CLIENT_ID"))     { $envBlock["AzureAd__ClientId"] = $envBlock["CLIENT_ID"] }
            if ($envBlock.ContainsKey("CLIENT_SECRET")) {
                $envBlock["AzureAd__ClientCredentials__0__SourceType"] = "ClientSecret"
                $envBlock["AzureAd__ClientCredentials__0__ClientSecret"] = $envBlock["CLIENT_SECRET"]
            }
            if ($envBlock.ContainsKey("TENANT_ID"))     { $envBlock["AzureAd__TenantId"] = $envBlock["TENANT_ID"] }
            $envBlock["AzureAd__Instance"] = "https://login.microsoftonline.com/"
            $envBlock["ASPNETCORE_URLS"] = "http://localhost:3978"
            $script:BotJob = Start-Job -Name "botas-e2e-bot" -ScriptBlock {
                param($projectPath, $envBlock)
                foreach ($k in $envBlock.Keys) { Set-Item -Path "env:$k" -Value $envBlock[$k] }
                # --no-launch-profile prevents launchSettings.json from clobbering our env vars
                & cmd /c "dotnet run --no-launch-profile --project `"$projectPath`" 2>&1"
            } -ArgumentList (Join-Path $repoRoot "dotnet\samples\TestBot"), $envBlock
        }
        "python" {
            Write-Host "Starting Python test-bot externally (background job)..."
            $script:BotJob = Start-Job -Name "botas-e2e-bot" -ScriptBlock {
                param($cwd, $envBlock)
                foreach ($k in $envBlock.Keys) { Set-Item -Path "env:$k" -Value $envBlock[$k] }
                Set-Location $cwd
                & cmd /c "python main.py 2>&1"
            } -ArgumentList (Join-Path $repoRoot "python\samples\test-bot"), $envBlock
        }
        default { throw "Unknown language: $Lang" }
    }
    # Wait for /health (dotnet first-build can take 2+ minutes)
    $timeoutSec = if ($Lang -eq "dotnet") { 240 } else { 60 }
    $deadline = (Get-Date).AddSeconds($timeoutSec)
    while ((Get-Date) -lt $deadline) {
        if ($script:BotJob.State -eq "Failed" -or $script:BotJob.State -eq "Completed") {
            $output = Receive-Job -Job $script:BotJob -Keep | Out-String
            throw "Bot job exited prematurely (state: $($script:BotJob.State)).`nOutput:`n$output"
        }
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:3978/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            if ($r.StatusCode -eq 200) {
                Write-Host "✅ Bot is ready on port 3978 (job id $($script:BotJob.Id))"
                return
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    $output = Receive-Job -Job $script:BotJob -Keep | Out-String
    throw "Bot failed to start within ${timeoutSec}s.`nBot output so far:`n$output"
}

function Stop-Bot() {
    if ($script:BotJob) {
        Write-Host "Stopping bot job ($($script:BotJob.Id))..."
        # Drain output for diagnostics
        try { Receive-Job -Job $script:BotJob | Out-Null } catch { }
        Stop-Job -Job $script:BotJob -ErrorAction SilentlyContinue
        Remove-Job -Job $script:BotJob -Force -ErrorAction SilentlyContinue
        $script:BotJob = $null
        # Belt-and-suspenders: kill any leftover node/dotnet on port 3978
        $procs = Get-NetTCPConnection -LocalPort 3978 -ErrorAction SilentlyContinue |
            Where-Object { $_.State -eq "Listen" } |
            Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $procs) {
            try { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue } catch { }
        }
    }
}

# Determine languages to run
$languages = if ($Language -eq "all") { @("dotnet", "node", "python") } else { @($Language) }

$overallExitCode = 0

foreach ($lang in $languages) {
    Write-Host ""
    Write-Host "=============================="
    Write-Host "  Running Playwright E2E Tests"
    Write-Host "  Language: $lang"
    Write-Host "  Single browser instance, single bot instance"
    Write-Host "=============================="
    Write-Host ""

    $env:E2E_LANGUAGES = $lang

    try {
        Start-BotForLanguage $lang

        # Use & cmd /c so stdio pipes flow through to the parent terminal
        # (Start-Process -NoNewWindow buffers/breaks Playwright's list reporter output).
        Push-Location $PwDir
        try {
            & cmd /c "npx $pwArgs"
            $code = $LASTEXITCODE
        } finally {
            Pop-Location
        }

        if ($code -ne 0) {
            Write-Warning "Playwright tests failed for $lang (exit code $code)"
            $overallExitCode = $code
        } else {
            Write-Host ""
            Write-Host "======================================="
            Write-Host "  Playwright E2E tests passed for $lang ✅"
            Write-Host "======================================="
        }
    } finally {
        Stop-Bot
    }
}

if ($overallExitCode -ne 0) {
    Write-Error "One or more Playwright runs failed"
    exit $overallExitCode
}


