import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BotApplication, BotHandlerException } from './bot-application.js'
import type { CoreActivity } from './core-activity.js'
import type { TurnContext } from './turn-context.js'
import { ActivityType } from './activity-type.js'

const baseCoreActivity: CoreActivity = {
  type: 'message',
  serviceUrl: 'https://smba.trafficmanager.botframework.com/api',
  from: { id: 'user1' },
  recipient: { id: 'bot1' },
  conversation: { id: 'conv1' },
  text: 'hello',
}

function makeBody (overrides: Partial<CoreActivity> = {}): string {
  return JSON.stringify({ ...baseCoreActivity, ...overrides })
}

describe('Typing Activity', () => {
  describe('receiving typing activity', () => {
    it('dispatches typing activity to handler via on("typing")', async () => {
      const bot = new BotApplication()
      let received: TurnContext | undefined
      bot.on('typing', async (ctx) => { received = ctx })
      await bot.processBody(makeBody({ type: 'typing' }))
      assert.ok(received)
      assert.equal(received.activity.type, 'typing')
    })

    it('dispatches typing activity to handler via on(ActivityType.Typing)', async () => {
      const bot = new BotApplication()
      let received: TurnContext | undefined
      bot.on(ActivityType.Typing, async (ctx) => { received = ctx })
      await bot.processBody(makeBody({ type: 'typing' }))
      assert.ok(received)
      assert.equal(received.activity.type, ActivityType.Typing)
    })

    it('wraps handler exceptions in BotHandlerException', async () => {
      const bot = new BotApplication()
      const cause = new Error('typing handler error')
      bot.on('typing', async () => { throw cause })
      const err = await bot.processBody(makeBody({ type: 'typing' })).catch((e: unknown) => e)
      assert.ok(err instanceof BotHandlerException)
      assert.equal(err.cause, cause)
      assert.equal(err.activity.type, 'typing')
    })

    it('typing activity is silently ignored when no handler registered', async () => {
      const bot = new BotApplication()
      let messageCalled = false
      bot.on('message', async () => { messageCalled = true })
      await bot.processBody(makeBody({ type: 'typing' }))
      assert.equal(messageCalled, false)
    })
  })

  describe('sendTyping()', () => {
    it('sends typing activity with routing fields', async () => {
      const bot = new BotApplication()
      let sentActivity: Partial<CoreActivity> | undefined
      let sentServiceUrl: string | undefined
      let sentConversationId: string | undefined

      bot.on('message', async (ctx) => {
        // Override sendActivityAsync INSIDE the handler context
        ctx.app.sendActivityAsync = async (serviceUrl, conversationId, activity) => {
          sentServiceUrl = serviceUrl
          sentConversationId = conversationId
          sentActivity = activity
          return { id: 'test-id' }
        }

        await ctx.sendTyping()
      })

      await bot.processBody(makeBody())

      assert.ok(sentActivity)
      assert.equal(sentActivity.type, 'typing')
      assert.equal(sentServiceUrl, 'https://smba.trafficmanager.botframework.com/api')
      assert.equal(sentConversationId, 'conv1')
      assert.equal(sentActivity.serviceUrl, 'https://smba.trafficmanager.botframework.com/api')
      assert.equal(sentActivity.conversation?.id, 'conv1')
      assert.equal(sentActivity.from?.id, 'bot1') // swapped
      assert.equal(sentActivity.recipient?.id, 'user1') // swapped
    })

    it('sendTyping does not set text field', async () => {
      const bot = new BotApplication()
      let sentActivity: Partial<CoreActivity> | undefined

      bot.on('message', async (ctx) => {
        ctx.app.sendActivityAsync = async (_serviceUrl, _conversationId, activity) => {
          sentActivity = activity
          return { id: 'test-id' }
        }
        await ctx.sendTyping()
      })

      await bot.processBody(makeBody({ text: 'user message' }))

      assert.ok(sentActivity)
      assert.equal(sentActivity.type, 'typing')
      assert.equal(sentActivity.text, '') // CoreActivityBuilder defaults to empty string
    })

    it('sendTyping returns Promise<void>', async () => {
      const bot = new BotApplication()
      let returnValue: unknown

      bot.on('message', async (ctx) => {
        ctx.app.sendActivityAsync = async () => ({ id: 'test-id' })
        returnValue = await ctx.sendTyping()
      })

      await bot.processBody(makeBody())
      assert.equal(returnValue, undefined)
    })

    it('multiple sendTyping calls work correctly', async () => {
      const bot = new BotApplication()
      const sentActivities: Array<Partial<CoreActivity>> = []

      bot.on('message', async (ctx) => {
        ctx.app.sendActivityAsync = async (_serviceUrl, _conversationId, activity) => {
          sentActivities.push(activity)
          return { id: 'test-id' }
        }
        await ctx.sendTyping()
        await ctx.sendTyping()
      })

      await bot.processBody(makeBody())

      assert.equal(sentActivities.length, 2)
      assert.equal(sentActivities[0].type, 'typing')
      assert.equal(sentActivities[1].type, 'typing')
    })
  })
})
