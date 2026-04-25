import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CoreActivityBuilder } from './core-activity.js'
import type { CoreActivity } from './core-activity.js'

describe('activity schema', () => {
  describe('JSON deserialization', () => {
    it('parses known fields', () => {
      const json = JSON.stringify({
        type: 'message',
        text: 'hello',
        serviceUrl: 'https://smba.trafficmanager.botframework.com/api',
        from: { id: 'user1', name: 'User One' },
        recipient: { id: 'bot1', name: 'Bot One' },
        conversation: { id: 'conv1' },
      })
      const act = JSON.parse(json) as CoreActivity
      assert.equal(act.type, 'message')
      assert.equal(act.text, 'hello')
      assert.equal(act.from.id, 'user1')
      assert.equal(act.from.name, 'User One')
    })

    it('handles null text field', () => {
      const act = JSON.parse('{"type":"message","text":null}') as CoreActivity
      assert.equal(act.type, 'message')
      assert.equal(act.text, null)
    })

    it('handles missing optional fields', () => {
      const act = JSON.parse('{"type":"message","serviceUrl":"https://smba.trafficmanager.botframework.com/api","from":{"id":"u"},"recipient":{"id":"b"},"conversation":{"id":"c"}}') as CoreActivity
      assert.equal(act.type, 'message')
      assert.equal(act.text, undefined)
    })

    it('deserializes id and channelId as typed properties', () => {
      const json = JSON.stringify({
        id: 'act-001',
        channelId: 'msteams',
        type: 'message',
        text: 'hello',
        serviceUrl: 'https://smba.trafficmanager.botframework.com/api',
        from: { id: 'user1', name: 'User One' },
        recipient: { id: 'bot1', name: 'Bot One' },
        conversation: { id: 'conv1' },
      })
      const act = JSON.parse(json) as CoreActivity
      assert.equal(act.id, 'act-001')
      assert.equal(act.channelId, 'msteams')
    })

    it('id and channelId are not in properties after deserialization', () => {
      const json = JSON.stringify({
        id: 'act-002',
        channelId: 'webchat',
        type: 'message',
        serviceUrl: 'https://smba.trafficmanager.botframework.com/api',
        from: { id: 'u1' },
        recipient: { id: 'b1' },
        conversation: { id: 'c1' },
      })
      const act = JSON.parse(json) as CoreActivity
      assert.equal(act.id, 'act-002')
      assert.equal(act.channelId, 'webchat')
      // They should be top-level typed fields, not in properties
      assert.equal(act.properties?.['id'], undefined)
      assert.equal(act.properties?.['channelId'], undefined)
    })

    it('id and channelId round-trip through JSON serialization', () => {
      const original: CoreActivity = {
        id: 'act-003',
        channelId: 'emulator',
        type: 'message',
        serviceUrl: 'https://localhost/api',
        from: { id: 'u1', name: 'User' },
        recipient: { id: 'b1', name: 'Bot' },
        conversation: { id: 'c1' },
        text: 'round-trip',
      }
      const json = JSON.stringify(original)
      const restored = JSON.parse(json) as CoreActivity
      assert.equal(restored.id, 'act-003')
      assert.equal(restored.channelId, 'emulator')
      assert.equal(restored.type, 'message')
      assert.equal(restored.text, 'round-trip')
    })

    it('handles missing id and channelId gracefully', () => {
      const act = JSON.parse('{"type":"message","serviceUrl":"https://smba.trafficmanager.botframework.com/api","from":{"id":"u"},"recipient":{"id":"b"},"conversation":{"id":"c"}}') as CoreActivity
      assert.equal(act.id, undefined)
      assert.equal(act.channelId, undefined)
    })

    it('deserializes aadObjectId as typed property on ChannelAccount', () => {
      const json = JSON.stringify({
        type: 'message',
        text: 'hello',
        from: { id: '1', name: 'tester', aadObjectId: '123' },
      })
      const act = JSON.parse(json) as CoreActivity
      assert.equal(act.from.id, '1')
      assert.equal(act.from.name, 'tester')
      assert.equal(act.from.aadObjectId, '123')
    })

    it('deserializes role as typed property on ChannelAccount', () => {
      const json = JSON.stringify({
        type: 'message',
        from: { id: '1', role: 'user' },
      })
      const act = JSON.parse(json) as CoreActivity
      assert.equal(act.from.role, 'user')
    })
  })

  describe('CoreActivityBuilder', () => {
    const incoming: CoreActivity = {
      type: 'message',
      serviceUrl: 'https://smba.trafficmanager.botframework.com/api',
      from: { id: 'user1', name: 'User One' },
      recipient: { id: 'bot1', name: 'Bot One' },
      conversation: { id: 'conversation1' },
      text: 'hello',
    }

    it('sets type to message', () => {
      const reply = new CoreActivityBuilder()
        .withConversationReference(incoming)
        .withText('reply')
        .build()
      assert.equal(reply.type, 'message')
    })

    it('copies serviceUrl and conversation', () => {
      const reply = new CoreActivityBuilder()
        .withConversationReference(incoming)
        .withText('reply')
        .build()
      assert.equal(reply.serviceUrl, 'https://smba.trafficmanager.botframework.com/api')
      assert.equal(reply.conversation?.id, 'conversation1')
    })

    it('swaps from and recipient', () => {
      const reply = new CoreActivityBuilder()
        .withConversationReference(incoming)
        .withText('reply')
        .build()
      assert.equal(reply.from?.id, 'bot1')
      assert.equal(reply.from?.name, 'Bot One')
      assert.equal(reply.recipient?.id, 'user1')
      assert.equal(reply.recipient?.name, 'User One')
    })

    it('sets text', () => {
      const reply = new CoreActivityBuilder()
        .withConversationReference(incoming)
        .withText('you said: hello')
        .build()
      assert.equal(reply.text, 'you said: hello')
    })

    it('defaults text to empty string', () => {
      const reply = new CoreActivityBuilder()
        .withConversationReference(incoming)
        .build()
      assert.equal(reply.text, '')
    })

    it('returns a copy on build', () => {
      const builder = new CoreActivityBuilder()
        .withConversationReference(incoming)
      const a = builder.withText('first').build()
      const b = builder.withText('second').build()
      assert.equal(a.text, 'first')
      assert.equal(b.text, 'second')
    })
  })
})
