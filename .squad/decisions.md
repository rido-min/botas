# Squad Decisions

> Active directives + recent decisions on top, condensed history below. Inbox items live in `.squad/decisions/inbox/` (gitignored); design proposals awaiting owner review live in `.squad/decisions/deferred/`.

## Active Directives (standing)

These are persistent rules that govern how the squad works. They do not "complete."

### D1. Docs-first feature delivery (2026-04-13)
**Captured by:** Rido
A feature is not done until docs (`docs-site/`) and samples are updated in the same PR.

### D2. Remove legacy / backward-compatibility language (2026-04-13)
**Captured by:** Rido
This is a brand-new library. Do not write "legacy", "deprecated path", or "backward-compatible alternative" in user-facing docs.

### D3. Mandatory doc comments for public APIs (2026-04-22)
**Captured by:** Rido
Every public API change/addition must include doc comments: XML `///` for .NET, JSDoc for Node, docstrings for Python.

### D4. Bot Framework changes require owner consent (2026-04-22)
**Captured by:** Rido
Do not make decisions about Bot Framework protocol, HTTP contracts, JWT/auth flows, or activity type definitions without explicit consent from Rido. When in doubt, ask first.

### D5. PR-to-Issue auto-close linking (2026-04-22)
**Captured by:** Rido
PRs that fix issues must use `Fixes #N` / `Closes #N` keywords in the PR body so issues auto-close on merge.

### D6. Documentation modernization rules (2026-04-24)
**Captured by:** Rido
- No version text or selectors in public docs — always assume latest.
- API Reference is linked from each language guide, not from the top nav.
- API Reference docs use the native generator output (DocFX, TypeDoc, pdoc) — no VitePress integration.
- Always work in a new branch from `main`; never commit directly to `main` (branch is protected).

### D7. Rerun before filing E2E failures as code bugs (2026-05-05)
**Captured by:** Nibbler
A single-run E2E failure is filed as a flake-tracking issue (label `flake`), not a code bug. Reproduce in 2+ runs before filing as `bug`. Identical failure across multiple languages in one run is almost always a test-infra race. Reference: #354 → #356.

---

## Active Decisions

### A1. Samples reorganization (Issue #321) — in flight
**Author:** Leela (Lead) | **Owner:** Squad | **Status:** Phase 1 merged, phases 2–5 stacked

Reorganize all samples across .NET / Node / Python into five numbered, parity-aligned categories on the `feat/samples-reorg` branch with one PR per category:

| # | Category | Purpose |
|---|---|---|
| 01 | EchoBot | Minimal entry point |
| 02 | Advanced Hosting | Manual framework wiring (Express/Hono/Koa/Deno on Node; Flask on Python) |
| 03 | Teams Features | Teams-specific activity types |
| 04 | AI Features | Two idiomatic AI samples per language (LangChain, Vercel AI, M.E.AI, …) |
| 05 | Observability | OpenTelemetry + gen_ai conventions, AI + telemetry combined |

**Owner directives captured (2026-05-03):**
- Foundry SDK sample (`04-ai-foundry/`) deferred to a follow-up PR.
- Keep Hono in Node Advanced Hosting; Node Advanced = Hono + Koa + Deno (multiple frameworks demonstrate that `botas-core` is web-server-agnostic).
- Stacked PRs, one per category, merged sequentially.

**Status:** PR #322 (rename `echo-bot` → `01-echo-bot`) merged. Plan in `.squad/decisions/deferred/leela-samples-reorg-plan.md`.

### A2. Public ConversationClient + CreateConversationAsync (.NET, PR #349) (2026-05-05)
**Author:** Amy (.NET Dev) | **Status:** Implemented; spec follow-up open

`.NET ConversationClient` is now a public type and exposes `CreateConversationAsync(...)`. This unlocks proactive scenarios (sending the first message to a user without an inbound activity) for .NET hosts. Node and Python expose equivalent surfaces; the spec was already cross-language.

**Follow-up (open):** `specs/proactive-messaging.md` still says .NET does **not** expose `ConversationClient` publicly — needs update to reflect PR #349.

### A3. Spec compliance tests — design proposal (PR #347, planning artifact) (2026-05-04)
**Author:** Squad (planning artifact in deferred/) | **Status:** Proposal — awaiting owner answers to 3 open questions

Design for a CI mechanism that catches "this spec cites a file/symbol that no longer exists" drift between `specs/` and the three implementations. Frontmatter `implements:` block per spec lists `path` + `anchor` (and optional `lines:` warning-only). 50-line Python script in `scripts/`, runs as a PR check.

**Open questions for Rido:**
1. Block PRs on missing-anchor errors, or warn only?
2. Required for new specs in `specs/`?
3. Citation granularity — per-spec, or per-section?

**Doc:** `.squad/decisions/deferred/spec-compliance-tests.md` (in repo via PR #347).

### A4. Node `BotApplication.onTurnError` hook — design (Issue #328)
**Author:** Leela (Lead) | **Status:** Proposed — awaiting owner sign-off

Node handlers/middleware throw silently by default (`processAsync` swallows + debug-logs). Proposal adds an optional `onTurnError(error, activity?)` hook on `BotApplication`, invoked before the error is collapsed into HTTP 500. Throwing inside the hook still results in 500 with the original error logged.

**Doc:** `.squad/decisions/deferred/leela-on-turn-error.md`. Cross-language: .NET surfaces handler errors via ASP.NET Core middleware; Python via FastAPI exception handlers — neither needs a parity change unless owner asks.

### A5. Add `npm run typecheck` step to Node CI job (PR #332)
**Author:** Bender (DevOps) | **Status:** Ready to merge — awaiting owner ack

PR #332 adds a `Typecheck` step in `.github/workflows/CI.yml` between Build and Test for the Node job. Originally blocked on PR #331 (typecheck script in samples) — **#331 is now merged**, so #332 can land. See `.squad/decisions/deferred/leela-sample-ci-gaps.md` for the gap analysis that motivated this.

### A6. TurnState Spec & Three-Scope Design (Issue #361) — Phase 1 complete
**Author:** Leela (Lead) | **Status:** Proposed — awaiting owner review & approval

Created `specs/turn-state.md` defining a state management system for botas bots, inspired by Microsoft.TeamsAI but simplified for v1. Key design:

- **Three-scope model** (Conversation, User, Temp) with automatic key derivation from activity fields (channelId, botId, conversationId, userId)
- **Storage abstraction** (IStorage) with read/write/delete operations; pluggable backends (MemoryStorage, Cosmos, etc.)
- **Lifecycle**: Load before middleware, save after handler; dirty tracking via JSON hash to avoid wasteful storage writes
- **Concurrency**: Last-write-wins v1; optimistic concurrency with ETags deferred to v2
- **TurnContext integration**: `context.state` property (nullable when storage not configured)

**Open questions for Rido** (blocking Phase 2 implementation fan-out):
1. Should `app.UseState(storage)` be a middleware or built into core?
2. Storage config location: Constructor option vs. separate method?
3. Save state even when handler throws?
4. Pre-populate temp scope with `input` (activity.text) automatically?
5. Is MemoryStorage sufficient for v1 or include one cloud adapter?

**Files updated**: `specs/turn-state.md` (new), `specs/README.md`, `specs/architecture.md` (added TurnState to pipeline + components).

**Phase 2 (pending approval)**: Amy (`.NET`), Fry (Node.js), Hermes (Python) implement TurnState + MemoryStorage in parallel; Kif writes state management guide for `docs-site/`.

**Decision doc**: `.squad/decisions/inbox/leela-turn-state-spec.md` (architectural decisions, alternatives, deviations from TeamsAI).

### A7. TurnState implementation outcomes — Issue #361 Phase 2 (2026-05-21)
**Author:** Squad (consolidated) | **Owner:** Leela | **Status:** Implemented and tested

Phase 2 of A6 (TurnState). All three language implementations shipped and parity-aligned.

**Final decisions captured this round:**

1. **Resolved open questions on A6** (Leela):
   - Integration: middleware via `app.UseState(storage)` (opt-in), NOT built into BotApplication core.
   - Atomic semantics: state is saved ONLY when the turn completes without throwing. Exceptions discard state writes.
   - v1 storage: `MemoryStorage` + `FileStorage` ship in v1. Cloud adapters (Blob/Redis/Cosmos) are deferred to follow-up issues.

2. **Canonical FileStorage key encoding** (Leela parity review):
   - RFC 3986 percent-encoding with no safe characters.
   - .NET: `Uri.EscapeDataString(key)`
   - Node.js: `encodeURIComponent(key)`
   - Python: `urllib.parse.quote(key, safe="")`
   - Pinned in `specs/turn-state.md` under "Cross-Language Parity Rules".
   - Cross-language interop tests added by Nibbler guard the rule.

3. **Known character-class edge cases between RFC 3986 implementations** (Amy — flagged for future review):
   - `!` `'` `(` `)` `*` `~` behave slightly differently across .NET / Node / Python percent-encoders.
   - Not fixed in v1 — keys in practice (channel/bot/conversation/user IDs) don't use these characters.
   - If user-provided keys with these chars become common, the spec may need a normalization step.

4. **Test coverage added** (Nibbler):
   - Cross-language FileStorage filename parity tests (each language asserts the same encoded filename for the same key).
   - Behavioral parity scenarios in each language: atomic-on-error, dirty tracking, scope isolation.
   - Fixture convention: state-related tests use `http://localhost:3978/` as serviceUrl to comply with the SSRF allowlist in Python's `_validate_service_url`.

**Result:** TurnState landed across .NET/Node/Python with byte-identical FileStorage interop and parity-locked behavior.
- .NET: 165 passed, 1 skipped (pre-existing `Middleware_LoadsAndSavesState`)
- Node: 203 passed (191 botas-core + 12 botas-express)
- Python: 204 passed, 11 skipped

---

## Deferred (proposals awaiting owner review)

Stored under `.squad/decisions/deferred/` (gitignored — not for cross-PR sharing). Active items pending owner action are tracked above as A3–A5.

| File | Topic | Status |
|---|---|---|
| `spec-compliance-tests.md` | Spec ↔ code citation verification (PR #347) | A3 — awaiting owner answers |
| `leela-on-turn-error.md` | Node `BotApplication.onTurnError` hook (#328) | A4 — awaiting owner sign-off |
| `bender-ci-typecheck.md` | Node CI typecheck step (PR #332) | A5 — ready, awaiting owner ack |
| `leela-sample-ci-gaps.md` | Why Node samples didn't catch `fix/samples-0503` bugs | Informational; informs A1 + A5 |
| `leela-samples-reorg-plan.md` | Full samples reorg plan (Issue #321) | A1 reference; **partially superseded** by 2026-05-03 owner directives (keep Hono; defer Foundry) |

---

## Archived Decisions

One-liners. Implementation details live in PRs / commits / `.squad/log/`.

### Foundation & spec work (2026-04-12 → 2026-04-15)
1. **Jekyll docs scaffold** (2026-04-12) — superseded by VitePress.
2. **`docs/` → `specs/` + `art/`** (2026-04-13) — repo restructure.
3. **Middleware docs enhancement** (2026-04-13).
4. **RemoveMentionMiddleware in .NET / Node / Python** (2026-04-13, Issue #51).
5. **BotApp simplified API — docs leading** (2026-04-13).
6. **Python `botas` / `botas-fastapi` package split** (2026-04-13, PR #48).
7. **CatchAll handler — cross-language parity** (2026-04-13).
8. **TeamsActivity spec design** (2026-04-13) — superseded by spec consolidation (#14).
9. **Python RemoveMentionMiddleware parity fix** (2026-04-13) — case-insensitive, AppId fallback.
10. **Typing activity — cross-language `sendTyping()`** (2026-04-13).
11. **Issue triage rounds 1, 2, 3** (2026-04-13 → 2026-04-25).
12. **VitePress migration from Jekyll** (2026-04-13).
13. **Spec consolidation — 18 files → 11 core + 2 future** (2026-04-13).
14. **P1 security batch — JWT before dispatch, SSRF, JWKS cache, token rate-limit, no PII at DEBUG** (2026-04-13, PRs #118 / #119 / #120).
15. **FluentCards adoption in Teams samples** (2026-04-15, all 3 languages).
16. **Auth setup restructure — Teams CLI first** (2026-04-15).
17. **CD release job + GitHub Release creation** (2026-04-15, PRs #196 / #197).
18. **botas-core rename + `BotApplication.Version` property** (2026-04-15, PR #198).
19. **Getting Started revamp — code-first** (2026-04-15, PR #201).
20. **Spec restructure — condensed + reference docs** (2026-04-15, PR #202).
21. **Node JWT decoupling from botas-core** (2026-04-15, PR #173).
22. **Docs-site CI + Netlify PR previews** (2026-04-15, PR #176).
23. **CI/CD hardening — SHA pinning, caching, concurrency** (2026-04-15, PR #177).
24. **E2E gates the CD pipeline** (2026-04-15, PR #191).
25. **Release publishing matrix — stable → public registries, non-stable → GitHub Packages / TestPyPI** (2026-04-21, PR #196).
26. **Both `release/*` branches and `v*` tags trigger stable releases** (2026-04-21).
27. **`specs/releasing.md` written** (2026-04-21, PR #196).

### Docs / API / governance (2026-04-22 → 2026-04-26)
28. **Tiered Setup Path — README → getting-started → setup → authentication** (2026-04-22).
29. **API documentation tooling + VitePress integration (initial)** (2026-04-22) — later replaced by D6 (native HTML output).
30. **DocFX + VitePress integration for .NET API docs** (2026-04-23) — later simplified per D6.
31. **Sanitize .NET API docs to remove XML tags** (2026-04-22, PR #230) — strip `<example>`, `<code>`, `<see>` so VitePress builds.
32. **Markdown cross-links outside backticks** (2026-04-22) — fix nodejs/python API ref tables.
33. **Security #207: wildcard service-URL allowlist** (2026-04-23).
34. **Issue #205: update Teams CLI references** (2026-04-23).
35. **Sample alignment plan — Issues #211 & #218** (2026-04-25) — superseded by A1 reorg.
36. **`Skills.md` for agent integration** (2026-04-25).
37. **`ActivityType` split — Core vs Teams** (2026-04-22).
38. **Publish `botas-fastapi` to PyPI via CD** (2026-04-22, PR #213).
39. **Accumulate `versions.json` across docs deploys** (2026-04-23) — superseded by D6 (no version text).
40. **Fix `botas-fastapi` PyPI publishing — OIDC trusted publisher** (2026-04-23).
41. **Issue #236 reassignment + ActivityType parity verification — closed as resolved** (2026-04-23 → 2026-04-25).
42. **Express 405 for non-POST on `/api/messages`** (2026-04-25, PR #255, Issue #250).
43. **Remove version text + restructure API references** (2026-04-25, PR #254) — implements D6.
44. **Standard HTTP error response format `{error, message}`** (2026-04-25, PRs #256 / #257 / #258, Issue #247).
45. **Logging documentation structure** (2026-04-XX) — `docs-site/logging.md` with code-group blocks for all 3 languages.
46. **id / channelId promoted to typed CoreActivity fields** (2026-04-26, PRs #261 / #269) — completes Decision 6 from earlier round.

### Recent fixes & infrastructure (2026-04-13 → 2026-05-05)
47. **CI only on PR (not push to main)** (2026-05-02, PRs #305 / #306).
48. **Node `processAsync` re-throws after writing 500** (2026-05-04, PR #333, Issue #328).
49. **`tsc --noEmit` typecheck for all Node samples** (2026-05-04, PR #331).
50. **OTel sample extracted to dedicated `otel-bot` (Python)** (2026-04, refactor in observability work).
51. **Auth & ConversationClient OTel spans (.NET)** (2026-05-02, observability spec PR #284 + follow-ups) — `botas.auth.inbound` is intentional .NET difference (handled by Microsoft.Identity.Web).
52. **Serialize ActivitySource test classes via xUnit `[Collection]`** (2026-05-02, PR #307).
53. **OpenTelemetry observability spec** (2026-05-02, PR #284).
54. **JSR publishing for botas-core as `@botas/core`** (2026-04-28 → 2026-05-01, PRs #297 / #298 / #299 / #300 / #308).
55. **Internal-visibility refactor across all 3 languages** (2026-04-27 → 2026-05-01, PRs #292 / #295) — narrow public surface; `TeamsChannelData` and sub-types kept public.
56. **Lower minimum Python version 3.12 → 3.8** (PR #293).
57. **Invoke handler dispatch — 200 with no handlers, 501 on mismatch** (2026-04-25, PR #270, Issue #262).
58. **Case-insensitive activity type handler lookup** (2026-04-25, PR #267, Issue #263).
59. **400 for missing required activity fields** (2026-04-25, PR #271, Issue #260).
60. **`Action.Submit` invoke handling + mention E2E** (2026-04-25, PR #281).
61. **Conversation ID encoding fix + docs improvements** (2026-04-25, PR #282).
62. **Spec gaps from clean-room exercise resolved** (2026-04-25, PR #277).
63. **Samples reorg PR #1 — rename `echo-bot` → `01-echo-bot`** (2026-05-04, PR #322) — first slice of A1.
64. **Public docs mention coding agents** (2026-05-03, PR #314).
65. **05-observability sample upgraded to AI + OTel across all 3 languages** (2026-05-04, PR #329).
66. **LangChain sample with OTel + error handling** (2026-05-04, PR #330).
67. **Spec accuracy fixes — sample paths, env vars, auth specs, API surface** (2026-05-03 → 2026-05-04, PRs #335 / #336 / #338) — recurring drift; motivates A3.
68. **Teams-activity spec consolidated from `specs/future/` into main specs** (2026-05-03, PR #334).
69. **Custom token factory must return non-empty token** (2026-05-05, PR #350) — Node + Python; .NET MSAL path validates internally.
70. **`AddCustomJwtBearer` adds v2.0 issuer for single-tenant** (2026-05-04, PR #348).
71. **Auth scheme span guard fix + AI E2E tests (.NET)** (2026-05-03, PR #327) — multi-scheme `AddCustomJwtBearer` now configures each scheme's ConfigurationManager.
72. **Node OTel DiagAPI logger overwrite warnings silenced (sample-level)** (2026-05-04, PR #353).
73. **Remove remaining `createRequire` calls for Deno compatibility** (2026-05-04, PR #352).
74. **Process docs separated from specs** (2026-05-04, PR #346) — `specs/process/` for releasing/contributing/parity/error-handling/spec-compliance design.
75. **Language parity matrix added** (2026-05-04, PR #345).
76. **Reference doc API drift fixes** (2026-05-04, PR #344) — `specs/reference/{dotnet,nodejs,python}.md` matched against post-refactor public surface.
77. **Error handling spec added** (2026-05-04, PR #343) — references #44 (JSON error format) and #48 (Node re-throw).
78. **Public ConversationClient + `CreateConversationAsync` (.NET)** (2026-05-05, PR #349) — see also A2 follow-up to update `specs/proactive-messaging.md`.
79. **`azure-identity` dependency added for Python + outbound-auth spec updated** (2026-05-05, PR #351).
80. **Decisions log cleanup** (2026-04-15) — first big condensation; this file is its successor.

---

## Governance

- All meaningful changes require team consensus (Squad coordinates, owner Rido approves Bot Framework decisions per D4).
- Document architectural decisions here. Keep agent histories focused on work, decisions focused on direction.
- Drop-box pattern: agents write proposals to `.squad/decisions/inbox/{name}-{slug}.md`; Scribe folds implemented items into this file. `inbox/` is gitignored.
- Standing design proposals (multi-PR or owner-review-pending) live in `.squad/decisions/deferred/` and are tracked above.
- Active decisions are recent and actionable (≤ ~10 entries). Once shipped, they collapse to a one-line entry in Archived.
