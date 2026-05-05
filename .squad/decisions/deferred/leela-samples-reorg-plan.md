# Samples Reorganization — Issue #321

**Date:** 2026-05-XX  
**Author:** Leela (Lead)  
**Status:** Proposed — **partially superseded by 2026-05-03 owner directives**  
**Issue:** [#321](https://github.com/rido-min/botas/issues/321)

> **2026-05-05 update (compaction):** Per Rido's 2026-05-03 directives (captured in `.squad/decisions.md` A1):
> - **Keep Hono** in Node Advanced Hosting (do NOT replace with Koa). Final Node Advanced = **Hono + Koa + Deno**.
> - **`04-ai-foundry/` is deferred** to a follow-up PR; not part of this reorganization.
> - PRs are **stacked on `feat/samples-reorg`**, one per category, merged sequentially.
>
> Ignore conflicting wording below; treat sections marked "Foundry" or any "remove Hono" guidance as out-of-date.

---

## Decision

Reorganize all samples across .NET, Node.js, and Python into **five consistent categories**:

1. **EchoBot** — simplest possible bot (rename existing)
2. **Advanced Hosting** — manual framework setup for full control
3. **Teams Features** — Teams-specific activity types (rename existing)
4. **AI Features** — two idiomatic AI samples per language
5. **Observability** — OpenTelemetry + gen_ai telemetry conventions

**Directory naming:** `{category}-{feature-name}` (e.g., `01-echo-bot`, `04-ai-langchain-mcp`)  
**Execution:** Stacked PRs on `feat/samples-reorg` branch (5 PRs total, one per category)

---

## Rationale

### Why Reorganize?

**Current state problems:**
- Samples lack consistent structure across languages (8 .NET samples, 8 Node.js, 8 Python — but different purposes)
- No clear "beginner → advanced" progression
- Redundant samples (MentionBot, TypingBot, echo-bot-no-mention, multiple framework demos)
- AI and observability samples don't demonstrate cross-cutting concerns (AI + observability together)
- Framework-specific hosting samples (express, hono, fastapi, aiohttp) create maintenance burden without clear differentiation

**Desired outcome:**
- Clear learning path: 01 (basic) → 05 (advanced observability)
- Cross-language parity: same five categories in all three languages
- Showcase modern patterns: AI integration (Microsoft.Extensions.AI, Vercel AI, LangChain), observability (gen_ai telemetry), framework diversity (Koa, Flask)
- Reduce maintenance: fewer, more focused samples

### Why These Five Categories?

1. **EchoBot:** Entry point. Zero complexity. Every framework needs this.
2. **Advanced Hosting:** Shows raw framework power (manual DI, custom middleware, routes). Differentiates from "magic" `BotApp.Create()` helpers.
3. **Teams Features:** Teams is a primary use case. Needs dedicated showcase.
4. **AI Features:** AI bots are the #1 use case for this library. Show best-in-class patterns per language. Two samples per language demonstrate ecosystem diversity.
5. **Observability:** Production-ready bots need observability. Combining AI + observability demonstrates **gen_ai telemetry conventions** (the most valuable observability pattern for AI bots).

---

## Key Architectural Decisions

### 1. Numbered Directory Names

**Decision:** Use `{category}-{feature-name}` naming (e.g., `01-echo-bot`, `04-ai-vercel`).

**Rationale:**
- Enforces display order in file explorers and GitHub
- Makes learning path explicit (`01` → `05`)
- Descriptive names improve discoverability (`04-ai-langchain-mcp` vs. `ai-bot`)

**Rejected alternative:** Flat, unnumbered names (`echo-bot`, `ai-bot`) — no visual ordering.

### 2. Framework Diversity in Advanced Hosting

**Decision:**
- .NET: ASP.NET Core (keep existing `AspNetHosting`)
- Node.js: Koa (replace Express/Hono)
- Python: Flask (replace FastAPI/aiohttp)

**Rationale:**
- ASP.NET Core is the idiomatic .NET framework — no change needed.
- Express/Hono are too similar (both Node.js HTTP servers). Koa offers different middleware model (async/await, context passing) and is widely used.
- FastAPI/aiohttp are both async Python frameworks. Flask is the most popular synchronous framework, shows sync/async bridge patterns.
- Reduces sample count from 7 framework demos (AspNetHosting, express, hono, fastapi, aiohttp, deno, echo-bot-no-mention's FastAPI) to 3.

**Rejected alternatives:**
- Keep all framework samples (Express, Hono, FastAPI, aiohttp) — increases maintenance burden without clear value.
- Use same framework across languages (e.g., all use Express-like frameworks) — misses opportunity to show ecosystem diversity.

### 3. Two AI Samples Per Language

**Decision:**
- .NET: `04-ai-openai` (Microsoft.Extensions.AI + Azure OpenAI), `04-ai-foundry` (Foundry SDK + Agents)
- Node.js: `04-ai-vercel` (Vercel AI SDK + Azure OpenAI), `04-ai-langchain-mcp` (LangChain + MCP client)
- Python: `04-ai-langchain` (LangChain + Azure OpenAI), `04-ai-semantic-kernel` (Semantic Kernel)

**Rationale:**
- AI is the #1 use case — needs comprehensive coverage.
- Two samples per language show ecosystem diversity (not just "one true way").
- Each sample demonstrates a different pattern:
  - Microsoft.Extensions.AI: unified .NET AI abstraction
  - Foundry SDK: agent-to-agent orchestration
  - Vercel AI SDK: streaming, tool calling, simple API
  - LangChain + MCP: retrieval-augmented generation with Model Context Protocol
  - Semantic Kernel: Microsoft's Python AI orchestration framework

**Open question:** Foundry SDK package names need confirmation (are they public yet?).

### 4. Observability + AI Integration

**Decision:** All three `05-observability` samples will add AI integration (Azure OpenAI) to demonstrate **gen_ai telemetry conventions**.

**Rationale:**
- Observability without AI is table stakes (HTTP spans, logs).
- Observability **with AI** is the differentiator (LLM call spans, token usage metrics, prompt/response tracing).
- **gen_ai telemetry conventions** are the most valuable observability pattern for AI bots — must be showcased.
- Reusing AI frameworks from `04-ai-*` samples shows consistency.

**Rejected alternative:** Keep observability samples as echo-only — misses opportunity to demonstrate gen_ai telemetry.

### 5. Stacked PRs

**Decision:** One PR per category (5 PRs total) on a shared `feat/samples-reorg` branch.

**Rationale:**
- Incremental review: each PR is ~1000 lines (manageable)
- Parallel work: Amy, Fry, Hermes can work on different languages simultaneously
- Early feedback: PR #1 (EchoBot) validates approach before investing in PR #4 (AI)
- Low risk: each PR can be reverted independently if issues arise

**Rejected alternative:** One mega-PR with all changes — 5000+ line diff, high merge conflict risk, hard to review.

---

## Samples to Remove

| Sample | Reason | Covered By |
|--------|--------|------------|
| .NET: `MentionBot/` | RemoveMentionMiddleware demo | `TeamsSample` uses it |
| .NET: `TypingBot/` | Too narrow (only typing indicator) | Docs/middleware guide |
| Node.js: `express/` | Redundant framework demo | `02-advanced-hosting-koa/` |
| Node.js: `hono/` | Redundant framework demo | `02-advanced-hosting-koa/` |
| Python: `fastapi/` | Redundant framework demo | `02-advanced-hosting-flask/` |
| Python: `aiohttp/` | Redundant framework demo | `02-advanced-hosting-flask/` |
| Python: `echo-bot-no-mention/` | RemoveMentionMiddleware demo | `TeamsSample` uses it |

**Total removed:** 7 samples (down from 24 to 17 user-facing samples)

**Samples to keep separate (not user-facing):**
- `test-bot/` (E2E test fixture for Playwright)
- `deno/` (Deno runtime demo — future: consider promoting to `02-advanced-hosting-deno/`)

---

## New Dependencies

| Language | Package | Used In | Purpose |
|----------|---------|---------|---------|
| Node.js | `koa` | `02-advanced-hosting-koa/` | Web framework |
| Node.js | `@koa/router` | `02-advanced-hosting-koa/` | Routing |
| Node.js | `langchain` | `04-ai-langchain-mcp/` | LangChain core |
| Node.js | `@modelcontextprotocol/sdk` | `04-ai-langchain-mcp/` | MCP client |
| Node.js | `@langchain/openai` | `04-ai-langchain-mcp/` | OpenAI integration |
| Python | `flask` | `02-advanced-hosting-flask/` | Web framework |
| Python | `semantic-kernel` | `04-ai-semantic-kernel/` | AI orchestration |
| .NET | Foundry SDK (TBD) | `04-ai-foundry/` | Foundry Agents |

---

## Cross-Language Parity Matrix

| Category | .NET | Node.js | Python | Parity? |
|----------|------|---------|--------|---------|
| **01-echo-bot** | ✅ BotApp.Create() | ✅ BotApp | ✅ BotApp | ✅ Yes |
| **02-advanced-hosting** | ✅ ASP.NET Core DI | ✅ Koa | ✅ Flask | ✅ Yes (different frameworks) |
| **03-teams-features** | ✅ TeamsActivityBuilder | ✅ TeamsActivityBuilder | ✅ TeamsActivityBuilder | ✅ Yes |
| **04-ai (sample 1)** | ✅ Microsoft.Extensions.AI | ✅ Vercel AI SDK | ✅ LangChain | ✅ Yes (different ecosystems) |
| **04-ai (sample 2)** | ✅ Foundry SDK | ✅ LangChain + MCP | ✅ Semantic Kernel | ✅ Yes (different patterns) |
| **05-observability** | ✅ OTel + AI | ✅ OTel + AI | ✅ OTel + AI | ✅ Yes |

**Parity achieved:** All five categories exist in all three languages with similar capabilities (adjusted for language idioms).

---

## Execution Plan

### Stacked PRs (5 total)

1. **PR #1: EchoBot** — rename samples, update docs paths (1 day, low risk)
2. **PR #2: Advanced Hosting** — create Koa/Flask samples, remove Express/Hono/FastAPI/aiohttp (3 days, medium risk)
3. **PR #3: Teams Features** — rename samples, remove MentionBot/echo-bot-no-mention (1 day, low risk)
4. **PR #4: AI Features** — create 6 new AI samples (2 per language) (5 days, high complexity)
5. **PR #5: Observability** — add AI to observability samples, create docs (3 days, medium complexity)

**Total estimated time:** 14 calendar days (parallel work)

### Ownership

| PR | Amy (.NET) | Fry (Node.js) | Hermes (Python) | Kif (DevRel) |
|----|------------|---------------|-----------------|--------------|
| #1 | Rename .NET samples | Rename Node samples | Rename Python samples | Update docs paths |
| #2 | Rename AspNetHosting | Create Koa sample | Create Flask sample | Update language docs |
| #3 | Remove MentionBot, TypingBot | Update teams-sample | Remove echo-bot-no-mention | Update middleware docs |
| #4 | Create 04-ai-foundry | Create 04-ai-langchain-mcp | Create 04-ai-semantic-kernel | — |
| #5 | Add AI to OtelBot | Add AI to otel-bot | Add AI to otel-bot | Create observability.md |

---

## Open Questions for Rido

1. **Foundry SDK:** What NuGet packages should `04-ai-foundry/` reference? Are they public?
2. **Deno sample:** Keep as-is or promote to `02-advanced-hosting-deno/`?
3. **Semantic Kernel:** Confirm this is the desired "latest AI framework" for Python.
4. **TestBot naming:** Keep as `test-bot/` or rename to `99-test-bot/`?
5. **Migration guide:** Do we need docs for users referencing old sample paths?

---

## Success Criteria

✅ All five categories have parity across languages (same structure, similar capabilities)  
✅ Samples are numbered for easy discovery and ordering  
✅ Each sample has a clear, specific purpose (no overlap)  
✅ AI + Observability integration demonstrates gen_ai telemetry conventions  
✅ All samples build and run without errors  
✅ Docs updated to reflect new structure  
✅ Stacked PRs enable incremental review (no mega-PR)

---

## Next Steps

1. **Leela:** Review this plan with Rido. Get answers to open questions.
2. **Leela:** Create GitHub tracking issue with 5 subtasks (one per PR).
3. **Leela:** Create `feat/samples-reorg` base branch from `main`.
4. **Amy, Fry, Hermes:** Start PR #1 (EchoBot) — low-risk rename to build momentum.
5. **Kif:** Draft `docs-site/observability.md` outline (ready for PR #5).

---

## References

- [Issue #321](https://github.com/rido-min/botas/issues/321)
- Plan document: `C:\Users\rmpablos\.copilot\session-state\798f3122-ff20-4bb0-9365-761ee88bf390\plan.md`
- `.squad/agents/leela/history.md` — learning entry appended
