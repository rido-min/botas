---
outline: deep
---

# Node.js (TypeScript)

📦 [botas-core](https://www.npmjs.com/package/botas-core) · [botas-express](https://www.npmjs.com/package/botas-express) · 📗 API Reference: [botas-core](/api/generated/nodejs/botas-core/index.html) · [botas-express](/api/generated/nodejs/botas-express/index.html)

## Installation

The Node.js implementation ships as two npm packages, both published as ES modules and requiring **Node.js 20+**:

| Package &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | Description |
|---------|-------------|
| **`botas-express`** | All-in-one package — includes `BotApp`, re-exports core types |
| **`botas-core`** | Standalone core library — use when integrating with Hono or other frameworks |

```bash
npm install botas-express          # recommended — includes botas-core
# or, for advanced/non-Express setups:
npm install botas-core
```

### Deno / JSR

The core library is also published on [JSR](https://jsr.io/@botas/core) as **`@botas/core`** for use with Deno (v2+) — no build step or bundler needed:

```bash
deno add jsr:@botas/core
```

```ts
import { BotApplication, validateBotToken } from '@botas/core'
```

See the [Deno sample](https://github.com/rido-min/botas/tree/main/node/samples/deno) for a complete example using `Deno.serve()` with no framework.

If you're working inside the monorepo, the workspace already links the package:

```bash
cd node
npm install          # installs all workspace dependencies
npm run build        # compiles the library and samples
```

---

## Quick start with BotApp

The simplest way to create a bot in Node.js is to use `BotApp` from the **`botas-express`** package. It sets up Express, JWT authentication, and the `/api/messages` endpoint in a single call:

```typescript
import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.start()
```

That's it — **8 lines** to go from zero to a working bot.

### What `BotApp` does

Under the hood, `BotApp`:

1. Creates an Express server
2. Registers `POST /api/messages` with JWT authentication middleware (`botAuthExpress()`)
3. Wires up <a href="/api/generated/nodejs/botas-core/classes/BotApplication.html" target="_blank"><code>BotApplication</code></a>.processAsync(req, res) to handle incoming activities
4. Starts the server on `process.env.PORT ?? 3978`

### Handler registration with `app.on()`

Use `app.on(type, handler)` to register per-activity-type handlers. The handler receives a <a href="/api/generated/nodejs/botas-core/interfaces/TurnContext.html" target="_blank"><code>TurnContext</code></a> (not a raw <a href="/api/generated/nodejs/botas-core/interfaces/CoreActivity.html" target="_blank"><code>CoreActivity</code></a>):

```typescript
app.on('message', async (ctx) => {
  // ctx.activity is the incoming activity
  // ctx.send() sends a reply
  await ctx.send(`You said: ${ctx.activity.text}`)
})
```

If no handler is registered for an incoming activity type, the activity is **silently ignored** — no error is thrown.

### Sending replies with `ctx.send()`

<a href="/api/generated/nodejs/botas-core/interfaces/TurnContext.html" target="_blank"><code>TurnContext</code></a>.send() is the simplest way to send a reply:

```typescript
// Send text
await ctx.send('Hello!')

// Send a full activity
await ctx.send({
  type: 'message',
  text: 'Hello!',
  conversation: ctx.activity.conversation,
  serviceUrl: ctx.activity.serviceUrl,
})
```

`send(string)` automatically creates a properly-addressed reply with the given text. send(Partial&lt;<a href="/api/generated/nodejs/botas-core/interfaces/CoreActivity.html" target="_blank"><code>CoreActivity</code></a>&gt;) sends the activity as-is through the authenticated <a href="/api/generated/nodejs/botas-core/classes/ConversationClient.html" target="_blank"><code>ConversationClient</code></a>.

---

## Advanced: Manual framework integration

For advanced scenarios — using Hono, custom Express middleware, or other frameworks — you can use <a href="/api/generated/nodejs/botas-core/classes/BotApplication.html" target="_blank"><code>BotApplication</code></a> directly and wire up the HTTP handling yourself.

---

## BotApplication

<a href="/api/generated/nodejs/botas-core/classes/BotApplication.html" target="_blank"><code>BotApplication</code></a> is the central class that processes incoming activities. It is **web-framework-agnostic** — you wire it into Express, Hono, or any HTTP server you like.

### Creating an instance

```ts
import { BotApplication } from 'botas-core'

const bot = new BotApplication()
```

Credentials are resolved automatically from environment variables (`CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID`). You can also pass them explicitly:

```ts
const bot = new BotApplication({
  clientId: '00000000-0000-0000-0000-000000000000',
  clientSecret: 'your-secret',
  tenantId: 'your-tenant-id',
})
```

### Registering activity handlers (BotApplication)

When using <a href="/api/generated/nodejs/botas-core/classes/BotApplication.html" target="_blank"><code>BotApplication</code></a> directly (not `BotApp`), use `on(type, handler)` to register an async handler for a specific activity type. Only one handler per type is supported — registering the same type again replaces the previous handler. The method returns `this`, so you can chain calls.

The handler receives a <a href="/api/generated/nodejs/botas-core/interfaces/TurnContext.html" target="_blank"><code>TurnContext</code></a>:

```typescript
bot.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})
```

If no handler is registered for an incoming activity type, the activity is **silently ignored** — no error is thrown.

The <a href="/api/generated/nodejs/botas-core/variables/ActivityType.html" target="_blank"><code>ActivityType</code></a> type alias provides compile-time safety for known activity types:

```ts
import type { ActivityType } from 'botas-core'

// ActivityType = 'message' | 'typing' | 'invoke'
bot.on('message', async (ctx) => { /* ... */ })
bot.on('typing', async (ctx) => { /* ... */ })
```

For Teams-specific activity types, use `TeamsActivityType`:

```ts
import type { TeamsActivityType } from 'botas-core'

// Includes all core types plus: 'conversationUpdate', 'event', etc.
bot.on('conversationUpdate', async (ctx) => { /* ... */ })
```

---

## Express integration

The **`botas-express`** package ships a ready-made Express middleware for JWT authentication: `botAuthExpress()`.

### Wiring it up

```ts
import express from 'express'
import { BotApplication } from 'botas-core'
import { botAuthExpress } from 'botas-express'

const bot = new BotApplication()
const server = express()

server.post('/api/messages', botAuthExpress(), (req, res) => {
  bot.processAsync(req, res)
})
```

`botAuthExpress()` validates the `Authorization: Bearer <token>` header against the Bot Service JWKS endpoint. If validation fails, it responds with `401` before your handler ever runs.

`processAsync(req, res)` reads the request body, runs the middleware pipeline and handler, then writes `200 {}` on success or `500` on error.

---

## Hono integration

For [Hono](https://hono.dev), use `validateBotToken` and `BotAuthError` from `botas-core` to build a small auth middleware, and `processBody()` for activity handling. Because Hono manages its own response lifecycle, you call `processBody` with the raw JSON string and return the response yourself:

```ts
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { BotApplication, validateBotToken, BotAuthError } from 'botas-core'
import type { Context, Next } from 'hono'

const bot = new BotApplication()
const app = new Hono()

function botAuthHono (appId?: string): (c: Context, next: Next) => Promise<Response | void> {
  const audience = appId ?? process.env['CLIENT_ID']
  if (!audience) throw new Error('CLIENT_ID is required')
  return async (c, next) => {
    try {
      await validateBotToken(c.req.header('authorization'), appId)
      return next()
    } catch (err) {
      if (err instanceof BotAuthError) return c.text(err.message, 401)
      throw err
    }
  }
}

app.post('/api/messages', botAuthHono(), async (c) => {
  const body = await c.req.text()
  await bot.processBody(body)
  return c.json({})
})

serve({ fetch: app.fetch, port: 3978 })
```

`botas-core` exports `validateBotToken` and `BotAuthError` so you can build auth middleware for any web framework. The Express-specific `botAuthExpress()` lives in `botas-express` for convenience.

---

## Middleware

Middleware lets you add cross-cutting logic (logging, telemetry, error tracking) that runs before — and optionally after — every activity handler.

### The TurnMiddleware type

Middleware in Node.js is a plain async function matching the <a href="/api/generated/nodejs/botas-core/type-aliases/TurnMiddleware.html" target="_blank"><code>TurnMiddleware</code></a> type:

```ts
import type { TurnMiddleware } from 'botas-express'

const loggingMiddleware: TurnMiddleware = async (context, next) => {
  console.log(`→ Received ${context.activity.type}`)
  await next()  // continue to the next middleware or the handler
  console.log(`← Done processing ${context.activity.type}`)
}
```

The `next` callback invokes the next middleware in the chain, or the activity handler if this is the last middleware. If you don't call `next()`, the activity handler is **skipped** (short-circuit).

### Registering middleware

```ts
bot.use(loggingMiddleware)
```

Middleware executes in **registration order**. The method returns `this` for chaining:

```ts
bot
  .use(loggingMiddleware)
  .use(telemetryMiddleware)
  .on('message', async (activity) => { /* ... */ })
```

---

## Observability (OpenTelemetry)

botas emits OpenTelemetry traces, metrics, and structured logs automatically. Enable observability with a single setup call — no custom middleware needed.

See the [Observability guide](../observability) for Quick Start, Aspire Dashboard setup, and Azure Monitor configuration.

---

## Error handling

If an activity handler throws an exception, it is wrapped in a <a href="/api/generated/nodejs/botas-core/classes/BotHandlerException.html" target="_blank"><code>BotHandlerException</code></a> that carries the original error and the triggering activity:

```ts
import { BotHandlerException } from 'botas-express'

try {
  await bot.processBody(body)
} catch (err) {
  if (err instanceof BotHandlerException) {
    console.error('Handler failed for activity type:', err.activity.type)
    console.error('Original error:', err.cause)
  }
}
```

When using `processAsync` (Express), handler errors result in a `500 Internal server error` response automatically.

---

## CoreActivity schema

<a href="/api/generated/nodejs/botas-core/interfaces/CoreActivity.html" target="_blank"><code>CoreActivity</code></a> is a plain TypeScript interface. Unknown JSON properties are captured in a `properties` record:

| Property | Type | Description |
|---|---|---|
| `type` | `string` | Activity type (`"message"`, `"typing"`, etc.) |
| `serviceUrl` | `string` | The channel's service endpoint |
| `from` | <a href="/api/generated/nodejs/botas-core/interfaces/ChannelAccount.html" target="_blank"><code>ChannelAccount</code></a> \| undefined | Sender |
| `recipient` | <a href="/api/generated/nodejs/botas-core/interfaces/ChannelAccount.html" target="_blank"><code>ChannelAccount</code></a> \| undefined | Recipient |
| `conversation` | `Conversation \| undefined` | Conversation reference |
| `text` | `string \| undefined` | Message text |
| `entities` | <a href="/api/generated/nodejs/botas-core/interfaces/Entity.html" target="_blank"><code>Entity</code></a>[] \| undefined | Attached entities |
| `attachments` | <a href="/api/generated/nodejs/botas-core/interfaces/Attachment.html" target="_blank"><code>Attachment</code></a>[] \| undefined | Attached files/cards |
| `properties` | `Record<string, unknown>` | Unknown JSON properties (preserved on round-trip) |

---

## ConversationClient

For advanced scenarios, `bot.conversationClient` exposes the full Conversations REST API:

| Method | Description |
|--------|-------------|
| `sendCoreActivityAsync` | Send an activity to a conversation |
| `updateCoreActivityAsync` | Update an existing activity |
| `deleteCoreActivityAsync` | Delete an activity |
| `getConversationMembersAsync` | List all members |
| `getConversationPagedMembersAsync` | List members with pagination |
| `createConversationAsync` | Create a new proactive conversation |

---

## Teams features

Use <a href="/api/generated/nodejs/botas-core/classes/TeamsActivityBuilder.html" target="_blank"><code>TeamsActivityBuilder</code></a> to send mentions, adaptive cards, and suggested actions. See the [Teams Features guide](../teams-features) for full examples.

```typescript
import { TeamsActivityBuilder } from 'botas-core'

const sender = ctx.activity.from
const reply = new TeamsActivityBuilder()
  .withConversationReference(ctx.activity)
  .withText(`<at>${sender.name}</at> said: ${ctx.activity.text}`)
  .addMention(sender)
  .build()
await ctx.send(reply)
```

Use `TeamsActivity.fromActivity()` to access Teams-specific metadata:

```typescript
import { TeamsActivity } from 'botas-core'

const teamsActivity = TeamsActivity.fromActivity(ctx.activity)
const tenantId = teamsActivity.channelData?.tenant?.id
```

---

## Configuration

All credentials are read from environment variables by default:

| Variable | Description |
|----------|-------------|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID |
| `PORT` | HTTP listen port (default: `3978`) |

You can also pass these values through the <a href="/api/generated/nodejs/botas-core/interfaces/BotApplicationOptions.html" target="_blank"><code>BotApplicationOptions</code></a> constructor parameter.

For setup details on Azure Bot registration and credentials, see the [Setup Guide](../setup) and [Authentication](../authentication).

---

## Key types reference

| Type | Description |
|------|-------------|
| <a href="/api/generated/nodejs/botas-core/classes/BotApplication.html" target="_blank"><code>BotApplication</code></a> | Main bot class — owns handlers, middleware pipeline, and send methods |
| <a href="/api/generated/nodejs/botas-core/interfaces/CoreActivity.html" target="_blank"><code>CoreActivity</code></a> | Deserialized Bot Service activity; preserves unknown JSON properties in `properties` |
| <a href="/api/generated/nodejs/botas-core/interfaces/ChannelAccount.html" target="_blank"><code>ChannelAccount</code></a> | Represents a user or bot identity (`id`, `name`, `aadObjectId`, `role`) |
| `Conversation` | Conversation identifier (`id`) |
| <a href="/api/generated/nodejs/botas-core/classes/ConversationClient.html" target="_blank"><code>ConversationClient</code></a> | Sends outbound activities over the authenticated HTTP client |
| <a href="/api/generated/nodejs/botas-core/type-aliases/TurnMiddleware.html" target="_blank"><code>TurnMiddleware</code></a> | Middleware function type — `(context, next) => Promise<void>` |
| <a href="/api/generated/nodejs/botas-core/classes/BotHandlerException.html" target="_blank"><code>BotHandlerException</code></a> | Wraps handler exceptions with the triggering activity |
| <a href="/api/generated/nodejs/botas-core/classes/TeamsActivity.html" target="_blank"><code>TeamsActivity</code></a> | Teams-specific activity — `channelData`, `locale`, `suggestedActions`, and `fromActivity()` factory |
| <a href="/api/generated/nodejs/botas-core/classes/TeamsActivityBuilder.html" target="_blank"><code>TeamsActivityBuilder</code></a> | Fluent builder for Teams replies — `addMention()`, `addAdaptiveCardAttachment()`, `withSuggestedActions()` |
| <a href="/api/generated/nodejs/botas-core/interfaces/TeamsChannelData.html" target="_blank"><code>TeamsChannelData</code></a> | Typed Teams channel metadata — `tenant`, `channel`, `team`, `meeting`, `notification` |
| <a href="/api/generated/nodejs/botas-core/interfaces/Entity.html" target="_blank"><code>Entity</code></a> | Activity entity (e.g. mention) |
| <a href="/api/generated/nodejs/botas-core/interfaces/Attachment.html" target="_blank"><code>Attachment</code></a> | File or card attachment with `contentType`, `content` |

---

## API Reference

Full API documentation is generated with TypeDoc from TSDoc comments:

📗 [botas-core API Reference](/api/generated/nodejs/botas-core/index.html)
📗 [botas-express API Reference](/api/generated/nodejs/botas-express/index.html)
