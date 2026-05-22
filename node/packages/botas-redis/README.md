# botas-redis

Redis-backed `Storage` provider for botas state.

## Install

```bash
npm install botas-redis
```

## Quick start

```ts
import { BotApp } from 'botas-express'
import { RedisStorage } from 'botas-redis'

const app = new BotApp()
const storage = new RedisStorage('redis://localhost:6379')

app.useState(storage)

process.once('SIGINT', async () => {
  await storage.close()
  process.exit(0)
})
```

Use a custom prefix when sharing Redis with other apps:

```ts
const storage = new RedisStorage('redis://localhost:6379', { keyPrefix: 'mybot:' })
```

Learn more in the [State Management Guide](../../../docs-site/state.md).
