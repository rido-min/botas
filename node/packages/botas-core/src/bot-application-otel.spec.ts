import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { trace } from '@opentelemetry/api'
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { BotApplication } from './bot-application.js'
import type { CoreActivity } from './core-activity.js'
import type { TurnContext } from './turn-context.js'
import { resetTracer } from './tracer-provider.js'

const baseCoreActivity: CoreActivity = {
  type: 'message',
  id: 'act-001',
  channelId: 'msteams',
  serviceUrl: 'https://smba.trafficmanager.botframework.com/api',
  from: { id: 'user1' },
  recipient: { id: 'bot1' },
  conversation: { id: 'conv1' },
  text: 'hello',
}

function makeBody (overrides: Partial<CoreActivity> = {}): string {
  return JSON.stringify({ ...baseCoreActivity, ...overrides })
}

describe('BotApplication OTel spans', () => {
  let exporter: InMemorySpanExporter
  let provider: BasicTracerProvider

  beforeEach(() => {
    resetTracer()
    exporter = new InMemorySpanExporter()
    provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)]
    })
    trace.setGlobalTracerProvider(provider)
  })

  afterEach(async () => {
    await provider.shutdown()
    trace.disable()
    resetTracer()
  })

  it('emits botas.turn span with correct attributes', async () => {
    const bot = new BotApplication({ clientId: 'test-bot-id' })
    bot.on('message', async () => {})
    await bot.processBody(makeBody())

    const spans = exporter.getFinishedSpans()
    const turnSpan = spans.find(s => s.name === 'botas.turn')
    assert.ok(turnSpan, 'botas.turn span should exist')
    assert.equal(turnSpan.attributes['activity.type'], 'message')
    assert.equal(turnSpan.attributes['activity.id'], 'act-001')
    assert.equal(turnSpan.attributes['conversation.id'], 'conv1')
    assert.equal(turnSpan.attributes['channel.id'], 'msteams')
    assert.equal(turnSpan.attributes['bot.id'], 'test-bot-id')
  })

  it('emits botas.middleware span for each registered middleware', async () => {
    const bot = new BotApplication()
    async function loggingMiddleware (_ctx: TurnContext, next: () => Promise<void>) { await next() }
    bot.use(loggingMiddleware)
    bot.use(async (_ctx, next) => { await next() }) // anonymous
    bot.on('message', async () => {})
    await bot.processBody(makeBody())

    const spans = exporter.getFinishedSpans()
    const mwSpans = spans
      .filter(s => s.name === 'botas.middleware')
      .sort((a, b) => (a.attributes['middleware.index'] as number) - (b.attributes['middleware.index'] as number))
    assert.equal(mwSpans.length, 2, 'should have 2 middleware spans')

    // First middleware: named function
    assert.equal(mwSpans[0]!.attributes['middleware.name'], 'loggingMiddleware')
    assert.equal(mwSpans[0]!.attributes['middleware.index'], 0)

    // Second middleware: anonymous — fallback name
    const mw1Name = mwSpans[1]!.attributes['middleware.name'] as string
    assert.ok(mw1Name, 'second middleware should have a name')
    assert.equal(mwSpans[1]!.attributes['middleware.index'], 1)
  })

  it('emits botas.handler span with type dispatch', async () => {
    const bot = new BotApplication()
    bot.on('message', async () => {})
    await bot.processBody(makeBody())

    const spans = exporter.getFinishedSpans()
    const handlerSpan = spans.find(s => s.name === 'botas.handler')
    assert.ok(handlerSpan, 'botas.handler span should exist')
    assert.equal(handlerSpan.attributes['handler.type'], 'message')
    assert.equal(handlerSpan.attributes['handler.dispatch'], 'type')
  })

  it('emits botas.handler span with catchall dispatch', async () => {
    const bot = new BotApplication()
    bot.onActivity = async () => {}
    await bot.processBody(makeBody())

    const spans = exporter.getFinishedSpans()
    const handlerSpan = spans.find(s => s.name === 'botas.handler')
    assert.ok(handlerSpan, 'botas.handler span should exist')
    assert.equal(handlerSpan.attributes['handler.dispatch'], 'catchall')
  })

  it('emits botas.handler span with invoke dispatch', async () => {
    const bot = new BotApplication()
    bot.onInvoke('task/fetch', async () => ({ status: 200, body: { ok: true } }))
    const result = await bot.processBody(makeBody({ type: 'invoke', name: 'task/fetch' }))

    const spans = exporter.getFinishedSpans()
    const handlerSpan = spans.find(s => s.name === 'botas.handler')
    assert.ok(handlerSpan, 'botas.handler span should exist')
    assert.equal(handlerSpan.attributes['handler.type'], 'task/fetch')
    assert.equal(handlerSpan.attributes['handler.dispatch'], 'invoke')
    assert.ok(result)
    assert.equal(result.status, 200)
  })

  it('records exception on turn span when handler throws', async () => {
    const bot = new BotApplication()
    bot.on('message', async () => { throw new Error('handler boom') })
    await assert.rejects(
      () => bot.processBody(makeBody()),
      (err: Error) => err.name === 'BotHandlerException'
    )

    const spans = exporter.getFinishedSpans()
    const turnSpan = spans.find(s => s.name === 'botas.turn')
    assert.ok(turnSpan, 'turn span should exist even on error')
    assert.ok(turnSpan.events.length > 0, 'turn span should have exception event')
  })

  it('ends all spans even when middleware throws', async () => {
    const bot = new BotApplication()
    bot.use(async () => { throw new Error('mw boom') })
    bot.on('message', async () => {})
    await assert.rejects(() => bot.processBody(makeBody()))

    const spans = exporter.getFinishedSpans()
    const mwSpan = spans.find(s => s.name === 'botas.middleware')
    assert.ok(mwSpan, 'middleware span should exist')
    assert.ok(mwSpan.events.length > 0, 'middleware span should have exception event')
    const turnSpan = spans.find(s => s.name === 'botas.turn')
    assert.ok(turnSpan, 'turn span should end even on error')
  })
})
