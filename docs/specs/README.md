# Bot Spec

**Purpose**: Enable LLM-driven implementation in different programming languages
**Status**: Draft


## Overview

`botas` is a lightweight library for building Microsoft Bot Framework bots with minimal overhead. This specification documents the library's design, APIs, and behaviors to enable accurate implementation to other programming languages like Python, Go, Java, or Rust.

## Detailed Specs

The language-agnostic protocol and payload specifications live in `docs/specs/`:

| Spec | Description |
|------|-------------|
| [Protocol](./protocol.md) | HTTP contract: inbound `POST /api/messages`, outbound `POST …/v3/conversations/…/activities`, middleware pipeline, handler dispatch, error wrapping |
| [Inbound Auth](./inbound-auth.md) | JWT validation for incoming Bot Framework requests (audience, issuers, JWKS discovery) |
| [Outbound Auth](./outbound-auth.md) | OAuth 2.0 client credentials flow for outbound requests |
| [Activity Schema](./activity-schema.md) | JSON payload structure: Activity, ChannelAccount, Conversation, serialization rules |
| [Turn Context](./turn-context.md) | `TurnContext` abstraction: scoped `send()`, simplified handler/middleware signatures |
| [botas-express](./botas-express.md) | `botas-express` package: zero-boilerplate Express server setup (depends on Turn Context) |

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

### User Story 3 - Middleware Pipeline (Priority: P2)

A developer adds custom middleware to process activities before/after handlers.

**Acceptance Scenarios**:

1. **Given** middleware is registered, **When** activity is received, **Then** middleware executes before handler
2. **Given** multiple middleware, **When** activity is received, **Then** middleware executes in registration order
3. **Given** middleware calls `next()`, **When** processing continues, **Then** subsequent middleware and handler execute

---

## API Surface

### BotApplication (dotnet)

```csharp
public class BotApplication
{
    // Single callback; set by application logic
    public Func<CoreActivity, CancellationToken, Task>? OnActivity { get; set; }

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

### CoreActivityBuilder

Fluent builder for constructing outbound activities. `withConversationReference` copies routing fields (`serviceUrl`, `conversation`) from an incoming activity and swaps `from`/`recipient`.

```typescript
// node
const reply = new CoreActivityBuilder()
  .withConversationReference(activity)
  .withText(`You said: ${activity.text}`)
  .build()
```

```csharp
// dotnet
var reply = new CoreActivityBuilder()
    .WithConversationReference(activity)
    .WithText($"You said: {activity.Text}")
    .Build();
```

```python
# python
reply = (
    CoreActivityBuilder()
    .with_conversation_reference(activity)
    .with_text(f"You said: {activity.text}")
    .build()
)
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
| Handler registration | Single `OnActivity` callback (receives `TurnContext`) | Per-type `on(type, handler)` Map (receives `TurnContext`) |
| HTTP integration | `ProcessAsync(HttpContext)` | `processAsync(req, res)` or `processBody(body)` |
| Auth middleware | ASP.NET authentication scheme | `botAuthExpress()` / `botAuthHono()` factory |
| SendActivityAsync args | Single `CoreActivity` (carries serviceUrl/conversationId) | `(serviceUrl, conversationId, activity)` |
| TurnContext.send | `SendAsync(string)` / `SendAsync(CoreActivity)` | `send(string \| Partial<CoreActivity>)` |
| Exception class name | `BotHanlderException` (typo kept) | `BotHandlerException` (correct spelling) |

| DI registration | `AddBotApplication<TApp>()` — generic; TApp must extend `BotApplication` | Not applicable |
| App builder | `UseBotApplication<TApp>()` — returns typed `TApp` instance | Not applicable |

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

var app = BotApp.Create(args);

app.On("message", async (ctx, ct) =>
    await ctx.SendAsync($"You said: {ctx.Activity.Text}", ct));

app.Run();
```

### TypeScript with Express

```typescript
import express from 'express'
import { BotApplication, botAuthExpress } from 'botas'

const bot = new BotApplication()

bot.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

const server = express()
server.post('/api/messages', botAuthExpress(), (req, res) => { bot.processAsync(req, res) })
server.listen(Number(process.env['PORT'] ?? 3978))
```

### TypeScript with Hono

```typescript
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { BotApplication, botAuthHono } from 'botas'

const bot = new BotApplication()

bot.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

const app = new Hono()
app.post('/api/messages', botAuthHono(), async (c) => {
  await bot.processBody(await c.req.text())
  return c.json({})
})
serve({ fetch: app.fetch, port: Number(process.env['PORT'] ?? 3978) })
```

---
