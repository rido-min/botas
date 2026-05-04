# 04 - AI Bot (Microsoft Agent Framework)

Conversational AI bot using the [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) with Azure AI Foundry.

## How it works

- Uses `Agent` + `FoundryChatClient` from the Agent Framework
- Maintains multi-turn conversation state via `AgentSession`
- Authenticates with Azure using `DefaultAzureCredential` (supports managed identity, CLI, env vars)
- Azure AI Foundry provides the model backend

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AZURE_AI_ENDPOINT` | Azure AI Foundry project endpoint |
| `AZURE_OPENAI_DEPLOYMENT` | Model deployment name (default: `gpt-4o`) |

Authentication is handled by `DefaultAzureCredential` — ensure you're logged in via `az login` or have appropriate environment variables set.

## Run

```bash
cd python/samples/04-ai-agent-framework && python main.py
```

## Learn More

- [Agent Framework docs](https://aka.ms/agent-framework)
- [Azure AI Foundry](https://ai.azure.com)
