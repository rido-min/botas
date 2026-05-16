# Decision: Agentic Identities Architecture

**Author**: Leela  
**Date**: 2025-07-24  
**Issue**: #313  
**Spec**: `specs/future/agentic-identities.md`

## Decision

Add support for Entra Agent ID (agentic identities) to botas, enabling bots to act on behalf of users via a 3-step token exchange.

## Key Points

1. **New standalone `AgentTokenClient`** — NOT integrated into existing `TokenManager`. Different flow, different caching semantics.
2. **Raw HTTP only** — no MSAL dependency. The `fmi_path` and `user_fic` grants are non-standard and unsupported by MSAL for Node.js/Python.
3. **Activity-driven** — agentic identity fields come from the incoming activity's `conversation` object. Blueprint credentials come from env vars.
4. **Schema addition** — `ConversationAccount` gains 3 new optional fields: `agenticAppId`, `agenticUserId`, `agenticAppBlueprintId`.
5. **Conditional outbound auth** — if `AgenticIdentity` is present, use agentic flow; otherwise, fall back to existing `client_credentials`.
6. **All three languages** must implement identically (parity requirement).

## Rationale

Follows the pattern established in microsoft/teams.net while keeping our MSAL-free, raw-HTTP approach consistent with botas philosophy. The standalone client is cleaner than bolting a completely different flow onto `TokenManager`.

## Impact

- Amy (.NET), Fry (Node.js), Hermes (Python): Will implement `AgentTokenClient` + schema changes
- Nibbler: Needs unit tests for 3-step flow (mocked HTTP)
- Kif: Docs update for outbound-auth.md
