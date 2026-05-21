# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-05-21 — TurnState Spec Drafted (Phase 1, Issue #361)

**Context**: Leela (Lead) completed Phase 1 of TurnState design for GitHub issue #361.

**Impact for Nibbler (E2E Tester)**: 
- TurnState spec ready in `specs/turn-state.md` 
- Phase 2: Add E2E tests for state persistence across turns (pending Rido approval of 5 open questions in decision A6)
- Test scope: Conversation state (shared), User state (per-user), Temp state (per-turn)
- Test storage backends: MemoryStorage initially, cloud adapters in later phases
- Estimated timeline: After implementation phases complete (Amy, Fry, Hermes)

**Next step**: Watch `.squad/decisions.md` A6 for Rido's approval; E2E tests will follow implementation.

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

### 2026-05-05 — Issue #354 Filed: Invoke-Bot Adaptive Card Parity Gap (NOW CLOSED AS FLAKE)
- **Issue:** https://github.com/rido-min/botas/issues/354 — "Node and Python test-bot samples don't send Adaptive Card on card message (parity gap with .NET)" — CLOSED (not planned)
- **Original Failure:** Node and Python fail with "Could not find Submit button at page level or in any iframe"; .NET passes.
- **Rerun Evidence:** Squad re-ran the Playwright e2e suite. **Run 1: Node and Python both failed invoke-bot identically (~1.2m each). Run 2: Node 4/4 passed (~1.1m), Python 4/4 passed (~58.3s).** .NET passed both runs (~38s).
- **Verdict:** This is **test flake, not a code bug**. The bot samples are NOT broken. Identical failure pattern on Node and Python in the same run → Playwright/Teams UI timing issue (Adaptive Card render race in iframe). Bot code is correct.
- **Follow-up:** Issue #356 filed to track and fix the flaky submit button selector timing in the invoke-bot Playwright test.

### 2026-05-05 — Issue #356 Filed: Invoke-Bot Adaptive Card Test Flake
- **Issue:** https://github.com/rido-min/botas/issues/356 — "flake: invoke-bot adaptive card test — 'Could not find Submit button' intermittent failure"
- **Root Cause:** Playwright submit button selector resolves before Adaptive Card iframe completes hydration in Teams web client.
- **Evidence:** Rerun runs identically (both fail, then both pass) → race condition, not code bug
- **Proposed Fix:** Add explicit waits for Submit button visibility before query (`await expect(submit).toBeVisible({ timeout: 30000 })`) or wait for iframe load before searching
- **Location:** `e2e/playwright/tests/invoke-bot.spec.ts:27–66` (button query helper ~lines 64–66)
- **Workaround:** Rerun on first failure; test passes on second execution
- **Labels:** `bug`, `squad`

### Learnings
**Rule: Treat single-run e2e failures as suspect; require 2+ confirmations before filing as a code bug**
- Single-run test failures can be flakes; identical failures across multiple languages in the same run strongly suggest test infrastructure issues, not code bugs
- Best practice: Before filing a parity bug, verify the failure is reproducible and consistent in a second run
- When in doubt, rerun first; only file as code bug if the failure is deterministic
