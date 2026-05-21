# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Core Context

**Recent Work**: TurnState spec design (Issue #361 Phase 1), cross-language spec authoring, architectural decision documentation, team coordination.

**Key Ongoing**: Samples reorg (A1, phases 2–5 stacked), `onTurnError` hook (A4, pending approval), spec compliance tests (A3, pending Rido answers).

**Key Deliverables**:
- `specs/turn-state.md` — Three-scope state model with storage abstraction (decision A6, pending approval)
- `.squad/skills/cross-language-spec-design/SKILL.md` — Reusable patterns for multi-language spec writing
- Cross-language API audit + accuracy fixes for `turn-context.md`, `conversation-client.md`, `core-activity-builder.md`
- Observability spec (`specs/observability.md`) + span hierarchy design
- Node `onTurnError` hook design (`specs/future/on-turn-error.md`)
- Samples reorg planning (Phase 2–5 tracked in `.squad/decisions.md` A1)

**Decision Authorship**: A1 (samples reorg), A4 (onTurnError), A6 (TurnState) + 7 archived spec decisions.

## Learnings

### 2026-05-21: TurnState Parity Review — FileStorage Encoding Divergence

**Task**: Cross-language parity review of TurnState implementations from Amy (.NET), Fry (Node.js), and Hermes (Python).

**Context**: All three devs implemented TurnState in parallel from `specs/turn-state.md`. Each passed their language's test suite. Parity review required before merge.

**Findings**:
1. **1 critical divergence**: FileStorage key sanitization
   - Amy (.NET): Regex `[^a-zA-Z0-9_\-]` → underscore (lossy — `foo/bar` and `foo*bar` both become `foo_bar`)
   - Fry (Node.js): `encodeURIComponent` (lossless, RFC 3986)
   - Hermes (Python): `urllib.parse.quote(key, safe="")` (lossless, RFC 3986)
2. **0 divergences** in core TurnState logic — all three correctly implement three-scope model, key derivation, path syntax, dirty tracking, atomic semantics

**Canonical decision**: Percent-encoding (RFC 3986) with no safe characters. Node.js and Python already compliant; Amy must update `FileStorage.cs` to use `Uri.EscapeDataString(key)`.

**Spec update**: Added "Cross-Language Parity Rules" section to `specs/turn-state.md` pinning:
- Canonical FileStorage key encoding algorithm with examples
- Key derivation format (explicitly labeled as parity requirement)
- Path syntax rules

**Alignment work assigned**:
- Amy (.NET): 1 change — `FileStorage.SanitizeKey()` method
- Fry (Node.js): 0 changes
- Hermes (Python): 0 changes

**Key learning**: FileStorage key encoding was underspecified in the original spec (said "sanitized for filesystem safety" but didn't mandate the algorithm). Future specs should explicitly pin encoding algorithms with cross-language examples when file interoperability matters.

### 2026-05-21: TurnState Decisions Resolved — Spec Finalized

**Task**: Lock in rido's answers to TurnState spec open questions and finalize `specs/turn-state.md` for implementation.

**Context**: TurnState spec (Issue #361 Phase 1) completed with 3 open design questions. Rido resolved all three — middleware model, atomic per-turn semantics (discard on error), and MemoryStorage + FileStorage for v1.

**Changes made**:
1. **specs/turn-state.md** — Removed "Open Questions" section, added "Resolved Decisions" subsection with rationale for each decision
2. **specs/turn-state.md** — Updated "Lifecycle in the Pipeline" section to describe middleware registration (`app.UseState(storage)`) and atomic semantics (save skipped if `next()` throws)
3. **specs/turn-state.md** — Updated "Error Handling" section with discard-on-error behavior and rationale
4. **specs/turn-state.md** — Updated "Built-in Implementations" section to include FileStorage as v1 deliverable with API examples and implementation notes (path sanitization, no locking, single-instance assumption)
5. **specs/turn-state.md** — Updated "Configuration" section with correct middleware registration API examples per language
6. **specs/turn-state.md** — Updated "Behavioral Invariants" section to include atomic semantics and FileStorage key sanitization parity
7. **specs/turn-state.md** — Updated "Language-Specific Intentional Differences" table to reflect middleware registration methods
8. **specs/turn-state.md** — Updated "Out of Scope for v1" to clarify cloud adapters deferred (FileStorage is sufficient)
9. **.squad/decisions/inbox/leela-turn-state-decisions-resolved.md** — Captured 3 resolved decisions with rationale
10. **.squad/agents/leela/history.md** — Appended learning note

**Key decisions locked in**:
- **Middleware model**: `app.UseState(storage)` opt-in registration (NOT built into BotApplication core)
- **Atomic semantics**: State saved ONLY on successful turns; discarded if handler/middleware throws (matches teams-sdk)
- **v1 storage**: MemoryStorage + FileStorage ship in v1; cloud adapters deferred

**Outcome**: Implementation phase (Phase 2) unblocked for Amy (.NET), Fry (Node.js), Hermes (Python). Spec is the contract — no further design changes expected for v1.

### 2026-05-21: TurnState Spec Design — Phase 1 Complete (Issue #361)

**Task**: Design and spec a state management system for botas bots across .NET, Node.js, and Python (Phase 1).

**Deliverables**:
- `specs/turn-state.md` (~21KB) — Full design with three-scope model, storage abstraction, lifecycle, examples, language-specific notes
- `specs/README.md` — Updated with link to new spec
- `specs/architecture.md` — Added TurnState to pipeline diagram and components table
- `.squad/decisions/inbox/leela-turn-state-spec.md` → merged to decision A6 — architectural decisions, alternatives, deviations from TeamsAI

**Key Design Decisions**:
1. **Three-scope model** (Conversation, User, Temp) — automatic key derivation from activity fields; covers 95% of bot state needs
2. **Storage abstraction** (IStorage) — simple key-value read/write/delete; pluggable backends (MemoryStorage, Cosmos, etc.)
3. **Lifecycle**: Load before middleware, save after handler — boilerplate elimination, middleware can inspect/modify state
4. **Dirty tracking**: JSON hash comparison — language-agnostic, catches nested mutations
5. **Concurrency**: Last-write-wins v1 — simplicity; optimistic ETags deferred to v2
6. **TurnContext integration**: `context.state` property (nullable when unconfigured)

**Research Basis**: Microsoft.TeamsAI State module reference; intentional simplifications for botas v1 (no custom scopes, no bot-level scope, no MemoryFork, non-generic TurnState).

**Phase 2** (pending approval): Amy (.NET), Fry (Node.js), Hermes (Python) implement TurnState + storage adapters in parallel; Kif writes state management guide; Nibbler adds E2E tests.

**Decision**: Decision A6 in `.squad/decisions.md`. Spec implementation patterns captured in `.squad/skills/cross-language-spec-design/SKILL.md`.

**Follow-up (2026-05-21)**: Open questions resolved by rido — middleware model, atomic semantics, MemoryStorage + FileStorage for v1. Spec finalized in decision file at `.squad/decisions/inbox/leela-turn-state-decisions-resolved.md`. Implementation phase unblocked.

