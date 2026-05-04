# 04 - AI Bot (Vercel AI SDK + Azure OpenAI)

A simple bot powered by Vercel AI SDK with Azure OpenAI as the backend model provider. This sample demonstrates streaming, tool calling, and provider-agnostic LLM integration.

## Setup

Set these environment variables before running:

```bash
export AZURE_OPENAI_ENDPOINT="https://<your-resource>.openai.azure.com"
export AZURE_OPENAI_API_KEY="your-api-key"
export AZURE_OPENAI_DEPLOYMENT="gpt-4o"
```

## Run

From the `node` directory:

```bash
npx tsx samples/04-ai-vercel/index.ts
```

Or with dev watch:

```bash
npm run dev --prefix samples/04-ai-vercel
```

## Features

- **Streaming responses** — streaming text generation from Azure OpenAI
- **Tool calling** — structured function calling with Vercel AI SDK
- **Provider-agnostic** — easily swap to other OpenAI-compatible providers (Anthropic, Ollama, etc.)
- **Conversation history** — maintains per-conversation context
