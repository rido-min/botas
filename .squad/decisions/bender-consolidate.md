# Decision: PostHog Branch Consolidation

**Author:** Bender (DevOps Engineer)  
**Date:** 2026-06-29  
**Status:** ✅ Complete  
**Context:** `.squad/orchestration-log/2026-06-29T1245-leela-posthog-rereview.md` (Leela's Option A)

---

## Summary

Successfully consolidated tangled PostHog branches into 4 clean stacked branches per Leela's consolidation plan (Option A). All branches pushed to origin; original branches preserved as backup. Each language branch is now cleanly scoped without cross-language contamination.

---

## Clean Branches Created

### 1. `feat/telemetry-base` (base for all PRs)

**Commits:**
- `6b9b768` — feat(docs-site): Add PostHog product analytics (cherry-pick d8a4914)
- `5a277f5` — feat: add PostHog telemetry parity spec (future) (cherry-pick 00b498f)

**Verification:**
- ✅ `docs-site:build` succeeded (8.91s)
- Scope: docs-site + specs only (no language implementations)

---

### 2. `feat/dotnet-clean` (off `feat/telemetry-base`)

**Commits:**
- `0fe9a4c` — feat(dotnet): implement PostHog usage telemetry (cherry-pick 90d1313, .NET portion only)
- `6fce0b8` — fix(dotnet): Complete PostHog telemetry parity with Node reference (cherry-pick fa9933f)
- `9766059` — chore: remove Python/Node contamination from .NET branch

**Cleanup:**
- ❌ **Dropped stray commit 7311283** (Python fix — not cherry-picked)
- ❌ **Dropped squad docs** from 90d1313 (.squad/agents/kif/history.md)
- ❌ **Removed Python files:** `_posthog_telemetry.py`, `test_posthog_telemetry.py`
- ❌ **Removed Node files:** `posthog-telemetry.ts`, `posthog-telemetry.spec.ts`
- ❌ **Reverted Node/Python changes** to `package.json`, `bot_application.py`, `conversation_client.py`, `bot-application.ts`, `conversation-client.ts`

**Verification:**
- ✅ `dotnet build Botas.slnx` succeeded
- ✅ `dotnet test` passed (178 tests, 0 failures)

---

### 3. `feat/python-clean` (off `feat/telemetry-base`)

**Commits:**
- `42ee486` — feat(python): implement PostHog usage telemetry (cherry-pick a970a9f, OTel test fix only)
- `3aaa87e` — feat(python): add PostHog telemetry implementation (extracted Python files from 90d1313)
- `b8622f1` — fix: Python PostHog telemetry blockers (cherry-pick 655a155)
- `6c2d41a` — chore: remove squad docs and Node contamination from Python branch

**Cleanup:**
- ❌ **Dropped squad docs** from 655a155 (.squad/agents/leela/history.md, .squad/decisions/decisions.md, .squad/decisions/inbox/amy-posthog.md)
- ❌ **Reverted Node changes** to `node/package-lock.json`
- ℹ️ **Resolved conflict** in `node/packages/botas-core/src/conversation-client.ts` (kept base version, no Node changes)

**Verification:**
- ✅ `pip install -e ".[dev]"` succeeded
- ✅ `pytest tests/ -v` passed (236 tests, 0 failures, 12 skipped)

---

### 4. `feat/node-clean` (off `feat/telemetry-base`)

**Commits:**
- `d2d7b75` — feat(node): add PostHog telemetry implementation (extracted Node files from 90d1313)
- `7832981` — fix(node): queue PostHog events until async init completes (cherry-pick 646ed30, conflict resolved)

**Cleanup:**
- ℹ️ **Resolved conflict** in `node/packages/botas-core/src/posthog-telemetry.ts`:
  - Merge conflict markers at lines 79-90 (HEAD vs 646ed30)
  - Took incoming version (646ed30) with `_initPromise` and event queue pattern
  - Manual cleanup: removed conflict markers, kept async init fix
- ℹ️ **Fixed duplicate code** in `node/packages/botas-core/src/conversation-client.ts`:
  - Lines 120-129 had fragment of `updateCoreActivityAsync` duplicated after proper method close
  - Removed duplicate fragment

**Verification:**
- ✅ `npm install` succeeded
- ✅ `npm run build` succeeded (TypeScript compilation clean)
- ✅ `npm test` passed (all tests green)

---

## Conflict Resolutions

### Python: `node/packages/botas-core/src/conversation-client.ts`
- **Strategy:** Keep base version (no Node changes in Python branch)
- **Command:** `git checkout --ours node/packages/botas-core/src/conversation-client.ts`

### Node: `node/packages/botas-core/src/posthog-telemetry.ts`
- **Conflict:** Lines 79-90 (import logic)
- **Strategy:** Take incoming version (646ed30 with `_initPromise` pattern)
- **Manual edit:** Removed `<<<<<<< HEAD`, `=======`, `>>>>>>> 646ed30` markers

### Node: `node/packages/botas-core/src/conversation-client.ts`
- **Issue:** Duplicate method fragment (lines 120-129)
- **Strategy:** Manual edit to remove duplicate
- **Cause:** Cherry-pick artifact from overlapping changes

---

## Branch Strategy

- **Do NOT delete original branches:** `feat/dotnet-posthog`, `feat/python-posthog`, `feat/node-posthog` preserved as backup
- **Never touched main:** All work branched from `main` commit `ff7bdd6`
- **Stacked structure:**
  ```
  main
    └─ feat/telemetry-base (d8a4914 + 00b498f)
        ├─ feat/dotnet-clean (90d1313 + fa9933f, language-scoped)
        ├─ feat/python-clean (a970a9f + 655a155, language-scoped)
        └─ feat/node-clean (90d1313 Node portion + 646ed30, language-scoped)
  ```

---

## PR Strategy (Recommended)

1. **PR #1:** `feat/telemetry-base` → `main` (spec + docs-site, no implementations)
2. **PR #2:** `feat/dotnet-clean` → `main` (after PR #1 merges)
3. **PR #3:** `feat/python-clean` → `main` (after PR #1 merges)
4. **PR #4:** `feat/node-clean` → `main` (after PR #1 merges)

Each PR is cleanly scoped, no cross-language conflicts, independent review.

---

## Files Modified Summary

| Branch | Language Files | Squad Docs Dropped | Other Changes |
|--------|----------------|-------------------|---------------|
| `feat/telemetry-base` | none | none | docs-site + specs only |
| `feat/dotnet-clean` | .NET only | kif/history.md | Removed Python/Node contamination |
| `feat/python-clean` | Python only | leela/history, decisions, inbox/amy-posthog | Reverted Node package-lock |
| `feat/node-clean` | Node only | none | Conflict resolution + duplicate removal |

---

## Validation Summary

| Branch | Build | Tests | Duration |
|--------|-------|-------|----------|
| `feat/telemetry-base` | ✅ docs-site:build | N/A | 8.91s |
| `feat/dotnet-clean` | ✅ dotnet build | ✅ 178 passed, 1 skipped | ~15s |
| `feat/python-clean` | ✅ pip install | ✅ 236 passed, 12 skipped | 38.66s |
| `feat/node-clean` | ✅ npm build | ✅ all tests pass | ~2s build |

---

## Notes

- Original tangled branches preserved: `feat/dotnet-posthog`, `feat/python-posthog`, `feat/node-posthog`
- Commit `7311283` (Python fix on .NET branch) correctly excluded from `feat/dotnet-clean`
- Squad docs intentionally dropped to keep branch scope clean (they can be re-added in main via separate PR if needed)
- All builds/tests verified before push
- No package-lock.json conflicts remain (Node changes isolated to `feat/node-clean`)
