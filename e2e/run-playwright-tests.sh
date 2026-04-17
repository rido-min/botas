#!/usr/bin/env bash
# Run Playwright E2E tests against all 3 language bots.
# Each bot is started, tested, and stopped in sequence.
#
# Usage: ./run-playwright-tests.sh [dotnet|node|python]
#   No argument runs all 3 languages.
#
# Prerequisites:
#   1. Run `cd e2e/playwright && npm run setup` to authenticate with Teams
#   2. .env at repo root with CLIENT_ID, CLIENT_SECRET, TENANT_ID
#   3. e2e/playwright/.env with TEAMS_BOT_NAME
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
PW_DIR="$SCRIPT_DIR/playwright"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found." >&2
  exit 1
fi

if [ ! -f "$PW_DIR/storageState.json" ]; then
  echo "Error: storageState.json not found. Run 'cd e2e/playwright && npm run setup' first." >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

BOT_PID=""
cleanup() {
  if [ -n "$BOT_PID" ] && kill -0 "$BOT_PID" 2>/dev/null; then
    echo "Stopping bot (PID $BOT_PID)..."
    kill "$BOT_PID" 2>/dev/null
    wait "$BOT_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

wait_for_bot() {
  local port="${PORT:-3978}"
  echo "Waiting for bot on port $port..."
  for i in $(seq 1 30); do
    if curl -sf "http://localhost:$port/api/messages" -X POST -H "Content-Type: application/json" -d '{}' > /dev/null 2>&1; then
      echo "Bot is ready."
      return 0
    fi
    if [ -n "$BOT_PID" ] && ! kill -0 "$BOT_PID" 2>/dev/null; then
      echo "Bot process died before becoming ready." >&2
      return 1
    fi
    sleep 1
  done
  echo "Bot failed to start within 30 seconds." >&2
  return 1
}

start_dotnet_bot() {
  echo "Starting .NET test-bot..."
  sh "$SCRIPT_DIR/env2azad.sh" "$ENV_FILE" "$REPO_ROOT/dotnet/samples/TestBot/Properties/launchSettings.json"
  cd "$REPO_ROOT"
  dotnet run --project dotnet/samples/TestBot &
  BOT_PID=$!
}

start_node_bot() {
  echo "Starting Node.js test-bot..."
  cd "$REPO_ROOT/node"
  npx tsx samples/test-bot/index.ts &
  BOT_PID=$!
  cd "$REPO_ROOT"
}

start_python_bot() {
  echo "Starting Python test-bot..."
  cd "$REPO_ROOT/python/samples/test-bot"
  python main.py &
  BOT_PID=$!
  cd "$REPO_ROOT"
}

stop_bot() {
  if [ -n "$BOT_PID" ] && kill -0 "$BOT_PID" 2>/dev/null; then
    kill "$BOT_PID" 2>/dev/null
    wait "$BOT_PID" 2>/dev/null || true
  fi
  BOT_PID=""
}

run_playwright_for() {
  local lang="$1"

  echo ""
  echo "=============================="
  echo "  Playwright: $lang"
  echo "=============================="

  case "$lang" in
    dotnet) start_dotnet_bot ;;
    node)   start_node_bot ;;
    python) start_python_bot ;;
    *) echo "Unknown language: $lang" >&2; return 1 ;;
  esac

  wait_for_bot

  cd "$PW_DIR"
  npx playwright test --project=teams-tests
  cd "$REPO_ROOT"

  stop_bot
  echo "✅ Playwright $lang passed"
}

# Parse arguments
LANGUAGES="${1:-all}"
if [ "$LANGUAGES" = "all" ]; then
  LANGUAGES="dotnet node python"
fi

for lang in $LANGUAGES; do
  run_playwright_for "$lang"
done

echo ""
echo "======================================="
echo "  All Playwright E2E tests passed ✅"
echo "======================================="
