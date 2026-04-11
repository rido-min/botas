import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createReplyActivity } from './activity.js'
import type { Activity } from './activity.js'

describe('activity schema', () => {
  describe('JSON deserialization', () => {
    it('parses known fields', () => {
      const json = JSON.stringify({
        type: 'message',
        text: 'hello',
        channelId: 'msteams',
        serviceUrl: 'http://service.url',
        from: { id: 'user1', name: 'User One' },
        recipient: { id: 'bot1', name: 'Bot One' },
        conversation: { id: 'conv1' },
      })
      const act = JSON.parse(json) as Activity
      assert.equal(act.type, 'message')
      assert.equal(act.text, 'hello')
      assert.equal(act.channelId, 'msteams')
      assert.equal(act.from.id, 'user1')
      assert.equal(act.from.name, 'User One')
    })

    it('handles null text field', () => {
      const act = JSON.parse('{"type":"message","text":null}') as Activity
      assert.equal(act.type, 'message')
      assert.equal(act.text, null)
    })

    it('handles missing optional fields', () => {
      const act = JSON.parse('{"type":"message","serviceUrl":"http://s","channelId":"c","from":{"id":"u"},"recipient":{"id":"b"},"conversation":{"id":"c"}}') as Activity
      assert.equal(act.type, 'message')
      assert.equal(act.text, undefined)
    })

    it('deserializes aadObjectId as typed property on ChannelAccount', () => {
      const json = JSON.stringify({
        type: 'message',
        text: 'hello',
        from: { id: '1', name: 'tester', aadObjectId: '123' },
      })
      const act = JSON.parse(json) as Activity
      assert.equal(act.from.id, '1')
      assert.equal(act.from.name, 'tester')
      assert.equal(act.from.aadObjectId, '123')
    })

    it('deserializes role as typed property on ChannelAccount', () => {
      const json = JSON.stringify({
        type: 'message',
        from: { id: '1', role: 'user' },
      })
      const act = JSON.parse(json) as Activity
      assert.equal(act.from.role, 'user')
    })
  })

  describe('createReplyActivity', () => {
    const incoming: Activity = {
      type: 'message',
      id: 'activity1',
      channelId: 'channel1',
      serviceUrl: 'http://service.url',
      from: { id: 'user1', name: 'User One' },
      recipient: { id: 'bot1', name: 'Bot One' },
      conversation: { id: 'conversation1' },
      text: 'hello',
    }

    it('sets type to message', () => {
      const reply = createReplyActivity(incoming, 'reply')
      assert.equal(reply.type, 'message')
    })

    it('copies channelId, serviceUrl, conversation', () => {
      const reply = createReplyActivity(incoming, 'reply')
      assert.equal(reply.channelId, 'channel1')
      assert.equal(reply.serviceUrl, 'http://service.url')
      assert.equal(reply.conversation?.id, 'conversation1')
    })

    it('swaps from and recipient', () => {
      const reply = createReplyActivity(incoming, 'reply')
      assert.equal(reply.from?.id, 'bot1')
      assert.equal(reply.from?.name, 'Bot One')
      assert.equal(reply.recipient?.id, 'user1')
      assert.equal(reply.recipient?.name, 'User One')
    })

    it('sets replyToId to original activity id', () => {
      const reply = createReplyActivity(incoming, 'reply')
      assert.equal(reply.replyToId, 'activity1')
    })

    it('sets text', () => {
      const reply = createReplyActivity(incoming, 'you said: hello')
      assert.equal(reply.text, 'you said: hello')
    })

    it('defaults text to empty string', () => {
      const reply = createReplyActivity(incoming)
      assert.equal(reply.text, '')
    })
  })
})
