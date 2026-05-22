# Redis State Bot

**Category:** 1 — Basic Bot  
**Language:** .NET  
**Complexity:** Intermediate  

## What This Sample Demonstrates

- Using `app.UseState(storage)` middleware to enable TurnState
- Persisting data to Redis with `RedisStorage`
- All three state scopes: conversation, user, and temp
- Clearing conversation state with the `reset` command
- Inspecting user state with the `whoami` command

## Prerequisites

- Docker
- .NET 10 SDK

## Run

Start Redis 7:

```bash
cd dotnet/samples/07-redis-state-bot
docker compose up -d
```

Run the bot:

```bash
dotnet run
```

The bot listens on **http://localhost:5006** by default.  
Endpoint: `POST http://localhost:5006/api/messages`

## Try It

Send a message and watch the counters increment:

```powershell
$activity = @{
    type = "message"
    text = "Hello bot!"
    from = @{ id = "user123"; name = "Test User" }
    recipient = @{ id = "bot"; name = "Redis State Bot" }
    conversation = @{ id = "conv456" }
    channelId = "emulator"
    serviceUrl = "http://localhost:5006"
} | ConvertTo-Json -Depth 5

Invoke-WebRequest -Uri "http://localhost:5006/api/messages" `
    -Method POST `
    -ContentType "application/json" `
    -Body $activity
```

Expected response:

```
🔢 Turn #1 | 💬 Your message #1
📝 You said: Hello bot!
```

Special commands:

- `reset` — clears conversation scope and resets the turn counter.
- `whoami` — shows your user ID and user-scoped message count.

## Stop Redis

Stop containers while preserving state in the Docker volume:

```bash
docker compose down
```

Reset state by removing the Docker volume:

```bash
docker compose down -v
```

## Learn More

- [State Management Guide](../../../docs-site/state.md)
- [TurnState Spec](../../../specs/turn-state.md)
- [Architecture](../../../specs/architecture.md)
