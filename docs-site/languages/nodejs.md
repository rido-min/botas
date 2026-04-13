---
layout: default
title: Node.js
parent: Languages
nav_order: 2
---

# Node.js (TypeScript)
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

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

### Registering activity handlers

Use `on(type, handler)` to register an async handler for a specific activity type. Only one handler per type is supported — registering the same type again replaces the previous handler. The method returns `this`, so you can chain calls.

```ts
bot.on('message', async (activity) => {
  console.log('User said:', activity.text)
})

bot.on('conversationUpdate', async (activity) => {
  console.log('Members changed:', activity.properties?.['membersAdded'])
})
```

If no handler is registered for an incoming activity type, the activity is **silently ignored** — no error is thrown.

The `ActivityType` constant provides well-known type strings to avoid magic values:

```ts
import { ActivityType } from 'botas'

bot.on(ActivityType.Message, async (activity) => { /* ... */ })
bot.on(ActivityType.ConversationUpdate, async (activity) => { /* ... */ })
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

To reply to an incoming activity, use `sendActivityAsync` together with the `createReplyActivity` helper:

```ts
import { createReplyActivity } from 'botas'

bot.on('message', async (activity) => {
  await bot.sendActivityAsync(
    activity.serviceUrl,
    activity.conversation.id,
    createReplyActivity(activity, `You said: ${activity.text}`)
  )
})
```

`createReplyActivity(activity, text)` builds a reply that:

- Copies `serviceUrl` and `conversation` from the original activity
- Swaps `from` and `recipient`
- Sets the `type` to `"message"` and the `text` to the value you provide

Under the hood, `sendActivityAsync` authenticates with client credentials and POSTs the reply to the Bot Framework REST API at `{serviceUrl}v3/conversations/{conversationId}/activities`.

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

### UserTokenClient

`bot.userTokenClient` handles OAuth user-token flows:

| Method | Description |
|--------|-------------|
| `getTokenAsync` | Get an OAuth token for a user |
| `getSignInResourceAsync` | Get a sign-in link for the user |
| `exchangeTokenAsync` | Exchange an SSO token |
| `signOutUserAsync` | Sign the user out |

---

## Middleware

Middleware lets you add cross-cutting logic (logging, telemetry, error tracking) that runs before — and optionally after — every activity handler.

### The ITurnMiddleware interface

```ts
import type { ITurnMiddleware, NextTurn } from 'botas'
import type { CoreActivity } from 'botas'

class LoggingMiddleware implements ITurnMiddleware {
  async onTurnAsync(app: unknown, activity: CoreActivity, next: NextTurn): Promise<void> {
    console.log(`→ Received ${activity.type}`)
    await next()  // continue to the next middleware or the handler
    console.log(`← Done processing ${activity.type}`)
  }
}
```

The `next` callback invokes the next middleware in the chain, or the activity handler if this is the last middleware. If you don't call `next()`, the activity handler is **skipped** (short-circuit).

### Registering middleware

```ts
bot.use(new LoggingMiddleware())
```

Middleware executes in **registration order**. The method returns `this` for chaining:

```ts
bot
  .use(new LoggingMiddleware())
  .use(new TelemetryMiddleware())
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
import { BotApplication, botAuthExpress, createReplyActivity } from 'botas'

// 1. Create the bot — credentials come from CLIENT_ID / CLIENT_SECRET / TENANT_ID env vars.
const bot = new BotApplication()

// 2. Handle incoming messages by echoing the user's text back.
bot.on('message', async (activity) => {
  await bot.sendActivityAsync(
    activity.serviceUrl,
    activity.conversation.id,
    createReplyActivity(activity, `You said: ${activity.text}. from express`)
  )
})

// 3. Log conversation updates (e.g. members added/removed).
bot.on('conversationUpdate', async (activity) => {
  console.log('conversation update', activity.properties?.['membersAdded'])
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
4. The handler calls `sendActivityAsync` to reply via the Bot Framework REST API (authenticated with client credentials).
5. `processAsync` writes `200 {}` back to the channel.

---

## Hono sample

The same bot logic works with Hono — only the HTTP wiring changes:

```ts
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

bot.on('conversationUpdate', async (activity) => {
  console.log('conversation update', activity.properties?.['membersAdded'])
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
