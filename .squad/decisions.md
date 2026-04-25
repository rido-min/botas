# Squad Decisions

## Active Decisions

### 1. Jekyll docs site scaffold (2026-04-12)

**Author:** Kif (DevRel) | **Status:** Implemented

- Created `/docs-site/` with Jekyll + `just-the-docs` remote theme (GitHub Pages compatible).
- Navigation: Home, Getting Started, Languages (with .NET/Node.js/Python children), Middleware, Authentication & Setup.
- Logo copied from `docs/art/icon.svg` to `docs-site/assets/images/logo.svg`.
- All section pages populated with content; nav structure verified.

### 2. User directive: Docs-first feature delivery (2026-04-13)

**Captured by:** Rido (via Copilot) | **Status:** Active

From now on, each feature won't be completed until it has proper docs and samples.

### 3. docs/ folder reorganized to specs/ and art/ (2026-04-13)

**Author:** Kif (DevRel) | **Status:** Implemented

- `docs/specs/` moved to `specs/` at repo root
- `docs/Architecture.md` and `docs/Setup.md` moved to `specs/`
- `docs/art/` moved to `art/` at repo root
- `docs/` directory removed entirely; `docs-site/` remains for the Jekyll site
- All cross-references updated in README.md, AGENTS.md, `.github/copilot-instructions.md`, and all three language package READMEs
- Kif's charter and routing.md updated to reflect new paths

**Impact:** Any future references to documentation should use `specs/` (for specs, architecture, setup) and `art/` (for icons/logos). The old `docs/` path no longer exists.

### 3. Middleware Documentation Enhancement (2026-04-13)

**Author:** Kif (DevRel) | **Status:** Completed

Enhanced `docs-site/middleware.md` with:
- Common use cases table (logging, metrics, filtering, auth, rate limiting, context enrichment, error recovery, routing)
- Explanation of activity modification via mutable `context.activity`
- Three language examples of RemoveMentionMiddleware (.NET, Node.js, Python) addressing GitHub Issue #51

Updated `specs/README.md` to link developer guides. All examples follow existing code patterns and require no breaking changes.

**Impact:** Developers can now understand middleware patterns and apply them without reading source code, supporting Decision #2 (docs-first feature delivery).

### 4. RemoveMentionMiddleware Implementation (.NET) (2026-04-13)

**Author:** Amy (.NET Dev) | **Status:** Implemented | **Issue:** #51

- **New `RemoveMentionMiddleware`** (`dotnet/src/Botas/RemoveMentionMiddleware.cs`): Strips @mention text from `activity.Text` when the mention matches the bot's AppId (or falls back to `Recipient.Id`). Case-insensitive matching; trims resulting whitespace.
- **New `BotApp.Use()` method** (`dotnet/src/Botas/BotApp.cs`): Deferred-registration pattern mirrors `BotApp.On()` — middleware registered before handlers.
- **MentionBot sample** (`dotnet/samples/MentionBot/`): Demonstrates middleware registration.
- **10 new tests**: All 27 tests pass.

**Cross-language impact:** Node.js and Python should implement equivalent middleware for parity.

### 5. RemoveMentionMiddleware Implementation (Node.js) (2026-04-13)

**Author:** Fry (Node Dev) | **Status:** Implemented | **Issue:** #51

- **`RemoveMentionMiddleware` class** (`node/packages/botas/src/remove-mention-middleware.ts`): Implements `ITurnMiddleware`; strips bot @mentions from `activity.text` by matching `entity.mentioned.id` against `activity.recipient.id`.
- **Design:** Middleware mutates `activity.text` in-place (shared TurnContext object); only strips bot-self mentions.
- **Exported** from package index.
- **10 new tests**: All 36 tests pass.

### 6. RemoveMentionMiddleware Implementation (Python) (2026-04-13)

**Author:** Hermes (Python Dev) | **Status:** Implemented | **Issue:** #51

- **`RemoveMentionMiddleware`** (`python/packages/botas/src/botas/remove_mention_middleware.py`): Implements `ITurnMiddleware` (Protocol); strips `<at>BotName</at>` text from incoming activities when mention targets the bot.
- **Sample** (`python/samples/echo-bot-no-mention/main.py`): Demonstrates usage.
- **8 new tests** (`python/packages/botas/tests/test_remove_mention_middleware.py`): All 45 tests pass; lint clean (ruff).
- **Pattern:** Iterate entities, match mention type + bot ID, regex-strip mention text.
### 4. BotApp Simplification API — Documentation Updated (2026-04-13)

**Author:** Kif (DevRel) | **Status:** Completed

All documentation now leads with the simplified BotApp API as the primary, recommended approach across all three languages. Manual setup (ASP.NET Core, Express, FastAPI) documented as "Advanced" or legacy option. Maintains backward compatibility while improving onboarding.

**Updated:** README.md, docs-site/getting-started.md, language-specific pages, specs/README.md

**Follow-up:** Both simple (BotApp) and advanced examples must be kept in sync when API changes.

### 5. User directive: Remove legacy/backward-compatibility language (2026-04-13)

**Captured by:** Rido | **Status:** Active

Remove any comment about "legacy" or "backward compatibility" in documentation. This is a brand new library with no existing users. Documentation can be simplified accordingly.

### 6. Python botas/botas-fastapi package split (2026-04-13)

**Author:** Leela (Lead) | **Status:** Approved with changes completed

PR #48 extracts FastAPI-specific code into separate `botas-fastapi` adapter package, mirroring Node.js `botas`/`botas-express` split. Architecture correct and approved.

**Changes completed by Hermes:**
- Rebased onto main (resolved doc conflicts)
- Added botas-fastapi to build-all.sh
- bot_auth_dependency now has test coverage

**Follow-up:** Node.js should move `botAuthExpress()` and `botAuthHono()` from core to adapter packages for consistency.

### 7. CatchAll Handler — Cross-Language Parity (2026-04-13)

**Author:** Leela (Lead) | **Status:** Implemented & Verified

Achieved behavioral parity for CatchAll handler across all three languages (.NET, Node.js, Python).

**Specification (Leela):**
- Added "CatchAll Handler" subsection to specs/protocol.md
- Updated specs/README.md with language-specific API naming
- Added Language-Specific Intentional Differences table entry
- Semantics: When CatchAll is set, per-type handlers are completely replaced; exceptions wrapped in BotHandlerException

**Implementation (Fry — Node.js):**
- Added `onActivity?: CoreActivityHandler` property to BotApplication
- Dispatch logic: `this.onActivity ?? this.handlers.get(type)` replaces per-type dispatch entirely
- Error wrapping shared in existing BotHandlerException try/catch
- 4 new parity tests; all 37 tests pass

**Implementation (Hermes — Python):**
- Added `on_activity: ActivityHandler | None = None` attribute to BotApplication
- Dispatch logic: `self.on_activity or self._handlers.get(...)` replaces per-type dispatch entirely
- Error wrapping in same BotHandlerException as per-type handlers
- 4 new parity tests; all 35 tests pass

**Verification (Amy — .NET):**
- Existing .NET OnActivity property already implements correct CatchAll semantics
- No code changes required; .NET serves as canonical reference
- Noted: existing test coverage is minimal; recommend follow-up

**Impact:** All three languages now have consistent CatchAll handler behavior. Parity achieved.

### 8. TeamsActivity Spec — Design Decisions (2026-04-13)

**Author:** Leela (Lead) | **Status:** Proposed (awaiting implementation)

Wrote comprehensive spec for `TeamsActivity` and `TeamsActivityBuilder` at `specs/teams-activity.md`. This defines the strongly-typed Teams-specific activity types and builder pattern for all three languages.

**Key Design Decisions:**

1. **No Shadow Properties**
   - TeamsActivity does NOT shadow inherited properties (`From`, `Recipient`, `Conversation`).
   - Explicit casting (`(TeamsChannelAccount)activity.From`) is clearer and safer.
   - Developers use `FromActivity()` to convert CoreActivity → TeamsActivity.

2. **Builder Inheritance (Not Generics)**
   - TeamsActivityBuilder extends CoreActivityBuilder directly.
   - Current CoreActivityBuilder already supports fluent chaining without generics.
   - Generics would break existing API and add unnecessary complexity.

3. **Entity/Attachment as Typed Classes**
   - .NET will add `Entity` and `Attachment` classes (matching Node.js/Python).
   - Cross-language parity with strongly-typed access.
   - Maintains `[JsonExtensionData]` pattern for forward compatibility.
   - Breaking change for .NET CoreActivity (acceptable at 0.1.x).

4. **Mention Helper Does Not Modify Text**
   - `AddMention(account, mentionText)` creates entity but does NOT modify activity text.
   - Text modification is context-specific; explicit is better.
   - Requires two calls (`WithText()` + `AddMention()`); more explicit, less magic.

**Types Defined (Phase 1):**
- `TeamsActivity` (extends CoreActivity)
- `TeamsActivityBuilder` (extends CoreActivityBuilder)
- `TeamsChannelAccount` (extends ChannelAccount — needs .NET implementation)
- `TeamsConversation` (extends Conversation — needs all three languages)
- `TeamsChannelData` + sub-types: TenantInfo, ChannelInfo, TeamInfo, MeetingInfo, NotificationInfo
- `SuggestedActions`, `CardAction`
- `Entity` (needs .NET implementation)
- `Attachment` (needs .NET implementation)

**Phase 2 (Deferred):**
- Meeting event helpers
- O365 connector card helpers
- File consent card helpers
- Sign-in card helpers

**Cross-Language Status:**
- **Node.js and Python ahead:** Already have `TeamsChannelAccount`, `Entity`, `Attachment`.
- **.NET needs catch-up:** Must add those types for parity.
- **All three need:** `TeamsConversation`, `TeamsChannelData`, `SuggestedActions`.

**Implementation Order:**
1. Amy (.NET): Add missing types (Entity, Attachment, TeamsChannelAccount), then TeamsActivity + builder.
2. Fry (Node.js): Add missing types (TeamsConversation, TeamsChannelData), then TeamsActivity + builder.
3. Hermes (Python): Add missing types (TeamsConversation, TeamsChannelData), then TeamsActivity + builder.
4. Nibbler (QA): Write cross-language parity tests.
5. Kif (DevRel): Update docs-site with TeamsActivity examples.

**Follow-Up:** After implementation, consider Phase 2 helpers, TurnContext.send() overload, middleware for auto-parsing.

**Impact:** Enables cross-language Teams Activity parity. Spec-first approach supports docs-driven feature delivery.

### 9. Python RemoveMentionMiddleware Parity Fix (2026-04-13)

**Author:** Fry (Node Dev, cross-assigned) | **Status:** Completed

Fixed Python `RemoveMentionMiddleware` to match .NET reference implementation per Leela's parity review.

**Changes:**

1. **Removed `recipient.name` matching:**
   - Python was doing three-way OR (`appid || recipient.id || recipient.name`).
   - Now uses two-stage fallback: `appid ?? recipient.id`, matching .NET exactly.

2. **Case-insensitive ID comparison:**
   - Changed `==` to `.casefold()` comparison.
   - Bot IDs with different casing now still match (e.g., `BOT1` matches `bot1`).

3. **Case-insensitive text replacement:**
   - Added `re.IGNORECASE` flag to `re.sub`.
   - `<AT>BotName</AT>` gets stripped even if casing differs from `entity.text`.

**Test Results:**
- 48 Python tests pass (3 new: case-insensitive ID, case-insensitive text, no name-matching).
- ruff lint: all checks passed.

**Remaining Review Items (Out of Scope):**
- **Node.js:** Still needs AppId lookup + case-insensitive + replaceAll (assigned to Hermes per review).
- **Docs:** Still needs update (assigned to Amy per review).

**Impact:** Python middleware now matches .NET reference behavior exactly.

### 10. Typing Activity Support — Cross-Language Implementation (2026-04-13)

**Author:** Leela (Lead) | **Reviewers:** Amy (.NET), Fry (Node), Hermes (Python) | **Status:** Implemented & Verified

Added first-class typing activity support across all three languages with language-idiomatic APIs.

**Design Decision (Leela):**
- Spec written at `specs/ActivityPayloads.md` with inbound/outbound examples
- API includes convenience method `sendTyping()` / `SendTypingAsync()` / `send_typing()` on TurnContext
- Original proposal included handler registration (`onTyping()` / `OnTyping()` / `on_typing()`), but user directive narrowed scope to **send method only**
- Developers can still use `on("typing", handler)` or language-specific equivalents if needed

**Review & Amendments (Leela):**
1. **Amy (.NET):** Approved with changes — `SendTypingAsync()` returns `Task<string>` (not `Task`) for consistency with existing `SendAsync()` overloads. This is a language-specific intentional difference.
2. **Fry (Node.js):** Approved with changes — No `onTyping()` method. Node uses existing `on('typing', handler)` pattern. `sendTyping()` on TurnContext approved.
3. **Hermes (Python):** Approved as-is — API is clean and idiomatic.

**Implementation (Amy — .NET):**
- Added `SendTypingAsync(CancellationToken)` to TurnContext, returns `Task<string>`
- Uses `CoreActivityBuilder.WithConversationReference()` to auto-populate routing fields
- 8 new tests; all 50 tests pass
- Sample: `dotnet/samples/TypingBot/`

**Implementation (Fry — Node.js):**
- Added `sendTyping()` to TurnContext, returns `Promise<void>`
- Uses `CoreActivityBuilder.withConversationReference()` to auto-populate routing fields
- 7 new tests; all 69 tests pass
- Developers use `app.on('typing', async (ctx) => ...)` to handle incoming typing

**Implementation (Hermes — Python):**
- Added `send_typing()` to TurnContext, returns `Awaitable[None]`
- Uses `CoreActivityBuilder.with_conversation_reference()` to auto-populate routing fields
- 5 new tests; all 70 tests pass
- Developers use `@app.on("typing")` decorator or `app.on("typing", handler)` to handle incoming typing

**Spec & Docs (Kif):**
- Added "Typing Activities" section to `specs/ActivityPayloads.md` with all language examples
- Added typing to activity types table in `specs/README.md`
- Updated `docs-site/` with typing activity guide
- Updated README examples with typing patterns

**Cross-Language Parity Table:**
| Concern | .NET | Node.js | Python |
|---------|------|---------|--------|
| Send typing | `await ctx.SendTypingAsync(ct)` returns `Task<string>` | `await ctx.sendTyping()` returns `Promise<void>` | `await ctx.send_typing()` returns `None` |
| Receive typing | `app.on("typing", async (ctx, ct) => ...)` | `app.on('typing', async (ctx) => ...)` | `@app.on("typing")` or `app.on("typing", handler)` |

**Test Results:**
- .NET: 50 tests pass (8 new)
- Node.js: 69 tests pass (7 new)
- Python: 70 tests pass (5 new)

**Impact:** All three languages now have typing activity support with idiomatic APIs. Developers can show bot presence via typing indicators.

### 11. Issue Triage — All 8 Untriaged Issues (2026-04-13)

**Triaged by:** Leela (Lead) | **Status:** Completed

All 8 untriaged issues have been routed to appropriate squad members via `squad:{member}` labels and triage comments. 4 issues marked HIGH due to security or critical runtime impact.

**Routing Summary:**

| Issue | Type | Title | Assigned | Priority | Notes |
|-------|------|-------|----------|----------|-------|
| #76 | Node | Audit: Medium & Low findings | Fry | MEDIUM | 13 audit items; prioritize security (JWKS, ReDoS, race conditions) |
| #75 | .NET | Audit: Medium & Low findings | Amy | MEDIUM | 4 audit items; input validation, HttpClient, async, catch-all |
| #74 | Python | Audit: Medium & Low findings | Hermes | MEDIUM | 9 audit items; prioritize config/security leaks first |
| #72 | Python | FastAPI BotApp missing shutdown cleanup | Hermes | **HIGH** | No uvicorn shutdown hook; leaking connections |
| #70 | Node | Missing rate limiting on token validation | Fry | **HIGH** | DDoS amplification; unauthenticated requests trigger JWT fetch |
| #67 | Node | Unhandled promise rejection in middleware | Fry | **HIGH** | Post-next() errors crash process; needs error handling review |
| #65 | Node | Secrets logged in debug mode | Fry | **HIGH** | PII exposure (clientId, tenantId, MSI details at DEBUG level) |
| #64 | Python | BotApplication missing async context manager | Hermes | **HIGH** | `async with bot:` fails; need `__aenter__/__aexit__` |

**High Priority Action Items:**

- **Node.js (Fry):** 4 issues, 3 HIGH (#70, #67, #65, #76)

### 12. User Directive: Mandatory Doc Comments for Public APIs (2026-04-22T21:27:00Z)

**Captured by:** Rido (via Copilot) | **Status:** Active

From now on, all changes/additions in public APIs must have doc comments:
- **C# / .NET**: XML documentation (`/// <summary>...`)
- **TypeScript / Node.js**: JSDoc/TSDoc (`/** ... @param ... @returns ...`)
- **Python**: Google-style docstrings (Args, Returns, Raises sections)

**Rationale:** Ensures API documentation stays current as the library evolves; reduces maintenance debt.

**Implementation Status (2026-04-22):**
- ✅ Amy (.NET): Added XML doc comments to all 14 public API files (PR #225)
- ✅ Fry (Node.js): Added JSDoc/TSDoc to all 11 public API files (PR #225)
- ✅ Hermes (Python): Added Google-style docstrings to all 12 public files (PR #225)

**PR:** #225 (1687 total lines of doc comments) — Fixes #224

### 13. API Documentation Tooling & VitePress Integration (2026-04-22)

**Author:** Kif (DevRel) | **Status:** Implemented | **PR:** #226 (Part of #224)

Set up per-language API documentation generation tooling and VitePress integration for public docs site.

**Tooling Choices:**
- **DocFX v2.78.5** for .NET: Extracts XML comments from compiled assemblies, generates clean HTML
- **TypeDoc with typedoc-plugin-markdown** for Node.js: Generates native Markdown for VitePress
- **pdoc** for Python: Lightweight, clean HTML from docstrings

**VitePress Integration:**
- Added "API Reference" nav section with per-language links
- Created placeholder API docs pages (`docs-site/api/dotnet.md`, nodejs.md, python.md)
- Configured `@viteplus/versions` plugin for multi-version documentation selector
- Created `generate-api-docs.sh` build script to orchestrate all three generators

**Config Files Created:**
- `dotnet/docfx.json` — DocFX metadata and build config
- `node/packages/botas/typedoc.json` — TypeDoc entry point and markdown plugin
- `python/packages/botas/pyproject.toml` — Added pdoc to dev dependencies
- `docs-site/versions.json` — Version selector config
- `docs-site/.vitepress/config.mts` — Updated nav and sidebar for API docs

**Verification:** VitePress build succeeds; all configs validate

**Next Steps:**
- CI/CD automation: Generate docs on release via GitHub Actions
- Wire up version selector plugin in theme
- Deploy versioned documentation

**References:**
- Research: `.squad/decisions/inbox/kif-api-docs-research.md` (comprehensive tool evaluation)
- Choices: `.squad/decisions/inbox/kif-api-tooling-choices.md` (detailed justifications)

### 14. Security Issue #207: Wildcard Service URL Allowlist (2026-04-23)

**Triaged by:** Leela (Lead) | **Status:** NOT FIXED — Issue Identified

Issue #207 requests removing wildcard patterns (like `*.trafficmanager.net`) from valid service URL allowlists and adding configuration for additional domains.

**Current Issue:**
- **Severity**: **HIGH** (Security — SSRF risk)
- All 3 languages still contain wildcard `*.trafficmanager.net` pattern
- .NET: `AllowedServiceUrlPatterns` array, `ConversationClient.cs` line 14
- Node.js: Regex pattern in `bot-auth-middleware.ts` line 55
- Python: Regex pattern in `bot_application.py` line 21
- Spec still references wildcard at `specs/protocol.md` line 124

**What Needs to Happen:**
1. Update `specs/protocol.md` to replace `*.trafficmanager.net` with specific exact-match domain
2. Add environment variable or config mechanism for additional allowed domains (e.g., `ADDITIONAL_SERVICE_URLS`)
3. Update .NET, Node.js, Python implementations to use exact-match pattern and config support
4. Add tests verifying wildcard rejection and config override behavior

**Action Required:**
- Assign to implementation lead (recommend cross-language coordination)
- Create implementation PR with spec + code changes across all 3 languages
- Add security-focused test coverage

**References:** GitHub Issue #207 — "do not allow wildcards in valid service urls"

### 15. Issue #205: Update Teams CLI References (2026-04-23)

**Triaged by:** Leela (Lead) | **Status:** SCOPE IDENTIFIED — 6 files to update

Issue #205 requests replacing all `https://github.com/heyitsaamir/teamscli` references with official `npm install @microsoft/teams.cli@preview`.

**Files Needing Updates:**
1. `.copilot/skills/teams-bot-infra/SKILL.md`
2. `README.md`
3. `specs/setup.md`
4. `docs-site/getting-started.md`
5. `docs-site/setup.md`
6. `skills-lock.json`

**Scope Assessment:** MANAGEABLE — straightforward replacements, low risk

**Action Required:**
- Create PR with 6 file replacements
- Update unofficial CLI → official CLI reference
- Verify no other unofficial CLI references remain

**References:** GitHub Issue #205 — "Update all references to teams cli to use the official version"

### 16. Sample Alignment Plan — Issues #211 & #218 (2026-04-25)

**Author:** Leela (Lead) | **Status:** PLANNING DOCUMENT CREATED

Cross-language alignment of sample bots. Comprehensive plan consolidates findings and prescribes unified sample portfolio.

**Key Findings:**
1. **Core 4 samples (mandatory parity):** Echo, TestBot, Teams, AI
   - All three languages have implementations ✅
   - Teams sample incomplete: missing conversationUpdate, messageReaction, typing, installationUpdate handlers

2. **Scope inconsistencies:**
   - .NET has standalone MentionBot, TypingBot samples
   - Node.js has typing-indicator sample
   - Python has echo-bot-no-mention variant
   - Framework samples (.NET AspNetHosting, Node express/hono, Python aiohttp/fastapi) exist but add noise

3. **Activity type coverage in Teams samples:** INCOMPLETE
   - Current: `message` + `invoke:adaptiveCard/action` only
   - Missing: `conversationUpdate`, `messageReaction`, `typing`, `installationUpdate`

4. **AI sample provider mismatch:**
   - .NET: Microsoft.Extensions.AI (vendor-neutral)
   - Node.js: @ai-sdk/azure (Vercel SDK)
   - Python: langchain_azure_ai (LangChain)

**Execution Plan:**

**Phase 1 (Core Portfolio — Mandatory):**
- Task 1: Expand Teams samples to handle all 6 activity types (Issue #218)
- Task 2: Keep middleware samples but de-emphasize
- Task 3: Keep AI samples idiomatic per language

**Phase 2 (Supplemental — Optional):**
- Framework adapter samples documented as "advanced" use cases

**Cross-Language Parity Checklist:**
| Aspect | .NET | Node | Python | Status |
|--------|------|------|--------|--------|
| Teams: conversationUpdate | ❌ | ❌ | ❌ | TODO |
| Teams: messageReaction | ❌ | ❌ | ❌ | TODO |
| Teams: typing | ❌ | ❌ | ❌ | TODO |
| Teams: installationUpdate | ❌ | ❌ | ❌ | TODO |

**References:**
- Plan document: `.squad/decisions/inbox/leela-sample-alignment-plan.md`
- Issue #211: "Review Samples"
- Issue #218: "Teams samples: demonstrate handling additional activity types"

### 17. Skills.md Created for Agent Integration (2026-04-25)

**Author:** Kif (DevRel) | **Status:** COMPLETE | **PR:** #216 (Fixes #210)

Created `Skills.md` at repo root following agentskills.io specification to enable coding agents to discover and integrate botas.

**Content:**
- **YAML Frontmatter**: name, description, license, compatibility, packages, frameworks
- **Quick Start**: Install commands + 3-language echo-bot code + env vars + run commands
- **Core Concepts**: BotApplication, TurnContext, Middleware, Handlers, Activities
- **Authentication**: Deep dive on 2-auth model (inbound JWT + outbound OAuth2)
- **Teams Features**: Adaptive Cards, Mentions, Suggested Actions with code examples
- **Code Patterns**: Echo, Middleware+Handler, Conditional Routing
- **Debugging**: Logging levels, activity inspection
- **References**: Links to docs, samples, GitHub

**Design Decisions:**
- Single self-contained file (~750 lines) vs. skill subdirectories
- All three languages side-by-side for pattern consistency
- Progressive disclosure: frontmatter (~50 tokens) + examples (~4500 tokens)
- Avoids duplicating setup instructions; links to existing docs

**Verification:**
- YAML frontmatter validates against spec
- All code examples taken from existing samples/README
- Cross-language parity verified
- Ready for publication on skills.sh

**References:**
- agentskills.io specification
- PR #216 with branch squad/210-create-skills-md
- Fixes GitHub Issue #210

### 18. Triage Round 3 — Issues #211 & #210 Routing (2026-04-25)

**Triaged by:** Leela (Lead) | **Status:** ROUTING DOCUMENTED

Issue triage establishing ownership and acceptance criteria for #211 and #210.

**Issue #211 (Review Samples):**
- **Primary:** Kif (DevRel)
- **Co-owners:** Amy (.NET), Fry (Node), Hermes (Python)
- **Validator:** Nibbler (E2E testing)
- **Enforcer:** Leela (Lead)
- **Labels:** squad:kif, squad:amy, squad:fry, squad:hermes

**Issue #210 (Skills.md):**
- **Primary:** Kif (DevRel)
- **Status:** Already complete (PR #216)
- **Labels:** squad:kif

**Cross-Issue Notes:**
Both are documentation-first per Decision #2. Both start with go:needs-research (spec/discovery work) before implementation.

**References:**
- Triage document: `.squad/decisions/inbox/leela-triage-round3-samples-skills.md`
- **Python (Hermes):** 3 issues, 2 HIGH (#72, #64, #74)
- **.NET (Amy):** 1 issue, 0 HIGH (#75)

**Cross-Language Impact:** None. All issues are language-specific.

### 19. User directive: Bot Framework changes require owner consent (2026-04-22)

**Captured by:** Rido (Owner) | **Status:** Active

Do not make any decision related to Bot Framework protocol, activity types, auth flows, HTTP contracts, or activity type definitions without explicit consent from the project owner. When in doubt, ask first.

### 20. ActivityType split — Core vs Teams (2026-04-22)

**Author:** Rido (Owner) | **Status:** Implemented

`ActivityType` trimmed to core types only: `'message' | 'typing' | 'invoke'`. New `TeamsActivityType` type alias (superset) adds all Teams/channel-specific types: event, conversationUpdate, messageUpdate, messageDelete, messageReaction, installationUpdate. All three languages use string literal types (no runtime enum objects).

**Rationale:** CoreActivity and BotApplication should not enumerate channel-specific types. Teams-specific types belong in TeamsActivityType.

**Impact:** Breaking change for consumers using `ActivityType.ConversationUpdate`, `ActivityType.Event`, etc. — migrate to `TeamsActivityType`.

### 21. DocFX + VitePress Integration for .NET API Docs (2026-04-23)

**Author:** Bender (DevOps) | **Status:** Approved & Implemented

Implemented DocFX as the .NET API documentation generator, replacing DefaultDocumentation.

**Investigation:**
- **Ideal path tested:** DocFX markdown output (for VitePress integration) — BLOCKED (DocFX v2.78 has no markdown capability)
- **Fallback approved:** DocFX HTML standalone site hosted at `/api/dotnet/` subdirectory

**Implementation:**
- Updated `docs-site/generate-api-docs.sh` with DocFX build commands
- Created `docfx.json` with metadata and build configuration
- DocFX generates professional HTML site (search, xref, syntax highlighting)
- VitePress nav can link to `/api/dotnet/` subdirectory

**Benefits:**
- ✅ Professional, fully-featured API reference
- ✅ Industry-standard tool (.NET community standard)
- ✅ Minimal CI/CD maintenance (regenerate on .NET changes)
- ✅ Clean separation: VitePress for guides, DocFX for API reference

**Files Changed:**
- `docs-site/generate-api-docs.sh` — DocFX build logic
- `docfx.json` — metadata, build, template configuration

**Impact:** .NET API docs now auto-generate to standalone HTML site. Unblocks GitHub Issue #224.

### 22. Publish botas-fastapi to PyPI via CD Pipeline (2026-04-22)

**Author:** Bender (DevOps) | **Status:** Implemented | **PR:** #233

Added `python-fastapi` job to `.github/workflows/CD.yml` for automated PyPI publishing.

**Key Design Decisions:**
1. **Separate job with dependency ordering** — `needs: [changes, python]` ensures `botas` publishes first
2. **Dynamic versioning via hatchling** — Same pattern as `botas`; nbgv stamps `_version.py`
3. **Pinned botas dependency** — Published package pins to exact co-released version
4. **Same secrets** — Uses `PYPI_API_TOKEN` / `TEST_PYPI_API_TOKEN` (pypi environment)

**Files Changed:**
- `.github/workflows/CD.yml` — new `python-fastapi` job
- `python/packages/botas-fastapi/pyproject.toml` — dynamic version, hatch config
- `python/packages/botas-fastapi/src/botas_fastapi/_version.py` — new file (version placeholder)

**Impact:** `botas-fastapi` auto-publishes alongside `botas` in release/non-release workflows.

### 23. Accumulate versions.json across Docs Deployments (2026-04-23)

**Author:** Bender (DevOps) | **Status:** Implemented | **PR:** #235 (Merged)

Fixed docs version selector to accumulate all released versions instead of showing only current.

**Problem:**
- Versioned directories (`v0.3.18/`, `v0.3.25/`) preserved via rsync `--exclude`, but `versions.json` was clobbered
- UI version selector only showed 1 version at a time

**Solution:**
- CD workflow: Save existing `versions.json` before rsync
- After deploy: Merge old + new version arrays (deduplicated, sorted newest-first by semver)
- UI: VersionBadge component reads version from `versions.json` at build time (not hardcoded)

**Files Changed:**
- `.github/workflows/CD.yml` — save + merge versions.json logic
- `docs-site/versions.json` — current version updated to 0.3.25
- `docs-site/.vitepress/theme/index.ts` — dynamic badge version

**Impact:** Version selector now displays all released versions. Versioned docs remain accessible.

### 24. Fix botas-fastapi PyPI Publishing (2026-04-23)

**Author:** Bender (DevOps) | **Status:** Proposed

The `v0.3.25-alpha` CD run failed: new `python-fastapi` job couldn't publish `botas-fastapi` because PyPI rejects OIDC for brand-new projects.

**Options:**
1. **Register trusted publisher on PyPI** — Rido creates project manually, adds GitHub Actions trusted publisher, OIDC works going forward (preferred)
2. **Remove `id-token: write`** — Fall back to API token auth (quick workaround)

**Recommendation:** Option 1 (OIDC is more secure). Rido action required at pypi.org.

**Impact:** Blocks GitHub Release creation and versioned docs deployment for v0.3.25-alpha. Re-run CD after OIDC setup.

### 25. Issue #236 Reassignment & Triage (2026-04-23)

**Triaged by:** Leela (Lead) | **Status:** Documented

Issue #236 ("Inconsistencies across languages implementing ActivityType") reassigned from squad:bender to squad:leela.

**Reasoning:**
- This is cross-language API design parity audit, not DevOps work
- Requires architecture review and harmonization across .NET/Node.js/Python
- Bender (DevOps) should focus on CI/CD; Leela (Lead) owns architectural consistency

**Next Steps:**
1. Audit PR #231 diffs across all three languages
2. Identify inconsistencies in ActivityType constructs
3. Determine scope: breaking fix or minor follow-up
4. Reassign to Amy/Fry/Hermes per scope

**Impact:** Improves issue routing accuracy; parity work now owned by architecture lead.

## Archived Decisions

### Remove createReplyActivity from Internal Spec Files (2025-01-10)

**Author:** Kif (DevRel) | **Status:** Completed

All mentions of `createReplyActivity()` and its language variants removed from docs/bot-spec.md and AGENTS.md. Reply construction logic now documented implicitly through behavioral invariants and sample code.

### 12. Issue Triage — Round 2 (2026-04-13)

**Triaged by:** Leela (Lead) | **Status:** Completed

Triaged 15 security audit findings from comprehensive codebase audit. All issues have been routed to appropriate squad members via `squad:{member}` labels and priority assessment comments.

**Routing Breakdown:**

| Member | Language | P1 Issues | P2 Issues | Key Priorities |
|--------|----------|-----------|-----------|-----------------|
| Amy | .NET | 4 | 5 | SSRF, exception handling, HTTP lifecycle, JWT validation |
| Fry | Node.js | 2 | 4 | SSRF, JWKS cache, token caching, error sanitization |

**Total:** 7 P1 issues (SSRF, cache, exception handling, JWT validation), 8 P2 issues (audit items, configuration, error exposure).

**Cross-Language Notes:** No parity issues identified. All 15 findings are language-specific implementation problems — no spec changes required.

**Next Steps:**
1. Amy: Prioritize #107, #99, #100 (trust and SSRF), then #102, #101 (runtime stability)
2. Fry: Prioritize #91, #89 (cache and SSRF), then #95, #94 (startup + token caching)
3. Follow-up: Request parity audit after implementation if SSRF/cache patterns adopted

**Decision File:** `.squad/decisions/inbox/leela-triage-round2.md`

### 13. P1 Security Batch — Cross-Language Fix (2026-04-13)

**Coordinated by:** Leela (Lead) | **Leads:** Amy (.NET), Fry (Node), Hermes (Python) | **Status:** Completed

Resolved 7 P1 security and stability issues across all three languages.

**Issues Fixed:**
- **.NET (Amy, PR #120):** JWT validation, error detail leaking, HttpClient lifecycle, exception handler, SSRF — 5 P1 issues
- **Node.js (Fry, PR #118):** Secrets in logs, middleware errors, token rate limiting, JWKS cache, SSRF — 5 P1 issues
- **Python (Hermes, PR #119):** JWT validation verification, async context manager, delegation chain tests — 2 P1 issues + parity verification

**Test Coverage:**
- .NET: 65 tests total (+17 new)
- Node.js: 97 tests total (+12 new)
- Python: 82 tests total (+3 new)

**Cross-Language Alignment Achieved:**
- JWT validation now happens before activity dispatch across all languages
- SSRF prevention rules applied consistently (URL validation, endpoint checks)
- Error handling prevents stack trace exposure and unhandled exceptions
- Token management includes rate limiting and cache invalidation
- PII is no longer logged at DEBUG level

**Session Log:** `.squad/log/2026-04-13T2131-p1-security-batch.md`

**Next Steps:** P2 audit findings to be triaged and assigned per language after PR review/merge.

### 14. Spec Consolidation — 18 Files → 11 Core + 2 Future (2026-04-13)

**Proposed by:** Leela (Lead) | **Executed by:** Kif (DevRel) + Leela (Arch Audit) + Amy (Parity Fix) | **Status:** Completed

Consolidated botas spec structure from 18 fragmented files into a clear 11-core / 2-future structure. Identified and fixed 6 accuracy gaps in Architecture.md and resolved cross-language parity inconsistency in ConversationClient.

**Architecture.md Fixes (Leela):**
1. Added invoke activity dispatch to turn pipeline diagram and component table (PR #79)
2. Added `.trafficmanager.net` service URL allowlist to auth middleware section (PR #141)
3. Added `botas-express` package to component table and language-specific notes (PR #147)
4. Added `sendTyping()` method to TurnContext API surface table
5. Added new "Security" section documenting SSRF protection, JWKS caching, body size limits
6. Documented ConversationClient invoke skip as .NET-specific intentional difference

**Spec Merges Executed (Kif):**
1. **Middleware.md → protocol.md** — Merged middleware interface, execution order, dispatch rules into protocol.md under "Middleware" section
2. **ActivityPayloads.md → activity-schema.md** — Merged annotated JSON examples into activity-schema.md under "Examples" section
3. **turn-context.md + botas-express.md → README.md** — Added TurnContext API surface and BotApp simplified API to README.md
4. **Moved to specs/future/:** targeted-messages-reactions.md, teams-activity.md (aspirational, not implemented)
5. **Rewrote invoke-activities.md** — Stripped proposal language, converted to reference documentation

**Cross-References Updated:**
- README.md, protocol.md, activity-schema.md, AGENTS.md, CLAUDE.md, `.github/copilot-instructions.md`
- All internal links verified

**Parity Fix (Amy):**
- **File:** `dotnet/src/Botas/ConversationClient.cs`
- **Change:** Removed `activity.Type == ActivityTypes.Invoke` condition from outbound filtering
- **Reason:** Fixed .NET-specific invoke skip; parity now restored with Node.js and Python
- **Tests:** All 73 .NET tests passing

**New Spec Structure:**

**Core Specs (11 files):**
- README.md, protocol.md, activity-schema.md, inbound-auth.md, outbound-auth.md
- Architecture.md, Configuration.md, Setup.md, Samples.md, Contributing.md
- ProactiveMessaging.md, invoke-activities.md

**Future Specs (2 files in specs/future/):**
- targeted-messages-reactions.md
- teams-activity.md

**Impact:**
- Documentation structure now clearly separates implemented core features from aspirational expansion work
- Eliminates duplication; improves maintainability
- Architecture.md accuracy restored; all implementation gaps closed
- Cross-language parity restored; no more .NET-specific invoke skip inconsistency
- 18 → 11 core files: easier to navigate, update, and reference

**Session Log:** `.squad/log/2026-04-13T2331-spec-consolidation-session.md`  
**Orchestration Logs:**
- `.squad/orchestration-log/2026-04-13T2331-leela-arch.md`
- `.squad/orchestration-log/2026-04-13T2331-kif-merges.md`
- `.squad/orchestration-log/2026-04-13T2331-amy-fix.md`

### 15. FluentCards Adoption — Cross-Language Sample Refactor (2026-04-15)

**Coordinated by:** Squad | **Status:** Implemented

Adopted fluent-cards/FluentCards builder libraries for Adaptive Card construction in teams-sample across all three language implementations.

**Decision Details:**

| Language | Package | Version | Files Modified | Tests | Status |
|----------|---------|---------|-----------------|-------|--------|
| .NET | FluentCards (NuGet) | v0.2.0-beta-0001 | `TeamsSample/Program.cs` | 73 ✅ | Implemented |
| Node.js | fluent-cards (npm) | v0.2.0-beta.1 | `teams-sample/index.ts` | 7 ✅ | Implemented |
| Python | fluent-cards (PyPI) | Latest | `teams-sample/main.py` | 94 ✅ | Implemented |

**Implementation Notes:**

1. **Amy (.NET):** Refactored `TeamsSample/Program.cs` to replace raw JSON Adaptive Card strings with `AdaptiveCardBuilder` fluent API. Welcome card uses TextBlock + Input.Text + Action.Execute; invoke response echoes verb/data. Package added to `.csproj`.

2. **Fry (Node.js):** Refactored `teams-sample/index.ts` using `AdaptiveCardBuilder` fluent calls. Pattern: `toJson(card)` for message attachments; `JSON.parse(toJson(card))` for invoke response objects. Package pinned to exact pre-release version.

3. **Hermes (Python):** Refactored `teams-sample/main.py` with fluent-cards `AdaptiveCardBuilder`. Invoke handler echoes verb/data from `ctx.activity.value`. Added to `pyproject.toml`.

**Design Decision:**

All three implementations use fluent builders instead of raw JSON/dicts for improved maintainability and type safety. This is a samples-only change — no impact to library code. When fluent-cards reaches stable release, versions should be updated accordingly.

**Cross-Language Consistency:**

All three samples now follow identical patterns: welcome card receives user input, invoke handler echoes back the verb and data for round-trip testing, suggested actions remain unchanged.

**Session Log:** `.squad/log/2026-04-15T17-30-fluentcards-adoption.md`

**Orchestration Logs:**
- `.squad/orchestration-log/2026-04-15T17-30-amy.md`
- `.squad/orchestration-log/2026-04-15T17-30-fry.md`

### 15. User directives: Documentation modernization (2026-04-24)

**Author:** Rido (via Copilot) | **Status:** Active

1. **Remove any text with a version from the public docs** — Always assume latest version. No versioning UI, no version selectors, no VersionBadge components.
2. **Remove API Reference links from top nav bar** — API references should be links inside each language-specific documentation page instead.
3. **For API Ref docs, keep the default template from docfx, typedoc, pdoc** — Do not try to integrate with VitePress; use the default HTML output as-is.
4. **Always work in a new branch from main** — Never commit directly to main; use feature branches and PR-based workflow.

**Rationale:** Simplify docs pipeline to always-latest model. API refs should use native tool output (TypeDoc HTML, pdoc HTML, docfx HTML) rather than custom VitePress integration. Version handling attempts in prior sessions were messy and error-prone.

**Tracking:** Implemented in PR #254 (Kif) and related docs/fix PRs.

### 16. Express 405 for non-POST on /api/messages (2026-04-25)

**Author:** Fry (Node Dev) | **Status:** Implemented | **Issue:** #250 | **PR:** #255

Node.js (Express adapter) returned 404 for GET `/api/messages`, while .NET and Python returned 405. The route exists but only accepts POST — 405 is semantically correct per HTTP spec.

**Decision:** Added `app.all(path, ...)` immediately after the `app.post(path, ...)` registration in `BotApp.start()`. This catches all non-POST methods and returns 405 with `Allow: POST` header.

**Impact:** Cross-language parity restored for non-POST method handling on the messages endpoint. Pattern documented for use in future adapters (Hono, Fastify).

**Test Results:** All existing tests pass; behavior verified against .NET and Python endpoints.

### 17. Remove versions and restructure API references (2026-04-25)

**Author:** Kif (DevRel) | **Status:** Implemented | **Issues:** #249, #248, #246 | **PR:** #254

Version text in the docs site was inconsistent and not CD-driven. Hand-curated API overview pages in `docs-site/api/` duplicated generated content and drifted. TypeDoc and Python doc generators were producing markdown for VitePress integration, adding complexity.

**Decision:**

1. **Remove all version text** — Delete `versions.json`, version selector nav dropdown, `VersionBadge` component, and `@viteplus/versions` dependency. Docs always assume "latest."
2. **Remove API Reference from nav/sidebar** — No more top-level API Reference dropdown or sidebar section.
3. **Delete `docs-site/api/`** — Hand-curated overview pages removed.
4. **Add API Reference links in language docs** — Each language page (dotnet.md, nodejs.md, python.md) now links to its generated API docs at the bottom.
5. **Switch to HTML output** — TypeDoc uses default HTML (not `typedoc-plugin-markdown`), pdoc uses `pdoc -o` (not custom markdown generator). Output goes to `docs-site/public/api/generated/` as static assets.

**Impact:** Simpler docs build pipeline (no markdown plugin, no custom Python script for API docs). API references served as standalone HTML pages, not integrated into VitePress. Each language guide is now the single entry point to its API reference.

**Files Modified:** `docs-site/`, `.github/workflows/docs.yml`, `generate-api-docs.sh`

### 18. Standard HTTP error response format (2026-04-25)

**Author:** Leela (Lead) | **Status:** Decided → Implemented | **Issue:** #247

All HTTP error responses (401, 405, and any future error status codes) across all three languages must return:

```json
{"error": "{ErrorCode}", "message": "{human-readable description}"}
```

with `Content-Type: application/json`.

**Specific cases defined:**

| Status | `error` | `message` |
|--------|---------|-----------|
| 401 | `"Unauthorized"` | `"Missing or invalid Authorization header"` (or the specific validation failure from `BotAuthError`) |
| 405 | `"MethodNotAllowed"` | `"Only POST is accepted"` |

**Design rationale:** Minimal, machine-parseable error code (`error`) + human-readable context (`message`) is similar to RFC 7807 `problem+json` but simpler for bot endpoints. Two fields serve distinct purposes: `error` is stable for programmatic checks, `message` can vary for debugging (e.g., "Token expired" vs "Missing Authorization header").

**Implementation Tracking:**
- **Node.js (Fry, PR #257):** Updated `botas-express/bot-auth-express.ts` to return JSON 401/405 responses
- **Python (Hermes, PR #256):** Replaced FastAPI `HTTPException` with `JSONResponse` for standard format
- **.NET (Amy, PR #258):** Configured JWT bearer `OnChallenge` event to write standard JSON body

**Status:** All three implementations complete and shipping in coordinated batch.

### 19. ActivityType parity verification (2026-04-25)

**Author:** Leela (Lead) | **Status:** Verified — Ready to Close | **Issue:** #236

Completed comprehensive cross-language audit of `ActivityType` and `TeamsActivityType` following PR #231 refactor.

**Verdict:** All three languages ARE in parity.

- Core types (`message`, `typing`, `invoke`) match exactly across .NET, Node.js, Python
- Teams-specific types (`event`, `conversationUpdate`, `messageUpdate`, `messageDelete`, `messageReaction`, `installationUpdate`) match exactly
- All type values match specification exactly (case-sensitive `camelCase` in all cases)
- Separate `ActivityType` and `TeamsActivityType` defined in all languages
- `TeamsActivityType` includes core types (via union in Node, re-declaration in .NET, flat list in Python)
- All types exported/public in all three languages

**Intentional differences (language-idiomatic, no behavioral impact):**
- **File organization:** Node.js has dedicated `activity-type.ts` file; .NET and Python inline with CoreActivity
- **Composition pattern:** Node.js uses union composition; .NET re-declares; Python flat-lists
- **Type mechanism:** .NET uses `static class`, Node.js uses `type` alias, Python uses `Literal`

**Recommendation:** Close Issue #236 as resolved. No code changes required. Differences are cosmetic/stylistic and follow language idioms.

**Test Coverage:** Existing test suites validate type values and dispatch behavior across all languages.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
- `.squad/orchestration-log/2026-04-15T17-30-hermes.md`

### 12. VitePress Docs-Site Migration (2026-04-13)

**Author:** Kif (DevRel) | **Status:** Implemented

Migrated docs-site from Jekyll to VitePress after evaluating three static site generators.

**Evaluation:**
| Generator | node_modules | Code-group tabs | Config |
|-----------|-------------|-----------------|--------|
| VitePress | ~79 MB | Built-in | Single `config.mts` |
| Starlight | ~155 MB | Plugin | `astro.config.mjs` + integrations |
| Docusaurus | ~330 MB | Plugin | `docusaurus.config.js` + sidebars |

**Reasons:**
1. Lighter dependencies (79 MB vs 155/330 MB)
2. Native `::: code-group` syntax for three-language examples
3. Simpler single-file config, no plugin ecosystem

**Completed Work:**
- VitePress prototype at `docs-site-vitepress/` with all 10 pages migrated
- Code-group tabs added to: getting-started, middleware, typing-activity, teams-features
- Hero home page with BotAS branding
- Local search enabled
- Build verified clean
- Rejected prototypes (`docs-site-starlight/`, `docs-site-docusaurus/`) deleted

**Key Paths:**
- Config: `docs-site-vitepress/.vitepress/config.mts`
- Logo: `docs-site-vitepress/public/logo.svg`
- Build output: `docs-site-vitepress/.vitepress/dist/`
- Base URL: `/botas/` (GitHub Pages)

**Follow-up:** Original Jekyll site (`docs-site/`) can be removed post-deployment. GitHub Actions workflow needed for automated deployment.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction


## New Decisions (2026-04-15)

### Release Process Publishing Strategy (2026-04-21)

**Author:** Bender (DevOps Engineer) | **Status:** Implemented | **Issue:** #196

Non-stable package releases should be published to non-public registries to minimize pollution of public package indexes with development builds.

**Publishing Matrix:**
| Language | Stable Release (release/* branches) | Non-Stable Release (main branch) |
|----------|-------------------------------------|----------------------------------|
| .NET | NuGet.org | GitHub Packages (nuget.pkg.github.com) |
| Node.js | npm (registry.npmjs.org) | GitHub Packages (npm.pkg.github.com) |
| Python | PyPI | TestPyPI |

**Key Changes:**
- Node.js non-stable builds now publish to GitHub Packages npm registry instead of public npm
- All stable releases include a package links table in release notes
- Dual setup-node configuration pattern for branch-based registry selection

**Benefits:**
- Cleaner public registries; development builds don't pollute public indexes
- Clear separation between stable (public) and non-stable (internal) releases
- Better discovery via release notes with direct package links
- Consistent across all three languages

### Support Both Branch-Based and Tag-Based Releases (2026-04-21)

**By:** Rido (via Copilot) | **Status:** Approved

The release process supports both `release/*` branches AND `v*` tags as triggers for stable releases. Both `version.json` (publicReleaseRefSpec) and CD.yml updated accordingly.

**Rationale:** Issue #196 requests creating releases via branch or tag; both should be supported for flexibility.

### Release Process Documentation (2026-04-21)

**Author:** Kif (DevRel) | **Status:** Implemented | **Issue:** #196

Created `specs/releasing.md` — comprehensive guide to the release process covering versioning, package registries, release workflow, non-stable releases, and version bumping.

**Key Features:**
- Six-section structure: Overview, Versioning, Package Registries, Release Process, Non-Stable Releases, Troubleshooting
- Link-heavy approach (version.json, CD.yml, external docs) to avoid duplication
- Step-by-step prescriptive workflow with expected runtimes and verification links
- Non-stable installation instructions for GitHub Packages and TestPyPI
- Troubleshooting common failure modes

**Impact:**
- Developers can execute releases without guessing or reading workflow YAML
- Non-stable package testing documented with clear installation instructions
- Version bumping guidance prevents accidental conflicts
- Addresses all issue #196 requirements

### Docs Restructuring — Option 3 "Tiered Setup Path" Approved (2026-04-22)

**By:** Rido (via Copilot) | **Status:** In Implementation (Kif/DevRel)

Approved restructure of documentation into 4 tiers with zero duplication target.

**Proposed Structure:**
1. **README.md** — Code-first marketing, quick start examples
2. **getting-started.md** — Code-first tutorial, hands-on walkthrough
3. **setup.md** (new) — Practical setup guide, Azure credentials, environment config
4. **authentication.md** (renamed from auth-setup.md) — Conceptual auth deep-dive, security model

**Basis:** Kif's audit found 6 exact duplications, 7 critical content gaps, and 8 navigation breaks. Leela proposed 3 options; Rido approved Option 3 for clarity, reduced cognitive load, and better progressive disclosure.

**Rationale:**
- Clear progressive disclosure from marketing to hands-on to setup to deep-dive
- Eliminates duplication across multiple pages
- Improves developer onboarding experience
- Aligns with "docs-first feature delivery" directive

### Auth Setup Restructure (2026-04-15)

# Decision: Restructure auth-setup.md to Lead with Teams CLI
# Squad Decisions

## Active Decisions

### 1. User directive: Docs-first feature delivery (2026-04-13)

**Captured by:** Rido (via Copilot) | **Status:** Active

Each feature won't be completed until it has proper docs and samples.

### 2. User directive: Remove legacy/backward-compatibility language (2026-04-13)

**Captured by:** Rido | **Status:** Active

Remove any comment about "legacy" or "backward compatibility" in documentation. This is a brand new library with no existing users.

### 3. Python botas/botas-fastapi package split (2026-04-13)

**Author:** Leela (Lead) | **Status:** Approved

PR #48 extracts FastAPI-specific code into separate `botas-fastapi` adapter package, mirroring Node.js `botas`/`botas-express` split. Architecture correct and approved.

**Follow-up:** Node.js should move `botAuthExpress()` and `botAuthHono()` from core to adapter packages for consistency.

### 4. CatchAll Handler — Cross-Language Parity (2026-04-13)

**Author:** Leela (Lead) | **Status:** Implemented & Verified

Achieved behavioral parity for CatchAll handler across all three languages (.NET, Node.js, Python).

**Specification:** Added "CatchAll Handler" subsection to specs/protocol.md; when CatchAll is set, per-type handlers are completely replaced; exceptions wrapped in BotHandlerException.

**Implementation:** All three languages have consistent CatchAll handler behavior. Parity achieved.

### 5. TeamsActivity Spec — Design Decisions (2026-04-13)

**Author:** Leela (Lead) | **Status:** Proposed (awaiting implementation)

Comprehensive spec at `specs/teams-activity.md` defines strongly-typed Teams-specific activity types and builder pattern for all three languages.

**Key Design Decisions:**
1. No shadow properties — explicit casting (`(TeamsChannelAccount)activity.From`)
2. Builder inheritance, not generics
3. Entity/Attachment as typed classes for .NET parity
4. Mention helper does not modify text (explicit is better)

**Follow-Up:** Implementation pending cross-language coordination.

### 6. Typing Activity Support — Cross-Language Implementation (2026-04-13)

**Author:** Leela (Lead) | **Status:** Implemented & Verified

Added first-class typing activity support across all three languages with language-idiomatic APIs.

**API:** Convenience method `sendTyping()` / `SendTypingAsync()` / `send_typing()` on TurnContext. Handler registration via existing `on("typing", handler)` pattern.

**Impact:** All three languages now have typing activity support. Developers can show bot presence via typing indicators.

### 7. Issue Triage — Round 1 (2026-04-13)

**Triaged by:** Leela (Lead) | **Status:** Completed

All 8 untriaged issues routed to appropriate squad members via `squad:{member}` labels and triage comments. 4 issues marked HIGH (security or critical runtime impact).

### 8. Issue Triage — Round 2 (2026-04-13)

**Triaged by:** Leela (Lead) | **Status:** Completed

Triaged 15 security audit findings. All issues routed to appropriate squad members: Amy (9 issues, 4 P1), Fry (6 issues, 2 P1).

### 9. P1 Security Batch — Cross-Language Fix (2026-04-13)

**Coordinated by:** Leela (Lead) | **Status:** Completed

Resolved 7 P1 security and stability issues across all three languages.

**Issues Fixed:**
- .NET (Amy, PR #120): JWT validation, error detail leaking, HttpClient lifecycle, exception handler, SSRF
- Node.js (Fry, PR #118): Secrets in logs, middleware errors, token rate limiting, JWKS cache, SSRF
- Python (Hermes, PR #119): JWT validation verification, async context manager, delegation chain tests

**Cross-Language Alignment:** JWT validation before activity dispatch, SSRF prevention, error handling, token management, PII logging.

### 10. Node JWT Decoupling (2026-04-15)

**Author:** Fry (Node Dev) | **Status:** Implemented | **PR:** #173

Decoupled JWT server middleware from `botas-core` package.

**Changes:**
- Moved framework-specific JWT middleware (`botAuthExpress`, `botAuthHono`) into separate `bot-auth-server-middleware.ts`
- `botas-core` remains framework-agnostic
- `botas-express` package now imports from `bot-auth-server-middleware.ts`

**Impact:** Clean separation of concerns; botas-core is pure Bot Framework logic without Express/Hono dependencies.

### 11. Docs-site CI + Netlify Preview (2026-04-15)

**Author:** Kif (DevRel) | **Status:** Implemented | **PR:** #176

Added CI build for docs-site with Netlify PR preview deployments.

**Changes:**
- `.github/workflows/docs-site.yml` builds VitePress docs on every PR
- Netlify integration provides preview URLs for documentation changes
- Ensures docs build succeeds before merge

**Impact:** Documentation quality gate; reviewers can preview docs changes before merge.

### 12. CI/CD Hardening (2026-04-15)

**Author:** Leela (Lead) | **Status:** Implemented | **PR:** #177

Hardened CI/CD pipeline with security and performance improvements.

**Changes:**
- SHA pinning for all GitHub Actions
- Dependency caching (npm, pip, NuGet)
- Concurrency controls to cancel stale runs
- Version alignment across all workflows

**Impact:** Improved CI/CD security, faster builds, reduced resource waste.

### 13. E2E as Release Gate (2026-04-15)

**Author:** Nibbler (QA) | **Status:** Implemented | **PR:** #191

E2E tests now gate CD pipeline — no releases ship without passing E2E validation.

**Changes:**
- CD workflow depends on successful E2E completion
- Playwright tests run against all three language implementations
- Release job only fires after E2E passes

**Impact:** Quality gate prevents broken releases; all three languages validated before publish.

### 14. Release Process Formalized (2026-04-15)

**Author:** Leela (Lead) | **Status:** Implemented | **PR:** #196, #197

Added formal release process documentation and GitHub Release creation.

**Changes:**
- `releasing.md` documents release workflow: branch creation, version bumping, PR merge, tag creation
- CD workflow creates GitHub Release with auto-generated notes on `release/**` branches
- Uses nbgv `SimpleVersion` for tag format (`v0.3.0`)

**Impact:** Repeatable release process; GitHub Releases provide changelog and distribution point.

### 15. botas-core Package Rename + Version Property (2026-04-15)

**Author:** Rido | **Status:** Implemented | **PR:** #198

Node package renamed from `botas` to `botas-core`; added `BotApplication.Version` property across all languages.

**Changes:**
- Node: `botas` → `botas-core` (mirrors .NET `Botas.Core` assembly name)
- .NET: `BotApplication.Version` via `ThisAssembly.AssemblyInformationalVersion`
- Node: `BotApplication.version` via `createRequire` reading `package.json`
- Python: `BotApplication.version` via `__import__` of `_version` module
- Test bots echo SDK details (language, version, platform)

**Impact:** Consistent naming across languages; runtime version introspection for diagnostics.

### 16. Getting Started Revamp (2026-04-15)

**Author:** Kif (DevRel) | **Status:** Implemented | **PR:** #201

Rewrote Getting Started guide as code-first Teams bot onboarding.

**Changes:**
- Lead with Teams CLI (`teams app create`) as primary path
- 3-step quickstart: create app, add code, run
- Removed Azure Portal steps from primary flow (moved to appendix)
- Added code-group tabs for .NET/Node.js/Python examples

**Impact:** Faster onboarding; developers get running bot in <5 minutes.

### 17. Spec Restructure (2026-04-15)

**Author:** Leela (Lead) + Kif (DevRel) | **Status:** Implemented | **PR:** #202

Condensed specs, added reference docs, promoted teams-activity.md from future/ to specs/.

**Changes:**
- Spec files renamed to lowercase (e.g., `Protocol.md` → `protocol.md`)
- Added `specs/reference/dotnet.md`, `specs/reference/node.md`, `specs/reference/python.md`
- Promoted `specs/future/teams-activity.md` → `specs/teams-activity.md` (implemented, not aspirational)
- Consolidated overlapping content (18 → 13 files)

**Impact:** Clearer spec structure; reference docs separate from protocol specs; implemented features no longer in "future".

## Archived Decisions

### 1. Jekyll docs scaffold (2026-04-12)
**Author:** Kif | **Superseded by:** VitePress migration (Decision #18, archived below)

### 2. docs/ folder reorganized (2026-04-13)
**Author:** Kif | Moved `docs/specs/` → `specs/`, `docs/art/` → `art/`, deleted `docs/`

### 3. Middleware docs enhancement (2026-04-13)
**Author:** Kif | Enhanced `docs-site/middleware.md` with use cases, examples, RemoveMentionMiddleware

### 4. RemoveMentionMiddleware .NET (2026-04-13)
**Author:** Amy | Implemented `RemoveMentionMiddleware` (.NET) with `BotApp.Use()` method

### 5. RemoveMentionMiddleware Node (2026-04-13)
**Author:** Fry | Implemented `RemoveMentionMiddleware` (Node.js) with `ITurnMiddleware`

### 6. RemoveMentionMiddleware Python (2026-04-13)
**Author:** Hermes | Implemented `RemoveMentionMiddleware` (Python) with regex-strip pattern

### 7. BotApp Simplification docs (2026-04-13)
**Author:** Kif | Updated all docs to lead with simplified BotApp API

### 8. Python parity fix (2026-04-13)
**Author:** Fry | Fixed Python `RemoveMentionMiddleware` to match .NET reference implementation

### 9. VitePress migration (2026-04-13)
**Author:** Kif | Migrated docs-site from Jekyll to VitePress with code-group tabs

### 10. Spec consolidation (2026-04-13)
**Author:** Leela + Kif + Amy | Consolidated specs 18 → 11 files, fixed Architecture.md gaps

### 11. FluentCards adoption (2026-04-15)
**Author:** Squad | Adopted fluent-cards libraries for Adaptive Card construction in teams-sample

### 12. Auth setup restructure (2026-04-15)
**Author:** Kif | Restructured auth-setup.md to lead with Teams CLI (matching getting-started)

### 13. CD release job (2026-04-15)
**Author:** Leela | Added GitHub Release creation to CD workflow on `release/**` branches

### 14. createReplyActivity spec gap resolved (2026-01-10)
**Author:** Kif | **Status:** Resolved

**Problem:** AGENTS.md said createReplyActivity "MUST copy channelId and set replyToId" but NO language implementation did this. .NET CoreActivity doesn't even have a typed `ChannelId` property.

**Resolution:** Docs updated to match implementation behavior (copies only `serviceUrl` and `conversation`, not `channelId`). AGENTS.md behavioral invariant corrected. Spec-vs-implementation gap closed.

**Related:** .NET invoke skip was also documented as cross-language invariant but was .NET-specific. Fixed in PR #150 (spec consolidation) — removed invoke filtering from ConversationClient.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
