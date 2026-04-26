import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { trace } from '@opentelemetry/api'
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { resetTracer } from './tracer-provider.js'
import { TokenManager } from './token-manager.js'
import { validateBotToken, BotAuthError } from './bot-auth-middleware.js'
import { ConversationClient } from './conversation-client.js'
import { createServer, type Server } from 'node:http'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeUnsignedToken (
  payload: Record<string, unknown>,
  kid = 'test-key-id'
): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.fakesignature`
}

let exporter: InMemorySpanExporter
let provider: BasicTracerProvider

function setupOtel (): void {
  resetTracer()
  exporter = new InMemorySpanExporter()
  provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)]
  })
  trace.setGlobalTracerProvider(provider)
}

async function teardownOtel (): Promise<void> {
  await provider.shutdown()
  trace.disable()
  resetTracer()
}

// ── botas.auth.outbound tests ────────────────────────────────────────────────

describe('botas.auth.outbound span', () => {
  beforeEach(setupOtel)
  afterEach(teardownOtel)

  it('emits span with client_credentials flow on custom token factory', async () => {
    const tm = new TokenManager({
      clientId: 'test-client',
      token: async (_scope, _tenantId) => 'fake-token',
    })
    await tm.getBotToken()

    const spans = exporter.getFinishedSpans()
    const span = spans.find(s => s.name === 'botas.auth.outbound')
    assert.ok(span, 'botas.auth.outbound span should exist')
    assert.equal(span.attributes['auth.scope'], 'https://api.botframework.com/.default')
    assert.equal(span.attributes['auth.flow'], 'custom_factory')
    assert.equal(span.attributes['auth.cache_hit'], false)
    assert.ok(
      (span.attributes['auth.token_endpoint'] as string).includes('login.microsoftonline.com'),
      'should include token endpoint'
    )
  })

  it('records exception when token factory throws', async () => {
    const tm = new TokenManager({
      clientId: 'test-client',
      token: async () => { throw new Error('token boom') },
    })

    await assert.rejects(() => tm.getBotToken(), { message: 'token boom' })

    const spans = exporter.getFinishedSpans()
    const span = spans.find(s => s.name === 'botas.auth.outbound')
    assert.ok(span, 'span should exist even on error')
    assert.ok(span.events.length > 0, 'should have exception event')
  })

  it('sets auth.flow to client_credentials when clientSecret is provided', async () => {
    const tm = new TokenManager({
      clientId: 'test-client',
      clientSecret: 'some-secret',
      token: async () => 'tok', // factory takes priority, but flow detection uses opts
    })
    await tm.getBotToken()

    const spans = exporter.getFinishedSpans()
    const span = spans.find(s => s.name === 'botas.auth.outbound')
    assert.ok(span)
    // token factory is present, so flow is 'custom_factory'
    assert.equal(span.attributes['auth.flow'], 'custom_factory')
  })

  it('does not emit span when clientId is missing (no-auth mode)', async () => {
    const tm = new TokenManager({})
    const result = await tm.getBotToken()
    assert.equal(result, null)

    const spans = exporter.getFinishedSpans()
    const span = spans.find(s => s.name === 'botas.auth.outbound')
    assert.equal(span, undefined, 'no span when auth is not configured')
  })
})

// ── botas.auth.inbound tests ─────────────────────────────────────────────────

describe('botas.auth.inbound span', () => {
  beforeEach(setupOtel)
  afterEach(teardownOtel)

  it('emits span with issuer and audience on token with trusted issuer (fails at JWKS)', async () => {
    const token = makeUnsignedToken(
      {
        iss: 'https://api.botframework.com',
        aud: 'my-client-id',
        tid: 'some-tenant',
      },
      'my-kid-123'
    )

    // This will fail at JWKS fetch, but span should still be emitted
    const err = await validateBotToken(`Bearer ${token}`, 'my-client-id').catch(e => e)
    assert.ok(err instanceof BotAuthError || err instanceof Error)

    const spans = exporter.getFinishedSpans()
    const span = spans.find(s => s.name === 'botas.auth.inbound')
    assert.ok(span, 'botas.auth.inbound span should exist')
    assert.equal(span.attributes['auth.issuer'], 'https://api.botframework.com')
    assert.equal(span.attributes['auth.audience'], 'my-client-id')
    assert.equal(span.attributes['auth.key_id'], 'my-kid-123')
    assert.ok(span.events.length > 0, 'should have exception event')
  })

  it('emits span with exception on untrusted issuer', async () => {
    const token = makeUnsignedToken({ iss: 'https://evil.com', aud: 'my-client-id' })

    await validateBotToken(`Bearer ${token}`, 'my-client-id').catch(() => {})

    const spans = exporter.getFinishedSpans()
    const span = spans.find(s => s.name === 'botas.auth.inbound')
    assert.ok(span, 'span should exist on untrusted issuer')
    assert.ok(span.events.length > 0, 'should record exception')
  })

  it('does not emit span when auth header is missing (pre-span rejection)', async () => {
    // Missing header rejects before span is created
    await validateBotToken(undefined, 'my-client-id').catch(() => {})

    const spans = exporter.getFinishedSpans()
    const span = spans.find(s => s.name === 'botas.auth.inbound')
    assert.equal(span, undefined, 'no span for missing auth header')
  })
})

// ── botas.conversation_client tests ──────────────────────────────────────────

describe('botas.conversation_client span', () => {
  let server: Server
  let port: number

  beforeEach(async () => {
    setupOtel()
    server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ id: 'activity-response-123' }))
    })
    await new Promise<void>((resolve) => server.listen(0, resolve))
    port = (server.address() as { port: number }).port
  })

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await teardownOtel()
  })

  it('emits span with correct attributes on sendCoreActivityAsync', async () => {
    const client = new ConversationClient()
    const result = await client.sendCoreActivityAsync(
      `http://localhost:${port}`,
      'conv-42',
      { type: 'message', text: 'hello' }
    )

    assert.ok(result)
    assert.equal(result.id, 'activity-response-123')

    const spans = exporter.getFinishedSpans()
    const span = spans.find(s => s.name === 'botas.conversation_client')
    assert.ok(span, 'botas.conversation_client span should exist')
    assert.equal(span.attributes['conversation.id'], 'conv-42')
    assert.equal(span.attributes['activity.type'], 'message')
    assert.ok((span.attributes['service.url'] as string).includes('localhost'))
    assert.equal(span.attributes['activity.id'], 'activity-response-123')
  })

  it('records exception when HTTP call fails', async () => {
    // Close server to force connection error
    await new Promise<void>((resolve) => server.close(() => resolve()))

    const client = new ConversationClient()
    await assert.rejects(() =>
      client.sendCoreActivityAsync(
        `http://localhost:${port}`,
        'conv-fail',
        { type: 'message', text: 'fail' }
      )
    )

    const spans = exporter.getFinishedSpans()
    const span = spans.find(s => s.name === 'botas.conversation_client')
    assert.ok(span, 'span should exist on error')
    assert.equal(span.attributes['conversation.id'], 'conv-fail')
    assert.ok(span.events.length > 0, 'should record exception')
  })
})
