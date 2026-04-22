# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- **2026-04-13**: Updated Python run/startup instructions in `docs-site/getting-started.md`, `docs-site/auth-setup.md`, and `docs-site/languages/python.md` to promote `uv` as the recommended runner. All sample run commands now show: (1) `::: code-group` tabs with both bash and PowerShell examples, (2) `uv run --env-file ../../.env main.py` as the primary method (works cross-platform), (3) `::: details` blocks for users without uv showing pip/python fallback. Paths use backslashes for `cd` on PowerShell but forward slashes for `--env-file` (uv handles both). Updated sections in getting-started (lines 142-173), auth-setup (lines 128-161), and python.md (lines 351-372, 417-438, 470-491). Purpose: improve Windows developer experience and modernize Python setup guidance.
- **2026-04-12**: Scaffolded Jekyll docs site in `/docs-site/` using `just-the-docs` remote theme. Logo lives at `docs/art/icon.svg` (copied to `docs-site/assets/images/logo.svg`). Nav structure: Home → Getting Started → Languages (.NET, Node.js, Python) → Middleware → Auth & Setup. All placeholder pages have front matter wired for just-the-docs navigation. Local preview: `cd docs-site && bundle install && bundle exec jekyll serve`.
- **2026-04-13**: Reorganized docs/ folder. Moved specs to `specs/`, art assets to `art/`, Architecture.md and Setup.md into `specs/`. Updated all cross-references in README.md, AGENTS.md, copilot-instructions.md, and all three language package READMEs. The `docs/` directory is now fully removed; `docs-site/` remains for the Jekyll site.
- **2026-04-13**: Enhanced middleware documentation in `docs-site/middleware.md` to address GitHub Issue #51. Added: common middleware use cases (logging, filtering, metrics, auth, rate limiting, context enrichment, error recovery, routing), detailed explanation of activity modification via `context.activity`, and three complete language examples of RemoveMentionMiddleware (.NET, Node.js, Python) with inline usage samples. Updated `specs/README.md` to link developer guides to `docs-site/middleware.md`. All middleware specs align with Turn Context and Protocol specs.

### Cross-language implementations (2026-04-13)
- **Amy (.NET):** Created `RemoveMentionMiddleware` class and `BotApp.Use()` method for middleware registration. MentionBot sample. 10 tests passing (27 total).
- **Fry (Node.js):** Created `remove-mention-middleware.ts` implementing `ITurnMiddleware`. Mutates `activity.text` in-place, matches `recipient.id`. 10 tests passing (36 total).
- **Hermes (Python):** Created Protocol-based middleware. Uses `entity.model_dump(by_alias=True)` for mention fields. 8 tests passing (45 total).
- All three ports maintain parity: strip self-mentions, case-insensitive, handle edge cases, provide samples.
- **2026-04-13**: Updated all docs to reflect the new simplified BotApp API. Key changes: (1) .NET uses `BotApp.Create()` + `app.On()` handlers instead of `AddBotApplication`/`UseBotApplication`/`OnActivity`; (2) Node.js uses `BotApp` from `botas-express` package for simple bots; (3) Python uses `BotApp()` with aiohttp; (4) All three use `TurnContext` (ctx) in handlers with `ctx.send()` for replies instead of `CoreActivityBuilder` + manual `sendActivityAsync()`. Legacy API (OnActivity, CoreActivityBuilder, createReplyActivity) is still documented as "still supported" for backward compatibility. All examples in README.md, getting-started.md, language guides, middleware.md, and specs/README.md updated to lead with the simple path (BotApp) and show manual setup as advanced/secondary option.
- **2026-04-13**: Typing activity documentation completed per Decision #2 (docs-first feature delivery). Reviewed and corrected `specs/ActivityPayloads.md` — fixed Node.js handler from `bot.onTyping()` to `bot.on('typing', ...)` per resolved API. Updated `specs/turn-context.md` with `sendTyping()` method signature and behavior description. Added typing return types to Language-Specific Intentional Differences table in `specs/README.md` (.NET `Task<string>`, Node.js `Promise<void>`, Python `None`). Created new `docs-site/typing-activity.md` Jekyll page with three-language examples (send & receive), tips on usage, and links to specs. Added typing to README.md activity types list and new section with quick examples. All docs link correctly and examples follow established patterns.
- **2026-04-13**: VitePress chosen over Starlight and Docusaurus for docs site. VitePress prototype lives at `docs-site-vitepress/` with config at `docs-site-vitepress/.vitepress/config.mts`. All 10 pages migrated from Jekyll with code-group tabs for multi-language examples. Rejected prototypes (`docs-site-starlight/`, `docs-site-docusaurus/`) deleted. Build command: `cd docs-site-vitepress && npm run docs:build`. VitePress was chosen for lighter deps (~79MB), built-in `::: code-group` tabs for multi-lang code, and simpler config vs Starlight/Docusaurus.

### PyPI publication (2026-04-13)
- **Botas Python packages now on PyPI**: Both `botas` and `botas-fastapi` are published to PyPI as of version 0.1.x. Standard install is now `pip install botas-fastapi` (pulls both packages). Updated all user-facing docs (README.md, getting-started.md, languages/python.md) to use PyPI install as primary path. Sample "Run" instructions now use `cd python/samples/{sample} && pip install -e . && python main.py` since each sample's pyproject.toml pulls botas/botas-fastapi from PyPI. Monorepo editable install (`pip install -e ".[dev]"`) is documented as development-only workflow. .NET docs also updated to remove "when published" caveat from NuGet package reference (packages are now published).
- **2026-04-13**: Restructured `docs-site/auth-setup.md` to match getting-started.md's Teams CLI-first approach. Key changes: (1) Moved Prerequisites to lead with Teams CLI install + dev tunnel (consistent with getting-started); (2) Reordered steps: Step 1 = tunnel setup, Step 2 = `teams app create` (handles app registration + bot resource creation automatically), Steps 3-4 = env vars + run & test; (3) Created appendix section "Appendix: Azure Portal Setup" containing original manual Steps 1-2 (Create App Registration + Create Azure Bot Resource) for users without Teams CLI; (4) Preserved Overview, Common Gotchas, and "How Auth Works Under the Hood" sections as-is. Updated Common Gotchas table with Teams CLI-specific guidance (`teams app secret reset`, `teams app edit`) while keeping Azure Portal fallbacks. Purpose: eliminate docs inconsistency where getting-started led with Teams CLI but auth-setup was portal-only.

### Documentation Batch: Auth Setup + Python uv/PowerShell (2026-04-15)

**Scope:** Two coordinated doc updates for Windows developer experience and consistency.

**Update 1: auth-setup.md Restructure (Teams CLI-first)**
- Restructured `docs-site/auth-setup.md` to lead with Teams CLI + Dev Tunnels (matching getting-started pattern)
- Prerequisites: Updated to Teams CLI install + tunnel guidance
- Steps 1-2: Tunnel setup → teams app create (replaces manual app registration)
- Steps 3-4: Env vars + run/test (unchanged)
- Appendix: Azure Portal Setup — complete fallback for portal-only users (with Azure CLI option)
- Common Gotchas: Updated with Teams CLI-specific guidance (teams app edit, teams app secret reset)
- Preserved: Overview, How Auth Works Under the Hood
- Result: Eliminated inconsistency; both getting-started and auth-setup now Teams CLI-first

**Update 2: Python uv + PowerShell Instructions**
- Added `uv run --env-file ../../.env main.py` to three docs files:
  - docs-site/getting-started.md (lines 142-173)
  - docs-site/auth-setup.md (lines 128-161)
  - docs-site/languages/python.md (lines 351-372, 417-438, 470-491)
- Pattern: Code-group tabs with bash + PowerShell examples
- PowerShell: Backslashes in cd commands, forward slashes in --env-file
- Fallback: ::: details blocks with pip/python alternative
- Result: Improved Windows developer experience; cross-platform uv guidance clear

**Verification (Hermes):** All Python commands verified as technically correct. No changes needed.

**Impact:** Windows developers now have consistent, clear guidance across all Python setup docs. Teams CLI path is now primary in all entry points.

### Docs CI validation (2026-07-14)
- Added `docs` path filter (`docs-site/**`) and `docs` output to the `changes` job in `.github/workflows/CI.yml`.
- Added `docs` job: checkout → setup-node@v6 (node 22, npm cache) → `npm ci` → `npm run docs:build` → upload `.vitepress/dist` as `docs-site-preview` artifact on PRs only.
- Job is gated on `needs.changes.outputs.docs == 'true'`, matching existing CI pattern.
- Does NOT touch `docs.yml` (production GitHub Pages deployment stays separate).
- Action versions match existing workflow: checkout@v6, setup-node@v6, upload-artifact@v4.

### Squad docs refresh (2026-04-22)
- Updated `.squad/identity/now.md` with current project state: v0.3-alpha, release stabilization focus, VitePress migration, cross-language parity work (RemoveMentionMiddleware, typing activity, CatchAll handler, BotApplication.Version).
- Created `.squad/identity/wisdom.md` with 8 reusable team patterns: spec-first design, parity tables, docs-first delivery, drop-box decisions, test-bot E2E, VitePress code-groups, Teams CLI-first setup, Node package naming, and Python ruff linting.
- Fixed charter references: Leela's and Kif's charters now link to correct spec files (specs/README.md, protocol.md, architecture.md, setup.md; docs-site/).
- Updated `.squad/team.md` stack line to include VitePress for docs.

### README restructure — Issue #212 (2026-07-14)
- **PR #215**: Restructured main `README.md` to be code-first, following the pattern established in `docs-site/getting-started.md`.
- **Changes:** (1) Moved echo bot code snippets (all 3 languages in `::: code-group` tabs) to the very top, right after the intro; (2) Condensed setup from multi-section with duplication to a single 30-second checklist; (3) Removed duplicated content about running each language sample (referenced repo paths instead); (4) Updated Learn more table: setup/language/auth links now point to `docs-site/` pages; (5) Removed AI bots callout (can be found in docs-site under Teams features).
- **Result:** README is now cleaner, code-forward, and reinforces docs-site as the source of truth. Users see working code instantly, detailed guidance is one link away.

### Security: Remove wildcard *.trafficmanager.net from service URL allowlist (#207, 2026-04-22)

Replaced the wildcard `*.trafficmanager.net` pattern with an exact-match for `smba.trafficmanager.net` across all three languages. Any Azure customer can register subdomains under trafficmanager.net, making the wildcard an SSRF vector.

**Changes (all 3 languages + spec):**
- `specs/protocol.md` — Updated allowed hosts table; added configurable additional hosts section.
- `.NET` `ConversationClient.cs` — Split allowlist into `AllowedServiceUrlPatterns` (suffix match) and `AllowedExactHosts` (exact match). Added `additionalAllowedHosts` parameter and `ADDITIONAL_SERVICE_URLS` env var support.
- `Node.js` `bot-auth-middleware.ts` — Separated `ALLOWED_SERVICE_URL_PATTERNS` (regex) from `ALLOWED_EXACT_HOSTS`. Added `additionalHosts` parameter and env var support.
- `Python` `bot_application.py` — Same pattern: `_ALLOWED_SERVICE_URL_PATTERNS` + `_ALLOWED_EXACT_HOSTS`. Added `additional_hosts` parameter and env var support.
- Tests in all 3 languages verify: `evil.trafficmanager.net` rejected, `smba.trafficmanager.net` accepted, additional hosts work.

**Validation:** Unit tests (79 .NET, 109 Node, 95 Python) + Playwright E2E (echo + invoke) all passing. Confirmed Teams sends `smba.trafficmanager.net` as serviceUrl via debug logging.

