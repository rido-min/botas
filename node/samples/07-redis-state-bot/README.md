# Redis State Bot

**Category:** 7 — Redis State Management
**Language:** Node.js
**Complexity:** Intermediate

This sample mirrors `06-state-bot` but persists state in Redis 7 using `botas-redis`.

## Prerequisites

- Docker
- Node.js 20+

## Run Redis

```bash
docker compose up -d
```

## Install and start

```bash
npm install
npm start
```

The bot listens on `http://localhost:3978/api/messages` by default. It supports the same counter contract as `06-state-bot`:

- Send any message to increment conversation and user counters.
- Send `whoami` to see your user counter.
- Send `reset` to clear the conversation counter.

## Stop Redis

```bash
# Stop containers and keep Redis state volume
docker compose down

# Stop containers and delete Redis state volume
docker compose down -v
```

## Learn More

- [State Management Guide](../../../docs-site/state.md)
- [TurnState Spec](../../../specs/turn-state.md)
