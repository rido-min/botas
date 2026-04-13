# Bot Spec

**Purpose**: Enable LLM-driven implementation in different programming languages
**Status**: Draft


## Overview

`botas` is a lightweight library for building Microsoft Bot Framework bots with minimal overhead. This specification documents the library's design, APIs, and behaviors to enable accurate implementation to other programming languages like Python, Go, Java, or Rust.

## Detailed Specs

The language-agnostic protocol and payload specifications live in `specs/`:

| Spec | Description |
|------|-------------|
| [Protocol](./protocol.md) | HTTP contract: inbound `POST /api/messages`, outbound `POST …/v3/conversations/…/activities`, middleware pipeline, handler dispatch, error wrapping |
| [Inbound Auth](./inbound-auth.md) | JWT validation for incoming Bot Framework requests (audience, issuers, JWKS discovery) |
| [Outbound Auth](./outbound-auth.md) | OAuth 2.0 client credentials flow for outbound requests |
| [Activity Schema](./activity-schema.md) | JSON payload structure: Activity, ChannelAccount, Conversation, serialization rules |
| [Activity Payloads](./ActivityPayloads.md) | Annotated JSON examples for each activity type (message, conversationUpdate, messageReaction, invoke, installationUpdate, typing) |
| [Teams Activity](./teams-activity.md) | TeamsActivity, TeamsActivityBuilder, and Teams-specific types (channel data, mentions, adaptive cards) |
| [Turn Context](./turn-context.md) | `TurnContext` abstraction: scoped `send()`, simplified handler/middleware signatures |
| [Middleware](./Middleware.md) | How to write and register middleware, execution order, short-circuiting, example patterns |
| [Configuration](./Configuration.md) | Per-language configuration reference: env vars, DI wiring, options objects, managed identity |
| [Proactive Messaging](./ProactiveMessaging.md) | Sending messages outside a turn using `ConversationClient` |
| [Samples](./Samples.md) | Walkthrough of each sample with annotated code and expected behavior |
| [Contributing](./Contributing.md) | Behavioral invariants, CI setup, how to add a new language port |
| [botas-express](./botas-express.md) | `botas-express` package: zero-boilerplate Express server setup (depends on Turn Context) |

For **developer guides** on middleware patterns, use cases, and samples, see the [Middleware Guide](../docs-site/middleware.md) and [Developer Docs](../docs-site/).

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

### User Story 4 - Teams Activity Features (Priority: P2)

A developer uses `TeamsActivityBuilder` to send mentions, suggested actions, and adaptive cards.

**Why this priority**: Rich Teams interactions (mentions, cards, quick replies) are the most common bot scenarios after echo.

**Independent Test**: Bot receives a message, replies with a mention of the sender, an adaptive card, and suggested action buttons.

**Acceptance Scenarios**:

1. **Given** a running bot, **When** user sends "cards", **Then** the bot replies with an Adaptive Card
2. **Given** a running bot, **When** user sends "actions", **Then** the bot replies with suggested action buttons
3. **Given** a running bot, **When** user sends any other text, **Then** the bot echoes back with an @mention of the sender

---

## API Surface

### BotApp (simplified API — .NET, Node.js, Python)

**Purpose:** Zero-boilerplate bot setup for simple bots. Automatically configures web server, JWT auth, and `/api/messages` endpoint.

**.NET:**

```csharp
var app = BotApp.Create(args);

app.On("message", async (ctx, ct) =>
{
    await ctx.SendAsync($"You said: {ctx.Activity.Text}", ct);
});

app.Run();
```

**Node.js (botas-express package):**

```typescript
import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.start()
```

**Python:**

```python
from botas import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```

### BotApplication (manual API — advanced scenarios)

**Purpose:** Framework-agnostic bot class for manual HTTP integration (Express, Hono, FastAPI, aiohttp, or custom ASP.NET Core setup).

**.NET:**

```csharp
public class BotApplication
{
    // Per-type handlers
    public BotApplication On(string activityType, Func<TurnContext, CancellationToken, Task> handler)

    // CatchAll handler — replaces per-type dispatch when set
    public Func<TurnContext, CancellationToken, Task>? OnActivity { get; set; }

    // ASP.NET Core integration — reads body, runs pipeline, writes response
    public Task<CoreActivity> ProcessAsync(HttpContext httpContext, CancellationToken cancellationToken = default)

    // Send outbound activity
    public Task<string> SendActivityAsync(CoreActivity activity, CancellationToken cancellationToken = default)

    // Register middleware
    public ITurnMiddleWare Use(ITurnMiddleWare middleware)
}
```

**Node.js:**

```typescript
class BotApplication {
    readonly conversationClient: ConversationClient

    // Register handler for an activity type (replaces previous for same type)
    on(type: string, handler: (ctx: TurnContext) => Promise<void>): this

    // CatchAll handler — replaces per-type dispatch when set
    onActivity?: (ctx: TurnContext) => Promise<void>

    // Register middleware
    use(middleware: TurnMiddleware): this

    // For Express / Node.js http.Server
    processAsync(req: IncomingMessage, res: ServerResponse): Promise<void>

    // For Hono and other response-owning frameworks
    processBody(body: string): Promise<void>

    // Proactive send
    sendActivityAsync(serviceUrl: string, conversationId: string, activity: Partial<CoreActivity>): Promise<ResourceResponse | undefined>
}
```

**Python:**

```python
class BotApplication:
    # Register handler by type
    def on(self, activity_type: str, handler: Callable[[TurnContext], Awaitable[None]]) -> "BotApplication"

    # CatchAll handler — replaces per-type dispatch when set
    on_activity: Optional[Callable[[TurnContext], Awaitable[None]]] = None

    # Process incoming activity
    async def process_body(self, body: str) -> None

    # Send outbound activity
    async def send_activity_async(
        self, service_url: str, conversation_id: str, activity: dict
    ) -> ResourceResponse

    # Register middleware
    def use(self, middleware: TurnMiddleware) -> "BotApplication"
```

### TurnContext

**Purpose:** Scoped context for the current turn. Simplifies handler signatures and reply sending.

```csharp
// .NET
public class TurnContext
{
    public CoreActivity Activity { get; }
    public BotApplication App { get; }
    public Task SendAsync(string text, CancellationToken ct)
    public Task SendAsync(CoreActivity activity, CancellationToken ct)
}
```

```typescript
// Node.js
interface TurnContext {
    activity: CoreActivity
    app: BotApplication
    send(text: string): Promise<void>
    send(activity: Partial<CoreActivity>): Promise<void>
}
```

```python
# Python
class TurnContext:
    activity: CoreActivity
    app: BotApplication
    async def send(self, text_or_activity: str | dict) -> None
```

### ITurnMiddleware (Deprecated Names)

```text
# Node.js — TurnMiddleware is a function type:
type TurnMiddleware = (context: TurnContext, next: NextTurn) => Promise<void>

# Python — TurnMiddleware is a Protocol with on_turn():
class TurnMiddleware(Protocol):
    async def on_turn(self, context: TurnContext, next: NextTurn) -> None: ...

# .NET — unchanged:
interface ITurnMiddleWare:
    OnTurnAsync(context, next, cancellationToken) -> Task
```

> Legacy names `ITurnMiddleware` (Node/Python) are kept as deprecated aliases.

### TeamsActivityBuilder

**Purpose:** Fluent builder for constructing Teams-specific activities with mentions, adaptive cards, and suggested actions. Full spec: [teams-activity.md](./teams-activity.md).

**.NET:**
```csharp
var reply = new TeamsActivityBuilder()
    .WithConversationReference(activity)
    .WithText("<at>User</at> hello")
    .AddMention(account)
    .WithChannelData(new TeamsChannelData { ... })
    .WithSuggestedActions(new SuggestedActions { ... })
    .AddAdaptiveCardAttachment(cardJson)
    .Build();  // returns TeamsActivity
```

**Node.js:**
```typescript
const reply = new TeamsActivityBuilder()
    .withConversationReference(activity)
    .withText('<at>User</at> hello')
    .addMention(account)
    .withChannelData({ ... })
    .withSuggestedActions({ actions: [...] })
    .addAdaptiveCardAttachment(cardJson)
    .build()  // returns Partial<TeamsActivity>
```

**Python:**
```python
reply = TeamsActivityBuilder() \
    .with_conversation_reference(activity) \
    .with_text("<at>User</at> hello") \
    .add_mention(account) \
    .with_channel_data(TeamsChannelData(...)) \
    .with_suggested_actions(SuggestedActions(...)) \
    .add_adaptive_card_attachment(card_json) \
    .build()  # returns TeamsActivity
```

---

Wraps an exception thrown inside a handler:

```typescript
// node
class BotHandlerException extends Error {
    cause: unknown
    activity: CoreActivity
}
```

```csharp
// dotnet
class BotHandlerException : Exception {
    CoreActivity Activity { get; }
}
```

---

## Language-Specific Intentional Differences

| Concern | dotnet | node | python |
|---------|--------|------|--------|
| Simple bot API | `BotApp.Create()` + `app.On()` | `BotApp` (botas-express) | `BotApp()` |
| Web framework | ASP.NET Core (built-in) | Express (via botas-express) or manual | aiohttp (built-in) or manual FastAPI |
| Handler registration | `app.On(type, handler)` receiving `TurnContext` | `app.on(type, handler)` receiving `TurnContext` | `@app.on(type)` receiving `TurnContext` |
| CatchAll handler | `OnActivity` property | `onActivity` property | `on_activity` property |
| HTTP integration | `ProcessAsync(HttpContext)` | `processAsync(req, res)` or `processBody(body)` | `process_body(body)` |
| Auth middleware | ASP.NET authentication scheme | `botAuthExpress()` / `botAuthHono()` factory | `bot_auth_dependency()` / `validate_bot_token()` |
| SendActivityAsync args | Single `CoreActivity` (carries serviceUrl/conversationId) | `(serviceUrl, conversationId, activity)` | `(service_url, conversation_id, activity)` |
| TurnContext.send | `SendAsync(string)` / `SendAsync(CoreActivity)` | `send(string \| Partial<CoreActivity>)` | `send(str \| dict)` |
| TurnContext.sendTyping | `SendTypingAsync()` returns `Task<string>` | `sendTyping()` returns `Promise<void>` | `send_typing()` returns `None` |
| Exception class name | `BotHandlerException` | `BotHandlerException` (correct spelling) | `BotHandlerException` |
| DI registration | `AddBotApplication<TApp>()` — generic; TApp must extend `BotApplication` | Not applicable | Not applicable |
| App builder | `UseBotApplication<TApp>()` — returns typed `TApp` instance | Not applicable | Not applicable |

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

## Sample: Teams Bot (Mentions, Cards, Suggested Actions)

Full sample source in `dotnet/samples/TeamsSample`, `node/samples/teams-sample`, `python/samples/teams-sample`.

### C#

```csharp
using Botas;

var app = BotApp.Create(args);
app.Use(new RemoveMentionMiddleware());

app.On("message", async (ctx, ct) =>
{
    var text = ctx.Activity.Text?.Trim() ?? "";

    if (text.Equals("cards", StringComparison.OrdinalIgnoreCase))
    {
        var reply = new TeamsActivityBuilder()
            .WithConversationReference(ctx.Activity)
            .WithAdaptiveCardAttachment(cardJson)
            .Build();
        await ctx.SendAsync(reply, ct);
    }
    else
    {
        var sender = ctx.Activity.From!;
        var reply = new TeamsActivityBuilder()
            .WithConversationReference(ctx.Activity)
            .WithText($"<at>{sender.Name}</at> said: {text}")
            .AddMention(sender)
            .Build();
        await ctx.SendAsync(reply, ct);
    }
});

app.Run();
```

### TypeScript (botas-express)

```typescript
import { BotApp } from 'botas-express'
import { TeamsActivityBuilder } from 'botas'

const app = new BotApp()

app.on('message', async (ctx) => {
  const text = (ctx.activity.text ?? '').trim()

  if (text.toLowerCase() === 'cards') {
    const reply = new TeamsActivityBuilder()
      .withConversationReference(ctx.activity)
      .withAdaptiveCardAttachment(cardJson)
      .build()
    await ctx.send(reply)
  } else {
    const sender = ctx.activity.from
    const reply = new TeamsActivityBuilder()
      .withConversationReference(ctx.activity)
      .withText(`<at>${sender.name}</at> said: ${text}`)
      .addMention(sender)
      .build()
    await ctx.send(reply)
  }
})

app.start()
```

### Python (botas-fastapi)

```python
from botas import TeamsActivityBuilder
from botas_fastapi import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    text = (ctx.activity.text or "").strip()

    if text.lower() == "cards":
        reply = TeamsActivityBuilder() \
            .with_conversation_reference(ctx.activity) \
            .with_adaptive_card_attachment(card_json) \
            .build()
        await ctx.send(reply)
    else:
        sender = ctx.activity.from_account
        reply = TeamsActivityBuilder() \
            .with_conversation_reference(ctx.activity) \
            .with_text(f"<at>{sender.name}</at> said: {text}") \
            .add_mention(sender) \
            .build()
        await ctx.send(reply)

app.start()
```

---
