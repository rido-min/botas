<img src="https://raw.githubusercontent.com/rido-min/botas/main/art/icon-256.png" alt="botas logo" width="96" align="right"/>

# botas-express

Zero-boilerplate [Express](https://expressjs.com/) integration for [botas](https://www.npmjs.com/package/botas) — build [Microsoft Bot Framework](https://learn.microsoft.com/azure/bot-service/) bots in a few lines.

## Installation

```bash
npm install botas-express
```

## Quick start

```typescript
import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.start()
```

## Environment variables

| Variable | Description |
|---|---|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID (or `common`) |
| `PORT` | HTTP listen port (default: `3978`) |

## Documentation

- [Full documentation site](https://rido-min.github.io/botas/)
- [Full feature specification](https://github.com/rido-min/botas/blob/main/specs/README.md)
- [Architecture overview](https://github.com/rido-min/botas/blob/main/specs/Architecture.md)

## License

MIT
