# 04 - AI Bot (Microsoft.Extensions.AI + Azure OpenAI)

Conversational AI bot using Microsoft.Extensions.AI abstraction with Azure OpenAI.

## How it works

- Uses `IChatClient` from Microsoft.Extensions.AI for provider-agnostic LLM access
- Maintains per-conversation chat history via `ConcurrentDictionary`
- Azure OpenAI provides the model backend (configurable deployment)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource endpoint |
| `AZURE_OPENAI_API_KEY` | API key for authentication |
| `AZURE_OPENAI_DEPLOYMENT` | Model deployment name (default: `gpt-4o`) |

## Run

```bash
cd dotnet && dotnet run --project samples/04-ai-openai
```
