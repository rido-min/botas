# Bot Spec

**Purpose**: Enable LLM-driven implementation in different programming languages
**Status**: Draft


## Overview

`botas` is a lightweight library for building Microsoft Bot Framework bots with minimal overhead. This specification documents the library's design, APIs, and behaviors to enable accurate implementation to other programming languages like Python, Go, Java, or Rust.

---

## Core Concepts

### 1. Bot Framework Protocol

The library implements the Microsoft Bot Framework REST API protocol:

- **Activities**: Messages and events exchanged between bot and Bot Framework Service
- **Conversations**: Container for message exchanges between users and bots
- **Channels**: Communication platforms (Teams, Web Chat, Slack, etc.)
- **Service URL**: Per-conversation endpoint for sending activities back to the channel

### 2. Activity Types

| Type | Description |
|------|-------------|
| `message` | Text message from user or bot |
| `messageReaction` | Emoji reaction added/removed from a message |
| `conversationUpdate` | Members added/removed from conversation |
| `installationUpdate` | Bot installed/uninstalled |
| `invoke` | Special request requiring synchronous response |

---

## Package Structure

### dotnet

```text
dotnet/src/Botas/
├── BotApplication.cs           # Main bot class + BotHanlderException + ITurnMiddleWare
├── ConversationClient.cs       # HTTP client for sending activities
├── UserTokenClient.cs          # OAuth token operations
├── Schema/
│   ├── Activity.cs             # CoreActivity model + CreateReplyActivity helper
│   ├── ConversationAccount.cs  # ConversationAccount model (for from/recipient fields)
│   └── Conversation.cs         # Conversation model
└── Hosting/                    # ASP.NET Core integration
    ├── AppBuilderExtensions.cs
    ├── BotApplicationConfigurationExtensions.cs
    ├── BotAuthenticationHandler.cs
    └── JwtExtensions.cs
```

### node

```text
node/packages/botas/src/
├── app/
│   ├── bot-application.ts          # BotApplication class + BotHandlerException
│   └── bot-application-options.ts  # Options type
├── auth/
│   ├── bot-auth-middleware.ts       # botAuthExpress(), botAuthHono(), validateBotToken()
│   └── token-manager.ts            # TokenManager (client creds, managed identity, federated)
├── clients/
│   ├── bot-http-client.ts          # Low-level authenticated HTTP client
│   ├── conversation-client.ts      # ConversationClient
│   └── user-token-client.ts        # UserTokenClient
├── logging/
│   └── logger.ts                   # debug-based logger
├── middleware/
│   └── i-turn-middleware.ts        # ITurnMiddleware interface
└── schema/
    └── core-activity.ts            # CoreActivity, ChannelAccount, Conversation, createReplyActivity()
```

---

## User Scenarios & Testing

### User Story 1 - Echo Bot (Priority: P1) 🎯 MVP

A developer creates a simple echo bot that responds to user messages.

**Why this priority**: This is the most basic bot functionality and validates the core library works.

**Independent Test**: Bot receives "hello" message and responds "you said hello"

**Acceptance Scenarios**:

1. **Given** a running bot application, **When** a user sends "hello", **Then** the bot responds with "you said hello"
2. **Given** a running bot application, **When** a user sends an empty message, **Then** the bot handles it gracefully (no crash)
3. **Given** a running bot application, **When** Bot Framework sends an activity, **Then** JWT authentication validates the token

---

### User Story 2 - Proactive Messaging (Priority: P2)

A developer sends a proactive message to a user outside of a direct conversation turn.

**Why this priority**: Proactive messaging is essential for notifications and bot-initiated conversations.

**Independent Test**: Bot can send a message using stored conversation reference

**Acceptance Scenarios**:

1. **Given** a stored conversation reference, **When** the bot sends a proactive message, **Then** the user receives the message
2. **Given** an invalid conversation reference, **When** the bot sends a message, **Then** an error is returned

---

### User Story 3 - Handle Message Reactions (Priority: P3)

The bot responds when a user adds or removes a reaction to a message.

**Acceptance Scenarios**:

1. **Given** a message in conversation, **When** user adds a thumbs-up reaction, **Then** the registered handler for `messageReaction` is invoked
2. **Given** a message in conversation, **When** user removes a reaction, **Then** handler receives the activity

---

### User Story 4 - Conversation Updates (Priority: P3)

The bot is notified when members join or leave a conversation.

**Acceptance Scenarios**:

1. **Given** a group conversation, **When** a new member joins, **Then** the `conversationUpdate` handler receives the activity
2. **Given** a group conversation, **When** a member leaves, **Then** handler receives the activity

---

### User Story 5 - Installation Events (Priority: P4)

The bot handles installation/uninstallation events.

**Acceptance Scenarios**:

1. **Given** bot is installed, **When** installation completes, **Then** `installationUpdate` handler is invoked
2. **Given** bot is uninstalled, **When** uninstallation completes, **Then** handler receives the activity

---

### User Story 6 - Middleware Pipeline (Priority: P2)

A developer adds custom middleware to process activities before/after handlers.

**Acceptance Scenarios**:

1. **Given** middleware is registered, **When** activity is received, **Then** middleware executes before handler
2. **Given** multiple middleware, **When** activity is received, **Then** middleware executes in registration order
3. **Given** middleware calls `next()`, **When** processing continues, **Then** subsequent middleware and handler execute

---

## Functional Requirements

### FR-001: Activity Serialization

System MUST serialize/deserialize activities using JSON with:

- Property naming: camelCase
- Null handling: Ignore null values when writing
- Extension data: Preserve unknown properties in a dictionary

### FR-002: HTTP Endpoint

System MUST expose a POST endpoint (default: `/api/messages`) that:

- Accepts Activity JSON in request body
- Returns `{}` on success
- Requires JWT authentication

### FR-003: JWT Authentication

System MUST validate incoming requests using:

- Issuer: `api.botframework.com` or `https://sts.windows.net/{tenantId}/`
- Audience: Bot's Client ID (App ID)
- OpenID configuration from: `https://login.botframework.com/v1/.well-known/openid-configuration`

### FR-004: Outbound Authentication

System MUST authenticate outbound requests using:

- OAuth 2.0 client credentials flow
- Scope: `https://api.botframework.com/.default`
- Token endpoint: Microsoft identity platform

### FR-005: Activity Reply

System MUST provide a method to create reply activities that:

- Copies `conversation`, `serviceUrl` from original
- Swaps `from` and `recipient`
- Sets `type` to `"message"`

### FR-006: Send Activity

System MUST send activities via HTTP POST to:

- URL: `{serviceUrl}v3/conversations/{conversationId}/activities`
- Content-Type: `application/json`
- Authorization: Bearer token

Dotnet signature:
```csharp
Task<string> SendActivityAsync(CoreActivity activity, CancellationToken cancellationToken = default)
```

Node signature:
```typescript
sendActivityAsync(serviceUrl: string, conversationId: string, activity: Partial<CoreActivity>): Promise<ResourceResponse | undefined>
```

> Note: dotnet takes a fully-populated `Activity` (serviceUrl/conversationId embedded). Node takes them as explicit parameters for proactive messaging ergonomics.

### FR-007: Handler Dispatch

System MUST dispatch incoming activities to registered handlers by type string:

- `"message"` → message handler
- `"conversationUpdate"` → conversationUpdate handler
- `"messageReaction"` → messageReaction handler
- `"installationUpdate"` → installationUpdate handler
- Any type string → its registered handler (generic dispatch)

If no handler is registered for an activity type, the activity MUST be silently ignored.

### FR-008: Middleware Pipeline

System MUST support middleware that:

- Executes in registration order
- Receives `BotApplication`, `Activity`, and `NextDelegate`
- Can short-circuit by not calling `next()`
- Can modify activity before/after handler

### FR-009: Error Handling

System MUST wrap handler exceptions in `BotHandlerException` with:

- Original exception as inner exception / cause
- Reference to the activity that caused the error

---

## Key Entities

### CoreActivity

The core message/event model exchanged with Bot Framework. Only the fields listed below are explicitly typed — everything else is preserved in the extension dictionary.

```text
CoreActivity
├── type: string              # "message", "conversationUpdate", etc.
├── serviceUrl: string        # Callback URL for this conversation
├── text: string?             # Message text content
├── from: ChannelAccount      # Sender information
├── recipient: ChannelAccount # Recipient information
├── conversation: { id: string }  # Conversation context (id only)
├── entities: unknown[]?      # Mentions, card actions, etc.
├── attachments: unknown[]?   # File or card attachments
└── [extensionData]: Dictionary  # All other properties preserved
```

### ChannelAccount

Represents a user or bot account.

```text
ChannelAccount
├── id: string                # Unique identifier
├── name: string?             # Display name
├── aadObjectId: string?      # Azure AD object ID
├── role: string?             # "user" or "bot"
└── [extensionData]: Dictionary
```

### Conversation

Minimal conversation reference — only the ID is typed.

```text
Conversation
├── id: string                # Conversation identifier
└── [extensionData]: Dictionary
```

---

## API Surface

### BotApplication (dotnet)

```csharp
public class BotApplication
{
    // Single callback; set by application logic
    public Func<CoreActivity, CancellationToken, Task>? OnActivity { get; set; }

    public UserTokenClient UserTokenClient { get; }

    // ASP.NET Core integration — reads body, runs pipeline, writes response
    public Task<CoreActivity> ProcessAsync(HttpContext httpContext, CancellationToken cancellationToken = default)

    public Task<string> SendActivityAsync(CoreActivity activity, CancellationToken cancellationToken = default)

    public ITurnMiddleWare Use(ITurnMiddleWare middleware)
}
```

### BotApplication (node)

```typescript
class BotApplication {
    readonly conversationClient: ConversationClient
    readonly userTokenClient: UserTokenClient

    // Register handler for an activity type (replaces previous for same type)
    on(type: string, handler: ActivityHandler): this

    // Register middleware
    use(middleware: ITurnMiddleware): this

    // For Express / Node.js http.Server
    processAsync(req: IncomingMessage, res: ServerResponse): Promise<void>

    // For Hono and other response-owning frameworks
    processBody(body: string): Promise<void>

    // Proactive send
    sendActivityAsync(serviceUrl: string, conversationId: string, activity: Partial<CoreActivity>): Promise<ResourceResponse | undefined>
}
```

### ITurnMiddleware

```text
interface ITurnMiddleware:
    onTurnAsync(botApplication, activity, next) -> Task/Promise<void>
```

### createReplyActivity (node) / CoreActivity.CreateReplyActivity (dotnet)

Standalone helper that constructs a reply activity:

```typescript
// node
function createReplyActivity(activity: CoreActivity, text?: string): Partial<CoreActivity>
```

```csharp
// dotnet — instance method on CoreActivity
public CoreActivity CreateReplyActivity(string text)
```

### BotHandlerException

Wraps an exception thrown inside a handler:

```typescript
// node
class BotHandlerException extends Error {
    cause: unknown
    activity: CoreActivity
}
```

```csharp
// dotnet (note: typo in source — "Hanlde" not "Handle")
class BotHanlderException : Exception {
    CoreActivity Activity { get; }
}
```

---

## Language-Specific Intentional Differences

| Concern | dotnet | node |
|---------|--------|------|
| Web framework | Always ASP.NET Core; DI-wired | Framework-agnostic; adapter per framework |
| Handler registration | Single `OnActivity` callback | Per-type `on(type, handler)` Map |
| HTTP integration | `ProcessAsync(HttpContext)` | `processAsync(req, res)` or `processBody(body)` |
| Auth middleware | ASP.NET authentication scheme | `botAuthExpress()` / `botAuthHono()` factory |
| SendActivityAsync args | Single `Activity` object | `(serviceUrl, conversationId, activity)` |
| Exception class name | `BotHanlderException` (typo kept) | `BotHandlerException` (correct spelling) |

These differences are intentional and should be preserved per language when porting.

---

## Application Setup

### Required Components

```text
Bot Application Setup:
    1. Create BotApplication instance
    2. Configure authentication (client credentials for outbound, JWT validation for inbound)
    3. Set up HTTP endpoint for receiving activities
    4. Register activity handlers
```

### Configuration

Credentials are read from environment variables:

```text
CLIENT_ID      — Azure AD application (bot) ID
CLIENT_SECRET  — Azure AD client secret
TENANT_ID      — Azure AD tenant ID (or "common")
```

---

## Success Criteria

### SC-001: Functional Parity

Translated implementation MUST pass all acceptance scenarios defined in user stories.

### SC-002: Protocol Compliance

Translated implementation MUST correctly serialize/deserialize all activity types per Bot Framework protocol.

### SC-003: Authentication

Translated implementation MUST validate incoming JWT tokens and authenticate outbound requests.

### SC-004: Idiomatic Code

Translated implementation SHOULD follow target language idioms and conventions.

### SC-005: Minimal Dependencies

Translated implementation SHOULD minimize external dependencies while maintaining functionality.

### SC-006: Example Compatibility

A translated echo bot example MUST produce identical behavior to the reference samples when deployed.

---

## Sample: Echo Bot

### C# with ASP.NET Core

```csharp
using Botas;
using Botas.Hosting;

var builder = WebApplication.CreateSlimBuilder(args);
builder.Services.AddBotApplication();
var app = builder.Build();

var bot = app.UseBotApplication();

bot.OnActivity = async (activity, cancellationToken) =>
{
    if (activity.Type == "message")
    {
        await bot.SendActivityAsync(activity.CreateReplyActivity($"You said: {activity.Text}"), cancellationToken);
    }
};

app.Run();
```

### TypeScript with Express

```typescript
import express from 'express'
import { BotApplication, botAuthExpress, createReplyActivity } from 'botas'

const bot = new BotApplication()

bot.on('message', async (activity) => {
  await bot.sendActivityAsync(
    activity.serviceUrl,
    activity.conversation.id,
    createReplyActivity(activity, `You said: ${activity.text}`)
  )
})

const server = express()
server.post('/api/messages', botAuthExpress(), (req, res) => { bot.processAsync(req, res) })
server.listen(Number(process.env['PORT'] ?? 3978))
```

### TypeScript with Hono

```typescript
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { BotApplication, botAuthHono, createReplyActivity } from 'botas'

const bot = new BotApplication()

bot.on('message', async (activity) => {
  await bot.sendActivityAsync(
    activity.serviceUrl,
    activity.conversation.id,
    createReplyActivity(activity, `You said: ${activity.text}`)
  )
})

const app = new Hono()
app.post('/api/messages', botAuthHono(), async (c) => {
  await bot.processBody(await c.req.text())
  return c.json({})
})
serve({ fetch: app.fetch, port: Number(process.env['PORT'] ?? 3978) })
```

---

## Appendix: Bot Framework REST API Reference

### Receive Activity

```http
POST /api/messages
Authorization: Bearer {jwt-token}
Content-Type: application/json

{
  "type": "message",
  "id": "activity-id",
  "serviceUrl": "https://smba.trafficmanager.net/...",
  "channelId": "msteams",
  "from": { "id": "user-id", "name": "User Name" },
  "recipient": { "id": "bot-id", "name": "Bot Name" },
  "conversation": { "id": "conversation-id" },
  "text": "Hello bot!"
}
```

### Send Activity

```http
POST {serviceUrl}v3/conversations/{conversationId}/activities
Authorization: Bearer {oauth-token}
Content-Type: application/json

{
  "type": "message",
  "text": "Hello user!",
  "from": { "id": "bot-id", "name": "Bot Name" },
  "recipient": { "id": "user-id", "name": "User Name" },
  "conversation": { "id": "conversation-id" }
}
```

### Response

```json
{ "id": "new-activity-id" }
```

---

## Appendix: Authentication Endpoints

### OpenID Configuration

```
https://login.botframework.com/v1/.well-known/openid-configuration
```

### Token Endpoint (for outbound)

```
POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
  grant_type=client_credentials
  client_id={botAppId}
  client_secret={botAppSecret}
  scope=https://api.botframework.com/.default
```
