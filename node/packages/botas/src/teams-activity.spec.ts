import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TeamsActivity, TeamsActivityBuilder } from './teams-activity.js'
import type { CoreActivity } from './core-activity.js'

describe('TeamsActivity', () => {
  describe('fromActivity', () => {
    it('copies basic fields', () => {
      const core: CoreActivity = {
        type: 'message',
        text: 'hello',
        serviceUrl: 'http://service.url',
        from: { id: 'user1', name: 'User One' },
        recipient: { id: 'bot1', name: 'Bot One' },
        conversation: { id: 'conv1' }
      }
      const teams = TeamsActivity.fromActivity(core)
      assert.equal(teams.type, 'message')
      assert.equal(teams.text, 'hello')
      assert.equal(teams.from.id, 'user1')
      assert.equal(teams.recipient.id, 'bot1')
    })

    it('preserves channelData as TeamsChannelData', () => {
      const core = {
        type: 'message',
        serviceUrl: 'http://svc',
        from: { id: 'u1' },
        recipient: { id: 'b1' },
        conversation: { id: 'c1' },
        channelData: {
          tenant: { id: 'tenant-123' },
          channel: { id: 'ch-456', name: 'General' }
        }
      } as unknown as CoreActivity
      const teams = TeamsActivity.fromActivity(core)
      assert.equal(teams.channelData?.tenant?.id, 'tenant-123')
      assert.equal(teams.channelData?.channel?.id, 'ch-456')
      assert.equal(teams.channelData?.channel?.name, 'General')
    })

    it('throws on null', () => {
      assert.throws(() => TeamsActivity.fromActivity(null!), /required/)
    })
  })

  describe('JSON round-trip', () => {
    it('deserializes Teams-specific fields', () => {
      const json = JSON.stringify({
        type: 'message',
        text: 'hello',
        serviceUrl: 'http://svc',
        from: { id: 'u1' },
        recipient: { id: 'b1' },
        conversation: { id: 'c1' },
        timestamp: '2024-01-01T00:00:00Z',
        locale: 'en-US',
        localTimezone: 'America/Los_Angeles',
        channelData: {
          tenant: { id: 't1' },
          team: { id: 'team1', aadGroupId: 'g1' }
        },
        suggestedActions: {
          actions: [{ type: 'imBack', title: 'Yes', value: 'yes' }]
        }
      })
      const act = JSON.parse(json) as ReturnType<typeof TeamsActivity.fromActivity>
      assert.equal(act.timestamp, '2024-01-01T00:00:00Z')
      assert.equal(act.locale, 'en-US')
      assert.equal(act.channelData?.tenant?.id, 't1')
      assert.equal(act.channelData?.team?.aadGroupId, 'g1')
      assert.equal(act.suggestedActions?.actions[0].title, 'Yes')
    })
  })
})

describe('TeamsActivityBuilder', () => {
  const incoming: CoreActivity = {
    type: 'message',
    serviceUrl: 'http://service.url',
    from: { id: 'user1', name: 'User One' },
    recipient: { id: 'bot1', name: 'Bot One' },
    conversation: { id: 'conversation1' },
    text: 'hello'
  }

  it('builds a TeamsActivity with type message', () => {
    const reply = new TeamsActivityBuilder()
      .withConversationReference(incoming)
      .withText('reply')
      .build()
    assert.equal(reply.type, 'message')
    assert.equal(reply.text, 'reply')
  })

  it('swaps from and recipient', () => {
    const reply = new TeamsActivityBuilder()
      .withConversationReference(incoming)
      .build()
    assert.equal(reply.from?.id, 'bot1')
    assert.equal(reply.recipient?.id, 'user1')
  })

  it('sets channelData', () => {
    const reply = new TeamsActivityBuilder()
      .withChannelData({ tenant: { id: 't1' } })
      .build()
    assert.equal(reply.channelData?.tenant?.id, 't1')
  })

  it('sets suggestedActions', () => {
    const reply = new TeamsActivityBuilder()
      .withSuggestedActions({ actions: [{ type: 'imBack', title: 'Yes', value: 'yes' }] })
      .build()
    assert.equal(reply.suggestedActions?.actions.length, 1)
    assert.equal(reply.suggestedActions?.actions[0].title, 'Yes')
  })

  it('addMention creates a mention entity', () => {
    const reply = new TeamsActivityBuilder()
      .withText('Hello <at>User One</at>!')
      .addMention({ id: 'user1', name: 'User One' })
      .build()
    assert.equal(reply.entities?.length, 1)
    assert.equal(reply.entities![0].type, 'mention')
    assert.deepEqual(reply.entities![0].mentioned, { id: 'user1', name: 'User One' })
    assert.equal(reply.entities![0].text, '<at>User One</at>')
  })

  it('addMention with custom text', () => {
    const reply = new TeamsActivityBuilder()
      .addMention({ id: 'u1', name: 'U' }, '<at>Custom</at>')
      .build()
    assert.equal(reply.entities![0].text, '<at>Custom</at>')
  })

  it('addMention throws on null account', () => {
    assert.throws(() => new TeamsActivityBuilder().addMention(null!), /required/)
  })

  it('addAdaptiveCardAttachment parses JSON', () => {
    const cardJson = '{"type":"AdaptiveCard","body":[]}'
    const reply = new TeamsActivityBuilder()
      .addAdaptiveCardAttachment(cardJson)
      .build()
    assert.equal(reply.attachments?.length, 1)
    assert.equal(reply.attachments![0].contentType, 'application/vnd.microsoft.card.adaptive')
    assert.deepEqual(reply.attachments![0].content, { type: 'AdaptiveCard', body: [] })
  })

  it('withAdaptiveCardAttachment replaces as single', () => {
    const cardJson = '{"type":"AdaptiveCard"}'
    const reply = new TeamsActivityBuilder()
      .addAttachment({ contentType: 'text/plain' })
      .withAdaptiveCardAttachment(cardJson)
      .build()
    assert.equal(reply.attachments?.length, 1)
    assert.equal(reply.attachments![0].contentType, 'application/vnd.microsoft.card.adaptive')
  })

  it('addAdaptiveCardAttachment throws on invalid JSON', () => {
    assert.throws(() => new TeamsActivityBuilder().addAdaptiveCardAttachment('not json'), SyntaxError)
  })

  it('returns a copy on build', () => {
    const builder = new TeamsActivityBuilder().withConversationReference(incoming)
    const a = builder.withText('first').build()
    const b = builder.withText('second').build()
    assert.equal(a.text, 'first')
    assert.equal(b.text, 'second')
  })

  it('fluent chaining works with all methods', () => {
    const result = new TeamsActivityBuilder()
      .withType('message')
      .withServiceUrl('http://svc')
      .withConversation({ id: 'c1' })
      .withFrom({ id: 'f1' })
      .withRecipient({ id: 'r1' })
      .withText('test')
      .withChannelData({ tenant: { id: 't1' } })
      .withSuggestedActions({ actions: [] })
      .build()
    assert.equal(result.type, 'message')
    assert.equal(result.serviceUrl, 'http://svc')
    assert.equal(result.conversation?.id, 'c1')
    assert.equal(result.from?.id, 'f1')
    assert.equal(result.text, 'test')
    assert.ok(result.channelData)
    assert.ok(result.suggestedActions)
  })
})
