# State Bot

**Category:** 6 — State Management
**Language:** Node.js
**Complexity:** Intermediate

## What This Sample Demonstrates

- TurnState with three scopes (conversation, user, temp)
- FileStorage for persistent state on disk
- Counter tracking across turns and users
- Special commands for reset and user info
- Inspecting state files with percent-encoded filenames

This sample shows how to persist conversation and user state across turns using `TurnState` with `FileStorage`. State files are written to `./state-data/` with percent-encoded filenames for cross-language compatibility.

## Prerequisites

- Node.js 20+
- Azure Bot Service credentials (CLIENT_ID, CLIENT_SECRET) — required to send replies back to the channel
- For local testing with Bot Framework Emulator, set environment variables or use a `.env` file (not included)

To run without sending replies (just verify state persistence):
```bash
# State will be saved, but ctx.send() will fail without credentials
export CLIENT_ID="dummy"
export CLIENT_SECRET="dummy"
npx tsx index.ts
```

## How to Run

```bash
# From this directory
npx tsx index.ts
```

The bot listens on `http://localhost:3978/api/messages` by default.

## Try It

Send messages to the bot using curl or Bot Framework Emulator:

### 1. Send a message

```bash
curl -X POST http://localhost:3978/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message",
    "id": "msg-001",
    "channelId": "emulator",
    "from": {"id": "user-123", "name": "Alice"},
    "recipient": {"id": "bot-456", "name": "StateBot"},
    "conversation": {"id": "conv-789"},
    "text": "Hello!",
    "serviceUrl": "http://localhost:3978"
  }'
```

**Expected response:** `Turn #1 | Your message #1: Hello!`

### 2. Send another message

```bash
curl -X POST http://localhost:3978/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message",
    "id": "msg-002",
    "channelId": "emulator",
    "from": {"id": "user-123", "name": "Alice"},
    "recipient": {"id": "bot-456", "name": "StateBot"},
    "conversation": {"id": "conv-789"},
    "text": "How are you?",
    "serviceUrl": "http://localhost:3978"
  }'
```

**Expected response:** `Turn #2 | Your message #2: How are you?`

### 3. Check your user stats

```bash
curl -X POST http://localhost:3978/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message",
    "id": "msg-003",
    "channelId": "emulator",
    "from": {"id": "user-123", "name": "Alice"},
    "recipient": {"id": "bot-456", "name": "StateBot"},
    "conversation": {"id": "conv-789"},
    "text": "whoami",
    "serviceUrl": "http://localhost:3978"
  }'
```

**Expected response:** `You are user-123. You have sent 3 message(s).`

### 4. Reset the conversation counter

```bash
curl -X POST http://localhost:3978/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message",
    "id": "msg-004",
    "channelId": "emulator",
    "from": {"id": "user-123", "name": "Alice"},
    "recipient": {"id": "bot-456", "name": "StateBot"},
    "conversation": {"id": "conv-789"},
    "text": "reset",
    "serviceUrl": "http://localhost:3978"
  }'
```

**Expected response:** `Counters reset!`

## Inspect State Files

After sending messages, check the `./state-data/` directory. You'll see JSON files with percent-encoded names like:

```
emulator%2Fbot-456%2Fconversations%2Fconv-789.json         (conversation state)
emulator%2Fbot-456%2Fusers%2Fuser-123.json                 (user state)
```

These files contain the persisted state:

**Conversation state (`emulator%2Fbot-456%2Fconversations%2Fconv-789.json`):**
```json
{
  "turn_count": 2
}
```

**User state (`emulator%2Fbot-456%2Fusers%2Fuser-123.json`):**
```json
{
  "user_message_count": 3
}
```

**Note:** Temp scope is never persisted, so you won't see temp state in files.

## Cross-Language Parity

The `.NET`, `Node.js`, and `Python` implementations use identical:
- State key encoding (RFC 3986 percent-encoding via `encodeURIComponent`)
- Field names (`turn_count`, `user_message_count`)
- Commands (`reset`, `whoami`)
- Storage directory (`./state-data`)

You can restart this bot and it will remember the counters from the previous session. Try stopping the bot, restarting it, and sending another message — the turn count picks up where it left off.

## Key Files

- `index.ts` — Bot setup with state middleware and message handler

## Learn More

- [State Management Guide](../../docs-site/state.md)
- [TurnState Spec](../../specs/turn-state.md)
- [Architecture](../../specs/architecture.md)
