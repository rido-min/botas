<img src="https://raw.githubusercontent.com/rido-min/botas/main/docs/art/icon-256.png" alt="botas logo" width="96" align="right"/>

# botas

Lightweight library for building [Microsoft Bot Framework](https://learn.microsoft.com/azure/bot-service/) bots — TypeScript/Node.js port.

## Installation

```bash
npm install botas
```

## Quick start

```typescript
import express from 'express'
import { BotApplication, botAuthExpress, createReplyActivity } from '@botas/botas'

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

## Environment variables

| Variable | Description |
|---|---|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID (or `common`) |
| `PORT` | HTTP listen port (default: `3978`) |

## Documentation

See the [full documentation](https://github.com/rido-min/botas) for architecture details, middleware, and more.

## License

MIT
