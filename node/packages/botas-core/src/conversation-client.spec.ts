import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { ConversationClient } from './conversation-client.js'

/**
 * Issue #280: Conversation IDs with semicolons must be URL-encoded, not truncated.
 */
describe('ConversationClient conversation ID encoding (#280)', () => {
  let server: Server
  let port: number
  let lastUrl: string

  async function startServer (): Promise<void> {
    server = createServer((req, res) => {
      lastUrl = req.url ?? ''
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ id: 'test-response' }))
    })
    await new Promise<void>((resolve) => server.listen(0, resolve))
    port = (server.address() as any).port
  }

  async function stopServer (): Promise<void> {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }

  it('sendCoreActivityAsync encodes semicolons in conversation ID', async () => {
    await startServer()
    try {
      const client = new ConversationClient()
      await client.sendCoreActivityAsync(
        `http://localhost:${port}`,
        'a]concat-123;messageid=9876',
        { type: 'message', text: 'hello' }
      )
      // Full conversation ID must be encoded — semicolon becomes %3B
      assert.ok(lastUrl.includes('%3B') || lastUrl.includes('%3b'), `URL should contain encoded semicolon: ${lastUrl}`)
      assert.ok(lastUrl.includes('messageid'), `URL should not truncate at semicolon: ${lastUrl}`)
    } finally {
      await stopServer()
    }
  })

  it('updateActivityAsync encodes semicolons in conversation ID', async () => {
    await startServer()
    try {
      const client = new ConversationClient()
      await client.updateCoreActivityAsync(
        `http://localhost:${port}`,
        'conv;with;semicolons',
        'activity-1',
        { type: 'message', text: 'updated' }
      )
      assert.ok(lastUrl.includes('%3B') || lastUrl.includes('%3b'), `URL should contain encoded semicolon: ${lastUrl}`)
      assert.ok(lastUrl.includes('semicolons'), `URL should not truncate at semicolon: ${lastUrl}`)
    } finally {
      await stopServer()
    }
  })
})
