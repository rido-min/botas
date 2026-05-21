# State Bot

**Category:** 1 — Basic Bot  
**Language:** Python  
**Complexity:** Basic

## What This Sample Demonstrates

- **TurnState** with conversation, user, and temp scopes
- **FileStorage** backend persisting state to `./state-data/` as JSON files
- Conversation-wide turn counter
- Per-user message counter
- Special commands: `reset` and `whoami`
- **Offline mode**: When `CLIENT_ID` is not set, bot replies are logged to console instead of sent to Bot Service

## Prerequisites

- Python 3.8+
- No Azure credentials needed for local testing (runs in offline mode)
- **Optional**: Set `CLIENT_ID` and `CLIENT_SECRET` environment variables to enable real Bot Service communication

## Run

```bash
cd python/samples/06-state-bot
pip install -e .
python main.py
```

The bot listens on **http://localhost:3978/api/messages** by default.

## Key Files

- `main.py` — Bot setup, state middleware registration, and message handler

## Try It

When running **without `CLIENT_ID`** (offline mode), the bot logs replies to console instead of sending them to Bot Service. State files are still persisted correctly.

### Send a message

```bash
curl -X POST http://localhost:3978/api/messages \
  -H "Content-Type: application/json" \
  -d '{"type":"message","text":"Hello!","from":{"id":"user-123","name":"Test"},"recipient":{"id":"bot-456","name":"Bot"},"conversation":{"id":"conv-789"},"channelId":"emulator","serviceUrl":"http://localhost:3978"}'
```

**Expected**: 
- Bot returns `{}` (200 OK)
- Console shows: `[OFFLINE] Would send: Turn #1 | Your message #1: Hello!`
- State is persisted to `./state-data/`

### Check persistence

Inspect the `./state-data/` directory. You'll see percent-encoded JSON files:

- `emulator%2Fbot-456%2Fconversations%2Fconv-789.json` — conversation scope (turn_count)
- `emulator%2Fbot-456%2Fusers%2Fuser-123.json` — user scope (user_message_count)

**Example conversation state (after 2 messages):**

```json
{"turn_count": 2}
```

**Example user state (after 2 messages):**

```json
{"user_message_count": 2}
```

Restart the bot and send another message — counters resume from persisted values.

### Reset counters

```bash
curl -X POST http://localhost:3978/api/messages \
  -H "Content-Type: application/json" \
  -d '{"type":"message","text":"reset","from":{"id":"user-123","name":"Test"},"recipient":{"id":"bot-456","name":"Bot"},"conversation":{"id":"conv-789"},"channelId":"emulator","serviceUrl":"http://localhost:3978"}'
```

**Expected**: 
- Console shows: `[OFFLINE] Would send: ✅ Conversation state cleared. Counters reset.`
- The conversation state file will be updated (turn_count removed), but user state persists

## State Scopes

- **Conversation** (`ctx.state.conversation`) — Shared across all participants in the conversation. Used for turn counters, dialog flow state.
- **User** (`ctx.state.user`) — Tracks data per user across all conversations. Used for user preferences, message counts.
- **Temp** (`ctx.state.temp`) — Ephemeral, per-turn only. Never persisted. Used for intermediate values during turn processing.

## Learn More

- [State Management Guide](../../../docs-site/state.md) — Detailed patterns, API reference, storage adapters
- [TurnState Spec](../../../specs/turn-state.md) — Technical architecture and lifecycle
