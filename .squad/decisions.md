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
