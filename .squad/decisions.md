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
- **Python (Hermes):** 3 issues, 2 HIGH (#72, #64, #74)
- **.NET (Amy):** 1 issue, 0 HIGH (#75)

**Cross-Language Impact:** None. All issues are language-specific.

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

### Auth Setup Restructure (2026-04-15)

# Decision: Restructure auth-setup.md to Lead with Teams CLI

**Author:** Kif (DevRel)  
**Date:** 2026-04-13  
**Status:** Complete  

## Problem

`docs-site/getting-started.md` leads with **Teams CLI** as the primary path (`teams app create` in Step 2), but `docs-site/auth-setup.md` was **portal-only**—Steps 1-2 walked through Azure Portal exclusively. This created inconsistency in the documentation: a developer following getting-started would be familiar with Teams CLI by the time they hit auth-setup, but then auth-setup starts from scratch with the portal, causing confusion.

## Solution

Restructured `auth-setup.md` to match the Teams CLI-first pattern from getting-started while preserving backward-compatibility for users who can't use Teams CLI.

### Key Changes

1. **Prerequisites**: Updated to lead with Teams CLI + dev tunnel (matching getting-started)
2. **Step 1**: Set up tunnel (Dev Tunnels recommended, ngrok alternative)
3. **Step 2**: Run `teams app create` with tunnel URL — single command creates app registration + bot resource + returns credentials
4. **Step 3**: Configure environment variables (unchanged; still critical)
5. **Step 4**: Run and test (unchanged content)
6. **Common Gotchas**: Updated table with Teams CLI-specific guidance (`teams app edit <appId>` for endpoint updates, `teams app secret reset` for secret renewal)
7. **NEW Section - Appendix: Azure Portal Setup**: Moved original portal instructions (Create App Registration + Create Azure Bot Resource) here as an alternative path with note on Azure CLI as well

### Preserved Sections (unchanged)

- Overview (two-auth model explanation)
- How Auth Works Under the Hood (deep dive)

## Rationale

- **Consistency**: Both getting-started and auth-setup now lead with Teams CLI as the standard path
- **Developer experience**: Developers get continuity between docs; less repetition of portal steps
- **Accessibility**: Users without Teams CLI aren't abandoned—appendix provides a complete Azure Portal fallback
- **Maintainability**: Less duplication of basic setup instructions; each page adds different value (getting-started = quick start, auth-setup = auth understanding + troubleshooting)

## Audience Impact

- **Quick-starters** (primary): Continue with Teams CLI as before; auth-setup now matches their workflow
- **Portal-only users** (secondary): Appendix provides all necessary steps with clear labeling as "alternative"
- **Troubleshooters**: Common Gotchas section expanded with Teams CLI-specific fixes

## No Breaking Changes

All original content preserved in appendix; page title, Overview, and How Auth Works sections unchanged.


### CD Release Job (2026-04-15)

# Decision: CD Release Job

**Author:** Leela  
**Date:** 2026-04-15  
**Status:** Implemented  

## Context

The CD workflow builds and publishes packages for all three languages on `release/**` branches but did not create a GitHub Release to mark the version.

## Decision

Added a `release` job to `.github/workflows/CD.yml` that:

1. **Runs only on `release/**` branches** — gated by `startsWith(github.ref, 'refs/heads/release/')`.
2. **Depends on all three language jobs** (`dotnet`, `node`, `python`) via `needs:`.
3. **Tolerates skipped jobs** — uses `if: always()` combined with `!contains(needs.*.result, 'failure') && !contains(needs.*.result, 'cancelled')` so the release fires even when path-filter skips some languages, but blocks if any job actually fails.
4. **Job-level `contents: write`** — overrides the workflow-level `contents: read` so `gh release create` can push tags and releases.
5. **Uses nbgv `SimpleVersion`** for the tag (`v0.1.42` format).
6. **Uses `gh release create --generate-notes`** — GitHub's built-in release notes generator, simpler than `actions/create-release`.

## Alternatives Considered

- `actions/create-release` — more verbose, requires more config, and is archived.
- Manual changelog — unnecessary overhead; GitHub's auto-generated notes from PR titles are sufficient for this project's cadence.

## Impact

- No changes to existing jobs or permissions.
- Release job is additive and only activates on `release/**` branches.
- All three languages benefit from a single coordinated release tag.

