# Python API Reference

API reference for the **botas** Python library, extracted from docstrings and type annotations in [`python/packages/botas/src/botas/`](https://github.com/rido-min/botas/tree/main/python/packages/botas/src/botas).

**Package:** `botas` (PyPI)  
**Import:** `from botas import BotApplication, ...`

---

## BotApplication

Central bot entry point managing the middleware pipeline, handler dispatch, and outbound messaging.

```python
class BotApplication
```

### Constructor

```python
BotApplication(options: BotApplicationOptions = BotApplicationOptions())
```

Options default from environment variables (`CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID`) when not provided.

### Class Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `version` | `str` | SDK version string. |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `appid` | `str \| None` | Azure AD application/client ID. |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `on` | `on(type: str, handler: ActivityHandler \| None = None) -> Any` | Register an activity handler by type. Can be used as a decorator: `@bot.on("message")`. |
| `use` | `use(middleware: TurnMiddleware) -> BotApplication` | Add middleware to the pipeline. |
| `on_invoke` | `on_invoke(name: str, handler: InvokeActivityHandler \| None = None) -> Any` | Register a named invoke handler. Can be used as a decorator. |
| `process_body` | `async process_body(body: str) -> InvokeResponse \| None` | Parse and process a raw JSON activity body. |
| `send_activity_async` | `async send_activity_async(service_url: str, conversation_id: str, activity: CoreActivity \| dict) -> ResourceResponse \| None` | Send a proactive activity to a conversation. |
| `aclose` | `async aclose() -> None` | Clean up resources (HTTP clients, token manager). |

Supports `async with` context manager.

---

## BotApplicationOptions

Authentication and token configuration for `BotApplication`.

```python
@dataclass
class BotApplicationOptions
```

| Field | Type | Default | Env Variable | Description |
|-------|------|---------|-------------|-------------|
| `client_id` | `str \| None` | `None` | `CLIENT_ID` | Azure AD app/client ID. |
| `client_secret` | `str \| None` | `None` | `CLIENT_SECRET` | Azure AD client secret. |
| `tenant_id` | `str \| None` | `None` | `TENANT_ID` | Azure AD tenant ID. |
| `managed_identity_client_id` | `str \| None` | `None` | — | Managed identity client ID. |
| `token_factory` | `Callable[[str, str], Awaitable[str]] \| None` | `None` | — | Custom async token provider. |

---

## TurnContext

Per-turn context passed to handlers and middleware.

```python
class TurnContext
```

### Constructor

```python
TurnContext(app: BotApplication, activity: CoreActivity)
```

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `activity` | `CoreActivity` | The incoming activity for this turn. |
| `app` | `BotApplication` | The bot application processing this turn. |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `send` | `async send(activity_or_text: str \| CoreActivity \| dict) -> ResourceResponse \| None` | Reply with text, a full activity, or a dict. |
| `send_typing` | `async send_typing() -> None` | Send a typing indicator. |

---

## ConversationClient

Typed async client for the Bot Framework Conversation REST API.

```python
class ConversationClient
```

### Constructor

```python
ConversationClient(get_token: TokenProvider | None = None)
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `send_activity_async` | `async (service_url, conversation_id, activity) -> ResourceResponse \| None` | Send an activity. |
| `update_activity_async` | `async (service_url, conversation_id, activity_id, activity) -> ResourceResponse \| None` | Update an activity. |
| `delete_activity_async` | `async (service_url, conversation_id, activity_id) -> None` | Delete an activity. |
| `get_conversation_members_async` | `async (service_url, conversation_id) -> list[ChannelAccount]` | List members. |
| `get_conversation_member_async` | `async (service_url, conversation_id, member_id) -> ChannelAccount \| None` | Get one member. |
| `get_conversation_paged_members_async` | `async (service_url, conversation_id, page_size?, continuation_token?) -> PagedMembersResult` | Get members with pagination. |
| `delete_conversation_member_async` | `async (service_url, conversation_id, member_id) -> None` | Remove a member. |
| `create_conversation_async` | `async (service_url, parameters) -> ConversationResourceResponse \| None` | Create a proactive conversation. |
| `get_conversations_async` | `async (service_url, continuation_token?) -> ConversationsResult` | List conversations. |
| `send_conversation_history_async` | `async (service_url, conversation_id, transcript) -> ResourceResponse \| None` | Upload transcript. |
| `get_conversation_account_async` | `async (service_url, conversation_id) -> Conversation \| None` | Get conversation details. |
| `aclose` | `async aclose() -> None` | Close the HTTP session. |

---

## CoreActivity

Bot Framework activity payload. Pydantic model with camelCase JSON aliases and `extra="allow"` for unknown property round-tripping.

```python
class CoreActivity(BaseModel)
```

| Field | Type | JSON Alias | Description |
|-------|------|-----------|-------------|
| `type` | `str` | `type` | Activity type (e.g. `"message"`, `"typing"`). |
| `service_url` | `str` | `serviceUrl` | Bot Framework service URL. |
| `from_account` | `ChannelAccount \| None` | `from` | Sender account. |
| `recipient` | `ChannelAccount \| None` | `recipient` | Recipient account. |
| `conversation` | `Conversation \| None` | `conversation` | Conversation reference. |
| `text` | `str \| None` | `text` | Text content. |
| `name` | `str \| None` | `name` | Activity name (invoke/event). |
| `value` | `Any` | `value` | Activity value payload. |
| `entities` | `list[Entity] \| None` | `entities` | Entity metadata. |
| `attachments` | `list[Attachment] \| None` | `attachments` | Attachments. |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `model_validate_json` | `classmethod (json_data: str \| bytes) -> CoreActivity` | Deserialize from JSON (handles `"from"` remapping). |
| `model_dump` | `(**kwargs) -> dict[str, Any]` | Serialize to dict (restores `"from"` key). |

---

## CoreActivityBuilder

Fluent builder for constructing outbound `CoreActivity` instances.

```python
class CoreActivityBuilder
```

| Method | Returns | Description |
|--------|---------|-------------|
| `with_conversation_reference(source)` | `CoreActivityBuilder` | Copy conversation reference. |
| `with_type(activity_type)` | `CoreActivityBuilder` | Set activity type. |
| `with_service_url(service_url)` | `CoreActivityBuilder` | Set service URL. |
| `with_conversation(conversation)` | `CoreActivityBuilder` | Set conversation. |
| `with_from(from_account)` | `CoreActivityBuilder` | Set sender. |
| `with_recipient(recipient)` | `CoreActivityBuilder` | Set recipient. |
| `with_text(text)` | `CoreActivityBuilder` | Set text. |
| `with_entities(entities)` | `CoreActivityBuilder` | Set entities. |
| `with_attachments(attachments)` | `CoreActivityBuilder` | Set attachments. |
| `build()` | `CoreActivity` | Build the activity. |

---

## ChannelAccount

User or bot account on a channel. Pydantic model.

```python
class ChannelAccount(BaseModel)
```

| Field | Type | JSON Alias | Description |
|-------|------|-----------|-------------|
| `id` | `str` | `id` | Account identifier. |
| `name` | `str \| None` | `name` | Display name. |
| `aad_object_id` | `str \| None` | `aadObjectId` | Azure AD object ID. |
| `role` | `str \| None` | `role` | Account role. |

---

## TeamsChannelAccount

Teams-specific channel account with email and UPN.

```python
class TeamsChannelAccount(ChannelAccount)
```

| Field | Type | JSON Alias | Description |
|-------|------|-----------|-------------|
| `user_principal_name` | `str \| None` | `userPrincipalName` | Azure AD UPN. |
| `email` | `str \| None` | `email` | Email address. |

---

## Conversation

Conversation reference.

```python
class Conversation(BaseModel)
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `str` | Conversation identifier. |

---

## Entity

Bot Framework entity metadata.

```python
class Entity(BaseModel)
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `str` | Entity type (e.g. `"mention"`). |

---

## Attachment

File or card attachment.

```python
class Attachment(BaseModel)
```

| Field | Type | JSON Alias | Description |
|-------|------|-----------|-------------|
| `content_type` | `str` | `contentType` | MIME type. |
| `content_url` | `str \| None` | `contentUrl` | URL to content. |
| `content` | `Any` | `content` | Inline content. |
| `name` | `str \| None` | `name` | Attachment name. |
| `thumbnail_url` | `str \| None` | `thumbnailUrl` | Thumbnail URL. |

---

## SuggestedActions & CardAction

### CardAction

```python
class CardAction(BaseModel)
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | `str` | `"imBack"` | Action type. |
| `title` | `str \| None` | `None` | Button text. |
| `value` | `str \| None` | `None` | Value sent on click. |
| `text` | `str \| None` | `None` | Text sent to bot. |
| `display_text` | `str \| None` | `None` | Text shown in chat. |
| `image` | `str \| None` | `None` | Icon URL. |

### SuggestedActions

```python
class SuggestedActions(BaseModel)
```

| Field | Type | Description |
|-------|------|-------------|
| `to` | `list[str] \| None` | Recipient IDs. |
| `actions` | `list[CardAction]` | Action buttons (default `[]`). |

---

## TeamsActivity

Teams-specific activity with channel data and helpers. Extends `CoreActivity`.

```python
class TeamsActivity(CoreActivity)
```

### Additional Fields

| Field | Type | JSON Alias | Description |
|-------|------|-----------|-------------|
| `channel_data` | `TeamsChannelData \| None` | `channelData` | Teams channel data. |
| `timestamp` | `str \| None` | `timestamp` | Activity timestamp. |
| `local_timestamp` | `str \| None` | `localTimestamp` | Local timestamp. |
| `locale` | `str \| None` | `locale` | User locale. |
| `local_timezone` | `str \| None` | `localTimezone` | User timezone. |
| `suggested_actions` | `SuggestedActions \| None` | `suggestedActions` | Suggested actions. |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `from_activity` | `classmethod (activity: CoreActivity) -> TeamsActivity` | Convert from CoreActivity. |
| `add_entity` | `(entity: Entity) -> None` | Add an entity. |
| `create_builder` | `classmethod () -> TeamsActivityBuilder` | Create a fluent builder. |

---

## TeamsActivityBuilder

Fluent builder for Teams activities with mention, Adaptive Card, and channel data helpers.

```python
class TeamsActivityBuilder
```

| Method | Returns | Description |
|--------|---------|-------------|
| `with_conversation_reference(source)` | `TeamsActivityBuilder` | Copy conversation reference. |
| `with_type(activity_type)` | `TeamsActivityBuilder` | Set activity type. |
| `with_service_url(service_url)` | `TeamsActivityBuilder` | Set service URL. |
| `with_conversation(conversation)` | `TeamsActivityBuilder` | Set conversation. |
| `with_from(from_account)` | `TeamsActivityBuilder` | Set sender. |
| `with_recipient(recipient)` | `TeamsActivityBuilder` | Set recipient. |
| `with_text(text)` | `TeamsActivityBuilder` | Set text. |
| `with_channel_data(channel_data)` | `TeamsActivityBuilder` | Set channel data. |
| `with_suggested_actions(actions)` | `TeamsActivityBuilder` | Set suggested actions. |
| `with_entities(entities)` | `TeamsActivityBuilder` | Set entities. |
| `with_attachments(attachments)` | `TeamsActivityBuilder` | Set attachments. |
| `with_attachment(attachment)` | `TeamsActivityBuilder` | Set single attachment. |
| `add_entity(entity)` | `TeamsActivityBuilder` | Append entity. |
| `add_attachment(attachment)` | `TeamsActivityBuilder` | Append attachment. |
| `add_mention(account, mention_text?)` | `TeamsActivityBuilder` | Add @mention entity. |
| `add_adaptive_card_attachment(card)` | `TeamsActivityBuilder` | Append Adaptive Card (JSON string or dict). |
| `with_adaptive_card_attachment(card)` | `TeamsActivityBuilder` | Replace attachments with Adaptive Card. |
| `build()` | `TeamsActivity` | Build the activity. |

---

## TeamsChannelData

Teams-specific channel data.

```python
class TeamsChannelData(BaseModel)
```

| Field | Type | Description |
|-------|------|-------------|
| `tenant` | `TenantInfo \| None` | Microsoft 365 tenant info. |
| `channel` | `ChannelInfo \| None` | Teams channel info. |
| `team` | `TeamInfo \| None` | Teams team info. |
| `meeting` | `MeetingInfo \| None` | Meeting info. |
| `notification` | `NotificationInfo \| None` | Notification settings. |

---

## TeamsConversation

Teams-specific conversation metadata.

```python
class TeamsConversation(Conversation)
```

| Field | Type | JSON Alias | Description |
|-------|------|-----------|-------------|
| `conversation_type` | `str \| None` | `conversationType` | Type (personal, groupChat, channel). |
| `tenant_id` | `str \| None` | `tenantId` | Tenant ID. |
| `is_group` | `bool \| None` | `isGroup` | Group conversation flag. |
| `name` | `str \| None` | `name` | Display name. |

---

## Middleware

### TurnMiddleware

```python
class TurnMiddleware(Protocol):
    async def on_turn(self, context: TurnContext, next: NextTurn) -> None: ...
```

Protocol for turn middleware. Call `await next()` to continue the pipeline, or skip it to short-circuit.

**Type alias:** `ITurnMiddleware = TurnMiddleware`

### RemoveMentionMiddleware

```python
class RemoveMentionMiddleware
```

Middleware that strips the bot's own `@mention` text from incoming messages.

| Method | Signature | Description |
|--------|-----------|-------------|
| `on_turn` | `async on_turn(context: TurnContext, next: NextTurn) -> None` | Remove self-mentions, then call next. |

---

## Authentication

### validate_bot_token

```python
async def validate_bot_token(auth_header: str | None, app_id: str | None = None) -> None
```

Validates the inbound JWT bearer token against Bot Framework issuers and JWKS endpoints. Raises `BotAuthError` on failure.

### BotAuthError

```python
class BotAuthError(Exception)
```

Raised on inbound JWT validation failure. HTTP layer should return 401.

---

## TokenManager

Acquires and caches OAuth2 client-credentials tokens for outbound Bot Framework API calls.

```python
class TokenManager
```

### Constructor

```python
TokenManager(options: BotApplicationOptions = BotApplicationOptions())
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `client_id` | `str \| None` | Configured client ID. |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `get_bot_token` | `async get_bot_token() -> str \| None` | Get cached/fresh bot token. Returns `None` when auth not configured. |
| `aclose` | `async aclose() -> None` | Clean up token cache resources. |

---

## Error Types

### BotHandlerException

```python
class BotHandlerException(Exception)
```

Wraps exceptions thrown inside activity handlers.

| Attribute | Type | Description |
|-----------|------|-------------|
| `cause` | `BaseException` | Original exception. |
| `activity` | `CoreActivity` | Activity being processed. |

### InvokeResponse

```python
@dataclass
class InvokeResponse:
    status: int
    body: Any = None
```

Response returned by invoke handlers.

---

## Utility Types

### ResourceResponse

```python
class ResourceResponse(BaseModel):
    id: str
```

### ConversationResourceResponse

```python
class ConversationResourceResponse(ResourceResponse):
    service_url: str
    activity_id: str
```

### PagedMembersResult

```python
class PagedMembersResult(BaseModel):
    members: list[ChannelAccount] = []
    continuation_token: str | None = None
```

### ConversationParameters

```python
class ConversationParameters(BaseModel):
    is_group: bool | None = None
    bot: ChannelAccount | None = None
    members: list[ChannelAccount] | None = None
    topic_name: str | None = None
    tenant_id: str | None = None
    activity: dict[str, Any] | None = None
    channel_data: Any = None
```

### Support Types

| Type | Fields |
|------|--------|
| `TenantInfo` | `id: str \| None` |
| `ChannelInfo` | `id: str \| None`, `name: str \| None` |
| `TeamInfo` | `id: str \| None`, `name: str \| None`, `aad_group_id: str \| None` |
| `MeetingInfo` | `id: str \| None` |
| `NotificationInfo` | `alert: bool \| None` |

---

See also: [Python Language Guide](/languages/python) · [Getting Started](/getting-started) · [Source on GitHub](https://github.com/rido-min/botas/tree/main/python/packages/botas/src/botas)

---

## botas-fastapi

Zero-boilerplate FastAPI integration for bot hosting. Re-exports all `botas` core types for single-import convenience.

**Package:** `botas-fastapi` (PyPI)  
**Import:** `from botas_fastapi import BotApp, ...`  
**Source:** [`python/packages/botas-fastapi/src/botas_fastapi/`](https://github.com/rido-min/botas/tree/main/python/packages/botas-fastapi/src/botas_fastapi)

---

### BotApp

Composes a [`BotApplication`](#botapplication) with a FastAPI server and Uvicorn.

```python
class BotApp
```

#### Constructor

```python
BotApp(
    options: BotApplicationOptions = BotApplicationOptions(),
    *,
    port: int | None = None,
    path: str = "/api/messages",
    auth: bool | None = None,
)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `options` | `BotApplicationOptions` | `BotApplicationOptions()` | Core bot options (auth, tokens). |
| `port` | `int \| None` | `PORT` env or `3978` | Port to listen on. |
| `path` | `str` | `"/api/messages"` | Path for the messages endpoint. |
| `auth` | `bool \| None` | `True` when `client_id` set | Whether to enable inbound JWT auth. |

#### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `bot` | `BotApplication` | The underlying `BotApplication` instance. |

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `on` | `on(type: str, handler=None) -> Any` | Register an activity handler. Works as a decorator. Delegates to `BotApplication.on`. |
| `on_invoke` | `on_invoke(name: str, handler=None) -> Any` | Register a named invoke handler. Works as a decorator. Delegates to `BotApplication.on_invoke`. |
| `use` | `use(middleware: TurnMiddleware) -> BotApp` | Add middleware to the turn pipeline. |
| `send_activity_async` | `async send_activity_async(service_url, conversation_id, activity) -> ResourceResponse \| None` | Proactively send an activity. |
| `start` | `start() -> None` | Build the FastAPI app and start Uvicorn. Blocks until shutdown. |

#### Example

```python
from botas_fastapi import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```

---

### bot_auth_dependency

FastAPI dependency that validates the Bot Framework JWT token.

```python
def bot_auth_dependency(app_id: str | None = None) -> Callable
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `app_id` | `str \| None` | Bot's client ID. Falls back to `CLIENT_ID` env var. |

Returns a FastAPI dependency. Raises `HTTPException(401)` on token validation failure.

#### Example

```python
from fastapi import Depends, FastAPI
from botas_fastapi import bot_auth_dependency

app = FastAPI()

@app.post("/api/messages", dependencies=[Depends(bot_auth_dependency())])
async def messages(request: Request):
    ...
```

---

### Re-exported Types

`botas-fastapi` re-exports all public types from `botas` core for single-import convenience:

`BotApplication`, `BotApplicationOptions`, `BotAuthError`, `BotHandlerException`, `ChannelAccount`, `Conversation`, `ConversationClient`, `CoreActivity`, `CoreActivityBuilder`, `ITurnMiddleware`, `TurnMiddleware`, `ResourceResponse`, `TeamsChannelAccount`, `TokenManager`, `TurnContext`, `validate_bot_token`

---

See also: [botas-fastapi Source](https://github.com/rido-min/botas/tree/main/python/packages/botas-fastapi/src/botas_fastapi)
