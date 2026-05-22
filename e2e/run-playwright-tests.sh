#!/usr/bin/env bash
# Run Playwright E2E tests against all 3 language bots.
# Each bot is started by its project setup, tested, and stopped by its teardown.
# The browser instance is reused across all 3 language runs.
#
# Usage: ./run-playwright-tests.sh [dotnet|node|python] [--headed]
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
HEADED=""

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found." >&2
  exit 1
fi

if [ ! -f "$PW_DIR/storageState.json" ]; then
  echo "Error: storageState.json not found. Run 'cd e2e/playwright && npm run setup' first." >&2
  exit 1
fi

# Parse arguments
LANGUAGES=""
for arg in "$@"; do
  case "$arg" in
    --headed) HEADED="--headed" ;;
    *) LANGUAGES="$arg" ;;
  esac
done
LANGUAGES="${LANGUAGES:-all}"

# Set E2E_LANGUAGES env var based on language selection
if [ "$LANGUAGES" = "all" ]; then
  export E2E_LANGUAGES="dotnet,node,python"
else
  export E2E_LANGUAGES="$LANGUAGES"
fi

echo ""
echo "=============================="
echo "  Running Playwright E2E Tests"
echo "  Language(s): $E2E_LANGUAGES"
echo "=============================="
echo ""

cd "$PW_DIR"
npx playwright test --project=teams-tests $HEADED

echo ""
echo "======================================="
echo "  All Playwright E2E tests passed ✅"
echo "======================================="

