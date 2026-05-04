<#
.SYNOPSIS
  Run E2E tests against AI bot samples.
  Starts the specified AI bot, runs API-level tests, and stops the bot.

.PARAMETER Sample
  Which AI sample to test: dotnet, node-vercel, node-langchain, python-langchain, python-agent, or all (default).

.EXAMPLE
  .\run-ai-tests.ps1
  .\run-ai-tests.ps1 -Sample dotnet
  .\run-ai-tests.ps1 -Sample node-vercel
#>
param(
    [ValidateSet("all", "dotnet", "node-vercel", "node-langchain", "python-langchain", "python-agent")]
    [string]$Sample = "all"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$EnvFile = Join-Path $RepoRoot ".env"

if (-not (Test-Path $EnvFile)) {
    Write-Error ".env not found at $EnvFile"
    return
}

# Load .env into current process environment
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
    }
}

# Verify required AI env vars
$requiredVars = @("AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT", "CLIENT_ID", "CLIENT_SECRET", "TENANT_ID")
foreach ($var in $requiredVars) {
    if (-not [Environment]::GetEnvironmentVariable($var)) {
        Write-Error "Missing required environment variable: $var"
        return
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
    param([int]$Port = 3978, [int]$MaxAttempts = 30)
    Write-Host "Waiting for bot on port $Port..."
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($r.StatusCode -eq 200) {
                Write-Host "Bot is ready on port $Port"
                return $true
            }
        } catch { }
        Start-Sleep -Seconds 2
    }
    Write-Error "Bot failed to start within $($MaxAttempts * 2) seconds"
    return $false
}

function Start-DotNetAiBot {
    Write-Host "`n=== Starting .NET AI Bot ===" -ForegroundColor Cyan
    $projDir = Join-Path $RepoRoot "dotnet/samples/04-ai-openai"
    $script:BotProcess = Start-Process -FilePath "dotnet" -ArgumentList "run", "--project", $projDir `
        -PassThru -NoNewWindow -RedirectStandardOutput "NUL"
    Wait-ForBot
}

function Start-NodeVercelBot {
    Write-Host "`n=== Starting Node.js AI Vercel Bot ===" -ForegroundColor Cyan
    $sampleDir = Join-Path $RepoRoot "node/samples/04-ai-vercel"
    # @ai-sdk/azure uses AZURE_RESOURCE_NAME and AZURE_API_KEY
    $endpoint = [Environment]::GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT")
    if ($endpoint -match "https://([^.]+)\.") {
        [Environment]::SetEnvironmentVariable("AZURE_RESOURCE_NAME", $Matches[1], "Process")
    }
    [Environment]::SetEnvironmentVariable("AZURE_API_KEY", [Environment]::GetEnvironmentVariable("AZURE_OPENAI_API_KEY"), "Process")
    $script:BotProcess = Start-Process -FilePath "npx" -ArgumentList "tsx", "index.ts" `
        -WorkingDirectory $sampleDir -PassThru -NoNewWindow -RedirectStandardOutput "NUL"
    Wait-ForBot
}

function Start-NodeLangchainBot {
    Write-Host "`n=== Starting Node.js AI LangChain Bot ===" -ForegroundColor Cyan
    $sampleDir = Join-Path $RepoRoot "node/samples/04-ai-langchain-mcp"
    $script:BotProcess = Start-Process -FilePath "npx" -ArgumentList "tsx", "index.ts" `
        -WorkingDirectory $sampleDir -PassThru -NoNewWindow -RedirectStandardOutput "NUL"
    Wait-ForBot
}

function Start-PythonLangchainBot {
    Write-Host "`n=== Starting Python AI LangChain Bot ===" -ForegroundColor Cyan
    $sampleDir = Join-Path $RepoRoot "python/samples/04-ai-langchain"
    $script:BotProcess = Start-Process -FilePath "python" -ArgumentList "main.py" `
        -WorkingDirectory $sampleDir -PassThru -NoNewWindow -RedirectStandardOutput "NUL"
    Wait-ForBot
}

function Start-PythonAgentBot {
    Write-Host "`n=== Starting Python AI Agent Framework Bot ===" -ForegroundColor Cyan
    $sampleDir = Join-Path $RepoRoot "python/samples/04-ai-agent-framework"
    $script:BotProcess = Start-Process -FilePath "python" -ArgumentList "main.py" `
        -WorkingDirectory $sampleDir -PassThru -NoNewWindow -RedirectStandardOutput "NUL"
    Wait-ForBot
}

function Run-Tests {
    param([string]$TraitCategory)
    Write-Host "Running AI tests for category: $TraitCategory" -ForegroundColor Yellow
    $testProj = Join-Path $ScriptDir "dotnet/Botas.E2ETests.csproj"
    & dotnet test $testProj --filter "Category=AI&Category=$TraitCategory" --no-build --logger "console;verbosity=detailed" 2>&1
    $script:LastExitCode = $LASTEXITCODE
}

$samples = if ($Sample -eq "all") {
    @("dotnet", "node-vercel", "node-langchain", "python-langchain", "python-agent")
} else {
    @($Sample)
}

# Build test project first
Write-Host "Building E2E test project..." -ForegroundColor Cyan
$testProj = Join-Path $ScriptDir "dotnet/Botas.E2ETests.csproj"
& dotnet build $testProj -v:q 2>&1 | Out-Null

$results = @{}

foreach ($s in $samples) {
    try {
        switch ($s) {
            "dotnet"           { Start-DotNetAiBot; Run-Tests "DotNet" }
            "node-vercel"      { Start-NodeVercelBot; Run-Tests "Node" }
            "node-langchain"   { Start-NodeLangchainBot; Run-Tests "NodeLangchain" }
            "python-langchain" { Start-PythonLangchainBot; Run-Tests "Python" }
            "python-agent"     { Start-PythonAgentBot; Run-Tests "PythonAgent" }
        }
        $results[$s] = if ($script:LastExitCode -eq 0) { "PASS" } else { "FAIL" }
    } catch {
        Write-Host "ERROR: $_" -ForegroundColor Red
        $results[$s] = "ERROR"
    } finally {
        Stop-Bot
    }
}

Write-Host "`n=== Results ===" -ForegroundColor Cyan
foreach ($r in $results.GetEnumerator()) {
    $color = if ($r.Value -eq "PASS") { "Green" } elseif ($r.Value -eq "FAIL") { "Red" } else { "Yellow" }
    Write-Host "  $($r.Key): $($r.Value)" -ForegroundColor $color
}

$failCount = ($results.Values | Where-Object { $_ -ne "PASS" }).Count
exit $failCount
