# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **RemoveMentionMiddleware (2026-04-13):** Created `node/packages/botas/src/remove-mention-middleware.ts` — implements `ITurnMiddleware`, strips bot @mentions from `activity.text` by matching `entity.mentioned.id` against `activity.recipient.id`. Exported from package index.
- **Middleware pattern:** Middleware can mutate `activity.text` even though `TurnContext.activity` is a readonly reference — the object properties themselves are mutable. This is by design for middleware like mention-stripping.
- **Test file registration:** New spec files must be added to the `test` script in `node/packages/botas/package.json` — it doesn't use glob patterns.
- **Bot Framework mention entity shape:** `{ type: "mention", mentioned: { id, name }, text: "<at>Name</at>" }` — the `text` field contains the exact string embedded in `activity.text`.

### Cross-language parity (2026-04-13)
- **Amy (.NET):** Created `RemoveMentionMiddleware` class and added `BotApp.Use()` method for deferred middleware registration. MentionBot sample demonstrates usage. 10 tests passing (27 total).
- **Hermes (Python):** Created Protocol-based middleware in `python/packages/botas/src/botas/remove_mention_middleware.py`, uses `entity.model_dump(by_alias=True)` to access mention fields. 8 tests passing (45 total).
- All three ports implement same behavior: strip bot @mentions, case-insensitive, provide samples for user reference.

### Python RemoveMentionMiddleware parity fix (2026-04-13)
- **Cross-assigned fix (Fry for Hermes):** Fixed Python `RemoveMentionMiddleware` per Leela's parity review rejection.
- **Removed name-based matching:** Python was checking `recipient.name` in addition to `appid` and `recipient.id`. Now uses `appid ?? recipient.id` two-stage fallback matching .NET reference.
- **Case-insensitive comparison:** ID matching now uses `.casefold()`, text replacement uses `re.IGNORECASE` flag.
- **Tests:** Added 3 new tests (case-insensitive ID, case-insensitive text, no name-matching). All 48 tests pass, ruff clean.
