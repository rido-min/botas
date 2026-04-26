// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getTracer } from './tracer-provider.js'

describe('tracer-provider', () => {
  it('returns a Tracer when @opentelemetry/api is installed', () => {
    const tracer = getTracer()
    assert.notStrictEqual(tracer, null, 'expected a Tracer instance, got null')
    assert.ok(tracer, 'tracer should be truthy')
  })

  it('returns the same cached tracer on subsequent calls', () => {
    const first = getTracer()
    const second = getTracer()
    assert.strictEqual(first, second, 'tracer should be cached')
  })

  // The "not installed" path (getTracer() returns null) cannot be tested here
  // because @opentelemetry/api is installed as a devDependency. In production,
  // when the package is not present, the require() call throws and _tracer is
  // set to null, making all span operations no-ops.
})
