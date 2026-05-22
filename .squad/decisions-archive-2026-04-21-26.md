# Archived Decisions — April 2026

Historical decisions from April 2026, archived from `decisions.md` on 2026-05-22 (>30 days old).

## Release & Governance (2026-04-21 → 2026-04-26)

25. **Release publishing matrix — stable → public registries, non-stable → GitHub Packages / TestPyPI** (2026-04-21, PR #196).
26. **Both `release/*` branches and `v*` tags trigger stable releases** (2026-04-21).
27. **`specs/releasing.md` written** (2026-04-21, PR #196).

## Docs / API / governance (2026-04-22 → 2026-04-26)

28. **Tiered Setup Path — README → getting-started → setup → authentication** (2026-04-22).
29. **API documentation tooling + VitePress integration (initial)** (2026-04-22) — later replaced by D6 (native HTML output).
30. **DocFX + VitePress integration for .NET API docs** (2026-04-23) — later simplified per D6.
31. **Sanitize .NET API docs to remove XML tags** (2026-04-22, PR #230) — strip `<example>`, `<code>`, `<see>` so VitePress builds.
32. **Markdown cross-links outside backticks** (2026-04-22) — fix nodejs/python API ref tables.
33. **Security #207: wildcard service-URL allowlist** (2026-04-23).
34. **Issue #205: update Teams CLI references** (2026-04-23).
35. **Sample alignment plan — Issues #211 & #218** (2026-04-25) — superseded by A1 reorg.
36. **`Skills.md` for agent integration** (2026-04-25).
37. **`ActivityType` split — Core vs Teams** (2026-04-22).
38. **Publish `botas-fastapi` to PyPI via CD** (2026-04-22, PR #213).
39. **Accumulate `versions.json` across docs deploys** (2026-04-23) — superseded by D6 (no version text).
40. **Fix `botas-fastapi` PyPI publishing — OIDC trusted publisher** (2026-04-23).
41. **Issue #236 reassignment + ActivityType parity verification — closed as resolved** (2026-04-23 → 2026-04-25).
42. **Express 405 for non-POST on `/api/messages`** (2026-04-25, PR #255, Issue #250).
43. **Remove version text + restructure API references** (2026-04-25, PR #254) — implements D6.
44. **Standard HTTP error response format `{error, message}`** (2026-04-25, PRs #256 / #257 / #258, Issue #247).
45. **Logging documentation structure** (2026-04-XX) — `docs-site/logging.md` with code-group blocks for all 3 languages.
46. **id / channelId promoted to typed CoreActivity fields** (2026-04-26, PRs #261 / #269) — completes Decision 6 from earlier round.
