#!/usr/bin/env bash
# Run e2e tests against the Node/Express EchoBot sample.
# Requires a .env file with CLIENT_ID, CLIENT_SECRET, TENANT_ID.
# Note: external bot auth bypass is not yet implemented; real credentials are required.
set -e

tsx --env-file .env node/samples/express/index.ts &
BOT_PID=$!
trap "kill $BOT_PID 2>/dev/null" EXIT

echo "Waiting for bot to be ready..."
until curl -sf http://localhost:3978/health > /dev/null; do sleep 1; done
echo "Bot is ready."

BOT_URL=http://localhost:3978 dotnet test e2e/dotnet --filter "Category=External"
