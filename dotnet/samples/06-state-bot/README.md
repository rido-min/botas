# State Bot

**Category:** 1 — Basic Bot  
**Language:** .NET  
**Complexity:** Intermediate  

## What This Sample Demonstrates

- Using `app.UseState(storage)` middleware to enable TurnState
- Persisting data to disk with `FileStorage`
- All three state scopes:
  - **Conversation scope** — turn counter shared across all users
  - **User scope** — per-user message count that follows the user across conversations
  - **Temp scope** — ephemeral per-turn data (never persisted)
- Clearing conversation state with the `reset` command
- Inspecting user state with the `whoami` command

## What You'll Learn

After running this sample, you'll understand:

1. How state automatically loads at turn start and saves at turn end
2. How each scope has different lifetime and persistence behavior
3. How to inspect the actual JSON files on disk (see `./state-data/` directory)
4. How state survives bot restarts (persistence)

## Prerequisites

- .NET 10.0+
- No Azure credentials needed for local testing with FileStorage

## Run

```bash
cd dotnet/samples/06-state-bot
dotnet run
```

The bot listens on **http://localhost:3978** by default.  
Endpoint: `POST http://localhost:3978/api/messages`

## Try It

### 1. Send a few messages

Send 3-4 messages and watch the counters increment:

**PowerShell:**

```powershell
$activity = @{
    type = "message"
    text = "Hello bot!"
    from = @{ id = "user123"; name = "Test User" }
    recipient = @{ id = "bot"; name = "State Bot" }
    conversation = @{ id = "conv456" }
    channelId = "emulator"
    serviceUrl = "http://localhost:3978"
} | ConvertTo-Json -Depth 5

Invoke-WebRequest -Uri "http://localhost:3978/api/messages" `
    -Method POST `
    -ContentType "application/json" `
    -Body $activity
```

**Bash/curl:**

```bash
curl -X POST http://localhost:3978/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message",
    "text": "Hello bot!",
    "from": { "id": "user123", "name": "Test User" },
    "recipient": { "id": "bot", "name": "State Bot" },
    "conversation": { "id": "conv456" },
    "channelId": "emulator",
    "serviceUrl": "http://localhost:3978"
  }'
```

**Expected response:**

```
🔢 Turn #1 | 💬 Your message #1
📝 You said: Hello bot!
```

Send again:

```
🔢 Turn #2 | 💬 Your message #2
📝 You said: Hello bot!
```

### 2. Inspect the state files on disk

After sending a few messages, look in the `./state-data/` directory:

```powershell
Get-ChildItem ./state-data/*.json
```

You'll see files with percent-encoded names (RFC 3986), like:

```
emulator%2Fbot%2Fconversations%2Fconv456.json  # conversation scope
emulator%2Fbot%2Fusers%2Fuser123.json          # user scope
```

**View the conversation state:**

```powershell
Get-Content ./state-data/emulator%2Fbot%2Fconversations%2Fconv456.json
```

Output:

```json
{"turn_count":2}
```

**View the user state:**

```powershell
Get-Content ./state-data/emulator%2Fbot%2Fusers%2Fuser123.json
```

Output:

```json
{"user_message_count":2}
```

### 3. Verify persistence across restarts

1. Send a few messages (turn count: 3)
2. Stop the bot (Ctrl+C)
3. Restart it (`dotnet run`)
4. Send another message → you'll see turn count continue from 4 (not reset to 1)

This proves state is persisted to disk and survives restarts.

### 4. Special commands

**`reset`** — Clears conversation scope (resets turn counter):

```powershell
$activity = @{
    type = "message"
    text = "reset"
    from = @{ id = "user123"; name = "Test User" }
    recipient = @{ id = "bot"; name = "State Bot" }
    conversation = @{ id = "conv456" }
    channelId = "emulator"
    serviceUrl = "http://localhost:3978"
} | ConvertTo-Json -Depth 5

Invoke-WebRequest -Uri "http://localhost:3978/api/messages" `
    -Method POST `
    -ContentType "application/json" `
    -Body $activity
```

Response: `✅ Conversation state cleared. Counters reset.`

Next message will show `Turn #1` again.

**`whoami`** — Shows your user ID and message count:

```powershell
$activity = @{
    type = "message"
    text = "whoami"
    from = @{ id = "user123"; name = "Test User" }
    recipient = @{ id = "bot"; name = "State Bot" }
    conversation = @{ id = "conv456" }
    channelId = "emulator"
    serviceUrl = "http://localhost:3978"
} | ConvertTo-Json -Depth 5

Invoke-WebRequest -Uri "http://localhost:3978/api/messages" `
    -Method POST `
    -ContentType "application/json" `
    -Body $activity
```

Response:

```
👤 User ID: user123
📊 Your message count: 5
```

## Key Files

- `Program.cs` — Bot setup, state registration, handler with all three scopes
- `./state-data/` — Directory where FileStorage persists JSON files (created on first run)

## Learn More

- [State Management Guide](../../../docs-site/state.md) — Conceptual guide with patterns
- [TurnState Spec](../../../specs/turn-state.md) — Technical specification
- [Architecture](../../../specs/architecture.md) — How state fits into the turn pipeline

## What's Next

- Try using `MemoryStorage()` instead of `FileStorage()` (no persistence across restarts)
- Experiment with user scope: send messages from different user IDs and see how each user's counter is independent
- Add your own state keys to track conversation history, user preferences, etc.
