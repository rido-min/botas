# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- **2026-04-12**: Scaffolded Jekyll docs site in `/docs-site/` using `just-the-docs` remote theme. Logo lives at `docs/art/icon.svg` (copied to `docs-site/assets/images/logo.svg`). Nav structure: Home → Getting Started → Languages (.NET, Node.js, Python) → Middleware → Auth & Setup. All placeholder pages have front matter wired for just-the-docs navigation. Local preview: `cd docs-site && bundle install && bundle exec jekyll serve`.
- **2026-04-13**: Reorganized docs/ folder. Moved specs to `specs/`, art assets to `art/`, Architecture.md and Setup.md into `specs/`. Updated all cross-references in README.md, AGENTS.md, copilot-instructions.md, and all three language package READMEs. The `docs/` directory is now fully removed; `docs-site/` remains for the Jekyll site.
- **2026-04-13**: Enhanced middleware documentation in `docs-site/middleware.md` to address GitHub Issue #51. Added: common middleware use cases (logging, filtering, metrics, auth, rate limiting, context enrichment, error recovery, routing), detailed explanation of activity modification via `context.activity`, and three complete language examples of RemoveMentionMiddleware (.NET, Node.js, Python) with inline usage samples. Updated `specs/README.md` to link developer guides to `docs-site/middleware.md`. All middleware specs align with Turn Context and Protocol specs.

### Cross-language implementations (2026-04-13)
- **Amy (.NET):** Created `RemoveMentionMiddleware` class and `BotApp.Use()` method for middleware registration. MentionBot sample. 10 tests passing (27 total).
- **Fry (Node.js):** Created `remove-mention-middleware.ts` implementing `ITurnMiddleware`. Mutates `activity.text` in-place, matches `recipient.id`. 10 tests passing (36 total).
- **Hermes (Python):** Created Protocol-based middleware. Uses `entity.model_dump(by_alias=True)` for mention fields. 8 tests passing (45 total).
- All three ports maintain parity: strip self-mentions, case-insensitive, handle edge cases, provide samples.
- **2026-04-13**: Updated all docs to reflect the new simplified BotApp API. Key changes: (1) .NET uses `BotApp.Create()` + `app.On()` handlers instead of `AddBotApplication`/`UseBotApplication`/`OnActivity`; (2) Node.js uses `BotApp` from `botas-express` package for simple bots; (3) Python uses `BotApp()` with aiohttp; (4) All three use `TurnContext` (ctx) in handlers with `ctx.send()` for replies instead of `CoreActivityBuilder` + manual `sendActivityAsync()`. Legacy API (OnActivity, CoreActivityBuilder, createReplyActivity) is still documented as "still supported" for backward compatibility. All examples in README.md, getting-started.md, language guides, middleware.md, and specs/README.md updated to lead with the simple path (BotApp) and show manual setup as advanced/secondary option.
