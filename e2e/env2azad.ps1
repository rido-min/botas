<#
.SYNOPSIS
  Reads CLIENT_ID, CLIENT_SECRET, TENANT_ID, and PORT from a .env file
  and writes them into a .NET launchSettings.json as AzureAd environment variables.

.PARAMETER EnvFile
  Path to the .env file (default: <repo-root>/.env).

.PARAMETER LaunchSettingsFile
  Path to the launchSettings.json to update
  (default: <repo-root>/dotnet/samples/EchoBot/Properties/launchSettings.json).

.EXAMPLE
  .\env2azad.ps1
  .\env2azad.ps1 -EnvFile ..\.env -LaunchSettingsFile ..\dotnet\samples\TestBot\Properties\launchSettings.json
#>
param(
    [string]$EnvFile,
    [string]$LaunchSettingsFile
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent $ScriptDir

if (-not $EnvFile) {
    $EnvFile = Join-Path $RepoRoot ".env"
}
if (-not $LaunchSettingsFile) {
    $LaunchSettingsFile = Join-Path $RepoRoot "dotnet\samples\EchoBot\Properties\launchSettings.json"
}

if (-not (Test-Path $EnvFile)) {
    Write-Error "Error: env file not found: $EnvFile"
}
if (-not (Test-Path $LaunchSettingsFile)) {
    Write-Error "Error: launchSettings file not found: $LaunchSettingsFile"
}

# Parse .env
$ClientId     = ""
$ClientSecret = ""
$TenantId     = ""
$Port         = ""

Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    switch -Wildcard ($line) {
        "CLIENT_ID=*"     { $script:ClientId     = ($line -split "=", 2)[1] }
        "CLIENT_SECRET=*" { $script:ClientSecret = ($line -split "=", 2)[1] }
        "TENANT_ID=*"     { $script:TenantId     = ($line -split "=", 2)[1] }
        "PORT=*"          { $script:Port         = ($line -split "=", 2)[1] }
    }
}

# Read and update launchSettings.json
$LaunchSettingsFile = (Resolve-Path $LaunchSettingsFile).Path
$data = Get-Content $LaunchSettingsFile -Raw | ConvertFrom-Json

# Ensure profiles.http exists
if (-not $data.profiles) {
    $data | Add-Member -NotePropertyName "profiles" -NotePropertyValue ([PSCustomObject]@{})
}
$profileName = ($data.profiles.PSObject.Properties | Select-Object -First 1).Name
if (-not $profileName) {
    $profileName = "http"
    $data.profiles | Add-Member -NotePropertyName $profileName -NotePropertyValue ([PSCustomObject]@{})
}
$profile = $data.profiles.$profileName

# Update port in applicationUrl if PORT is set
if ($Port) {
    $appUrl = $profile.applicationUrl
    if ($appUrl) {
        $profile.applicationUrl = $appUrl -replace ":\d+", ":$Port"
    }
}

# Ensure environmentVariables exists
if (-not $profile.environmentVariables) {
    $profile | Add-Member -NotePropertyName "environmentVariables" -NotePropertyValue ([PSCustomObject]@{})
}
$envVars = $profile.environmentVariables

# Set AzureAd values
if ($ClientId) {
    if ($envVars.PSObject.Properties["AzureAd__ClientId"]) {
        $envVars.AzureAd__ClientId = $ClientId
    } else {
        $envVars | Add-Member -NotePropertyName "AzureAd__ClientId" -NotePropertyValue $ClientId
    }
}
if ($TenantId) {
    if ($envVars.PSObject.Properties["AzureAd__TenantId"]) {
        $envVars.AzureAd__TenantId = $TenantId
    } else {
        $envVars | Add-Member -NotePropertyName "AzureAd__TenantId" -NotePropertyValue $TenantId
    }
}
if ($ClientSecret) {
    $secretKey = "AzureAd__ClientCredentials__0__ClientSecret"
    if ($envVars.PSObject.Properties[$secretKey]) {
        $envVars.$secretKey = $ClientSecret
    } else {
        $envVars | Add-Member -NotePropertyName $secretKey -NotePropertyValue $ClientSecret
    }
    # SourceType is required by Microsoft.Identity.Web to recognize the credential
    $sourceTypeKey = "AzureAd__ClientCredentials__0__SourceType"
    if ($envVars.PSObject.Properties[$sourceTypeKey]) {
        $envVars.$sourceTypeKey = "ClientSecret"
    } else {
        $envVars | Add-Member -NotePropertyName $sourceTypeKey -NotePropertyValue "ClientSecret"
    }
}

# Set Instance (required by Microsoft.Identity.Web for token acquisition)
$instanceKey = "AzureAd__Instance"
$instanceValue = "https://login.microsoftonline.com/"
if ($envVars.PSObject.Properties[$instanceKey]) {
    $envVars.$instanceKey = $instanceValue
} else {
    $envVars | Add-Member -NotePropertyName $instanceKey -NotePropertyValue $instanceValue
}

# Write back
$data | ConvertTo-Json -Depth 10 | Set-Content $LaunchSettingsFile -Encoding UTF8
Write-Host "Updated $LaunchSettingsFile from $EnvFile"
