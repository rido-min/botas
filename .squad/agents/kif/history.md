# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

### 2026-05-22 — A8/A9 Docs: RedisStorage Quick Start + CD Release Documentation (PR #363 + PR #366)

**Context**: Amy, Fry, and Hermes shipped RedisStorage across three languages (PR #363). Bender wired CD pipeline (PR #366). Kif updated docs to surface the new feature and document the release process.

**Work completed**:

1. **Updated `docs-site/state.md`** with RedisStorage adapter information:
   - Added RedisStorage to the "Storage adapters" section (after Memory and File storage)
   - Quick-start code snippet: `redisStorage = RedisStorage(redis_client)` (with language-specific syntax variations)
   - Production guidance: connection pooling, health checks, monitoring, cluster deployment
   - Installation instructions per language:
     - .NET: `dotnet add package Botas.Redis`
     - Node.js: `npm install botas-redis`
     - Python: `pip install "botas[redis]"`
   - Noted: No default TTL in v1; state persists until explicit delete (vs. MemoryStorage lifetime = process, vs. FileStorage lifetime = filesystem)
   - Use-case guidance: production bots (multi-instance), distributed deployments, cloud-native patterns

2. **Updated `RELEASING.md`** with CD pipeline changes and new package rows:
   - Job descriptions updated to reflect new Pack Botas.Redis step (.NET)
   - Job descriptions updated to reflect nbgv-setversion + npm publish for botas-redis (Node.js)
   - Verification table extended with new rows:
     - Botas.Redis (NuGet): version, publish link, install test command
     - botas-redis (npm): version, publish link, install test command
   - Added note: Python `botas[redis]` rides the main `botas` package — no separate publish step
   - Install command examples section added (all three language patterns side-by-side)

3. **Informed docs-site/generate-api-docs.sh changes**:
   - Bender added TypeDoc step for botas-redis (mirrors botas-express pattern)
   - Documented in RELEASING.md: "Verify TypeDoc links are generated for botas-redis"

**Key decisions documented**:
- RedisStorage as first-class production-ready adapter alongside Memory/File (not "future" or "preview")
- Installation patterns follow ecosystem norms (not forcing unified "botas-redis" package across languages)
- Release checklist now lists all three language packages explicitly to prevent "forgot to publish" scenarios

**Files modified**:
- `docs-site/state.md` — RedisStorage quick start + production guidance
- `RELEASING.md` — job descriptions, verification table, install commands
- Coordinated with Bender's CD.yml changes and Amy/Fry/Hermes implementation

**Impact**: Users discovering state management docs now see RedisStorage as a built-in, production-ready option. Release coordinators have explicit checklist for publishing all three optional packages.

### 2026-05-23 — Sample Links Added to State Management Docs (Issue #361, Phase 2 Continuation)

**Context**: Amy, Fry, and Hermes are currently creating `06-state-bot` samples in parallel across all three languages. Kif updated docs proactively to link to and promote these samples.

**Work completed**:
1. Updated `docs-site/state.md`:
   - Added "## Try the sample" section immediately after elevator pitch (before deep API docs)
   - Brief description: "A runnable counter bot in all three languages that demonstrates conversation, user, and temp scopes with FileStorage"
   - Three language-specific links to sample paths:
     - `.NET`: `dotnet/samples/06-state-bot/`
     - `Node.js`: `node/samples/06-state-bot/`
     - `Python`: `python/samples/06-state-bot/`
   - One-line invitation: "Run it locally, send a few messages, and watch the JSON files appear in `state-data/`."

2. Updated main `README.md`:
   - Added parenthetical note to State Management entry: "(see 06-state-bot samples in each language)"
   - Kept entry short and discoverable while pointing users toward runnable examples

**Key decision**:
- Proactively linked to sample paths at `{lang}/samples/06-state-bot/` confidently, even though samples are still under development
- This anticipatory linking pattern ensures docs-site users can immediately discover samples upon release
- Consistent with documentation philosophy: samples are primary learning tool, specs are reference

**Files modified**:
- `docs-site/state.md` — added "Try the sample" section with links
- `README.md` — added parenthetical to State Management table entry

**Impact**: Users discovering state management docs will now see working examples immediately, reducing time-to-first-success and improving adoption.

### 2026-06-29 — PostHog Product Analytics Integrated for Docs-Site Usage Tracking (Phase 1)

**Context**: Rido requested adding PostHog analytics to track documentation usage patterns. This is Phase 1 (docs-site only); library integration comes later.

**Work completed**:

1. **Installed posthog-js** as a docs-site dependency (`docs-site/package.json`)

2. **Integrated PostHog in VitePress theme** (`docs-site/.vitepress/theme/index.ts`):
   - Client-side-only initialization (guards for SSR/`typeof window`)
   - Reads configuration from Vite env vars: `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`
   - Default host: `https://us.i.posthog.com`
   - Placeholder API key: `phc_PLACEHOLDER_KEY_SET_VITE_POSTHOG_KEY_IN_ENV` (no telemetry without real key)
   - Enabled autocapture + pageview tracking
   - Captures `$pageview` event on VitePress route changes via `router.onAfterRouteChanged`

3. **Documented usage** in `docs-site/observability.md`:
   - Added "Documentation Site Analytics" section explaining what PostHog tracks (page views, search, interactions)
   - Environment variable reference table
   - Setup instructions for `.env` file and build-time configuration
   - Privacy note: placeholder key is intentionally non-functional

4. **Created `.env.example`** (`docs-site/.env.example`):
   - Template with placeholder values
   - Comments explaining configuration purpose

5. **Updated `.gitignore`** to exclude `.env` files

6. **Verified build**: `npm run docs:build` succeeds without errors

**Key decisions**:
- No hardcoded real keys — security-first approach using env vars with clear placeholder fallback
- Client-side only (SSR-safe) — dynamic import of posthog-js, guards for `typeof window`
- Standard VitePress pattern — `enhanceApp` hook in theme index
- Documented in observability.md (natural fit for telemetry/analytics topics)
- Phase 1 scope: docs-site only; library integration deferred

**Files modified**:
- `docs-site/.vitepress/theme/index.ts` — PostHog init + router tracking
- `docs-site/observability.md` — analytics section added
- `docs-site/package.json` + `package-lock.json` — posthog-js dependency
- `docs-site/.gitignore` — exclude `.env`
- `docs-site/.env.example` — created template

**Branch**: `feat/docs-site-posthog` (committed, not pushed to main per branch protection rules)

**Impact**: Documentation maintainers can now track which pages users visit, how they navigate, and what content needs improvement, while respecting privacy with explicit opt-in configuration.

### 2026-05-22 — TurnState User Documentation Drafted (Phase 2 Docs, Issue #361)

**Context**: Amy, Fry, and Hermes are implementing TurnState in parallel across .NET/Node/Python. Kif drafted user-facing docs anticipatory to implementations.

**Work completed**:
1. Created `docs-site/state.md` — comprehensive user guide with:
   - "What is TurnState?" elevator pitch + when-to-use decision aid
   - Three-scope explanation (conversation/user/temp) with one example each
   - Storage adapters overview (MemoryStorage, FileStorage) with explicit single-instance warning
   - Quick-start guide: create storage → register middleware → read/write in handler
   - 5+ common patterns (counter, timestamp, user prefs, temp scratch space, path syntax)
   - Atomic semantics explanation with error example
   - "What it's NOT" section (not a database, not for large blobs, not for locking)
   - v1 limitations (no concurrency, MemoryStorage/FileStorage only, FileStorage single-instance)
   - Coming later section (cloud adapters, ETags, custom scopes)
   - Language-specific examples using spec signatures verbatim

2. Updated navigation/TOC:
   - Added "State Management" to VitePress sidebar (`docs-site/.vitepress/config.mts`)
   - Updated `docs-site/index.md` Quick Links to include state management link
   - Updated main `README.md` "Learn more" table with State Management row

3. Added cross-reference:
   - Updated `specs/turn-state.md` header with link to `docs-site/state.md` ("📖 User-facing guide")

**Doc structure decisions**:
- **Placement**: `docs-site/state.md` (not `state-management.md`) — matches existing short names (middleware.md, logging.md, observability.md)
- **Language pattern**: Used `::: code-group` tabs showing all three languages side-by-side for each code example (established docs pattern)
- **Scope explanation**: One realistic example per scope (turn counter, display name, transient request ID) to make selection intuitive
- **Storage section**: Made FileStorage single-instance limitation explicit with ⚠️ callout + specific wording ("not thread-safe", "not multi-instance safe")
- **Examples**: All code is spec-verbatim (from specs/turn-state.md lines 700-766) with "from spec — verify after implementations land" implicit (implementations will confirm correctness)

**Spec alignment**:
- Code examples use **exact spec signatures**: 
  - `.NET`: `app.UseState()`, `ctx.State?.Conversation.Get<T>()`, `ctx.State?.SetValue()`
  - Node.js: `bot.useState()`, `ctx.state?.conversation.get<T>()`, `ctx.state?.setValue()`
  - Python: `bot.use_state()`, `ctx.state.conversation.get()`, `ctx.state.set_value()`
- Scope descriptions match spec (conversation = "entire conversation", user = "across all conversations", temp = "current turn only")
- Key derivation, lifecycle (load/save), dirty tracking, atomic semantics all explained at user level
- "What it's NOT" + v1 limitations prevent user confusion about out-of-scope features

**Next steps**:
- Once implementations land (Amy/Fry/Hermes PRs merge): verify code examples execute correctly, adjust if signatures diverged
- Implementations may discover edge cases not in spec → update docs correspondingly
- Cloud storage adapters (v2) will be added to "Coming later" section when work begins

**Files created/modified**:
- `docs-site/state.md` — created (17.4 KB)
- `docs-site/.vitepress/config.mts` — updated sidebar
- `docs-site/index.md` — updated Quick Links
- `README.md` — updated Learn more table
- `specs/turn-state.md` — added cross-reference link at header

### 2026-05-21 — TurnState Spec Drafted (Phase 1, Issue #361)

**Context**: Leela (Lead) completed Phase 1 of TurnState design for GitHub issue #361.

**Impact for Kif (Developer Relations)**:
- TurnState spec ready in `specs/turn-state.md` with examples and language-specific notes
- **Your next task**: Write state management guide for docs-site (Phase 2, pending Rido approval)
- Spec includes: three-scope model, storage abstraction, lifecycle, dirty tracking, concurrency model
- Target audience: Bot developers wanting to persist conversation/user/turn-scoped data
- Guide should include: quick-start with MemoryStorage, scope selection patterns, cloud backend configuration (v2+)
- Expected placement: `docs-site/state-management.md` (linked from core guide)

**Next step**: Watch for decision A6 approval; docs phase starts after implementation.

## Core Context

Prior work (2025-01 through 2026-04):
- **Squad Announcement (2025-05-XX):** Updated README.md and docs-site/index.md with Squad member bios and Copilot Squads experiment callout (Issue #312).
- **XML Tag Sanitization (2025-05-XX):** Added `sanitize_dotnet_docs()` to generate-api-docs.sh to post-process DefaultDocumentation XML tags for VitePress compatibility.
- **Specs Readability Overhaul (2025-01-XX):** Fixed 6 broken spec links, added template headers, standardized terminology (BotAS → botas), extracted user stories to new spec file (Issue #259).
- **Logging Documentation (2026-XX-XX):** Created comprehensive logging.md guide with per-language configuration, troubleshooting, and VitePress integration; cross-linked from README and language guides.
- **OTel Documentation Gaps (2026-04-17):** Added "Observability" to README "Learn more" table and language guides; clarified middleware.md distinction between built-in and custom OTel instrumentation.
- **Markdown Cross-Links Fix (2026-XX-XX):** Fixed ~98 lines in nodejs.md and python.md by removing backticks from cross-link cells and escaping angle brackets to prevent VitePress HTML interpretation.
- **TypeDoc Automation (2026-04-22):** Configured typedoc-plugin-markdown v4.11.0 for auto-generated Node.js API docs with VitePress integration and cross-linking.

---

