#!/usr/bin/env bash
# Run e2e tests against the Node echo-bot sample.
# Requires .env with CLIENT_ID, CLIENT_SECRET, TENANT_ID.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load credentials — shared by both the bot and the test runner
set -a
source "$REPO_ROOT/.env"
set +a

# Run from node/ so npm workspace resolution finds botas-express
cd "$REPO_ROOT/node"
npx tsx samples/echo-bot/index.ts &
BOT_PID=$!
cd "$REPO_ROOT"

cleanup() { kill $BOT_PID 2>/dev/null; wait $BOT_PID 2>/dev/null; }
trap cleanup EXIT

echo "Waiting for bot to be ready..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3978/health > /dev/null 2>&1; then
    echo "Bot is ready."
    break
  fi
  if ! kill -0 $BOT_PID 2>/dev/null; then
    echo "Bot process died before becoming ready." >&2
    exit 1
  fi
  sleep 1
done

if ! curl -sf http://localhost:3978/health > /dev/null 2>&1; then
  echo "Bot failed to start within 30 seconds." >&2
  exit 1
fi

BOT_URL=http://localhost:3978 dotnet test e2e/dotnet --filter "Category=Node"
