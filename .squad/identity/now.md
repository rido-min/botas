---
updated_at: 2026-04-22T00:00:00Z
focus_area: Release stabilization and docs improvements
active_issues: []
---

# What We're Focused On

**Current state:** v0.3-alpha (latest: v0.3.6-alpha) with formal release process documented in `specs/releasing.md`.

We're solidifying the foundation across all three languages:

- **Release stabilization:** Gatekeeping releases with E2E tests, SHA pinning in CI/CD, hardened pipeline
- **Docs improvements:** Migrated to VitePress, adopted FluentCards in Teams samples, spec restructuring (11 core + reference docs per language + 2 future specs)
- **Spec accuracy:** All three languages now have RemoveMentionMiddleware, typing activity, CatchAll handler, and `BotApplication.Version` property
- **Package naming clarity:** Node package renamed from `botas` to `botas-core` (with `botas-express` adapter)
- **Cross-language parity:** Ensuring behavior matches spec across .NET, Node.js, and Python
