
# BotAS — Bot ApplicationS

![BotAS logo: stylized blue and white square icon representing a bot application framework](art/icon-128.png)


A lightweight, multi-language library for building [Microsoft Bot Framework](https://learn.microsoft.com/azure/bot-service/) bots. Implementations exist for **.NET (C#)**, **TypeScript/Node.js**, and **Python**, with behavioral parity across all three.

📖 **[Full Documentation](https://rido-min.github.io/botas/)** — guides, API reference, and samples for all three languages.

## What it does

BotAS handles the plumbing so you can focus on bot logic:

- Validates inbound JWT tokens from the Bot Framework Service
- Deserializes activities and dispatches them to registered handlers
- Runs a configurable middleware pipeline before each handler
- Authenticates outbound HTTP calls using OAuth2 client credentials
- Preserves unknown JSON properties so custom channel data round-trips safely

## Getting started

### Prerequisites

- Azure AD app registration and Bot Framework channel registration — see [Infrastructure Setup](specs/Setup.md)
- A tunneling tool for local dev (Microsoft devtunnels or ngrok)
- Runtime for your chosen language:
  - .NET 10.0 SDK
  - Node.js 20+
  - Python 3.11+

### Environment variables

All three implementations read the same variables:

| Variable | Description |
|---|---|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID (or `common`) |
| `PORT` | HTTP listen port (default: `3978`) |

Copy `.env` from the repo root and fill in the values from your bot registration.

---

## Echo bot — quick start

### .NET

```csharp
using Botas;

var app = BotApp.Create(args);

app.On("message", async (ctx, ct) =>
{
    await ctx.SendAsync($"You said: {ctx.Activity.Text}", ct);
});

app.Run();
```

Run:
```bash
cd dotnet
dotnet run --project samples/EchoBot
```

For advanced ASP.NET Core integration scenarios (custom DI, middleware, or multi-bot hosting), see the [.NET language guide](https://rido-min.github.io/botas/languages/dotnet).

### Node.js

```typescript
import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.start()
```

Run:
```bash
cd node
npm install && npm run build
npx tsx samples/echo-bot/index.ts
```

For manual Express, Hono, or other framework integration, see the [Node.js language guide](https://rido-min.github.io/botas/languages/nodejs).

### Python

```python
from botas import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```

Run:
```bash
cd python/packages/botas
pip install -e ".[dev]"
cd ../../samples/echo-bot
python main.py
```

For manual FastAPI, aiohttp, or other framework integration, see the [Python language guide](https://rido-min.github.io/botas/languages/python).

---

## Repository layout

```
botas/
├── dotnet/           .NET library + ASP.NET Core integration + samples
├── node/             TypeScript library + Express and Hono samples
├── python/           Python library + FastAPI and aiohttp samples
├── specs/            Protocol specs, architecture, and setup docs
├── art/              Logo and icon assets
├── docs-site/        Jekyll documentation website
├── AGENTS.md         Guide for porting to new languages
└── README.md
```

---

## Teams features — mentions, cards & suggested actions

The `TeamsActivity` and `TeamsActivityBuilder` types provide a fluent API for common Teams scenarios. See the full spec at [specs/teams-activity.md](specs/teams-activity.md).

### .NET

```csharp
using Botas;

var reply = new TeamsActivityBuilder()
    .WithConversationReference(ctx.Activity)
    .WithText($"<at>{sender.Name}</at> said: {text}")
    .AddMention(sender)
    .WithAdaptiveCardAttachment(cardJson)
    .WithSuggestedActions(new SuggestedActions {
        Actions = [new CardAction { Type = "imBack", Title = "Yes", Value = "yes" }]
    })
    .Build();
await ctx.SendAsync(reply, ct);
```

### Node.js

```typescript
import { TeamsActivityBuilder } from 'botas'

const reply = new TeamsActivityBuilder()
  .withConversationReference(ctx.activity)
  .withText(`<at>${sender.name}</at> said: ${text}`)
  .addMention(sender)
  .withAdaptiveCardAttachment(cardJson)
  .withSuggestedActions({
    actions: [{ type: 'imBack', title: 'Yes', value: 'yes' }]
  })
  .build()
await ctx.send(reply)
```

### Python

```python
from botas import TeamsActivityBuilder
from botas.suggested_actions import SuggestedActions, CardAction

reply = (
    TeamsActivityBuilder()
    .with_conversation_reference(ctx.activity)
    .with_text(f"<at>{sender.name}</at> said: {text}")
    .add_mention(sender)
    .with_adaptive_card_attachment(card_json)
    .with_suggested_actions(SuggestedActions(
        actions=[CardAction(type="imBack", title="Yes", value="yes")]
    ))
    .build()
)
await ctx.send(reply)
```

Run the TeamsSample for any language:
```bash
cd dotnet && dotnet run --project samples/TeamsSample
cd node && npx tsx samples/teams-sample/index.ts
cd python/samples/teams-sample && python main.py
```

---

## Typing indicators

Show the bot is composing a reply (or react to user typing) with `sendTyping()` / `SendTypingAsync()` / `send_typing()`:

```csharp
// .NET
await ctx.SendTypingAsync(ct);
await Task.Delay(2000, ct);  // Long-running work
await ctx.SendAsync("Done!", ct);
```

```typescript
// Node.js
await ctx.sendTyping()
await new Promise(resolve => setTimeout(resolve, 2000))  // Long-running work
await ctx.send('Done!')
```

```python
# Python
await ctx.send_typing()
await asyncio.sleep(2)  # Long-running work
await ctx.send("Done!")
```

Typing activities are ephemeral presence signals — useful for improving perceived responsiveness on slow operations. See [Typing Indicators](docs-site/typing-activity.md) for more.

---

## AI bot — LLM integration with Azure Foundry

Each language has an AI bot sample that forwards messages to an LLM via Azure AI Foundry and maintains multi-turn conversation history.

### Environment variables (in addition to bot credentials)

| Variable | Description |
|---|---|
| `AZURE_OPENAI_ENDPOINT` | Azure Foundry resource endpoint (e.g. `https://<resource>.openai.azure.com`) |
| `AZURE_OPENAI_API_KEY` | API key for the deployed model |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment/model name (default: `gpt-4o`) |

### .NET (Azure.AI.OpenAI + Microsoft.Extensions.AI)

```csharp
using System.Collections.Concurrent;
using Azure.AI.OpenAI;
using Botas;
using Microsoft.Extensions.AI;

IChatClient chatClient = new AzureOpenAIClient(
    new Uri(endpoint), new System.ClientModel.ApiKeyCredential(apiKey))
    .GetChatClient(deployment)
    .AsIChatClient();

var history = new ConcurrentDictionary<string, List<ChatMessage>>();
var app = BotApp.Create(args);

app.On("message", async (ctx, ct) =>
{
    var msgs = history.GetOrAdd(ctx.Activity.Conversation!.Id!, _ => []);
    msgs.Add(new ChatMessage(ChatRole.User, ctx.Activity.Text ?? ""));
    var response = await chatClient.GetResponseAsync(msgs, cancellationToken: ct);
    msgs.Add(new ChatMessage(ChatRole.Assistant, response.Text ?? ""));
    await ctx.SendAsync(response.Text ?? "", ct);
});

app.Run();
```

```bash
cd dotnet && dotnet run --project samples/AiBot
```

### Node.js (Vercel AI SDK)

```typescript
import { BotApp } from 'botas-express'
import { azure } from '@ai-sdk/azure'
import { generateText, type CoreMessage } from 'ai'

const history = new Map<string, CoreMessage[]>()
const app = new BotApp()

app.on('message', async (ctx) => {
  const msgs = history.get(ctx.activity.conversation.id) ?? []
  msgs.push({ role: 'user', content: ctx.activity.text ?? '' })
  const { text } = await generateText({ model: azure('gpt-4o'), messages: msgs })
  msgs.push({ role: 'assistant', content: text })
  history.set(ctx.activity.conversation.id, msgs)
  await ctx.send(text)
})

app.start()
```

```bash
cd node && npx tsx samples/ai-bot/index.ts
```

### Python (LangChain)

```python
from botas_fastapi import BotApp
from langchain_azure_ai.chat_models import AzureAIChatCompletionsModel
from langchain_core.messages import AIMessage, HumanMessage

model = AzureAIChatCompletionsModel(endpoint=endpoint, credential=api_key, model=deployment)
history: dict[str, list] = {}
app = BotApp()

@app.on("message")
async def on_message(ctx):
    msgs = history.setdefault(ctx.activity.conversation.id, [])
    msgs.append(HumanMessage(content=ctx.activity.text or ""))
    response = await model.ainvoke(msgs)
    msgs.append(AIMessage(content=response.content))
    await ctx.send(response.content)

app.start()
```

```bash
cd python/samples/ai-bot && pip install -e . && python main.py
```

## Documentation

| Document | Description |
|---|---|
| [Full Documentation Site](https://rido-min.github.io/botas/) | Complete guides, API reference, and samples for all three languages |
| [Architecture](specs/Architecture.md) | Turn pipeline, two-auth model, middleware, schema |
| [Infrastructure Setup](specs/Setup.md) | Register a bot and get credentials using the Azure portal |
| [specs/README.md](specs/README.md) | Full feature specification and API surface per language |
| [AGENTS.md](AGENTS.md) | Porting guide for new language implementations |

## Additional documentation

| Document | Description |
|---|---|
| [Activity Payloads](specs/ActivityPayloads.md) | Annotated JSON examples for each activity type (`message`, `conversationUpdate`, `messageReaction`, `invoke`, `installationUpdate`, `typing`) |
| [Configuration](specs/Configuration.md) | Per-language configuration reference: env vars, DI wiring (.NET), options objects (Node), constructor args (Python), managed identity setup |
| [Middleware](specs/Middleware.md) | How to write and register middleware, execution order, short-circuiting, and example patterns |
| [Proactive Messaging](specs/ProactiveMessaging.md) | How to send messages outside of a turn using `ConversationClient` |
| [Samples](specs/Samples.md) | Walkthrough of each sample with annotated code and expected behavior |
| [Contributing](specs/Contributing.md) | Behavioral invariants, CI setup, how to add a new language port |

## Building and testing

```bash
# .NET
cd dotnet && dotnet build Botas && dotnet test

# Node
cd node && npm install && npm run build && npm test

# Python
cd python/packages/botas && pip install -e ".[dev]" && pytest

# All languages
./build-all.sh
```

CI runs all three on every push and pull request (see `.github/workflows/CI.yml`).
