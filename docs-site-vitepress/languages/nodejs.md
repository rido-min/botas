---
outline: deep
---

# Node.js (TypeScript)

## Installation

The `botas` package is published as an ES module and requires **Node.js 20+**.

```bash
npm install botas
```

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
3. Wires up `BotApplication.processAsync(req, res)` to handle incoming activities
4. Starts the server on `process.env.PORT ?? 3978`

### Handler registration with `app.on()`

Use `app.on(type, handler)` to register per-activity-type handlers. The handler receives a `TurnContext` (not a raw `CoreActivity`):

```typescript
app.on('message', async (ctx) => {
  // ctx.activity is the incoming activity
  // ctx.send() sends a reply
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.on('conversationUpdate', async (ctx) => {
  console.log('Members changed:', ctx.activity.properties?.['membersAdded'])
})
```

If no handler is registered for an incoming activity type, the activity is **silently ignored** — no error is thrown.

### Sending replies with `ctx.send()`

`TurnContext.send()` is the simplest way to send a reply:

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

`send(string)` automatically creates a properly-addressed reply with the given text. `send(Partial<CoreActivity>)` sends the activity as-is through the authenticated `ConversationClient`.

---

## Advanced: Manual framework integration

For advanced scenarios — using Hono, custom Express middleware, or other frameworks — you can use `BotApplication` directly and wire up the HTTP handling yourself.

---

## BotApplication

`BotApplication` is the central class that processes incoming Bot Framework activities. It is **web-framework-agnostic** — you wire it into Express, Hono, or any HTTP server you like.

### Creating an instance

```ts
import { BotApplication } from 'botas'

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

When using `BotApplication` directly (not `BotApp`), use `on(type, handler)` to register an async handler for a specific activity type. Only one handler per type is supported — registering the same type again replaces the previous handler. The method returns `this`, so you can chain calls.

The handler receives a `TurnContext`:

```typescript
bot.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})
```

If no handler is registered for an incoming activity type, the activity is **silently ignored** — no error is thrown.

The `ActivityType` constant provides well-known type strings to avoid magic values:

```ts
import { ActivityType } from 'botas'

bot.on(ActivityType.Message, async (ctx) => { /* ... */ })
bot.on(ActivityType.ConversationUpdate, async (ctx) => { /* ... */ })
```

---

## Express integration

botas ships a ready-made Express middleware for JWT authentication: `botAuthExpress()`.

### Wiring it up

```ts
import express from 'express'
import { BotApplication, botAuthExpress } from 'botas'

const bot = new BotApplication()
const server = express()

server.post('/api/messages', botAuthExpress(), (req, res) => {
  bot.processAsync(req, res)
})
```

`botAuthExpress()` validates the `Authorization: Bearer <token>` header against the Bot Framework JWKS endpoint. If validation fails, it responds with `401` before your handler ever runs.

`processAsync(req, res)` reads the request body, runs the middleware pipeline and handler, then writes `200 {}` on success or `500` on error.

---

## Hono integration

For [Hono](https://hono.dev), use `botAuthHono()` and `processBody()` instead. Because Hono manages its own response lifecycle, you call `processBody` with the raw JSON string and return the response yourself:

```ts
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { BotApplication, botAuthHono } from 'botas'

const bot = new BotApplication()
const app = new Hono()

app.post('/api/messages', botAuthHono(), async (c) => {
  const body = await c.req.text()
  await bot.processBody(body)
  return c.json({})
})

serve({ fetch: app.fetch, port: 3978 })
```

Both `botAuthExpress()` and `botAuthHono()` accept an optional `appId` parameter to override the audience check (defaults to the `CLIENT_ID` environment variable).

---

## Sending replies

### With TurnContext (recommended)

When using handlers that receive `TurnContext`, use `ctx.send()`:

```typescript
bot.on('message', async (ctx) => {
  // Send text
  await ctx.send(`You said: ${ctx.activity.text}`)

  // Or send a full activity
  await ctx.send({
    type: 'message',
    text: 'Custom reply',
  })
})
```

`ctx.send(string)` automatically creates a properly-addressed reply with the given text. `ctx.send(Partial<CoreActivity>)` sends the activity as-is through the authenticated `ConversationClient`.

### ConversationClient

For advanced scenarios, the `bot.conversationClient` exposes the full Conversations REST API:

| Method | Description |
|--------|-------------|
| `sendCoreActivityAsync` | Send an activity to a conversation |
| `updateCoreActivityAsync` | Update an existing activity |
| `deleteCoreActivityAsync` | Delete an activity |
| `getConversationMembersAsync` | List all members |
| `getConversationPagedMembersAsync` | List members with pagination |
| `createConversationAsync` | Create a new proactive conversation |

---

## Middleware

Middleware lets you add cross-cutting logic (logging, telemetry, error tracking) that runs before — and optionally after — every activity handler.

### The TurnMiddleware type

Middleware in Node.js is a plain async function matching the `TurnMiddleware` type:

```ts
import type { TurnMiddleware } from 'botas'

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

## Error handling

If an activity handler throws an exception, it is wrapped in a `BotHandlerException` that carries the original error and the triggering activity:

```ts
import { BotHandlerException } from 'botas'

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

## Full Express sample walkthrough

Here is the complete Express sample from `node/samples/express/index.ts`, annotated:

```ts
import express from 'express'
import { BotApplication, botAuthExpress } from 'botas'

// 1. Create the bot — credentials come from CLIENT_ID / CLIENT_SECRET / TENANT_ID env vars.
const bot = new BotApplication()

// 2. Handle incoming messages with TurnContext
bot.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}. from express`)
})

// 3. Log conversation updates (e.g. members added/removed).
bot.on('conversationUpdate', async (ctx) => {
  console.log('conversation update', ctx.activity.properties?.['membersAdded'])
})

// 4. Set up the Express server with JWT authentication middleware.
const server = express()

server.post('/api/messages', botAuthExpress(), (req, res) => {
  bot.processAsync(req, res)
})

// 5. Health check and status endpoints.
server.get('/', (_req, res) =>
  res.send(`Bot ${bot.options.clientId} is running. Send messages to /api/messages`)
)
server.get('/health', (_req, res) => res.json({ status: 'ok' }))

// 6. Start listening.
const PORT = Number(process.env['PORT'] ?? 3978)
server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}/api/messages for bot ${bot.options.clientId}`)
})
```

### What happens on each request

1. A `POST /api/messages` arrives from the Bot Framework channel.
2. `botAuthExpress()` validates the JWT — rejects with `401` if invalid.
3. `processAsync` reads the body, parses the `CoreActivity` JSON, runs middleware, and dispatches to the matching `on()` handler.
4. The handler calls `ctx.send()` to reply via the Bot Framework REST API (authenticated with client credentials).
5. `processAsync` writes `200 {}` back to the channel.

---

## Hono sample

The same bot logic works with Hono — only the HTTP wiring changes:

```ts
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { BotApplication, botAuthHono } from 'botas'

const bot = new BotApplication()

bot.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

bot.on('conversationUpdate', async (ctx) => {
  console.log('conversation update', ctx.activity.properties?.['membersAdded'])
})

const app = new Hono()

app.post('/api/messages', botAuthHono(), async (c) => {
  const body = await c.req.text()
  await bot.processBody(body)
  return c.json({})
})

app.get('/health', (c) => c.json({ status: 'ok' }))

const PORT = Number(process.env['PORT'] ?? 3978)
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Listening on http://localhost:${PORT}/api/messages`)
})
```

The key difference: Hono manages its own response, so you use `processBody(string)` instead of `processAsync(req, res)` and return the response via Hono's `c.json({})`.

---

## Teams features

Use `TeamsActivityBuilder` to send mentions, adaptive cards, and suggested actions. See the [Teams Features guide](../teams-features) for full examples.

```typescript
import { TeamsActivityBuilder } from 'botas'

// Echo with a mention
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
import { TeamsActivity } from 'botas'

const teamsActivity = TeamsActivity.fromActivity(ctx.activity)
const tenantId = teamsActivity.channelData?.tenant?.id
```

Run the sample:

```bash
npx tsx samples/teams-sample/index.ts
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

You can also pass these values through the `BotApplicationOptions` constructor parameter.

---

## Build and run

```bash
cd node

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Run a sample (requires a tunnel like ngrok or dev tunnels)
npx tsx samples/express/index.ts
npx tsx samples/hono/index.ts
```
