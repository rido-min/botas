---
last_updated: 2026-04-22T00:00:00Z
---

# Team Wisdom

Reusable patterns and heuristics learned through work. NOT transcripts — each entry is a distilled, actionable insight.

## Patterns

**Pattern: Spec-first, then implement.** **Context:** Before implementing cross-language features, write the spec in `specs/` first. This prevents divergence and clarifies requirements across all three languages. (Learned from typing activity and invoke activities work)

**Pattern: Parity table in decisions.** **Context:** When implementing a feature across languages, always include a cross-language parity table showing API differences (return types, handler signatures, extensions). (Learned from typing, CatchAll, RemoveMentionMiddleware)

**Pattern: Docs-first feature delivery.** **Context:** User directive — features aren't done until docs and samples are updated. Every PR touching library code should touch `docs-site/` too. (Decision #2)

**Pattern: Drop-box for decisions.** **Context:** Agents write to `.squad/decisions/inbox/{name}-{slug}.md`, Scribe merges. Never write directly to `decisions.md`.

**Pattern: Test-bot for E2E.** **Context:** E2E tests use dedicated test-bot samples (not echo-bot), extracted in PR #186. Test bots echo SDK details (language, version, platform).

**Pattern: VitePress code-groups for multi-language.** **Context:** Use `::: code-group` tabs in `docs-site/` for .NET/Node/Python examples side by side. Cleaner than Jekyll, built-in support.

**Pattern: Teams CLI-first setup.** **Context:** Documentation leads with `teams app create` for bot provisioning; Azure Portal as appendix fallback. Both getting-started and auth-setup follow this order.

**Pattern: Node package naming.** **Context:** Node packages are `botas-core` (library) and `botas-express` (adapter). NOT `botas`. Use these consistently in docs and install commands.

**Pattern: Python uses ruff.** **Context:** Always run `ruff check --fix` and `ruff format` before committing Python changes. Line length 120 (see `python/packages/botas/pyproject.toml`).
