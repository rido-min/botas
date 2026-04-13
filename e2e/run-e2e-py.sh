#!/usr/bin/env bash
# Run e2e tests against the Python echo-bot sample.
# Requires .env with CLIENT_ID, CLIENT_SECRET, TENANT_ID.
set -e

# Load credentials — shared by both the bot and the test runner
set -a
source .env
set +a

pushd python/samples/echo-bot
python main.py &
BOT_PID=$!
popd
trap "kill $BOT_PID 2>/dev/null" EXIT

echo "Waiting for bot to be ready..."
until curl -sf "http://localhost:${PORT:-3978}/health" > /dev/null 2>&1; do sleep 1; done
echo "Bot is ready."

BOT_URL="http://localhost:${PORT:-3978}" dotnet test e2e/dotnet --filter "Category=Python"
