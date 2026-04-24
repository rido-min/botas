# Typing Activity Sample

This sample demonstrates how to send and receive typing indicators in a Bot Service bot.

## Features

- **Receive typing indicators**: Handler fires when the user starts typing
- **Send typing indicators**: Bot sends typing activity before processing message to show it's "thinking"
- **Realistic bot behavior**: Simulates processing delay with typing indicator

## Running the Sample

```bash
dotnet run
```

## Usage

The bot demonstrates two patterns:

1. **Handling incoming typing**: The `OnTyping()` handler logs when the user is typing
2. **Sending typing before reply**: The message handler sends a typing indicator, waits 1.5 seconds to simulate processing, then replies

## Code Structure

```csharp
// Handle typing indicator from user
app.OnTyping(async (context, ct) =>
{
    Console.WriteLine($"User is typing in conversation {context.Activity.Conversation?.Id}");
    await context.SendTypingAsync(ct);
});

// Send typing indicator before replying to messages
app.On("message", async (context, ct) =>
{
    await context.SendTypingAsync(ct);
    await Task.Delay(1500, ct);
    await context.SendAsync($"You said: {context.Activity.Text}", ct);
});
```

## API Reference

### Handler Registration
- **`BotApplication.OnTyping(handler)`** — Syntactic sugar for `On("typing", handler)`
- **`BotApp.OnTyping(handler)`** — Wrapper for simplified API

### Sending Typing
- **`TurnContext.SendTypingAsync(ct)`** — Returns `Task<string>` (activity ID)
- Creates typing activity with routing fields from incoming activity
- Consistent with existing `SendAsync()` return type pattern
