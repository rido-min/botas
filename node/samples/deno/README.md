# Deno Echo Bot

A minimal bot sample using [`@botas/core`](https://jsr.io/@botas/core) from JSR with Deno's built-in HTTP server — no frameworks or build step needed.

## Prerequisites

- [Deno](https://deno.land/) v2+
- A registered Bot Service app (see [setup guide](../../../specs/setup.md))

## Run

```bash
deno run --allow-net --allow-env --allow-read --allow-sys main.ts
```

With authentication enabled (recommended for production):

```bash
CLIENT_ID=<your-app-id> CLIENT_SECRET=<your-secret> TENANT_ID=<your-tenant> \
  deno run --allow-net --allow-env main.ts
```

The bot listens on `http://localhost:3978/api/messages`.

## How it works

This sample uses Deno's native `Deno.serve()` — no Express, Hono, or other framework required. The `@botas/core` package is imported via the local alias in `deno.json`:

```ts
import { BotApplication, validateBotToken, BotAuthError } from '@botas/core'
```

The bot:
1. Validates the incoming JWT token (when `CLIENT_ID` is set)
2. Dispatches the activity through the `BotApplication` pipeline
3. Echoes back any message the user sends

## Endpoints

| Method | Path            | Description          |
|--------|-----------------|----------------------|
| POST   | /api/messages   | Bot Framework endpoint |
| GET    | /health         | Health check         |
