import assert from 'assert/strict'
import { describe, it } from 'node:test'
import {getRandomGuid} from '../src/index'

describe('bogus tests', () => {
  it('passes', () => {
    assert.ok(true)
  })
  it('guid is 36 characters long', () => {
    const guid = getRandomGuid()
    assert.equal(guid.length, 36)
  })
})