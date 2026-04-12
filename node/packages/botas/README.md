# botas — Bot ApplicationS (Node.js / TypeScript)

A lightweight TypeScript library for building [Microsoft Bot Framework](https://learn.microsoft.com/azure/bot-service/) bots.

## What it does

- Validates inbound JWT tokens from the Bot Framework Service
- Deserializes activities and dispatches them to registered handlers
- Runs a configurable middleware pipeline before each handler
- Authenticates outbound HTTP calls using OAuth2 client credentials
- Preserves unknown JSON properties so custom channel data round-trips safely

## Installation

```bash
npm install botas
```

## Quick start (Express)

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
server.use(express.json())
server.post('/api/messages', botAuthExpress(), (req, res) => bot.processAsync(req, res))
server.listen(process.env.PORT ?? 3978)
```

## Configuration

Set the following environment variables:

| Variable | Description |
|---|---|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID |
| `PORT` | HTTP listen port (default: `3978`) |

## Documentation

- [Full feature specification](https://github.com/rido-min/botas/blob/main/docs/bot-spec.md)
- [Architecture overview](https://github.com/rido-min/botas/blob/main/docs/Architecture.md)
- [Infrastructure setup](https://github.com/rido-min/botas/blob/main/docs/Setup.md)
- [Repository root](https://github.com/rido-min/botas)
