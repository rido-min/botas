# 04 - AI Bot (LangChain + MCP)

A bot powered by LangChain's AzureChatOpenAI with Model Context Protocol (MCP) integration for tool use. This sample demonstrates how to combine LangChain's chain orchestration with MCP's standardized tool interface.

## Setup

Set these environment variables before running:

```bash
export AZURE_OPENAI_ENDPOINT="https://<your-resource>.openai.azure.com"
export AZURE_OPENAI_API_KEY="your-api-key"
export AZURE_OPENAI_DEPLOYMENT="gpt-4o"
export MCP_SERVER_COMMAND="npx"
export MCP_SERVER_ARGS="-y @anthropic-ai/mcp-server-fetch"
```

## Run

From the `node` directory:

```bash
npx tsx samples/04-ai-langchain-mcp/index.ts
```

Or with dev watch:

```bash
npm run dev --prefix samples/04-ai-langchain-mcp
```

## Features

- **LangChain integration** — uses LangChain's message types and model abstractions
- **MCP tool integration** — connects to any MCP server (fetch, filesystem, database, etc.)
- **Conversation history** — maintains per-conversation message history using LangChain's BaseMessage
- **Graceful degradation** — runs without MCP tools if server is unavailable
