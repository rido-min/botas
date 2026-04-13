#!/usr/bin/env bash
# Run .NET e2e tests (in-process + anonymous + external with auth).
# Requires .env with CLIENT_ID, CLIENT_SECRET, TENANT_ID for external tests.
set -e

# Load credentials — shared by both the bot and the test runner
set -a
source .env
set +a

# Run in-process tests (JWT validation with test keys + anonymous bot tests)
dotnet test e2e/dotnet --filter "Category!=External"

# Start the .NET EchoBot with Azure AD config
sh e2e/env2azad.sh .env dotnet/samples/EchoBot/Properties/launchSettings.json
dotnet run --project dotnet/samples/EchoBot &
BOT_PID=$!
trap "kill $BOT_PID 2>/dev/null" EXIT

echo "Waiting for bot to be ready..."
until curl -sf http://localhost:5000/health > /dev/null 2>&1; do sleep 1; done
echo "Bot is ready."

BOT_URL=http://localhost:5000 dotnet test e2e/dotnet --filter "Category=DotNet"
