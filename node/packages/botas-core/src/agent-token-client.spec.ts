import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AgentTokenClient, getAgenticIdentity } from './agent-token-client.js'
import type { AgenticIdentity } from './agent-token-client.js'
import type { Conversation } from './core-activity.js'

describe('AgenticIdentity', () => {
  describe('getAgenticIdentity', () => {
    it('returns undefined when conversation is undefined', () => {
      assert.equal(getAgenticIdentity(undefined), undefined)
    })

    it('returns undefined when agenticAppId is missing', () => {
      const conv: Conversation = { id: 'conv-1', agenticUserId: 'user-oid' }
      assert.equal(getAgenticIdentity(conv), undefined)
    })

    it('returns undefined when agenticUserId is missing', () => {
      const conv: Conversation = { id: 'conv-1', agenticAppId: 'app-id' }
      assert.equal(getAgenticIdentity(conv), undefined)
    })

    it('extracts identity when all fields present', () => {
      const conv: Conversation = {
        id: 'conv-1',
        agenticAppId: 'app-id-123',
        agenticUserId: 'user-oid-456',
        agenticAppBlueprintId: 'blueprint-789',
      }

      const identity = getAgenticIdentity(conv)

      assert.ok(identity)
      assert.equal(identity.agenticAppId, 'app-id-123')
      assert.equal(identity.agenticUserId, 'user-oid-456')
      assert.equal(identity.agenticAppBlueprintId, 'blueprint-789')
    })

    it('works without blueprintId', () => {
      const conv: Conversation = {
        id: 'conv-1',
        agenticAppId: 'app-id',
        agenticUserId: 'user-oid',
      }

      const identity = getAgenticIdentity(conv)

      assert.ok(identity)
      assert.equal(identity.agenticAppId, 'app-id')
      assert.equal(identity.agenticUserId, 'user-oid')
      assert.equal(identity.agenticAppBlueprintId, undefined)
    })
  })

  describe('Conversation schema', () => {
    it('round-trips agentic fields through JSON', () => {
      const conv: Conversation = {
        id: 'conv-1',
        agenticAppId: 'app-id',
        agenticUserId: 'user-oid',
        agenticAppBlueprintId: 'blueprint-id',
      }

      const json = JSON.stringify(conv)
      const parsed = JSON.parse(json) as Conversation

      assert.equal(parsed.id, 'conv-1')
      assert.equal(parsed.agenticAppId, 'app-id')
      assert.equal(parsed.agenticUserId, 'user-oid')
      assert.equal(parsed.agenticAppBlueprintId, 'blueprint-id')
    })

    it('deserializes channel payload with agentic fields and extra props', () => {
      const channelJson = JSON.stringify({
        id: '19:abc@thread.v2',
        agenticAppId: '00000000-0000-0000-0000-000000000001',
        agenticUserId: '00000000-0000-0000-0000-000000000002',
        agenticAppBlueprintId: '00000000-0000-0000-0000-000000000003',
        tenantId: 'some-tenant',
      })

      const conv = JSON.parse(channelJson) as Conversation

      assert.equal(conv.id, '19:abc@thread.v2')
      assert.equal(conv.agenticAppId, '00000000-0000-0000-0000-000000000001')
      assert.equal(conv.agenticUserId, '00000000-0000-0000-0000-000000000002')
      assert.equal(conv.agenticAppBlueprintId, '00000000-0000-0000-0000-000000000003')
      assert.equal(conv.tenantId, 'some-tenant')
    })

    it('works without agentic fields', () => {
      const conv = JSON.parse('{"id": "conv-123", "name": "General"}') as Conversation

      assert.equal(conv.id, 'conv-123')
      assert.equal(conv.agenticAppId, undefined)
      assert.equal(conv.agenticUserId, undefined)
    })
  })

  describe('AgentTokenClient', () => {
    it('constructs without error', () => {
      const client = new AgentTokenClient('tenant-id', 'client-id', 'client-secret')
      assert.ok(client)
    })
  })
})
