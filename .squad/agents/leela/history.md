# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **2026-04-13: Docs-site technical accuracy review.** Found and fixed 6 issues: wrong method name in README (.NET `CreateReply` → `CreateReplyActivity`), wrong package name in README (Node `@botas/botas` → `botas`), phantom `express.json()` middleware in README, broken Python uvicorn run path in README and getting-started (samples/ dir not inside packages/botas/), false `ChannelId`/`channelId` claims in dotnet.md and python.md (createReplyActivity does NOT copy channelId in any language — only copies serviceUrl and conversation).
- **Spec-vs-implementation gap:** AGENTS.md behavioral invariant #2 says createReplyActivity "MUST copy channelId and set replyToId" but NO language implementation does this. The .NET CoreActivity class doesn't even have a typed `ChannelId` property. Docs now match implementation, not spec. This gap should be resolved: either update the implementations or update AGENTS.md.
- **Trace/invoke skip is .NET-only:** ConversationClient.SendActivityAsync in .NET silently skips `trace` and `invoke` activity types. Node.js and Python do NOT have this behavior — parity gap worth tracking.
