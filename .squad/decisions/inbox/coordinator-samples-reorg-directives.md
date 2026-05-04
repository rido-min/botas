### 2026-05-03: Samples reorganization directives (Issue #321)
**By:** Rido (via Copilot)

**Decisions:**
1. **Foundry SDK sample deferred** — `04-ai-foundry/` will be a follow-up PR, not part of this reorganization.
2. **Keep Hono sample** — do NOT remove `hono/` from Node.js samples. The Advanced Hosting category shows botas-core is web server agnostic by having MULTIPLE framework samples.
3. **Add Koa + Deno** — Node.js Advanced Hosting gets Koa (new) and Deno (promote from standalone). So Node Advanced Hosting = Hono + Koa + Deno.
4. **Purpose of Advanced Hosting** — demonstrate that botas-core is web server agnostic (works with any framework).
5. **Stacked PRs per category** — one PR per sample category, merged sequentially.

**Why:** User directive — captured for team memory and agent coordination.
