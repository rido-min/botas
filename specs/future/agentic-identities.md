# Agentic Identities Spec

**Status**: Proposal  
**Issue**: [#313](https://github.com/rido-min/botas/issues/313)  
**Date**: 2025-07-24  

---

## Summary

Agentic Identities allow a bot to act on behalf of a specific user when calling downstream APIs. Instead of the traditional client-credentials flow (where the bot acts as itself), the bot acquires a **user-delegated token** that represents a specific user — enabling scenarios where the bot performs actions with the user's permissions and identity.

This is powered by **Microsoft Entra Agent ID**, a new identity primitive that introduces a 3-step token exchange flow using non-standard OAuth2 extensions (`fmi_path` and `user_fic` grant type).

---

## Why This Matters

| Current Model | Agentic Identity Model |
|---------------|----------------------|
| Bot authenticates as itself (app identity) | Bot authenticates as a user (delegated identity) |
| All actions use bot's permissions | Actions use user's permissions |
| No per-user context on outbound calls | Outbound calls carry user identity |
| Single `client_credentials` grant | 3-step token exchange |

Use cases:
- Bot sends a Teams message **as a specific user** (not as "Bot")
- Bot calls Graph API with user's permissions
- Bot acts as a delegate/agent for a user in multi-tenant scenarios

---

## Token Acquisition Flow

The flow is a **3-step token exchange** against the Entra token endpoint. None of these grant types are standard OAuth2.

### Entities

| Entity | Description |
|--------|-------------|
| **Blueprint** | The Azure AD app registration (has `client_id` + `client_secret`) |
| **Agent Identity** | A sub-principal created under the blueprint (has its own `agentIdentityId`) |
| **User** | The target user the agent acts as (identified by `agentUserOid`) |

### Environment Variables (New)

| Variable | Description |
|----------|-------------|
| `AGENT_IDENTITY_ID` | Object ID of the Agent Identity (dual-purpose: `fmi_path` in step 1, `client_id` in steps 2-3) |
| `AGENT_USER_OID` | Object ID (or UPN) of the user to impersonate |

The existing `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID` refer to the **Blueprint** app registration.

### Step 1: Acquire FMI Exchange Token (T1)

The Blueprint acquires a token scoped to `api://AzureADTokenExchange/.default` with the non-standard `fmi_path` parameter.

```http
POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token

grant_type=client_credentials
&client_id={blueprintClientId}
&client_secret={blueprintClientSecret}
&scope=api://AzureADTokenExchange/.default
&fmi_path={agentIdentityId}
```

`fmi_path` tells Entra which Agent Identity sub-principal to stamp into the token's `sub` claim.

### Step 2: Acquire User Impersonation Token (T2)

The Agent Identity (using `agentIdentityId` as `client_id`) presents T1 as a JWT client assertion.

```http
POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token

grant_type=client_credentials
&client_id={agentIdentityId}
&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
&client_assertion={T1}
&scope=api://AzureADTokenExchange/.default
```

T1's subject matches the agent identity's app ID, satisfying the FIC (Federated Identity Credential) trust.

### Step 3: Acquire Resource Token via `user_fic` Grant

Combines T1 + T2 to get a final token for the target resource.

```http
POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token

grant_type=user_fic
&client_id={agentIdentityId}
&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
&client_assertion={T1}
&user_federated_identity_credential={T2}
&user_id={agentUserOid}
&requested_token_use=on_behalf_of
&scope={resourceScope}
```

Where `resourceScope` is typically `https://api.botframework.com/.default` or the downstream API scope.

### Flow Diagram

```
Blueprint (CLIENT_ID + CLIENT_SECRET)
    │
    ├── Step 1: client_credentials + fmi_path → T1 (FMI exchange token)
    │
    ▼
Agent Identity (AGENT_IDENTITY_ID)
    │
    ├── Step 2: client_credentials + T1 as assertion → T2 (impersonation token)
    │
    ├── Step 3: user_fic + T1 + T2 + user_id → Bearer token (resource token)
    │
    ▼
Bot Service API (https://api.botframework.com)
```

---

## Schema Changes

### `ConversationAccount` — New Fields

The incoming activity's `conversation` object may carry agentic identity fields set by the channel:

```json
{
  "conversation": {
    "id": "...",
    "agenticAppId": "<agent-identity-app-id>",
    "agenticUserId": "<user-oid>",
    "agenticAppBlueprintId": "<blueprint-client-id>"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `agenticAppId` | `string?` | The Agent Identity's application ID |
| `agenticUserId` | `string?` | The user OID the agent is acting as |
| `agenticAppBlueprintId` | `string?` | The Blueprint's application ID |

These fields are **optional** — only present when the channel (e.g., Teams) signals that agentic identity should be used for outbound calls.

### `AgenticIdentity` — New Model

A value object extracted from `ConversationAccount`:

```
AgenticIdentity
├── agenticAppId: string?
├── agenticUserId: string?
└── agenticAppBlueprintId: string?
```

---

## API Surface for botas

### New Class: `AgentTokenClient`

Responsible for the 3-step token exchange. Must be implemented in all three languages.

#### Constructor

| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | string | Azure AD tenant ID |
| `clientId` | string | Blueprint client ID |
| `clientSecret` | string | Blueprint client secret |

#### Method: `getAgentUserToken`

| Parameter | Type | Description |
|-----------|------|-------------|
| `agentIdentityId` | string | Agent Identity ID (dual-purpose) |
| `agentUserOid` | string | User OID to impersonate |
| `scope` | string | Target resource scope |
| **Returns** | string | `"Bearer {token}"` |

### Integration with Existing Architecture

The `AgentTokenClient` plugs into the **outbound auth** pipeline as an alternative to `TokenManager`:

```
ConversationClient
    │
    ├── If AgenticIdentity present on activity:
    │       └── AgentTokenClient.getAgentUserToken(...)
    │
    └── Otherwise:
            └── TokenManager (existing client_credentials flow)
```

The decision of which path to take is determined by whether the incoming activity's `conversation` carries agentic identity fields.

### Modified: `ConversationClient` / `UserTokenClient`

Both clients need awareness of `AgenticIdentity`:
- When sending an activity, if `AgenticIdentity` is available, use `AgentTokenClient` to acquire the bearer token instead of the standard `TokenManager`.
- The `AgenticIdentity` is extracted from the incoming activity's `conversation` field during request processing.

---

## Language Mapping

### .NET

```csharp
public sealed class AgenticIdentity
{
    public string? AgenticAppId { get; set; }
    public string? AgenticUserId { get; set; }
    public string? AgenticAppBlueprintId { get; set; }
}

public class AgentTokenClient(string tenantId, string clientId, string clientSecret)
{
    public Task<string> GetAgentUserTokenAsync(
        string agentIdentityId, string agentUserOid, string scope);
}
```

### Node.js (TypeScript)

```typescript
interface AgenticIdentity {
  agenticAppId?: string;
  agenticUserId?: string;
  agenticAppBlueprintId?: string;
}

class AgentTokenClient {
  constructor(tenantId: string, clientId: string, clientSecret: string);
  getAgentUserToken(agentIdentityId: string, agentUserOid: string, scope: string): Promise<string>;
}
```

### Python

```python
@dataclass
class AgenticIdentity:
    agentic_app_id: str | None = None
    agentic_user_id: str | None = None
    agentic_app_blueprint_id: str | None = None

class AgentTokenClient:
    def __init__(self, tenant_id: str, client_id: str, client_secret: str) -> None: ...
    async def get_agent_user_token(self, agent_identity_id: str, agent_user_oid: str, scope: str) -> str: ...
```

---

## Configuration

### Option A: Environment Variables (Explicit)

```env
CLIENT_ID=<blueprint-client-id>
CLIENT_SECRET=<blueprint-client-secret>
TENANT_ID=<tenant-id>
AGENT_IDENTITY_ID=<agent-identity-id>
AGENT_USER_OID=<user-oid>
```

### Option B: Activity-Driven (Preferred)

The agentic identity fields come from the incoming activity's `conversation` object. The bot only needs Blueprint credentials (`CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID`) — the agent identity and user OID are extracted per-request from the channel payload.

This is the model used in `microsoft/teams.net`: the `ConversationAccount` carries `agenticAppId`, `agenticUserId`, and `agenticAppBlueprintId`, and the framework extracts them automatically.

**Recommendation**: Support both. Option B is the primary path for channel-initiated flows. Option A is useful for proactive messaging scenarios where the bot initiates without an incoming activity.

---

## Token Caching

The 3-step flow is expensive (3 HTTP calls per token). Caching is essential:

- **T1** can be cached per `agentIdentityId` (short TTL, ~5 min based on token expiry)
- **T2** can be cached per `agentIdentityId` (same TTL as T1)
- **Final token** can be cached per `(agentIdentityId, agentUserOid, scope)` tuple

Cache keys should be composite. Cache invalidation should happen on HTTP 401 responses from the target API.

---

## Behavioral Invariants (Additions to AGENTS.md)

1. When `AgenticIdentity` is present, outbound calls MUST use the agentic token flow.
2. When `AgenticIdentity` is absent, the existing `client_credentials` flow is used (no behavior change).
3. Token acquisition failures in the agentic flow MUST throw/raise with a descriptive error (not silently fall back to app identity).
4. The 3 agentic fields on `ConversationAccount` MUST round-trip through serialization (preserve unknown properties rule already covers this).
5. `AgentTokenClient` MUST NOT depend on MSAL or any identity library — it uses raw HTTP (the `fmi_path` and `user_fic` grants are not supported by MSAL for Node.js/Python as of mid-2025).

---

## Open Questions

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Should `AgentTokenClient` be a standalone class or integrated into `TokenManager`? | Standalone / Integrated | **Standalone** — different flow, different caching semantics, clearer separation |
| 2 | Should token caching be built into `AgentTokenClient` or delegated to a separate cache layer? | Built-in / External | **Built-in** with simple in-memory TTL cache (same pattern as existing `TokenManager`) |
| 3 | How do we handle `agenticAppBlueprintId` — is it always equal to `CLIENT_ID`? | Assert match / Ignore / Use from activity | **Assert match** in debug, use `CLIENT_ID` for token requests |
| 4 | Should the agentic flow support managed identity / FIC for the Blueprint credential (instead of client_secret)? | Yes / Later | **Later** — start with client_secret, add FIC support in a follow-up |
| 5 | Production credential model — client secrets are not permitted for blueprints in production. When do we add FIC support? | P1 / P2 | **P1** — must ship before production use. Track as separate spec. |
| 6 | Should we add `AgenticIdentity` to our `CoreActivity` schema or keep it on `ConversationAccount` only? | Activity / ConversationAccount | **ConversationAccount only** — matches teams.net pattern |

---

## Implementation Plan

1. **Schema**: Add `agenticAppId`, `agenticUserId`, `agenticAppBlueprintId` to `ConversationAccount` in all languages
2. **Model**: Add `AgenticIdentity` value object in all languages
3. **Token Client**: Implement `AgentTokenClient` with the 3-step flow (raw HTTP, no MSAL dependency)
4. **Integration**: Wire `AgentTokenClient` into `ConversationClient` outbound path (conditional on `AgenticIdentity` presence)
5. **Caching**: Add per-token TTL cache inside `AgentTokenClient`
6. **Tests**: Unit tests for the 3-step flow (mocked HTTP), integration tests with real Entra endpoint
7. **Docs**: Update `specs/outbound-auth.md` to reference agentic flow as an alternative path

---

## References

- [Entra Agent ID OAuth Flow](https://learn.microsoft.com/en-us/entra/agent-id/identity-platform/agent-user-oauth-flow)
- [Entra Agent ID Overview](https://learn.microsoft.com/en-us/entra/agent-id/agent-oauth-protocols)
- [microsoft/teams.net — AgenticIdentity](https://github.com/microsoft/teams.net/blob/main/core/src/Microsoft.Teams.Core/Schema/AgenticIdentity.cs)
- [rido-min/spike-agentic-tokens — Raw HTTP Demo](https://github.com/rido-min/spike-agentic-tokens/tree/main/raw_http_demo)
- [Existing outbound-auth spec](../outbound-auth.md)
