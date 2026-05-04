// AI Bot — BotApp + LangChain with MCP Tools
// Run: npx tsx index.ts
// Env: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT, MCP_SERVER_COMMAND, MCP_SERVER_ARGS

import { BotApp } from 'botas-express'
import { AzureChatOpenAI } from '@langchain/openai'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { HumanMessage, AIMessage, type BaseMessage } from '@langchain/core/messages'

const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o'
const mcpCommand = process.env.MCP_SERVER_COMMAND ?? 'npx'
const mcpArgs = (process.env.MCP_SERVER_ARGS ?? '-y @anthropic-ai/mcp-server-fetch').split(' ')

const model = new AzureChatOpenAI({
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAIApiDeploymentName: deployment,
})

const conversationHistories = new Map<string, BaseMessage[]>()

let mcpTools: any[] = []

async function initMcp() {
  try {
    const transport = new StdioClientTransport({ command: mcpCommand, args: mcpArgs })
    const client = new Client({ name: 'botas-langchain-mcp', version: '1.0.0' })
    await client.connect(transport)
    const { tools } = await client.listTools()
    mcpTools = tools.map(tool => ({
      name: tool.name,
      description: tool.description ?? '',
      schema: tool.inputSchema,
    }))
    console.log(`MCP connected: ${mcpTools.length} tools available`)
  } catch (e) {
    console.log('MCP not available, running without tools:', (e as Error).message)
  }
}

const app = new BotApp()

app.on('message', async ctx => {
  const conversationId = ctx.activity.conversation.id
  const history = conversationHistories.get(conversationId) ?? []

  history.push(new HumanMessage(ctx.activity.text ?? ''))

  const response = await model.invoke(history)

  history.push(new AIMessage(response.content as string))
  conversationHistories.set(conversationId, history)

  await ctx.send(typeof response.content === 'string' ? response.content : JSON.stringify(response.content))
})

await initMcp()
app.start()
