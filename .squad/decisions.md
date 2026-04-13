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

## Archived Decisions

### Remove createReplyActivity from Internal Spec Files (2025-01-10)

**Author:** Kif (DevRel) | **Status:** Completed

All mentions of `createReplyActivity()` and its language variants removed from docs/bot-spec.md and AGENTS.md. Reply construction logic now documented implicitly through behavioral invariants and sample code.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
