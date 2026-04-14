---
outline: deep
---

# Typing Indicators

Show the bot is composing a reply, or react to user typing.

## Overview

Typing activities are ephemeral presence signals that indicate the bot or user is composing. They are useful for:

- **Showing typing indicators** when the bot processes a long-running operation (improves perceived responsiveness)
- **Reacting to user typing** (analytics, state management, or acknowledgments)

Typing activities differ from message activities in that they carry no text or persistent content — they are transient UI feedback.

For the full specification, see [specs/ActivityPayloads.md — typing](https://github.com/rido-min/botas/blob/main/specs/ActivityPayloads.md#typing).

---

## Sending Typing Indicators

Use `sendTyping()` / `SendTypingAsync()` / `send_typing()` on `TurnContext` to show a typing indicator. This is useful when processing takes a few seconds — it signals to the user that the bot is working.

::: code-group
```csharp [.NET]
app.On("message", async (ctx, ct) =>
{
    // Show typing indicator
    await ctx.SendTypingAsync(ct);
    
    // Simulate long-running work (e.g. database lookup, LLM inference)
    await Task.Delay(3000, ct);
    
    // Send the reply
    await ctx.SendAsync("Processing complete!", ct);
});
```

```typescript [Node.js]
app.on('message', async (ctx) => {
  // Show typing indicator
  await ctx.sendTyping()
  
  // Simulate long-running work
  await new Promise(resolve => setTimeout(resolve, 3000))
  
  // Send the reply
  await ctx.send('Processing complete!')
})
```

```python [Python]
@app.on("message")
async def on_message(ctx):
    # Show typing indicator
    await ctx.send_typing()
    
    # Simulate long-running work
    await asyncio.sleep(3)
    
    # Send the reply
    await ctx.send("Processing complete!")
```
:::

**Note:** .NET `SendTypingAsync()` returns `Task<string>` (the activity ID), but most bots ignore this value.

---

## Receiving Typing Activities

Register a handler to process incoming typing activities using the standard `on()` pattern. This is less common (most bots ignore inbound typing), but useful for analytics or state tracking.

::: code-group
```csharp [.NET]
app.On("typing", async (ctx, ct) =>
{
    Console.WriteLine($"{ctx.Activity.From?.Name} is typing...");
});
```

```typescript [Node.js]
app.on('typing', async (ctx) => {
  console.log(`${ctx.activity.from?.name} is typing...`)
})
```

```python [Python]
@app.on("typing")
async def on_typing(ctx):
    print(f"{ctx.activity.from_account.name} is typing...")
```
:::

---

## Unregistered Typing Activities

If no handler is registered for typing activities, they are silently ignored — the bot continues normally. You do not need to register a typing handler unless your bot needs to react to user typing.

---

## Tips

- **Don't overuse typing.** Sending a typing indicator every 500 milliseconds is noisy. Reserve it for operations that genuinely take 1–3+ seconds.
- **Combine with proactive delays.** If a message reply is delayed, send a typing indicator first to keep the user engaged.
- **Multiple sends are OK.** You can send typing multiple times in a single turn if the operation has distinct phases.

---

## See Also

- [Activity Payloads — typing](https://github.com/rido-min/botas/blob/main/specs/ActivityPayloads.md#typing) — JSON examples and semantics
- [Turn Context — sendTyping()](https://github.com/rido-min/botas/blob/main/specs/turn-context.md) — API reference
