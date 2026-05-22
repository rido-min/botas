# Agent Spawn Log: Leela (Error Format Decision + ActivityType Research)

**Date:** 2026-04-25T11:24:31Z  
**Agent:** Leela (Lead)  
**Issues:** #247, #236  
**Status:** Complete  

## What Was Done

### 1. Standard HTTP Error Response Format Decision (Issue #247)

Established canonical error response format for all languages:
- Status codes: 401 (Unauthorized), 405 (MethodNotAllowed), others as applicable
- Content-Type: `application/json`
- Body shape: `{"error": "{ErrorCode}", "message": "{human-readable description}"}`

Specific mappings:
- **401:** `error: "Unauthorized"`, `message: "Missing or invalid Authorization header"` (or specific BotAuthError)
- **405:** `error: "MethodNotAllowed"`, `message: "Only POST is accepted"`

Rationale: Minimal, machine-parseable error code + human-readable context; similar to RFC 7807 but simpler for bot endpoints.

Decision documented in `.squad/decisions/inbox/leela-error-format.md`.

### 2. ActivityType Parity Research (Issue #236)

Completed comprehensive cross-language audit of `ActivityType` and `TeamsActivityType` after PR #231 refactor.

**Verdict:** All three languages ARE in parity.
- Core types (`message`, `typing`, `invoke`) match exactly across .NET, Node.js, Python
- Teams-specific types (`event`, `conversationUpdate`, etc.) match exactly
- All values match specification
- Implementation differences (file location, composition pattern, type system) are language-idiomatic and have no behavioral impact

Recommendation: Close Issue #236 as resolved. No code changes required.

Research documented in `.squad/decisions/inbox/leela-activity-type-research.md`.

## Outcome

1. **Error Format Decision:** Established and documented. Ready for implementation across all three languages.
2. **ActivityType Verification:** Confirmed cross-language parity. Safe to close #236.

## Decision Summaries

- See `.squad/decisions/inbox/leela-error-format.md`
- See `.squad/decisions/inbox/leela-activity-type-research.md`

## Next Steps

1. Distribute error format decision to Fry (Node), Hermes (Python), Amy (.NET) for implementation
2. Rido to close Issue #236 with research link
3. Monitor implementation PRs for #247 error format changes
