# Redis State Bot

**Category:** 1 — Basic Bot  
**Language:** Python  
**Complexity:** Basic

## What This Sample Demonstrates

- **TurnState** with conversation, user, and temp scopes
- **RedisStorage** backend persisting state to Redis 7
- Conversation-wide turn counter
- Per-user message counter
- Special commands: `reset` and `whoami`
- **Offline mode**: When `CLIENT_ID` is not set, bot replies are logged to console instead of sent to Bot Service

## Prerequisites

- Docker
- Python 3.9+
- No Azure credentials needed for local testing (runs in offline mode)
- **Optional**: Set `CLIENT_ID` and `CLIENT_SECRET` environment variables to enable real Bot Service communication

## Run

```bash
cd python/samples/07-redis-state-bot
docker compose up -d
pip install -e .
python main.py
```

The bot listens on **http://localhost:3978/api/messages** by default and uses Redis at **redis://localhost:6379**.

## Key Files

- `main.py` — Bot setup, Redis state middleware registration, and message handler
- `docker-compose.yml` — Local Redis 7 service with append-only persistence

## Try It

When running **without `CLIENT_ID`** (offline mode), the bot logs replies to console instead of sending them to Bot Service. State is still persisted in Redis.

### Send a message

```bash
curl -X POST http://localhost:3978/api/messages \
  -H "Content-Type: application/json" \
  -d '{"type":"message","text":"Hello!","from":{"id":"user-123","name":"Test"},"recipient":{"id":"bot-456","name":"Bot"},"conversation":{"id":"conv-789"},"channelId":"emulator","serviceUrl":"http://localhost:3978"}'
```

**Expected**:

- Bot returns `{}` (200 OK)
- Console shows: `[OFFLINE] Would send: Turn #1 | Your message #1: Hello!`
- State is persisted to Redis keys with the `botas:` prefix

Restart the bot and send another message — counters resume from persisted values.

### Reset counters

```bash
curl -X POST http://localhost:3978/api/messages \
  -H "Content-Type: application/json" \
  -d '{"type":"message","text":"reset","from":{"id":"user-123","name":"Test"},"recipient":{"id":"bot-456","name":"Bot"},"conversation":{"id":"conv-789"},"channelId":"emulator","serviceUrl":"http://localhost:3978"}'
```

**Expected**:

- Console shows: `[OFFLINE] Would send: ✅ Conversation state cleared. Counters reset.`
- Conversation state is cleared, but user state persists

## Stop Redis

```bash
docker compose down
```

This stops Redis but keeps the Docker volume, so state remains available next time.

To reset all Redis state:

```bash
docker compose down -v
```

## State Scopes

- **Conversation** (`ctx.state.conversation`) — Shared across all participants in the conversation. Used for turn counters, dialog flow state.
- **User** (`ctx.state.user`) — Tracks data per user across all conversations. Used for user preferences, message counts.
- **Temp** (`ctx.state.temp`) — Ephemeral, per-turn only. Never persisted. Used for intermediate values during turn processing.

## Learn More

- [State Management Guide](../../../docs-site/state.md) — Detailed patterns, API reference, storage adapters
- [TurnState Spec](../../../specs/turn-state.md) — Technical architecture and lifecycle
