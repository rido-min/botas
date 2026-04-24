---
name: botas
description: Lightweight multi-language Bot Service library for building Microsoft Teams bots in .NET, Node.js, and Python with middleware pipelines, JWT authentication, and handler patterns.
license: MIT
compatibility: Requires .NET 10 SDK (C#), Node.js 20+ (TypeScript), or Python 3.12+ (asyncio). All languages support Microsoft Teams and Bot Service HTTP protocol.
metadata:
  languages: ".NET,Node.js,Python"
  frameworks: "ASP.NET Core,Express,Hono,FastAPI,aiohttp"
  packages: "Botas (NuGet),botas-core (npm),botas (PyPI)"
  homepage: "https://github.com/rido-min/botas"
  docs: "https://rido-min.github.io/botas/"
---

# BotAS — Bot Service Library

Build Microsoft Teams bots in three languages with a unified API. Botas handles HTTP routing, JWT authentication, middleware pipelines, and activity handlers out of the box.

## Quick Start by Language

### 1. Install

Pick your language:

#### .NET
```bash
dotnet add package Botas
```

#### Node.js
```bash
npm install botas-core botas-express
# or: npm install botas-core botas-hono
```

#### Python
```bash
pip install botas botas-fastapi
# or: pip install botas botas-aiohttp
```

### 2. Create a Bot

#### .NET (ASP.NET Core)
```csharp
using Botas;

var app = BotApp.Create(args);

app.On("message", async (ctx, ct) => {
    await ctx.SendAsync($"You said: {ctx.Activity.Text}", ct);
});

app.Run();
```

#### Node.js (Express or Hono)
```typescript
import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.start()
```

#### Python (FastAPI or aiohttp)
```python
from botas_fastapi import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```

### 3. Set Environment Variables

```env
CLIENT_ID=your-bot-app-id
CLIENT_SECRET=your-bot-client-secret
TENANT_ID=your-tenant-id
PORT=3978
```

Obtain these from the [Setup Guide](https://rido-min.github.io/botas/setup) using Teams CLI.

### 4. Run

#### .NET
```bash
cd dotnet && dotnet run --project samples/EchoBot
```

#### Node.js
```bash
npx tsx --env-file .env samples/echo-bot/index.ts
```

#### Python
```bash
cd python/samples/echo-bot && python main.py
```

## Core Concepts

### BotApplication

Main entry point for your bot. Handles HTTP routing, JWT validation, middleware execution, and handler dispatch.

**API:**
- `BotApp.Create(args)` (.NET) / `new BotApp()` (Node.js/Python) — Initialize
- `app.On(type, handler)` / `@app.on(type)` — Register handler for activity type
- `app.Use(middleware)` — Register middleware
- `app.Start()` — Start HTTP listener
- `app.Run()` (.NET) — Run ASP.NET host

### TurnContext

Passed to every handler and middleware. Contains the activity, conversation reference, and methods to send replies.

**Key Properties:**
- `activity` — The received activity (message, typing, invoke, etc.)
- `activity.type` — Activity type ("message", "invoke", "typing", etc.)
- `activity.text` — Text content (for message activities)
- `activity.from` — Sender info (userId, name, aadObjectId)
- `activity.recipient` — Bot identity (userId, name)
- `activity.conversation` — Conversation ID and tenant info
- `activity.channelId` — Channel identifier (usually "msteams")
- `activity.serviceUrl` — Base URL for sending replies

**Key Methods:**
- `await ctx.send(text, options?)` — Send a message reply
- `await ctx.sendTyping()` — Send typing indicator
- `await ctx.sendActivity(activity)` — Send custom activity
- `activity.CreateReplyActivity(text)` — Build a reply (lower-level)

### Middleware Pipeline

Middleware runs before handler dispatch. Each middleware receives context and a `next()` callback.

**Pattern:**
```typescript
// Node.js / Python example
app.use(async (ctx, next) => {
  console.log(`Activity: ${ctx.activity.type}`);
  await next();  // Call next() to continue
  console.log(`After handler`);
});
```

**Behavior:**
- Middleware executes in registration order
- Not calling `next()` skips handler and remaining middleware
- Exceptions wrapped in `BotHandlerException`
- Runs before handler dispatch

### Handler Registration

Register one handler per activity type. Unregistered types are silently ignored.

**Common Activity Types:**

Botas accepts *any* activity type string—the handler dispatch is string-based with no fixed enum. Below are the most common types in Bot Service. You can register handlers for any custom or uncommon types as well.

- `message` — User text messages
- `typing` — Typing indicators
- `invoke` — Invoke requests (cards, tasks, etc.)
- `conversionUpdate` — User join/leave events
- `contactRelationUpdate` — Bot added/removed

**Examples:**

#### .NET
```csharp
app.On("message", async (ctx, ct) => { /* ... */ });
app.On("typing", async (ctx, ct) => { /* ... */ });
app.On("invoke", async (ctx, ct) => { /* ... */ });
```

#### Node.js / TypeScript
```typescript
app.on('message', async (ctx) => { /* ... */ });
app.on('typing', async (ctx) => { /* ... */ });
app.on('invoke', async (ctx) => { /* ... */ });
```

#### Python
```python
@app.on('message')
async def on_message(ctx):
    # ...

@app.on('typing')
async def on_typing(ctx):
    # ...

@app.on('invoke')
async def on_invoke(ctx):
    # ...
```

### Common Activity Types (Examples)

| Type | When Sent | Typical Use |
|------|-----------|------------|
| `message` | User types and sends | Chatbot replies, message processing |
| `typing` | User typing indicator | Real-time typing status |
| `invoke` | Card action clicked, task fetch | Adaptive Card buttons, task modules |
| `conversionUpdate` | User joins/leaves conversation | Bot greeting, tracking membership |
| `contactRelationUpdate` | Bot added/removed from user's roster | Bot onboarding, notifications |

**Custom Activity Types:** You can register handlers for any activity type string using `app.on(type, handler)` or `@app.on(type)`. Botas will dispatch to your handler for that type. For example: `app.on('myCustomType', handler)` or `app.on('eventNotification', handler)` are both valid.

## Authentication

Botas handles two types of authentication:

### Inbound Authentication (Receiving Messages)

Bot Service signs every incoming request with a JWT token. Botas validates it automatically before calling handlers.

**Setup:**
```csharp
// .NET (automatic in BotApp.Create)
var app = BotApp.Create(args);
```

```typescript
// Node.js (automatic in new BotApp())
const app = new BotApp()
```

```python
# Python (automatic in BotApp())
app = BotApp()
```

**How it works:**
1. Bot Service sends request with `Authorization: Bearer <jwt>`
2. Botas fetches JWKS from Microsoft
3. JWT is validated
4. If valid, handler runs; if invalid, request rejected with 401

**Environment:**
```env
CLIENT_ID=your-bot-app-id
TENANT_ID=your-tenant-id  # or 'common'
```

### Outbound Authentication (Sending Messages)

When bot sends replies, it must prove its identity with an OAuth2 token.

**Setup:**
```csharp
// .NET (automatic via ClientCredential flow)
await ctx.SendAsync($"Hello", cancellationToken);
```

```typescript
// Node.js (automatic via ConversationClient)
await ctx.send("Hello");
```

```python
# Python (automatic via ConversationClient)
await ctx.send("Hello")
```

**How it works:**
1. Bot acquires OAuth2 token using `CLIENT_ID` + `CLIENT_SECRET`
2. Token cached locally (refresh when expired)
3. Every outbound activity includes `Authorization: Bearer <token>`
4. Bot Service validates token, processes message

**Environment:**
```env
CLIENT_ID=your-bot-app-id
CLIENT_SECRET=your-bot-client-secret
TENANT_ID=your-tenant-id  # or 'common'
```

## Sending Messages

### Reply to User

```csharp
// .NET
await ctx.SendAsync("Hello, World!", ct);
```

```typescript
// Node.js
await ctx.send("Hello, World!")
```

```python
# Python
await ctx.send("Hello, World!")
```

### Proactive Message (Out-of-Turn)

Store conversation reference, then send later:

```csharp
// .NET: ConversationReference from context
var reference = ctx.ConversationReference();
// ... later ...
await new ConversationClient().SendAsync(reference, "Hello later!", ct);
```

```typescript
// Node.js
const ref = ctx.conversationReference;
// ... later ...
await client.send(ref, "Hello later!")
```

```python
# Python
ref = ctx.conversation_reference
# ... later ...
await client.send(ref, "Hello later!")
```

## Error Handling

Handler exceptions are caught and wrapped in a `BotHandlerException` (or language-specific equivalent).

```csharp
// .NET
app.On("message", async (ctx, ct) =>
{
    throw new InvalidOperationException("Oops!");  // Caught, wrapped in BotHandlerException
});
```

```typescript
// Node.js: exceptions logged, 500 returned to framework
app.on('message', async (ctx) => {
  throw new Error("Oops!")  // Logged, 500 error returned
});
```

```python
# Python
@app.on('message')
async def on_message(ctx):
    raise Exception("Oops!")  # Logged, 500 error returned
```

## Teams-Specific Features

### Mentions

Remove @-mention from text:

```csharp
// .NET
var middleware = new RemoveMentionMiddleware();
app.Use(middleware);
```

```typescript
// Node.js
import { RemoveMentionMiddleware } from 'botas-core'
app.use(RemoveMentionMiddleware())
```

```python
# Python
from botas import RemoveMentionMiddleware
app.use(RemoveMentionMiddleware())
```

### Adaptive Cards

Send structured Adaptive Cards:

```csharp
// .NET
var card = new { type = "AdaptiveCard", version = "1.4", body = new[] { /* ... */ } };
var activity = ctx.CreateReplyActivity();
activity.Attachments.Add(new Attachment { ContentType = "application/vnd.microsoft.card.adaptive", Content = card });
await ctx.SendAsync(activity, ct);
```

```typescript
// Node.js
const card = { type: "AdaptiveCard", version: "1.4", body: [/* ... */] };
const activity = ctx.activity.createReplyActivity();
activity.attachments = [{ contentType: "application/vnd.microsoft.card.adaptive", content: card }];
await ctx.send(activity);
```

```python
# Python
card = {"type": "AdaptiveCard", "version": "1.4", "body": [...]}
activity = ctx.activity.create_reply_activity()
activity.attachments = [{"content_type": "application/vnd.microsoft.card.adaptive", "content": card}]
await ctx.send(activity)
```

### Suggested Actions

Offer clickable buttons:

```csharp
// .NET
var activity = ctx.CreateReplyActivity("Pick one:");
activity.SuggestedActions = new SuggestedActions
{
    Actions = new[] {
        new CardAction { Type = "postBack", Title = "Option 1", Value = "opt1" },
        new CardAction { Type = "postBack", Title = "Option 2", Value = "opt2" }
    }
};
await ctx.SendAsync(activity, ct);
```

```typescript
// Node.js
const activity = ctx.activity.createReplyActivity("Pick one:");
activity.suggestedActions = {
  actions: [
    { type: "postBack", title: "Option 1", value: "opt1" },
    { type: "postBack", title: "Option 2", value: "opt2" }
  ]
};
await ctx.send(activity);
```

```python
# Python
activity = ctx.activity.create_reply_activity("Pick one:")
activity.suggested_actions = {
  "actions": [
    {"type": "postBack", "title": "Option 1", "value": "opt1"},
    {"type": "postBack", "title": "Option 2", "value": "opt2"}
  ]
}
await ctx.send(activity)
```

## Configuration

Botas reads environment variables for credentials and settings:

| Variable | Description | Required |
|----------|-------------|----------|
| `CLIENT_ID` | Azure AD Application ID | Yes |
| `CLIENT_SECRET` | Azure AD Client Secret | Yes |
| `TENANT_ID` | Azure AD Tenant ID (default: `common`) | No |
| `PORT` | HTTP listen port (default: `3978`) | No |

Load from `.env` file:

#### .NET
```bash
# Uses appsettings.json + appsettings.{ASPNETCORE_ENVIRONMENT}.json
export CLIENT_ID=...
dotnet run
```

#### Node.js
```bash
npx tsx --env-file .env index.ts
```

#### Python
```bash
# .env is auto-loaded by python-dotenv
python main.py
```

## Code Patterns

### Echo Bot

The simplest bot — echoes back what the user sends:

```csharp
// .NET
app.On("message", async (ctx, ct) =>
{
    await ctx.SendAsync($"You said: {ctx.Activity.Text}", ct);
});
```

```typescript
// Node.js
app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})
```

```python
# Python
@app.on('message')
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")
```

### Middleware + Handler

Middleware logs, handler processes:

```csharp
// .NET
app.Use(async (ctx, next) =>
{
    Console.WriteLine($"[{DateTime.UtcNow}] {ctx.Activity.Type} from {ctx.Activity.From.Name}");
    await next();
});

app.On("message", async (ctx, ct) =>
{
    await ctx.SendAsync($"Got: {ctx.Activity.Text}", ct);
});
```

```typescript
// Node.js
app.use(async (ctx, next) => {
  console.log(`[${new Date().toISOString()}] ${ctx.activity.type} from ${ctx.activity.from.name}`)
  await next()
})

app.on('message', async (ctx) => {
  await ctx.send(`Got: ${ctx.activity.text}`)
})
```

```python
# Python
@app.use
async def log_middleware(ctx, next):
    import datetime
    print(f"[{datetime.datetime.utcnow()}] {ctx.activity.type} from {ctx.activity.from_['name']}")
    await next()

@app.on('message')
async def on_message(ctx):
    await ctx.send(f"Got: {ctx.activity.text}")
```

### Conditional Handler

Route based on activity type:

```csharp
// .NET
app.On("message", async (ctx, ct) =>
{
    if (ctx.Activity.Text?.Contains("hello", StringComparison.OrdinalIgnoreCase) == true)
    {
        await ctx.SendAsync("Hi there!", ct);
    }
    else
    {
        await ctx.SendAsync($"You said: {ctx.Activity.Text}", ct);
    }
});

app.On("conversionUpdate", async (ctx, ct) =>
{
    await ctx.SendAsync("Welcome to the bot!", ct);
});
```

```typescript
// Node.js
app.on('message', async (ctx) => {
  if (ctx.activity.text?.toLowerCase().includes('hello')) {
    await ctx.send("Hi there!")
  } else {
    await ctx.send(`You said: ${ctx.activity.text}`)
  }
})

app.on('conversionUpdate', async (ctx) => {
  await ctx.send("Welcome to the bot!")
})
```

```python
# Python
@app.on('message')
async def on_message(ctx):
    if 'hello' in (ctx.activity.text or '').lower():
        await ctx.send("Hi there!")
    else:
        await ctx.send(f"You said: {ctx.activity.text}")

@app.on('conversionUpdate')
async def on_conversion_update(ctx):
    await ctx.send("Welcome to the bot!")
```

## Debugging

### Enable Logging

#### .NET
```csharp
// Set log level in appsettings.json
{
  "Logging": {
    "LogLevel": {
      "Botas": "Debug"
    }
  }
}
```

#### Node.js
```bash
DEBUG=botas:* npx tsx --env-file .env index.ts
```

#### Python
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Inspect Activities

Log the raw activity to see what the bot receives:

```csharp
// .NET
app.Use(async (ctx, next) =>
{
    System.Diagnostics.Debug.WriteLine(System.Text.Json.JsonSerializer.Serialize(ctx.Activity));
    await next();
});
```

```typescript
// Node.js
app.use(async (ctx, next) => {
  console.log(JSON.stringify(ctx.activity, null, 2))
  await next()
})
```

```python
# Python
import json

@app.use
async def log_middleware(ctx, next):
    print(json.dumps(ctx.activity.model_dump(), indent=2))
    await next()
```

## References

- [Full Documentation](https://rido-min.github.io/botas/)
- [Setup Guide](https://rido-min.github.io/botas/setup)
- [Getting Started](https://rido-min.github.io/botas/getting-started)
- [Architecture](https://github.com/rido-min/botas/blob/main/specs/architecture.md)
- [Language Guides](https://rido-min.github.io/botas/languages/)
- [GitHub Repository](https://github.com/rido-min/botas)

## Samples

Official samples are available in the repository:

- **Echo Bot** — Minimal bot that echoes messages
  - .NET: `dotnet/samples/EchoBot`
  - Node.js: `node/samples/echo-bot`
  - Python: `python/samples/echo-bot`

- **Teams Bot** — Demonstrates Adaptive Cards, mentions, Teams features
  - Available for all three languages

## Common Tasks

### Task: Build and Deploy a Bot

**Steps:**
1. Clone botas repository or start with template
2. Choose language (.NET, Node.js, or Python)
3. Copy relevant sample (Echo or Teams bot)
4. Install dependencies (`dotnet add package Botas`, `npm install botas-core botas-express`, or `pip install botas botas-fastapi`)
5. Set `CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID` in `.env`
6. Add custom handlers via `app.On()` / `@app.on()` decorators
7. Run with appropriate command (see Quick Start section)
8. Test via Teams app installer or chat interface

### Task: Add Middleware

Middleware intercepts all activities before handlers run.

```typescript
// Node.js example: Rate limiting middleware
const requestCounts = new Map();

app.use(async (ctx, next) => {
  const userId = ctx.activity.from.id;
  const count = (requestCounts.get(userId) || 0) + 1;
  
  if (count > 10) {
    await ctx.send("Rate limit exceeded. Try again later.");
    return;  // Don't call next() — skip handler
  }
  
  requestCounts.set(userId, count);
  setTimeout(() => requestCounts.delete(userId), 60000);  // Reset after 1 minute
  
  await next();
});
```

### Task: Send Adaptive Card

See **Teams-Specific Features** section above for full examples.

### Task: Handle Invoke Activities

Invoke activities trigger when users click card buttons or submit task modules.

```typescript
// Node.js
app.on('invoke', async (ctx) => {
  const action = ctx.activity;  // Contains button/action data
  
  if (action.name === 'adaptiveCard/action') {
    const actionData = action.value;  // User action payload
    await ctx.send(`You clicked with data: ${JSON.stringify(actionData)}`);
  }
});
```

## Getting Help

- **Issues:** [GitHub Issues](https://github.com/rido-min/botas/issues)
- **Discussions:** [GitHub Discussions](https://github.com/rido-min/botas/discussions)
- **Documentation:** [Full docs site](https://rido-min.github.io/botas/)
