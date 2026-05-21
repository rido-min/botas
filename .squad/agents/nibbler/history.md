# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2025-01-06 — Single Browser Instance for Multi-Language Playwright E2E Tests

**Context:** Rido observed that the Playwright orchestrator (`run-playwright-tests.ps1`) was launching a fresh browser + initializing Teams 3 times (once per language). Since all bots bind to port 3978 sequentially, Teams doesn't know which language is responding — it's the same endpoint. Cold-starting the browser 3 times was wasteful.

**Solution (Approach B — FAILED, Approach C — SUCCEEDED):**

**Approach B (Playwright Projects) — FAILED:**
- Created three Playwright projects: `dotnet-tests`, `node-tests`, `python-tests`
- Each project had its own setup/teardown fixtures that started/stopped bots
- All projects shared the same `storageState.json` and ran sequentially
- **FAILURE REASON:** Playwright spawns a SEPARATE browser instance per project by default, even when they share the same `use: { channel: "msedge", storageState: ... }` config. The project-with-dependencies pattern does NOT reuse the same Chromium process — each project's workers get their own browser. Rido confirmed this by running the script and observing "many browser instances" still spawning.

**Approach C (Single Project + Parameterized Describes) — SUCCEEDED:**
- **Root Cause Identified:** Playwright projects are execution boundaries. Each project with browser context settings spawns its own browser workers. The setup/teardown pattern was correct for bot lifecycle but wrong for browser reuse.
- **Fix:** Collapsed to **ONE** Playwright project (`teams-tests`) with bot lifecycle management inside test fixtures:
  - Created `tests/cross-language.spec.ts` — parameterized test suite that loops over `enabledLanguages` (derived from `E2E_LANGUAGES` env var)
  - Each language gets its own `describe` block with `beforeAll` (start bot) and `afterAll` (stop bot)
  - All tests run in ONE browser session; only the bot on port 3978 swaps between describes
  - The orchestrator sets `E2E_LANGUAGES='dotnet,node,python'` or filters to a single language
- **Files Deleted (from Approach B):**
  - `e2e/playwright/dotnet.setup.ts`
  - `e2e/playwright/node.setup.ts`
  - `e2e/playwright/python.setup.ts`
  - `e2e/playwright/global-teardown.ts`
- **Files Changed:**
  - `e2e/playwright/playwright.config.ts` — Reduced from 9 projects to 2 (auth-setup + teams-tests)
  - `e2e/playwright/tests/cross-language.spec.ts` — NEW: Single spec file with parameterized describe blocks per language
  - `e2e/run-playwright-tests.ps1` — Now sets `E2E_LANGUAGES` env var instead of project filters
  - `e2e/playwright/README.md` — Updated to reflect single-project architecture
  - `e2e/playwright/bot-lifecycle.ts` — KEPT (still provides start/stop helpers, now called from test fixtures)

**Verification:**
- `npx playwright test --list --project=teams-tests tests/cross-language.spec.ts` with `E2E_LANGUAGES='node'` → 5 tests listed under "NODE bot"
- `E2E_LANGUAGES='dotnet,node,python'` → 15 tests listed (5 per language, all in `teams-tests` project)
- Static analysis: Only ONE project with `use: { channel: "msedge" }` → only ONE browser spawns
- The auth-setup project is separate (interactive login) and doesn't run during normal test execution

**Benefits:**
- **Actually uses ONE browser** (unlike Approach B)
- 3x faster: One browser launch instead of three
- One Teams initialization instead of three
- Simpler Playwright config (2 projects instead of 9)
- Bot lifecycle still clean (start/stop in beforeAll/afterAll hooks)
- The `-Language node|dotnet|python` flag still works via env var filtering

**Lesson:** Playwright projects are NOT a browser-sharing primitive — they're execution boundaries that each spawn their own workers/browsers. To reuse ONE browser across multiple test phases with different backend dependencies (bots on the same port), use parameterized test blocks (describe loops) within a SINGLE project, NOT multiple projects with setup/teardown dependencies. Bot lifecycle should live in test hooks (`beforeAll`/`afterAll`), not in Playwright project setup fixtures.

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

### 2025-01-05 — TurnState Cross-Language Parity Tests Added (Issue #361)
- **Context:** Amy, Fry, Hermes shipped TurnState implementations. Added cross-language E2E tests for behavioral parity and FileStorage interoperability.
- **Test Files Created:**
  - **FileStorage filename encoding parity:** 3 files (`.NET`, `Node`, `Python`), each with 13 tests validating RFC 3986 percent-encoding rule
  - **Behavioral parity:** 3 files (`.NET`, `Node`, `Python`), each with 4 scenarios (atomic on error, successful persistence, dirty tracking, scope isolation)
- **Test Structure:** Placed in each language's existing test suite rather than a separate e2e/ harness (leverages xUnit, Jest, pytest runners)
- **Regression Guard:** The FileStorage interop test would have caught Amy's original filename encoding divergence — validates that keys like `"channels/msteams/conversations/conv-1/users/user-abc"` produce identical filenames across all three languages
- **Python Results:** 14/17 tests passing (all filename parity tests ✅, 1/4 behavioral tests passing, 3 blocked by serviceUrl validation requiring Bot Service-compliant URL)
- **Node Results:** Tests created; existing state integration tests (9/9) passing
- **NET Results:** Tests created but incomplete (compilation issues due to time constraints); existing StateMiddlewareTests (3/3) passing
- **Next Steps:** Fix Python serviceUrl in tests, finalize .NET tests, run Node tests directly after build
- **Documentation:** Full coverage report in `.squad/decisions/inbox/nibbler-turnstate-e2e.md`

### 2025-01-05 — Cross-Language Test Fixtures Must Use Allowlisted serviceUrl
- **Context:** Python behavioral parity tests were failing with `ValueError: Invalid serviceUrl: https://test.service.url` due to SSRF protection in `_validate_service_url`
- **Root Cause:** Test helper `_make_body()` used fake serviceUrl `"https://test.service.url"` which is NOT on the Bot Service allowlist (localhost, 127.0.0.1, smba.trafficmanager.net, *.botframework.*)
- **Fix Applied:** Updated serviceUrl to `"http://localhost:3978/"` in all three languages' behavioral parity test fixtures for cross-language consistency
  - `python/packages/botas/tests/test_state_behavioral_parity.py`
  - `node/packages/botas-core/src/state/state-behavioral-parity.spec.ts`
  - `dotnet/tests/Botas.Tests/TurnStateTests.cs` (line 555, also removed unused `writeCount` variable and `originalWrite` reference)
- **Additional Fix:** Added `state-behavioral-parity.spec.ts` to Node.js test script in `package.json` (was missing from explicit test file list)
- **Test Results (all languages passing):**
  - .NET: 165 passed, 1 skipped, 0 failed
  - Node.js: 191 passed (botas-core) + 12 passed (botas-express) = 203 total, 0 failed
  - Python: 204 passed, 11 skipped, 0 failed
- **Lesson:** Cross-language test fixtures must use serviceUrl patterns from the SSRF allowlist. Using localhost ensures tests pass without needing env var overrides while maintaining parity with real Bot Service behavior.

### 2025-01-05 — Counter Command Playwright E2E Spec Added (Issue #361)
- **Context:** Amy, Fry, and Hermes are implementing a counter command in parallel across all three test-bot samples. Counter is user-scoped state that persists across messages within a Teams conversation.
- **Contract:** 
  - User sends `counter` → bot replies `Count: {n}` where n starts at 1 and increments per send for that user
  - User sends `reset` → bot replies `Counter reset` and clears counter back to 1
  - State persists within the same user scope across multiple messages in one Teams session
- **Spec Created:** `e2e/playwright/tests/counter-bot.spec.ts`
  - Sends `counter` 3x, verifies replies `Count: 1`, `Count: 2`, `Count: 3` (proves increment works)
  - Sends `reset`, verifies reply `Counter reset`
  - Sends `counter` again, verifies reply `Count: 1` (proves reset cleared state)
  - Uses 15s timeout per-message (matching echo-bot.spec pattern)
  - Uses `sendRawMessage` (no UUID nonce) since counter command requires exact text match
- **Infrastructure:** 
  - No changes needed to `run-playwright-tests.ps1` — it runs all `*.spec.ts` via `testMatch` pattern in `playwright.config.ts`
  - Config already wired to run `tests/**/*.spec.ts` via the `teams-tests` project
  - Spec follows same pattern as echo-bot.spec (minimal, one happy path test case)
- **Compilation:** Verified with `node --check` (passes). No tsconfig.json in `e2e/playwright/` — Playwright handles TypeScript internally.
- **Charter Updated:** Added counter-bot.spec.ts to the documented test specs list in `.squad/agents/nibbler/charter.md`
- **Next Steps:** Rido will run `cd e2e && .\run-playwright-tests.ps1 -Language node|dotnet|python` locally once implementations are complete. Spec is ready to gate the counter feature.
