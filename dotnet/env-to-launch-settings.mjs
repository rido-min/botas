#!/usr/bin/env node

// Reads a .env file and creates/updates launchSettings.json for .NET sample projects.
// Usage: node env-to-launch-settings.mjs <sample-name> [path-to-env]
// Example: node env-to-launch-settings.mjs EchoBot
// Omit sample-name to update all samples.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readdirSync, statSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// If the first arg looks like a path (contains / or \ or .env), treat it as the env path (legacy usage)
const firstArg = process.argv[2]
const isEnvPath = firstArg && (firstArg.includes('/') || firstArg.includes('\\') || firstArg.includes('.env'))
const targetSample = (!isEnvPath && firstArg) || null
const envPath = (isEnvPath ? firstArg : process.argv[3]) || join(__dirname, '..', '.env')

// Parse .env file
function parseEnv(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const vars = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '')
    vars[key] = value
  }
  return vars
}

// Map flat env vars to ASP.NET Core environment variables
function mapToAspNet(vars) {
  const mapped = {}
  if (vars.CLIENT_ID) mapped['AzureAd__ClientId'] = vars.CLIENT_ID
  if (vars.CLIENT_SECRET) {
    mapped['AzureAd__ClientCredentials__0__SourceType'] = 'ClientSecret'
    mapped['AzureAd__ClientCredentials__0__ClientSecret'] = vars.CLIENT_SECRET
  }
  if (vars.TENANT_ID) mapped['AzureAd__TenantId'] = vars.TENANT_ID
  if (vars.CLIENT_ID) mapped['AzureAd__Instance'] = 'https://login.microsoftonline.com/'
  if (vars.PORT) mapped['ASPNETCORE_URLS'] = `http://0.0.0.0:${vars.PORT}`
  return mapped
}

// Find all sample project directories
function findSampleDirs(samplesDir) {
  return readdirSync(samplesDir)
    .map(name => join(samplesDir, name))
    .filter(dir => {
      try {
        return statSync(dir).isDirectory() &&
          readdirSync(dir).some(f => f.endsWith('.csproj'))
      } catch { return false }
    })
}

// Create or update launchSettings.json
function updateLaunchSettings(projectDir, envVars) {
  const propsDir = join(projectDir, 'Properties')
  const settingsPath = join(propsDir, 'launchSettings.json')
  const projectName = projectDir.split(/[\\/]/).pop()

  let settings = {}
  if (existsSync(settingsPath)) {
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
  }

  if (!settings.profiles) settings.profiles = {}

  settings.profiles[projectName] = {
    commandName: 'Project',
    dotnetRunMessages: true,
    applicationUrl: envVars['ASPNETCORE_URLS'] || 'http://0.0.0.0:3978',
    environmentVariables: { ...envVars }
  }

  // Remove ASPNETCORE_URLS from env vars since it's set as applicationUrl
  delete settings.profiles[projectName].environmentVariables['ASPNETCORE_URLS']

  mkdirSync(propsDir, { recursive: true })
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
  console.log(`  ✅ ${projectName}/Properties/launchSettings.json`)
}

// Main
if (!existsSync(envPath)) {
  console.error(`❌ .env file not found: ${envPath}`)
  process.exit(1)
}

const vars = parseEnv(envPath)
const aspNetVars = mapToAspNet(vars)

if (Object.keys(aspNetVars).length === 0) {
  console.error('❌ No CLIENT_ID, CLIENT_SECRET, or TENANT_ID found in .env')
  process.exit(1)
}

console.log(`📄 Reading ${envPath}`)
console.log(`🔑 Found: ${Object.keys(vars).filter(k => ['CLIENT_ID', 'CLIENT_SECRET', 'TENANT_ID', 'PORT'].includes(k)).join(', ')}`)
console.log()

const samplesDir = join(__dirname, 'samples')

let sampleDirs
if (targetSample) {
  const targetDir = join(samplesDir, targetSample)
  if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) {
    console.error(`❌ Sample not found: ${targetSample}`)
    console.error(`   Available: ${findSampleDirs(samplesDir).map(d => d.split(/[\\/]/).pop()).join(', ')}`)
    process.exit(1)
  }
  sampleDirs = [targetDir]
} else {
  sampleDirs = findSampleDirs(samplesDir)
}

console.log(`📁 Updating ${sampleDirs.length} sample project(s):`)
for (const dir of sampleDirs) {
  updateLaunchSettings(dir, aspNetVars)
}

const sampleName = sampleDirs[0].split(/[\\/]/).pop()
console.log()
console.log(`Done! Run with: dotnet run --project dotnet/samples/${sampleName}`)
