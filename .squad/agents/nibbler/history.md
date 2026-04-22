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
