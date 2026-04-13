# botas — Bot ApplicationS (Node.js / TypeScript)

A lightweight TypeScript library for building [Microsoft Bot Framework](https://learn.microsoft.com/azure/bot-service/) bots.

## What it does

- Validates inbound JWT tokens from the Bot Framework Service
- Deserializes activities and dispatches them to registered handlers
- Runs a configurable middleware pipeline before each handler
- Authenticates outbound HTTP calls using OAuth2 client credentials
- Preserves unknown JSON properties so custom channel data round-trips safely
<img src="https://raw.githubusercontent.com/rido-min/botas/main/docs/art/icon-256.png" alt="botas logo" width="96" align="right"/>

# botas

Lightweight library for building [Microsoft Bot Framework](https://learn.microsoft.com/azure/bot-service/) bots — TypeScript/Node.js port.

## Installation

```bash
npm install botas
```

## Quick start (Express)

```typescript
import express from 'express'
import { BotApplication, botAuthExpress, createReplyActivity } from 'botas'
## Quick start

```typescript
import express from 'express'
import { BotApplication, botAuthExpress, CoreActivityBuilder } from '@botas/botas'

const bot = new BotApplication()

bot.on('message', async (activity) => {
  const reply = new CoreActivityBuilder()
    .withConversationReference(activity)
    .withText(`You said: ${activity.text}`)
    .build()
  await bot.sendActivityAsync(activity.serviceUrl, activity.conversation.id, reply)
})

const server = express()
server.use(express.json())
server.post('/api/messages', botAuthExpress(), (req, res) => bot.processAsync(req, res))
server.listen(process.env.PORT ?? 3978)
```

## Configuration

Set the following environment variables:
## Environment variables

| Variable | Description |
|---|---|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID |
| `TENANT_ID` | Azure AD tenant ID (or `common`) |
| `PORT` | HTTP listen port (default: `3978`) |

## Documentation

- [Full feature specification](https://github.com/rido-min/botas/blob/main/docs/bot-spec.md)
- [Architecture overview](https://github.com/rido-min/botas/blob/main/docs/Architecture.md)
- [Infrastructure setup](https://github.com/rido-min/botas/blob/main/docs/Setup.md)
- [Repository root](https://github.com/rido-min/botas)
See the [full documentation](https://github.com/rido-min/botas) for architecture details, middleware, and more.

## License

MIT
