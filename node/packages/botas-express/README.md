# botas-express

Zero-boilerplate [Express](https://expressjs.com/) integration for [`botas-core`](https://www.npmjs.com/package/botas-core) — build [Microsoft Teams](https://learn.microsoft.com/en-us/microsoftteams/platform/) bots in a few lines.

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

## API

### `BotApp`

Composes a `BotApplication` with an Express server.

| Method | Description |
|---|---|
| `on(type, handler)` | Register a handler for an activity type |
| `onInvoke(name, handler)` | Register a handler for an invoke activity by name |
| `use(middleware)` | Add a middleware to the turn pipeline |
| `start()` | Start the Express server (returns the `http.Server`) |

### Options

| Option | Env variable | Default | Description |
|---|---|---|---|
| `clientId` | `CLIENT_ID` | — | Azure AD application (bot) ID |
| `clientSecret` | `CLIENT_SECRET` | — | Azure AD client secret |
| `tenantId` | `TENANT_ID` | `common` | Azure AD tenant ID |
| `managedIdentityClientId` | `MANAGED_IDENTITY_CLIENT_ID` | — | Managed identity client ID (`"system"` for system-assigned) |
| `port` | `PORT` | `3978` | HTTP listen port |
| `path` | — | `/api/messages` | Messages endpoint path |
| `auth` | — | auto | Enable inbound JWT auth (defaults to `true` when `CLIENT_ID` is set) |

## Documentation

- [Full documentation site](https://rido-min.github.io/botas/)
- [Full feature specification](https://github.com/rido-min/botas/blob/main/specs/README.md)
- [Architecture overview](https://github.com/rido-min/botas/blob/main/specs/Architecture.md)

## License

MIT
