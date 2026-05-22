/**
 * Bot lifecycle helpers for Playwright projects.
 * Each language project uses these to start/stop its bot before/after tests.
 */
import { execSync, spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

const REPO_ROOT = path.resolve(__dirname, "../..");
const BOT_PORT = process.env.PORT || "3978";
const HEALTH_TIMEOUT_MS = 30_000;

let botProcess: ChildProcess | null = null;

/**
 * Load .env from repo root into process.env
 */
export function loadEnv() {
  const envPath = path.join(REPO_ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env not found at ${envPath}`);
  }
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      process.env[key] = value;
    }
  });
}

/**
 * Wait for bot's /health endpoint to respond
 */
async function waitForHealth(): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < HEALTH_TIMEOUT_MS) {
    try {
      const response = await fetch(`http://localhost:${BOT_PORT}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        console.log(`✅ Bot is ready on port ${BOT_PORT}`);
        return;
      }
    } catch {
      // Bot not ready yet or connection refused
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Bot failed to start within ${HEALTH_TIMEOUT_MS / 1000}s`);
}

/**
 * When set, the bot is managed externally (e.g., by a runner script).
 * Start/stop helpers skip spawning and just verify health.
 */
function isExternalBot(): boolean {
  return process.env.E2E_BOT_EXTERNAL === "1";
}

/**
 * Start the .NET test-bot
 */
export async function startDotNetBot(): Promise<void> {
  if (isExternalBot()) {
    console.log("E2E_BOT_EXTERNAL=1 — skipping spawn, verifying external bot health");
    await waitForHealth();
    return;
  }
  console.log("Starting .NET test-bot...");

  // Update launchSettings.json with env vars from .env
  const launchSettingsPath = path.join(
    REPO_ROOT,
    "dotnet/samples/TestBot/Properties/launchSettings.json"
  );
  if (!fs.existsSync(launchSettingsPath)) {
    throw new Error(`launchSettings.json not found at ${launchSettingsPath}`);
  }

  const launchSettings = JSON.parse(
    fs.readFileSync(launchSettingsPath, "utf-8")
  );
  launchSettings.profiles.http.environmentVariables = {
    CLIENT_ID: process.env.CLIENT_ID || "",
    CLIENT_SECRET: process.env.CLIENT_SECRET || "",
    TENANT_ID: process.env.TENANT_ID || "common",
    ASPNETCORE_URLS: `http://localhost:${BOT_PORT}`,
  };
  fs.writeFileSync(
    launchSettingsPath,
    JSON.stringify(launchSettings, null, 2)
  );

  botProcess = spawn(
    "dotnet",
    ["run", "--project", path.join(REPO_ROOT, "dotnet/samples/TestBot")],
    {
      stdio: "ignore",
      detached: false,
    }
  );

  await waitForHealth();
}

/**
 * Start the Node.js test-bot
 */
export async function startNodeBot(): Promise<void> {
  if (isExternalBot()) {
    console.log("E2E_BOT_EXTERNAL=1 — skipping spawn, verifying external bot health");
    await waitForHealth();
    return;
  }
  console.log("Starting Node.js test-bot...");
  botProcess = spawn("npx", ["tsx", "samples/test-bot/index.ts"], {
    cwd: path.join(REPO_ROOT, "node"),
    stdio: "ignore",
    detached: false,
    shell: true,
  });

  await waitForHealth();
}

/**
 * Start the Python test-bot
 */
export async function startPythonBot(): Promise<void> {
  if (isExternalBot()) {
    console.log("E2E_BOT_EXTERNAL=1 — skipping spawn, verifying external bot health");
    await waitForHealth();
    return;
  }
  console.log("Starting Python test-bot...");
  botProcess = spawn("python", ["main.py"], {
    cwd: path.join(REPO_ROOT, "python/samples/test-bot"),
    stdio: "ignore",
    detached: false,
    shell: true,
  });

  await waitForHealth();
}

/**
 * Stop the currently-running bot
 */
export async function stopBot(): Promise<void> {
  if (isExternalBot()) {
    console.log("E2E_BOT_EXTERNAL=1 — leaving external bot running");
    return;
  }
  if (!botProcess || botProcess.exitCode !== null) {
    botProcess = null;
    return;
  }

  console.log(`Stopping bot (PID ${botProcess.pid})...`);

  return new Promise<void>((resolve) => {
    if (!botProcess) {
      resolve();
      return;
    }

    botProcess.on("exit", () => {
      console.log("Bot stopped.");
      botProcess = null;
      resolve();
    });

    // On Windows, use taskkill to kill the process tree
    if (process.platform === "win32" && botProcess.pid) {
      try {
        execSync(`taskkill /pid ${botProcess.pid} /T /F`, {
          stdio: "ignore",
        });
      } catch {
        // Process already exited
      }
    } else {
      botProcess.kill("SIGTERM");
    }

    // Force kill after 5s if still alive
    setTimeout(() => {
      if (botProcess && botProcess.exitCode === null) {
        console.warn("Bot did not exit gracefully, force killing...");
        if (process.platform === "win32" && botProcess.pid) {
          try {
            execSync(`taskkill /pid ${botProcess.pid} /T /F`, {
              stdio: "ignore",
            });
          } catch {
            // Already dead
          }
        } else {
          botProcess.kill("SIGKILL");
        }
      }
      resolve();
    }, 5000);
  });
}
