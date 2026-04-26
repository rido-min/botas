# Decision: Auth & ConversationClient Spans (.NET)

**Author:** Amy (NET Dev)  
**Date:** 2025-07-17  
**Status:** Implemented  
**PR:** 3+4 combined (observability spec)

## Context

The observability spec requires three span types for auth and outbound calls:
- `botas.auth.inbound` — inbound JWT validation
- `botas.auth.outbound` — outbound token acquisition  
- `botas.conversation_client` — outbound activity sends

## Decisions

### 1. `botas.auth.inbound` — NOT added for .NET (intentional difference)

In .NET, inbound JWT validation is handled entirely by ASP.NET Core's authentication middleware (`Microsoft.Identity.Web` / `AddBotAuthentication()`). This middleware already emits its own spans when OpenTelemetry is configured for ASP.NET Core (`AddAspNetCoreInstrumentation()`).

Adding a botas-level wrapper would either:
- Duplicate framework telemetry (confusing traces)
- Require intercepting framework internals (fragile)

**Decision:** Document as .NET intentional difference. Node.js and Python should add `botas.auth.inbound` in their custom JWT validation code.

### 2. `auth.cache_hit` defaults to `false`

Microsoft.Identity.Web's `IAuthorizationHeaderProvider.CreateAuthorizationHeaderForAppAsync` doesn't expose whether the token came from cache. The tag is set to `false` as a default. Future versions of MSAL may expose this.

### 3. ConversationClient span placement

The span starts AFTER `ValidateServiceUrl()` — SSRF validation is a precondition, not part of the outbound call. This keeps the span focused on the actual HTTP round-trip.

### 4. Error recording pattern

Used `catch (Exception ex) when (ccActivity is not null)` in ConversationClient to record error status only when a span listener is active, avoiding catch block overhead in the common no-OTel case.
