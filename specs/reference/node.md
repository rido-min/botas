# Node.js API Reference

**Purpose**: Full Node.js API signatures and implementation patterns.
**See also**: [Core Specs](../README.md)

---

## BotApp (botas-express)

Zero-boilerplate bot setup with Express.

```typescript
import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.start()
```

### Configuration

| Method | Description |
|--------|-------------|
| `new BotApp()` | Create app |
| `app.on(activityType, handler)` | Register handler |
| `app.start()` | Start Express server |

---

## BotApplication (Manual API)

Framework-agnostic bot class.

```typescript
class BotApplication {
    readonly conversationClient: ConversationClient
    
    on(type: string, handler: (ctx: TurnContext) => Promise<void>): this
    
    onActivity?: (ctx: TurnContext) => Promise<void>
    
    use(middleware: TurnMiddleware): this
    
    processAsync(req: IncomingMessage, res: ServerResponse): Promise<void>
    
    processBody(body: string): Promise<InvokeResponse | undefined>
    
    sendActivityAsync(serviceUrl: string, conversationId: string, activity: Partial<CoreActivity>): Promise<ResourceResponse | undefined>
}
```

### Registration

```typescript
const bot = new BotApplication()
bot.on('message', MyHandler)
bot.onActivity = CatchAllHandler
bot.use(MyMiddleware)
```

---

## TurnContext

Scoped context for the current turn.

```typescript
interface TurnContext {
    readonly activity: CoreActivity
    readonly app: BotApplication
    
    send(text: string): Promise<ResourceResponse | undefined>
    send(activity: Partial<CoreActivity>): Promise<ResourceResponse | undefined>
    sendTyping(): Promise<void>
}
```

### Sending a Message

```typescript
// String - auto-creates message activity
await ctx.send('Hello!')

// Activity - full control
await ctx.send(myActivity)
```

### Sending Typing Indicator

```typescript
bot.on('message', async (ctx) => {
  await ctx.sendTyping()
  
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  await ctx.send('Done processing!')
})
```

---

## Middleware

### Interface

```typescript
type NextTurn = () => Promise<void>

type TurnMiddleware = (context: TurnContext, next: NextTurn) => Promise<void>
```

> The legacy `ITurnMiddleware` interface still exists as a deprecated alias.

### Registration

```typescript
const bot = new BotApplication()
bot.use(async (context, next) => {
  console.log(`▶ ${context.activity.type}`)
  await next()
}).use(async (context, next) => {
  try { await next() } catch (err) { console.error(err) }
})
```

`use()` returns `this` for chaining.

### Middleware Patterns

#### Logging

```typescript
const loggingMiddleware: TurnMiddleware = async (context, next) => {
  console.log(`▶ ${context.activity.type}`)
  const start = Date.now()
  await next()
  console.log(`◀ ${context.activity.type} (${Date.now() - start}ms)`)
}
```

#### Error Handling

```typescript
const errorHandlingMiddleware: TurnMiddleware = async (context, next) => {
  try {
    await next()
  } catch (err) {
    console.error('Error:', err)
    await context.send('Sorry, something went wrong.')
  }
}
```

#### Short-Circuiting (Filter)

```typescript
const messagesOnly: TurnMiddleware = async (context, next) => {
  if (context.activity.type === 'message') {
    await next()
  }
}
```

#### Remove Bot Mention (Teams)

```typescript
import { removeMentionMiddleware } from 'botas'
bot.use(removeMentionMiddleware())
```

---

## TeamsActivityBuilder

Fluent builder for Teams-specific activities.

```typescript
const reply = new TeamsActivityBuilder()
    .withConversationReference(activity)
    .withText('<at>User</at> hello')
    .addMention(account)
    .withChannelData({ ... })
    .withSuggestedActions({ actions: [...] })
    .addAdaptiveCardAttachment(cardJson)
    .build()
```

---

## Exception Handling

```typescript
class BotHandlerException extends Error {
    cause: unknown
    activity: CoreActivity
}
```

---

## HTTP Integration

### Express

```typescript
import express from 'express'
import { BotApplication, botAuthExpress } from 'botas'

const bot = new BotApplication()

bot.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

const server = express()
server.post('/api/messages', botAuthExpress(), (req, res) => {
  bot.processAsync(req, res)
})
server.listen(Number(process.env['PORT'] ?? 3978))
```

### Hono

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

## Language-Specific Differences

| Concern | Node.js Behavior |
|---------|------------------|
| Simple bot API | `BotApp` (botas-express) |
| Web framework | Express (via botas-express) or manual |
| Handler registration | `app.on(type, handler)` receiving `TurnContext` |
| CatchAll handler | `onActivity` property |
| HTTP integration | `processAsync(req, res)` or `processBody(body)` |
| SendActivityAsync args | `(serviceUrl, conversationId, activity)` |
| TurnContext.send | `send(string \| Partial<CoreActivity>)` |
| TurnContext.sendTyping | `sendTyping()` returns `Promise<void>` |
| Authentication | `botAuthExpress()` / `botAuthHono()` factory |
| Activity model | `CoreActivity` interface with `properties?` dict |
| `from` field | `from` (JS allows it) |
| Prototype pollution | Must strip `__proto__`, `constructor`, `prototype` |

---

## Auth Middleware

### botAuthExpress()

```typescript
import { botAuthExpress } from 'botas'

server.post('/api/messages', botAuthExpress(), (req, res) => {
  bot.processAsync(req, res)
})
```

### botAuthHono()

```typescript
import { botAuthHono } from 'botas'

app.post('/api/messages', botAuthHono(), async (c) => {
  await bot.processBody(await c.req.text())
  return c.json({})
})
```

---

## Resource Cleanup

The built-in `fetch` API manages connections automatically. No explicit cleanup required.

---

## Configuration

| Variable | Description |
|----------|-------------|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID (or `"common"`) |
| `PORT` | HTTP listen port (default: `3978`) |

---

## References

- [Protocol Spec](../protocol.md)
- [Inbound Auth](../inbound-auth.md)
- [Outbound Auth](../outbound-auth.md)
- [Activity Schema](../activity-schema.md)
