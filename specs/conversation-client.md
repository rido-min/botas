# ConversationClient Spec

**Purpose**: Define the `ConversationClient` API for outbound Bot Service REST API calls.  
**Status**: Draft

---

## Overview

`ConversationClient` wraps the [Bot Service v3 Conversations REST API](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference#conversations-object). It provides typed methods for:
- Sending, updating, and deleting activities
- Managing conversation members
- Creating proactive conversations
- Uploading transcripts

All methods require:
1. **Outbound authentication** — OAuth2 client-credentials tokens (see [Outbound Auth](./outbound-auth.md))
2. **Service URL validation** — SSRF protection via allowlist (see [Protocol — Service URL Validation](./protocol.md#service-url-validation))

---

## Constructor

**Signature** (language-specific):

**.NET:**

```csharp
ConversationClient(HttpClient httpClient, ILogger<ConversationClient> logger)
```

Registered via DI in ASP.NET Core. Application code typically does not call this constructor directly.

**Node.js:**

```typescript
constructor(getToken?: TokenProvider)
```

`TokenProvider` is an optional async function `() => Promise<string | undefined>` that returns a bearer token. Omit for unauthenticated local development.

**Python:**

```python
def __init__(self, get_token: TokenProvider | None = None) -> None
```

`TokenProvider` is an optional async callable `Callable[[], Awaitable[str | None]]` that returns a bearer token. Omit for unauthenticated local development.

---

## Methods

All methods are async and return typed responses (or `undefined` / `None` when the API returns no body).

### Send Activity

Send an activity to a conversation.

**.NET:**

```csharp
Task<string> SendActivityAsync(CoreActivity activity, CancellationToken cancellationToken = default)
```

**Returns**: Raw JSON response body (contains activity ID).

**Node.js / Python:**

```typescript
// Node.js
async sendCoreActivityAsync(
  serviceUrl: string,
  conversationId: string,
  activity: Partial<CoreActivity>
): Promise<ResourceResponse | undefined>
```

```python
# Python
async def send_activity_async(
    self,
    service_url: str,
    conversation_id: str,
    activity: CoreActivity | dict[str, Any],
) -> ResourceResponse | None
```

**Returns**: `ResourceResponse { id: string }` with the new activity ID.

**Note**: .NET embeds `serviceUrl` and `conversationId` in the `CoreActivity` object. Node.js and Python pass them as separate parameters.

---

### Update Activity

Update an existing activity in a conversation.

**Node.js:**

```typescript
async updateCoreActivityAsync(
  serviceUrl: string,
  conversationId: string,
  activityId: string,
  activity: Partial<CoreActivity>
): Promise<ResourceResponse | undefined>
```

**Python:**

```python
async def update_activity_async(
    self,
    service_url: str,
    conversation_id: str,
    activity_id: str,
    activity: CoreActivity | dict[str, Any],
) -> ResourceResponse | None
```

**Returns**: `ResourceResponse` with the activity ID.

**Available in**: Node.js, Python  
**.NET status**: Not yet implemented (tracked in backlog).

---

### Delete Activity

Delete an activity from a conversation.

**Node.js:**

```typescript
async deleteCoreActivityAsync(
  serviceUrl: string,
  conversationId: string,
  activityId: string
): Promise<void>
```

**Python:**

```python
async def delete_activity_async(
    self,
    service_url: str,
    conversation_id: str,
    activity_id: str,
) -> None
```

**Returns**: `void` / `None`

**Available in**: Node.js, Python  
**.NET status**: Not yet implemented (tracked in backlog).

---

### Get Conversation Members

Retrieve all members of a conversation.

**Node.js:**

```typescript
async getConversationMembersAsync(
  serviceUrl: string,
  conversationId: string
): Promise<ChannelAccount[]>
```

**Python:**

```python
async def get_conversation_members_async(
    self,
    service_url: str,
    conversation_id: str,
) -> list[ChannelAccount]
```

**Returns**: Array/list of `ChannelAccount` objects. Empty array if no members.

**Available in**: Node.js, Python  
**.NET status**: Not yet implemented (tracked in backlog).

---

### Get Conversation Member (by ID)

Retrieve a single conversation member by user ID.

**Node.js:**

```typescript
async getConversationMemberAsync(
  serviceUrl: string,
  conversationId: string,
  memberId: string
): Promise<ChannelAccount | undefined>
```

**Python:**

```python
async def get_conversation_member_async(
    self,
    service_url: str,
    conversation_id: str,
    member_id: str,
) -> ChannelAccount | None
```

**Returns**: `ChannelAccount` or `undefined` / `None` if not found.

**Available in**: Node.js, Python  
**.NET status**: Not yet implemented (tracked in backlog).

---

### Get Conversation Paged Members

Retrieve conversation members with server-side pagination.

**Node.js:**

```typescript
async getConversationPagedMembersAsync(
  serviceUrl: string,
  conversationId: string,
  pageSize?: number,
  continuationToken?: string
): Promise<PagedMembersResult<ChannelAccount>>
```

**Python:**

```python
async def get_conversation_paged_members_async(
    self,
    service_url: str,
    conversation_id: str,
    page_size: int | None = None,
    continuation_token: str | None = None,
) -> PagedMembersResult
```

**Returns**: `PagedMembersResult { members: ChannelAccount[], continuationToken?: string }`

Use `continuationToken` from the result to fetch subsequent pages.

**Available in**: Node.js, Python  
**.NET status**: Not yet implemented (tracked in backlog).

---

### Delete Conversation Member

Remove a member from a conversation.

**Node.js:**

```typescript
async deleteConversationMemberAsync(
  serviceUrl: string,
  conversationId: string,
  memberId: string
): Promise<void>
```

**Python:**

```python
async def delete_conversation_member_async(
    self,
    service_url: str,
    conversation_id: str,
    member_id: str,
) -> None
```

**Returns**: `void` / `None`

**Available in**: Node.js, Python  
**.NET status**: Not yet implemented (tracked in backlog).

---

### Create Conversation

Create a new proactive conversation (e.g., 1:1 chat with a user).

**Node.js:**

```typescript
async createConversationAsync(
  serviceUrl: string,
  parameters: ConversationParameters
): Promise<ConversationResourceResponse | undefined>
```

**Python:**

```python
async def create_conversation_async(
    self,
    service_url: str,
    parameters: ConversationParameters,
) -> ConversationResourceResponse | None
```

**Returns**: `ConversationResourceResponse { id: string, serviceUrl: string, activityId: string }`

**Available in**: Node.js, Python  
**.NET status**: Not yet implemented (tracked in backlog).

---

### Get Conversations

List all conversations the bot is a member of.

**Node.js:**

```typescript
async getConversationsAsync(
  serviceUrl: string,
  continuationToken?: string
): Promise<ConversationsResult>
```

**Python:**

```python
async def get_conversations_async(
    self,
    service_url: str,
    continuation_token: str | None = None,
) -> ConversationsResult
```

**Returns**: `ConversationsResult { conversations: Conversation[], continuationToken?: string }`

**Available in**: Node.js, Python  
**.NET status**: Not yet implemented (tracked in backlog).

---

### Send Conversation History (Upload Transcript)

Upload a transcript of past activities to a conversation.

**Node.js:**

```typescript
async sendConversationHistoryAsync(
  serviceUrl: string,
  conversationId: string,
  transcript: Transcript
): Promise<ResourceResponse | undefined>
```

**Python:**

```python
async def send_conversation_history_async(
    self,
    service_url: str,
    conversation_id: str,
    transcript: Transcript,
) -> ResourceResponse | None
```

**Returns**: `ResourceResponse` or `undefined` / `None`.

**Available in**: Node.js, Python  
**.NET status**: Not yet implemented (tracked in backlog).

---

### Get Conversation

Retrieve conversation account details.

**Node.js:**

```typescript
async getConversationAsync(
  serviceUrl: string,
  conversationId: string
): Promise<Conversation | undefined>
```

**Python:**

```python
async def get_conversation_async(
    self,
    service_url: str,
    conversation_id: str,
) -> Conversation | None
```

**Returns**: `Conversation` or `undefined` / `None` if not found.

**Available in**: Node.js, Python  
**.NET status**: Not yet implemented (tracked in backlog).

---

## Error Handling

All methods throw/reject on error:

- **Authentication errors** — If the token provider returns `undefined` / `None` or an invalid token, the HTTP client returns 401.
- **Service URL validation errors** — If the `serviceUrl` is not on the allowlist, throws `ArgumentException` (.NET) / `BotAuthError` (Node.js/Python) before making the request.
- **HTTP errors** — If the Bot Service returns a non-2xx status, throws an exception with the status code and error message (implementation-defined format).

---

## Conversation ID Encoding

When constructing the URL path, the `conversationId` is:
1. **Truncated at the first `;` character** (for Teams agents channel compatibility)
2. **URL-encoded** via `encodeURIComponent` / `quote`

Example: `a]concat-123;messageid=9876` becomes `a%5Dconcat-123` in the URL.

The full conversation ID is still used in the activity body.

---

## Service URL Validation

All methods validate the `serviceUrl` parameter against the allowlist before making the request. See [Protocol — Service URL Validation](./protocol.md#service-url-validation) for the full ruleset.

**Allowed patterns**:
- `*.botframework.com`
- `*.botframework.us`
- `*.botframework.cn`
- `smba.trafficmanager.net` (exact match)
- `localhost` / `127.0.0.1` (development only)
- Any prefix in the `ALLOWED_SERVICE_URLS` environment variable

---

## Language-Specific Notes

| Aspect | .NET | Node.js | Python |
|--------|------|---------|--------|
| Constructor | DI-injected `HttpClient` + `ILogger` | Optional `TokenProvider` callback | Optional `TokenProvider` callback |
| Send returns | `Task<string>` (raw JSON) | `Promise<ResourceResponse \| undefined>` | `ResourceResponse \| None` |
| Method availability | Send only | All methods | All methods |
| HTTP client | `IHttpClientFactory` with auth handler | `BotHttpClient` (wraps `fetch`) | `BotHttpClient` (wraps `httpx.AsyncClient`) |
| Resource cleanup | Automatic (DI manages `HttpClient`) | Automatic (`fetch` manages connections) | Must call `aclose()` or use `async with` |

**.NET roadmap**: Update, delete, and member management methods are planned but not yet implemented. Use the Node.js or Python implementations as reference when porting.

---

## References

- [Outbound Auth](./outbound-auth.md) — OAuth2 client-credentials token acquisition
- [Protocol — Service URL Validation](./protocol.md#service-url-validation) — SSRF protection
- [Activity Schema](./activity-schema.md) — `CoreActivity` type definition
- [Bot Service Conversations API](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference#conversations-object) — Official API reference
