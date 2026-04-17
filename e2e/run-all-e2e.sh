#!/usr/bin/env bash
# Run ALL E2E tests (API + Playwright) against all 3 language bots.
#
# Usage: ./run-all-e2e.sh [dotnet|node|python]
#   No argument runs all 3 languages.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LANG_ARG="${1:-all}"

echo "================================="
echo "  Phase 1: API E2E Tests"
echo "================================="
"$SCRIPT_DIR/run-api-tests.sh" "$LANG_ARG"

echo ""
echo "================================="
echo "  Phase 2: Playwright E2E Tests"
echo "================================="
"$SCRIPT_DIR/run-playwright-tests.sh" "$LANG_ARG"

echo ""
echo "================================="
echo "  All E2E tests passed ✅"
echo "================================="
