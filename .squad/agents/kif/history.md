# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

### 2025-05-XX: .NET API docs XML tag sanitization

**Problem**: DefaultDocumentation generates markdown with raw XML doc comment tags (`<example>`, `<code>`) that VitePress interprets as Vue components, breaking the build with "Element is missing end tag" errors.

**Solution**: Added `sanitize_dotnet_docs()` function to `docs-site/generate-api-docs.sh` that post-processes the generated .NET API docs using `awk` to:
1. Convert `<example><code>...</code></example>` blocks to markdown code fences (```csharp ... ```)
2. Strip bare XML doc tags (`<see>`, `<param>`, `<returns>`, `<summary>`, `<remarks>`)

**Key files**:
- `docs-site/generate-api-docs.sh` — API doc generation script
- `docs-site/api/generated/dotnet/` — .NET API docs output directory

**Portability**: Uses POSIX-compatible `awk` for cross-platform compatibility (Git Bash on Windows, Linux in CI).

**Pattern**: For generated documentation that includes embedded XML or HTML tags incompatible with the target renderer (VitePress), add a post-processing sanitization step immediately after generation rather than trying to configure the generator itself.

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- **2026-04-16**: Added API reference hyperlinks to all three language guides (`docs-site/languages/dotnet.md`, `nodejs.md`, `python.md`). **URL patterns per doc generator**: (1) DocFX (.NET): `/api/generated/dotnet/api/botas.{classname-lowercase}.html`; (2) TypeDoc (Node.js): `/api/generated/nodejs/botas-core/{classes|interfaces|functions|variables}/{Name}.html` (PascalCase preserved); (3) pdoc (Python): `/api/generated/python/botas/botas.html#{ClassName}` (anchor-based). **Convention**: VitePress new-tab links use `<a href="..." target="_blank"><code>Name</code></a>`. Only first mention per `##` section is linked. Code blocks, badge lines, and API Reference sections are never modified. 58 total links added (21 .NET, 19 Node.js, 18 Python).
- **2026-04-16**: Created `docs-site/api-theme/` with per-tool brand customizations for DocFX, TypeDoc, and pdoc. **Approach**: (1) DocFX — overrode `layout/_master.tmpl` from modern template to inject BotAS nav bar after `<body>`; added `public/main.css` with brand colors and `.botas-nav` styles; updated root `docfx.json` template list to include custom dir. (2) TypeDoc — used `customCss` and `navigationLinks` in both `typedoc.json` files; CSS overrides color variables for light/dark themes. (3) pdoc — Jinja2 `module.html.jinja2` extending default template, injects nav bar in `{% block body %}` and brand CSS in `{% block head %}`; `generate-api-docs.sh` updated with `--template-directory`. **Key files**: `docs-site/api-theme/docfx/`, `docs-site/api-theme/typedoc/custom.css`, `docs-site/api-theme/pdoc/module.html.jinja2`, `docfx.json`, both `typedoc.json` files, `docs-site/generate-api-docs.sh`. **Brand**: orange `#ff9100` (dark) / `#a05500` (light), dark nav bg `#1b1b1f`, from `docs-site/.vitepress/theme/style.css`.
- **2026-04-16**: Closed API reference documentation gap: added `ActivityType` and `TeamsActivityType` to both .NET and Python API docs. **Problem**: Node.js docs already documented these type constants, but .NET and Python API reference docs (`docs-site/api/dotnet.md`, `docs-site/api/python.md`) were missing them. **Solution**: (1) Added ActivityType and TeamsActivityType sections to both docs immediately after CoreActivityBuilder, before ChannelAccount (matches logical activity-related type grouping); (2) .NET docs show static classes with const strings; Python docs show Literal type aliases—each formatted idiomatically; (3) Maintained consistent description style across all three languages. **Pattern**: When a user-facing type is important enough to use in real code (handler registration, activity dispatch), it must be documented in the API reference with exact syntax examples. Cross-language feature parity verification: Node.js had these documented, .NET/Python did not → detected, fixed, and committed as PR #237. **Files**: `docs-site/api/dotnet.md` (lines 159-191), `docs-site/api/python.md` (lines 188-214).
- **2026-04-15**: Added version selector dropdown to VitePress docs site navigation. Implemented: (1) `docs-site/versions.json` with structure `{ "current": "0.3", "versions": [] }` for CD-driven updates; (2) `docs-site/.vitepress/config.mts` reads versions.json at build time and generates nav dropdown items dynamically; (3) Dropdown placed as last nav item after Teams Features, showing `v{current} (latest|dev)` label; (4) "Latest" link points to `/botas/`, previous versions to `/botas/v{version}/`; (5) Uses only Node.js built-ins (fs, path), gracefully degrades if file missing. Design enables CD workflow to update versions.json before build, supporting multi-version doc deployments. See decision: `.squad/decisions/inbox/kif-version-selector.md`.
- **2026-04-16**: **Docs cleanup — removed versions and restructured API refs (PR #244).** Removed version selector, VersionBadge component, `versions.json`, and `@viteplus/versions` dependency. Removed hand-curated `docs-site/api/` overview pages and API Reference from nav/sidebar. Added API Reference links at bottom of each language doc (dotnet.md, nodejs.md, python.md) pointing to generated HTML under `/botas/api/generated/`. Switched TypeDoc from `typedoc-plugin-markdown` to default HTML output (output to `docs-site/public/`). Switched Python docs from custom markdown generator to `pdoc -o`. Key pattern: API references are now standalone HTML (docfx/typedoc/pdoc defaults) served as static assets, not integrated into VitePress markdown.
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

### README restructure — Issue #212 (2026-04-22)
- **PR #215**: Restructured main `README.md` to be code-first, following the pattern established in `docs-site/getting-started.md`.
- **Changes:** (1) Moved echo bot code snippets (all 3 languages in `::: code-group` tabs) to the very top, right after the intro; (2) Condensed setup from multi-section with duplication to a single 30-second checklist; (3) Removed duplicated content about running each language sample (referenced repo paths instead); (4) Updated Learn more table: setup/language/auth links now point to `docs-site/` pages; (5) Removed AI bots callout (can be found in docs-site under Teams features).
- **Result:** README is now cleaner, code-forward, and reinforces docs-site as the source of truth. Users see working code instantly, detailed guidance is one link away.

### API Documentation Tooling Setup — Issue #224 (2026-04-22)

**PR #226** — Set up infrastructure for auto-generated API reference documentation across all three languages.

**Per-Language Tools Configured:**
- **DocFX** for .NET: Created `dotnet/docfx.json` to extract XML documentation comments and generate markdown output
- **TypeDoc** for Node.js: Added `typedoc` + `typedoc-plugin-markdown` dependencies; created `node/packages/botas/typedoc.json`; added `docs` npm script
- **pdoc** for Python: Added to dev dependencies in `python/packages/botas/pyproject.toml` (version 15+)

**VitePress Integration:**
- Created placeholder pages at `docs-site/api/{dotnet,nodejs,python}.md` explaining each language's API reference will be auto-generated
- Updated `docs-site/.vitepress/config.mts` to add "API Reference" section to both nav bar (dropdown with 3 languages) and sidebar
- Installed **@viteplus/versions** plugin (npm package) for multi-version documentation support
- Created `docs-site/versions.json` with initial v0.3 entry

**Build Script:**
- Created `docs-site/generate-api-docs.sh` — Bash script that runs all 3 doc generators (.NET DocFX, Node TypeDoc, Python pdoc) and copies output to `docs-site/api/` subdirectories

**Verification:**
- Confirmed docs-site builds successfully with new structure: `cd docs-site && npm run docs:build` → passes cleanly

**Key Decisions:**
- Chose **@viteplus/versions** over `vitepress-plugin-version-select` (doesn't exist on npm) after web search revealed actively-maintained alternative
- DocFX configured for markdown output (not HTML) to integrate with VitePress
- TypeDoc uses plugin for markdown generation instead of default HTML theme
- pdoc is lightweight and sufficient for Python (Sphinx deemed overkill per research)

**Next Steps:** Future PRs will handle CI integration to auto-generate docs on release, and actual API doc generation once doc comments are finalized across all languages.

### API Cross-Links Implementation (2026-04-22)

**Task:** Add cross-links between types in the Node.js and Python API reference docs.

**Scope:**
- `docs-site/api/nodejs.md` — Added 85+ internal markdown links
- `docs-site/api/python.md` — Added 82+ internal markdown links

**Implementation Pattern:**
- VitePress generates anchors from `## TypeName` headings as lowercase with hyphens (e.g., `## CoreActivity` → `#coreactivity`)
- Only link types that have their own section heading on the same page
- Link in table cells (Type columns, method signatures) and inline text
- Format: `[TypeName](#anchor)` where anchor is lowercase with hyphens
- Do not link: primitives (string, boolean), external types (Promise, BaseModel), types without headings, or already-linked types
- Handle compound types carefully: `CoreActivity | dict` → `[CoreActivity](#coreactivity) | dict`
- Handle generics: `PagedMembersResult<ChannelAccount>` → `[PagedMembersResult](#pagedmembersresult)\<[ChannelAccount](#channelaccount)>`

**Key Types Linked (Node.js):**
- Core: BotApplication, BotApplicationOptions, TurnContext, ConversationClient, CoreActivity, CoreActivityBuilder, ActivityType, ChannelAccount, TeamsChannelAccount, Conversation, Entity, Attachment, SuggestedActions, CardAction, TeamsActivity, TeamsActivityBuilder, TeamsChannelData
- Middleware: TurnMiddleware
- Auth: BotAuthError, TokenManager, BotHandlerException
- Utilities: InvokeResponse, ResourceResponse, ConversationResourceResponse, PagedMembersResult, BotHttpClient
- botas-express: BotApp, BotAppOptions, plus re-exports

**Key Types Linked (Python):**
- Core: BotApplication, BotApplicationOptions, TurnContext, ConversationClient, CoreActivity, CoreActivityBuilder, ChannelAccount, TeamsChannelAccount, Conversation, Entity, Attachment, SuggestedActions, CardAction, TeamsActivity, TeamsActivityBuilder, TeamsChannelData, TeamsConversation
- Middleware: TurnMiddleware, RemoveMentionMiddleware
- Auth: BotAuthError, TokenManager, BotHandlerException
- Utilities: InvokeResponse, ResourceResponse, ConversationResourceResponse, PagedMembersResult, ConversationParameters
- botas-fastapi: BotApp, plus re-exports

**Benefits:**
- Improves API reference usability for developers — types can jump directly to relevant sections
- Encourages exploration of related types (e.g., linking CoreActivity in CoreActivityBuilder methods)
- Reduces scrolling and cognitive load for users learning the SDK

**Verification:**
- All edits applied systematically top-to-bottom
- Anchor names verified against VitePress markdown rendering rules
- Compound and generic types handled correctly
- Re-export sections in botas-express and botas-fastapi fully cross-linked



### TypeDoc automation with VitePress (2026-04-22)
- **Branch**: `fix/api-docs-package-names` (PR #227)
- **Setup**: Configured `typedoc-plugin-markdown` v4.11.0 for `botas-core` and `botas-express` with VitePress-optimized output to `docs-site/api/generated/nodejs/`
- **Key config options**: `outputFileStrategy: "modules"`, `useCodeBlocks: true`, `expandObjects: true`, `parametersFormat: "table"`, `typeDeclarationFormat: "table"`, GitHub source links with line numbers (`sourceLinkTemplate`)
- **Cross-linking**: TypeDoc automatically generates markdown with type cross-references (e.g., `CoreActivity` links to its own definition page)
- **VitePress integration**: Added collapsed "API Reference (Generated)" sidebar section with links to botas-core and botas-express generated docs
- **Build scripts**: Updated `docs-site/generate-api-docs.sh` to run `npm run docs` for both packages; added `docs-site/api/generated/` to .gitignore (generated files)
- **Coexistence**: Hand-written API docs (`nodejs.md`, `python.md`) remain as supplementary guides; generated docs demonstrate automation with cross-linking
- **Version note**: typedoc-plugin-markdown v4.x has very different config from v3.x — native VitePress support, no need for typedoc-vitepress-theme

### 2026-XX-XX: Markdown cross-links must be outside backticks

Cross-links in markdown tables must NOT be inside backtick code spans. Markdown does NOT render links inside backticks — everything between backticks is literal text. Fixed ~98 affected lines across nodejs.md and python.md by removing outer backticks from Type/Signature cells containing `[TypeName](#anchor)` syntax, and escaping `<>` as HTML entities (`&lt;`/`&gt;`) to prevent VitePress from interpreting generics as HTML tags. Example: `\\sendActivityAsync(...): Promise<[ResourceResponse](#resourceresponse)>\\ ` became `sendActivityAsync(...): Promise&lt;[ResourceResponse](#resourceresponse)&gt;`.

**Pattern:** In table cells with cross-links: (1) remove outer backticks, (2) escape angle brackets, (3) leave method/property name column unchanged, (4) keep pipe escapes as-is. VitePress build passes after fix.

### 2025-01-XX: Specs overhaul readability work (Issue #259)

**What**: Fixed all broken links, added template headers, standardized terminology, and extracted user stories into a new spec file.

**Links fixed** (6 total):
1. `specs/architecture.md` line 106: `./specs/activity-schema.md` → `./activity-schema.md` (already in specs/)
2. `specs/README.md` line 32: Simplified link to `../docs-site/middleware.md` (removed redundant Developer Docs link)
3. `specs/protocol.md` line 268: Updated relative path in middleware reference
4. `specs/contributing.md` line 147: Changed `./turn-context.md` → `./protocol.md#turncontext` (turn-context.md not created yet; linked to closest spec)
5. `specs/activity-schema.md` line 6: Updated broken anchor `./README.md#coreactivitybuilder` → `./architecture.md#components`

**Template headers added**:
- `specs/setup.md`: Added purpose line, Status: Draft, and Overview section
- `specs/architecture.md`: Added purpose line and Status: Draft at top
- `specs/reference/dotnet.md`, `specs/reference/node.md`, `specs/reference/python.md`: Added Status: Draft and short Overview line

**Terminology standardized**:
- Replaced all "BotAS" with "botas" (lowercase) across: `architecture.md`, `configuration.md`, `activity-schema.md`, `samples.md`, `setup.md` (5 replacements total)
- Maintained consistent capitalization: "botas" in prose, "Botas" at sentence start

**User stories extracted**:
- Created new `specs/user-stories.md` with all four Gherkin scenarios (US-001 Echo Bot, US-002 Proactive Messaging, US-003 Middleware Pipeline, US-004 Teams Features) plus acceptance criteria
- Updated `specs/README.md` to remove inline user stories and link to new file: "See [User Stories](./user-stories.md) for detailed behavioral scenarios."

**Files modified**: 10 (architecture.md, README.md, protocol.md, contributing.md, activity-schema.md, setup.md, configuration.md, samples.md, dotnet.md, node.md, python.md) + 1 new (user-stories.md)

**Pattern**: Breaking large content blocks into separate spec files improves discoverability (user stories live in their own file, not buried in README) and keeps reference sections consistent across languages. Template headers (purpose + status) establish consistency and make the spec tree browsable.

