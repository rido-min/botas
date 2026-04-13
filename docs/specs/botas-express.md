# Spec: `botas-express` Package & Simplified Handler API

**Status**: Draft  
**Scope**: Node.js only (dotnet and Python to follow)

## Problem

Creating a bot today requires ~35 lines of boilerplate: importing express, setting up routes, configuring auth middleware, using `CoreActivityBuilder` to construct replies, and manually passing `serviceUrl`/`conversationId` to send. The user's desired experience is:

```ts
import { BotApp } from 'botas-express'

const app = new BotApp()
app.on('message', async (ctx) => {
  await ctx.send('you said: ' + ctx.activity.text)
})
app.start()
```

## Design

### Part 1: Turn Context (core `botas` package)

Add a `TurnContext` type that is passed to activity handlers instead of the raw `CoreActivity`. This provides a scoped `send()` method that automatically routes replies to the originating conversation.

```ts
interface TurnContext {
  /** The incoming activity. */
  activity: CoreActivity
  /** The BotApplication instance processing this turn. */
  app: BotApplication
  /** Send a reply to the current conversation. Accepts a text string or a partial activity. */
  send(activityOrText: string | Partial<CoreActivity>): Promise<ResourceResponse | undefined>
}
```

**Handler signature change:**

```ts
// Before (0.1.x)
type CoreActivityHandler = (activity: CoreActivity) => Promise<void>

// After
type CoreActivityHandler = (context: TurnContext) => Promise<void>
```

This is a breaking change to the handler signature. Since the library is at 0.1.0, this is acceptable. The existing samples will be updated.

**Middleware signature change:**

`ITurnMiddleware.onTurnAsync` already receives `(app, activity, next)`. Update to receive `(context, next)`:

```ts
interface ITurnMiddleware {
  onTurnAsync(context: TurnContext, next: NextTurn): Promise<void>
}
```

### Part 2: `botas-express` Package

A new npm package at `node/packages/botas-express/` that composes a `BotApplication` with an Express server.

```ts
import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async (ctx) => {
  await ctx.send('you said: ' + ctx.activity.text)
})

app.start() // listens on PORT env var or 3978
```

#### `BotApp` class

`BotApp` wraps a `BotApplication` and an Express server via composition (not inheritance).

```ts
interface BotAppOptions extends BotApplicationOptions {
  /** Port to listen on. Defaults to PORT env var or 3978. */
  port?: number
  /** Path for the messages endpoint. Defaults to '/api/messages'. */
  path?: string
  /** Whether to enable inbound JWT auth. Defaults to true when CLIENT_ID is set. */
  auth?: boolean
}

class BotApp {
  readonly bot: BotApplication

  constructor(options?: BotAppOptions)

  /** Register a handler for an activity type (delegates to BotApplication.on). */
  on(type: string, handler: CoreActivityHandler): this

  /** Register middleware (delegates to BotApplication.use). */
  use(middleware: ITurnMiddleware): this

  /** Start the Express server. Returns the http.Server for shutdown/testing. */
  start(): http.Server

  /** Proactive send (delegates to BotApplication.sendActivityAsync). */
  sendActivityAsync(
    serviceUrl: string,
    conversationId: string,
    activity: Partial<CoreActivity>
  ): Promise<ResourceResponse | undefined>
}
```

#### Express setup

`start()` creates an Express app with:
- `POST {path}` — auth middleware (if enabled) + `bot.processAsync(req, res)`
- `GET /health` — returns `{ status: 'ok' }`
- `GET /` — returns `Bot {clientId} is running`

#### Package structure

```
node/packages/botas-express/
  package.json     (deps: botas, express; devDeps: @types/express)
  tsconfig.json
  src/
    index.ts       (BotApp class + re-exports from botas)
    bot-app.ts     (BotApp implementation)
```

### What stays in core `botas`

- `BotApplication` — unchanged API surface, only handler signature updated
- `botAuthExpress()` / `botAuthHono()` — remain for users who want manual setup
- `CoreActivityBuilder` — remains for advanced use cases
- `processAsync()`, `processBody()` — remain for direct integration

### What does NOT change

- The `botas` package has no new dependencies
- Existing Hono integration pattern is unaffected
- `CoreActivityBuilder` is still available for complex reply construction

## Acceptance Criteria

1. A bot can be created and started with ≤5 lines of code using `botas-express`
2. `ctx.send('text')` sends a properly routed reply within a handler
3. `ctx.send(partialActivity)` sends a custom activity within a handler
4. Inbound JWT auth is enabled by default when `CLIENT_ID` is configured
5. `start()` returns an `http.Server` that can be closed in tests
6. Existing `botas` package tests continue to pass after handler signature change
7. Existing samples are updated to use `TurnContext`
