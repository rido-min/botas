# 04-ai-langchain

Basic bot using **LangChain** with Azure OpenAI. Maintains per-conversation history.

## Environment variables

| Variable | Description |
|---|---|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource endpoint |
| `AZURE_OPENAI_API_KEY` | API key |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name (default: `gpt-4o`) |
| `OPENAI_API_VERSION` | API version (default: `2024-06-01`) |

## Run

```bash
npm install
npx tsx index.ts
```
