#!/usr/bin/env bash
# Run e2e tests against the Python/FastAPI EchoBot sample.
# Requires a .env file with CLIENT_ID, CLIENT_SECRET, TENANT_ID.
# Note: external bot auth bypass is not yet implemented; real credentials are required.
set -e

pushd python/samples/fastapi
set -a
source ../../../.env
set +a
uvicorn main:app --host 0.0.0.0 --port "${PORT:-3978}" &
BOT_PID=$!
popd
trap "kill $BOT_PID 2>/dev/null" EXIT

echo "Waiting for bot to be ready..."
until curl -sf "http://localhost:${PORT:-3978}/health" > /dev/null; do sleep 1; done
echo "Bot is ready."

BOT_URL="http://localhost:${PORT:-3978}" dotnet test e2e/dotnet --filter "Category=External"
