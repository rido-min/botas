# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-04-22 — PR #219 validation (squad/76-node-audit-fixes)
- **Branch:** `squad/76-node-audit-fixes` — Node.js audit fixes (ReDoS protection, missing await, token race condition, noUncheckedIndexedAccess, error logging, activity input validation)
- **Unit tests:** 121/121 passed (112 botas-core + 9 botas-express). All new audit-fix tests included.
- **Playwright E2E:** 2/2 passed (echo-bot echo reply, adaptive card invoke). Bot started with credentials on port 3978.
- **Environment note:** The `run-playwright-tests.ps1` script fails on this Windows env because `Start-Process -FilePath "npx"` is not a valid Win32 application. Manual bot startup + Playwright invocation works fine.
- **Verdict:** ✅ PR #219 is safe to merge. No regressions detected.

### 2026-05-05 — Cross-Language Playwright E2E Test Parity Gap (teams-tests)
- **Issue:** Coordinator ran Playwright e2e suite across all three languages; Node.js test-bot **failed invoke-bot adaptive card test**.
- **Symptom:** Playwright cannot find Submit button; test-bot not sending adaptive card in response to user typing "card".
- **Parity Status:** .NET TestBot passes same test (4/4); Python test-bot also fails (3/4) with identical error.
- **Root Cause:** Unknown — requires code audit of Node.js test-bot card handler vs .NET reference implementation.
- **Impact:** Node.js test-bot implementation has behavior gap vs .NET; must investigate and align.
- **Next Action:** Audit `node/samples/teams-tests/test-bot.ts` (or equivalent handler) and verify activity dispatch for 'card' message type.

### 2026-05-05 — Issue #354 Filed: Invoke-Bot Adaptive Card Parity Gap
- **Issue:** https://github.com/rido-min/botas/issues/354 — "Node and Python test-bot samples don't send Adaptive Card on card message (parity gap with .NET)"
- **Test:** `e2e/playwright/tests/invoke-bot.spec.ts` ("adaptive card invoke updates the card")
- **Failure:** Node and Python fail with "Could not find Submit button at page level or in any iframe"; .NET passes.
- **Code Audit:** All three test-bot implementations (`dotnet/TestBot`, `node/test-bot`, `python/test-bot`) have identical "card" handlers with correct Adaptive Card serialization — but Node and Python don't send the card. Root cause likely in Express/FastAPI adapters or botas-core activity serialization.
- **Quick Repro:** `cd node/samples/test-bot && npx tsx index.ts` → send "card" → no card appears (vs .NET which does).
- **Labels:** `bug`, `squad`
