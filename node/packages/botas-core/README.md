# botas-core

A lightweight, multi-language library for building [Microsoft Teams](https://learn.microsoft.com/en-us/microsoftteams/platform/) bots — this is the **core** Node.js/TypeScript package.

> For zero-boilerplate Express hosting, see [`botas-express`](https://www.npmjs.com/package/botas-express).

## Installation

```bash
npm install botas-core
```

### Deno (via JSR)

```bash
deno add jsr:@botas/core
```

Or use the npm specifier directly:

```typescript
import { BotApplication } from "npm:botas-core"
```

## Quick start (with Express)

```typescript
import express from 'express'
import { BotApplication } from 'botas-core'
import { botAuthExpress } from 'botas-express'

const bot = new BotApplication()

bot.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

const server = express()
server.post('/api/messages', botAuthExpress(), (req, res) => {
  bot.processAsync(req, res)
})

server.listen(3978)
```

Or use the higher-level [`botas-express`](https://www.npmjs.com/package/botas-express) wrapper for zero-boilerplate hosting:

```typescript
// npm install botas-express
import { BotApp } from 'botas-express'
// ...see botas-express README for full example
```

## API

### `BotApplication`

The core bot class — web-server-agnostic.

| Method | Description |
|---|---|
| `on(type, handler)` | Register a handler for an activity type (e.g. `"message"`, `"conversationUpdate"`) |
| `onInvoke(name, handler)` | Register a handler for an invoke activity by name (e.g. `"adaptiveCard/action"`) |
| `use(middleware)` | Add a middleware to the turn pipeline (runs in registration order) |
| `processAsync(req, res)` | Process an incoming HTTP request (Express / Node.js `http.Server`) |
| `processBody(body)` | Process a raw JSON body — for frameworks that manage their own response lifecycle (e.g. Hono) |

### Authentication options

Credentials are resolved from constructor options or environment variables:

| Option | Env variable | Description |
|---|---|---|
| `clientId` | `CLIENT_ID` | Azure AD application (bot) ID |
| `clientSecret` | `CLIENT_SECRET` | Azure AD client secret |
| `tenantId` | `TENANT_ID` | Azure AD tenant ID (default: `common`) |
| `managedIdentityClientId` | `MANAGED_IDENTITY_CLIENT_ID` | Managed identity client ID (`"system"` for system-assigned) |
| `token` | — | Custom token factory `(scope, tenantId) => Promise<string>` |

Credential resolution:

| clientId | clientSecret | managedIdentityClientId | Result |
|---|---|---|---|
| not set | — | — | No auth (dev/testing only) |
| set | set | — | Client secret |
| set | not set | — | User managed identity |
| set | not set | different | Federated identity (user MI) |
| set | not set | `"system"` | Federated identity (system MI) |

## Documentation

- [Full documentation site](https://rido-min.github.io/botas/)
- [Full feature specification](https://github.com/rido-min/botas/blob/main/specs/README.md)
- [Architecture overview](https://github.com/rido-min/botas/blob/main/specs/architecture.md)
- [Infrastructure setup](https://github.com/rido-min/botas/blob/main/specs/setup.md)

## License

MIT
