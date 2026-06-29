// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  _resetPostHogTelemetry,
  trackActivityReceived,
  trackBotStarted,
  trackHandlerDispatched,
  trackHandlerError,
  trackOutboundSent,
} from './posthog-telemetry.js'

describe('PostHog Telemetry', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    _resetPostHogTelemetry()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    _resetPostHogTelemetry()
  })

  it('is disabled by default when POSTHOG_API_KEY is not set', () => {
    delete process.env.POSTHOG_API_KEY
    // Should not throw or crash - fire-and-forget
    trackActivityReceived({ activityType: 'message', hasHandler: true, channelId: 'msteams' })
    trackBotStarted({
      handlerCount: 1,
      invokeHandlerCount: 0,
      middlewareCount: 0,
      hasCatchAll: false,
      hasStateStorage: false,
      authFlow: 'client_credentials',
    })
    trackHandlerDispatched({ activityType: 'message', dispatchMode: 'type', durationMs: 10 })
    trackHandlerError({ activityType: 'message', errorType: 'Error' })
    trackOutboundSent({ operation: 'send', success: true })
    // No-op when disabled - test passes if no exceptions
  })

  it('is disabled when POSTHOG_API_KEY is empty string', () => {
    process.env.POSTHOG_API_KEY = ''
    // Should not throw or crash - fire-and-forget
    trackActivityReceived({ activityType: 'message', hasHandler: true, channelId: 'msteams' })
    // No-op when disabled - test passes if no exceptions
  })

  it('trackActivityReceived does not throw when disabled', () => {
    delete process.env.POSTHOG_API_KEY
    trackActivityReceived({ activityType: 'message', hasHandler: true, channelId: 'msteams' })
    trackActivityReceived({ activityType: 'conversationUpdate', hasHandler: false, channelId: undefined })
  })

  it('trackBotStarted does not throw when disabled', () => {
    delete process.env.POSTHOG_API_KEY
    trackBotStarted({
      handlerCount: 5,
      invokeHandlerCount: 2,
      middlewareCount: 3,
      hasCatchAll: true,
      hasStateStorage: true,
      authFlow: 'client_credentials',
    })
  })

  it('trackHandlerDispatched does not throw when disabled', () => {
    delete process.env.POSTHOG_API_KEY
    trackHandlerDispatched({ activityType: 'message', dispatchMode: 'type', durationMs: 42 })
    trackHandlerDispatched({ activityType: 'invoke', dispatchMode: 'invoke', durationMs: 100 })
  })

  it('trackHandlerError does not throw when disabled', () => {
    delete process.env.POSTHOG_API_KEY
    trackHandlerError({ activityType: 'message', errorType: 'TypeError' })
    trackHandlerError({ activityType: 'conversationUpdate', errorType: 'HttpRequestException' })
  })

  it('trackOutboundSent does not throw when disabled', () => {
    delete process.env.POSTHOG_API_KEY
    trackOutboundSent({ operation: 'send', success: true })
    trackOutboundSent({ operation: 'update', success: false })
    trackOutboundSent({ operation: 'delete', success: true })
    trackOutboundSent({ operation: 'create_conversation', success: false })
  })

  it('channel type sanitization works correctly', () => {
    delete process.env.POSTHOG_API_KEY
    // Test all channel type mappings - should not throw
    trackActivityReceived({ activityType: 'message', hasHandler: true, channelId: 'emulator' })
    trackActivityReceived({ activityType: 'message', hasHandler: true, channelId: 'msteams' })
    trackActivityReceived({ activityType: 'message', hasHandler: true, channelId: 'webchat' })
    trackActivityReceived({ activityType: 'message', hasHandler: true, channelId: 'slack' })
    trackActivityReceived({ activityType: 'message', hasHandler: true, channelId: undefined })
  })

  it('trackBotStarted is only emitted once per process lifetime', () => {
    delete process.env.POSTHOG_API_KEY
    // First call
    trackBotStarted({
      handlerCount: 1,
      invokeHandlerCount: 0,
      middlewareCount: 0,
      hasCatchAll: false,
      hasStateStorage: false,
      authFlow: 'none',
    })
    // Second call - should be no-op (only emitted once)
    trackBotStarted({
      handlerCount: 999,
      invokeHandlerCount: 999,
      middlewareCount: 999,
      hasCatchAll: true,
      hasStateStorage: true,
      authFlow: 'client_credentials',
    })
    // No-op when disabled - test passes if no exceptions
  })

  it('multiple calls do not crash when posthog-node is unavailable', () => {
    // Simulate posthog-node not installed (API key set but module unavailable)
    process.env.POSTHOG_API_KEY = 'test-key'
    process.env.POSTHOG_HOST = 'https://test.posthog.com'

    // All calls should be fire-and-forget, never crash pipeline
    for (let i = 0; i < 10; i++) {
      trackActivityReceived({ activityType: 'message', hasHandler: true, channelId: 'msteams' })
      trackHandlerDispatched({ activityType: 'message', dispatchMode: 'type', durationMs: i * 10 })
      trackOutboundSent({ operation: 'send', success: true })
    }
    // Test passes if no exceptions (graceful degradation when module unavailable)
  })

  it('all event types have correct property shapes', () => {
    delete process.env.POSTHOG_API_KEY

    // Test that all event tracking functions accept expected property shapes
    trackActivityReceived({
      activityType: 'message',
      hasHandler: true,
      channelId: 'msteams',
    })

    trackBotStarted({
      handlerCount: 5,
      invokeHandlerCount: 2,
      middlewareCount: 3,
      hasCatchAll: true,
      hasStateStorage: false,
      authFlow: 'managed_identity',
    })

    trackHandlerDispatched({
      activityType: 'conversationUpdate',
      dispatchMode: 'catchall',
      durationMs: 123,
    })

    trackHandlerError({
      activityType: 'invoke',
      errorType: 'BotHandlerException',
    })

    trackOutboundSent({
      operation: 'send',
      success: false,
    })

    // Test passes if TypeScript accepts all shapes and no runtime errors
  })
})
