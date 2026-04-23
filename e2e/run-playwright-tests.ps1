<#
.SYNOPSIS
  Run Playwright E2E tests against all 3 language bots.
  Each bot is started, tested, and stopped in sequence.

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

# Load .env into current process environment
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
    }
}

$BotProcess = $null

function Stop-Bot {
    if ($script:BotProcess -and -not $script:BotProcess.HasExited) {
        Write-Host "Stopping bot (PID $($script:BotProcess.Id))..."
        Stop-Process -Id $script:BotProcess.Id -Force -ErrorAction SilentlyContinue
        $script:BotProcess.WaitForExit(5000) | Out-Null
    }
    $script:BotProcess = $null
}

function Wait-ForBot {
    $port = if ($env:PORT) { $env:PORT } else { "3978" }
    Write-Host "Waiting for bot on port $port..."
    for ($i = 1; $i -le 30; $i++) {
        try {   
            $response = Invoke-WebRequest -Uri "http://localhost:$port/health" `
                -Method GET -ContentType "application/json" `
                -ErrorAction Stop -TimeoutSec 2
            Write-Host "Bot is ready."
            return $true
        } catch {
            if ($script:BotProcess -and $script:BotProcess.HasExited) {
                Write-Error "Bot process died before becoming ready."
                return $false
            }
            Start-Sleep -Seconds 1
        }
    }
    Write-Error "Bot failed to start within 30 seconds."
    return $false
}

function Start-DotNetBot {
    Write-Host "Starting .NET test-bot..."
    & "$ScriptDir\env2azad.ps1" -EnvFile "$EnvFile" -LaunchSettingsFile "$RepoRoot\dotnet\samples\TestBot\Properties\launchSettings.json"
    $script:BotProcess = Start-Process -FilePath "dotnet" `
        -ArgumentList "run", "--project", "$RepoRoot\dotnet\samples\TestBot" `
        -PassThru -NoNewWindow
}

function Start-NodeBot {
    Write-Host "Starting Node.js test-bot..."
    $script:BotProcess = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "npx tsx samples/test-bot/index.ts" `
        -WorkingDirectory "$RepoRoot\node" `
        -PassThru -NoNewWindow
}

function Start-PythonBot {
    Write-Host "Starting Python test-bot..."
    $script:BotProcess = Start-Process -FilePath "python" `
        -ArgumentList "main.py" `
        -WorkingDirectory "$RepoRoot\python\samples\test-bot" `
        -PassThru -NoNewWindow
}

function Invoke-PlaywrightFor {
    param([string]$Lang)

    Write-Host ""
    Write-Host "=============================="
    Write-Host "  Playwright: $Lang"
    Write-Host "=============================="

    switch ($Lang) {
        "dotnet" { Start-DotNetBot }
        "node"   { Start-NodeBot }
        "python" { Start-PythonBot }
        default  { Write-Error "Unknown language: $Lang"; return }
    }

    if (-not (Wait-ForBot)) {
        Stop-Bot
        throw "Bot failed to start for $Lang"
    }

    try {
        $pwArgs = "playwright test --project=teams-tests"
        if ($Headed) { $pwArgs += " --headed" }
        
        $npxProcess = Start-Process -FilePath "cmd.exe" `
            -ArgumentList "/c", "npx $pwArgs" `
            -WorkingDirectory $PwDir `
            -NoNewWindow -Wait -PassThru
        
        if ($npxProcess.ExitCode -ne 0) { 
            throw "Playwright tests failed for $Lang" 
        }
    } finally {
        Stop-Bot
    }

    Write-Host "✅ Playwright $Lang passed"
}

# Main
try {
    $languages = if ($Language -eq "all") { @("dotnet", "node", "python") } else { @($Language) }

    foreach ($lang in $languages) {
        Invoke-PlaywrightFor $lang
    }

    Write-Host ""
    Write-Host "======================================="
    Write-Host "  All Playwright E2E tests passed ✅"
    Write-Host "======================================="
} finally {
    Stop-Bot
}
