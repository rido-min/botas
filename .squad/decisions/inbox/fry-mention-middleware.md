# Decision: RemoveMentionMiddleware added to Node botas package

**Author:** Fry (Node Dev) | **Date:** 2026-04-13 | **Issue:** #51

## What

Added `RemoveMentionMiddleware` to `node/packages/botas/src/remove-mention-middleware.ts`, exported from the package.

## Design Choices

- **Class implementing ITurnMiddleware** (not a standalone function) — consistent with how `botAuthExpress`/`botAuthHono` are structured but uses the turn middleware interface for pipeline participation.
- **Matches by `recipient.id`** — the bot's own ID from the incoming activity. No need to pass bot ID as a constructor arg.
- **Mutates `activity.text` in place** — the middleware pipeline shares the same `TurnContext` object, so downstream middleware and handlers see the cleaned text.
- **Only strips bot-self mentions** — other user mentions are preserved.

## Parity Note

This middleware is Node-only for now. If the team wants parity across .NET and Python, the same logic should be ported using the same matching strategy (`recipient.id` comparison).
