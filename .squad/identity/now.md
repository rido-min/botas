---
updated_at: 2026-05-05T00:00:00Z
focus_area: Samples reorganization (Issue #321), spec ↔ code drift prevention, AI/observability rollout
active_issues: [321, 328, 332]
---

# What We're Focused On

**Current state:** v0.3-alpha line shipping regularly. Library API surface is largely settled across all three languages (.NET, Node.js, Python). Internal-visibility refactor done. JSR publishing live for Node (`@botas/core`). OpenTelemetry observability spec landed.

We're now in **polish + scale** mode:

- **Samples reorganization (Active A1, Issue #321):** Five-category structure (`01-echo-bot` → `05-observability`) on `feat/samples-reorg` with stacked PRs, one per category. PR #322 (rename) merged. Foundry SDK sample deferred.
- **Spec ↔ code drift prevention (Active A3, PR #347):** Recurring "fix stale spec" PRs (#335, #336, #338, #344) prompted a CI-mechanism design doc. Three open questions waiting for owner answers before implementation.
- **AI + observability rollout:** `05-observability` upgraded to AI + OTel + gen_ai conventions across all 3 languages (#329). LangChain + OTel sample (#330). Echo-bot kept minimal; OTel split into dedicated `otel-bot` (Python).
- **Auth hardening:** Custom token factory non-empty validation (#350), single-tenant v2.0 issuer fix (#348), auth scheme span guard fix (#327), `azure-identity` added for Python (#351).
- **.NET proactive scenarios (A2, PR #349):** `ConversationClient` made public + `CreateConversationAsync` exposed.
- **Process docs separated from specs (A7, PR #346):** `specs/process/` vs `specs/` — keeps behaviour specs uncluttered.

**Branch hygiene:** `main` is protected — always work in feature branches and open a PR (per D6).

**Pending owner input:**
- A3 — three open questions on spec compliance tests (block vs warn? required for new specs? citation granularity?).
- A5 — Node CI typecheck step (PR #332) ready to merge now that PR #331 is in.
- A4 — Node `BotApplication.onTurnError` hook design (#328).
