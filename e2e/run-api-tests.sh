#!/usr/bin/env bash
# Run API E2E tests (echo + invoke) against all 3 language bots.
# Each bot is started, tested, and stopped in sequence.
#
# Usage: ./run-api-tests.sh [dotnet|node|python]
#   No argument runs all 3 languages.
#
# Requires .env at repo root with CLIENT_ID, CLIENT_SECRET, TENANT_ID.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found. Copy .env.example and fill in credentials." >&2
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

run_tests_for() {
  local lang="$1"
  local echo_category invoke_category
  case "$lang" in
    dotnet)  echo_category="DotNet";  invoke_category="InvokeDotNet" ;;
    node)    echo_category="Node";    invoke_category="InvokeNode" ;;
    python)  echo_category="Python";  invoke_category="InvokePython" ;;
    *) echo "Unknown language: $lang" >&2; return 1 ;;
  esac

  echo ""
  echo "=============================="
  echo "  Testing: $lang"
  echo "=============================="

  case "$lang" in
    dotnet) start_dotnet_bot ;;
    node)   start_node_bot ;;
    python) start_python_bot ;;
  esac

  wait_for_bot

  local bot_url="http://localhost:${PORT:-3978}"
  echo "Running echo tests ($echo_category)..."
  BOT_URL="$bot_url" dotnet test "$SCRIPT_DIR/dotnet" --filter "Category=$echo_category" --no-build 2>/dev/null || \
  BOT_URL="$bot_url" dotnet test "$SCRIPT_DIR/dotnet" --filter "Category=$echo_category"

  echo "Running invoke tests ($invoke_category)..."
  BOT_URL="$bot_url" dotnet test "$SCRIPT_DIR/dotnet" --filter "Category=$invoke_category" --no-build 2>/dev/null || \
  BOT_URL="$bot_url" dotnet test "$SCRIPT_DIR/dotnet" --filter "Category=$invoke_category"

  stop_bot
  echo "✅ $lang passed"
}

# Parse arguments
LANGUAGES="${1:-all}"
if [ "$LANGUAGES" = "all" ]; then
  LANGUAGES="dotnet node python"
fi

echo "Building E2E test project..."
dotnet build "$SCRIPT_DIR/dotnet" -q 2>/dev/null || dotnet build "$SCRIPT_DIR/dotnet"

for lang in $LANGUAGES; do
  run_tests_for "$lang"
done

echo ""
echo "=============================="
echo "  All API E2E tests passed ✅"
echo "=============================="
