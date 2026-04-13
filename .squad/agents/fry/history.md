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
