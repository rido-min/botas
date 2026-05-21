// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FileStorage } from './file-storage.js'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * Cross-language parity tests for FileStorage filename encoding.
 * These tests validate that the filename encoding matches the canonical spec (RFC 3986 percent-encoding).
 */
describe('FileStorage Parity', () => {
  describe('Key Encoding - Canonical Spec', () => {
    const testCases: Array<[string, string]> = [
      ['foo/bar', 'foo%2Fbar.json'],
      ['foo bar', 'foo%20bar.json'],
      ['user@domain.com', 'user%40domain.com.json'],
      ['key:with:colons', 'key%3Awith%3Acolons.json'],
      ['simple-key_123', 'simple-key_123.json'],
      ['channels/msteams/conversations/conv-1/users/user-abc', 'channels%2Fmsteams%2Fconversations%2Fconv-1%2Fusers%2Fuser-abc.json'],
      ['msteams/bot-123/conversations/conv-456', 'msteams%2Fbot-123%2Fconversations%2Fconv-456.json'],
      ['key+with+plus', 'key%2Bwith%2Bplus.json'],
      ['key%with%percent', 'key%25with%25percent.json'],
      ['key&with&ampersand', 'key%26with%26ampersand.json'],
      ['key=with=equals', 'key%3Dwith%3Dequals.json'],
      ['héllo', 'h%C3%A9llo.json'],
    ]

    testCases.forEach(([key, expectedFilename]) => {
      it(`should encode "${key}" as "${expectedFilename}"`, () => {
        // Use encodeURIComponent as per spec
        const encoded = encodeURIComponent(key) + '.json'
        assert.strictEqual(encoded, expectedFilename)
      })
    })
  })

  describe('Cross-Language Interop', () => {
    it('should write key with canonical filename', async () => {
      const testDir = mkdtempSync(join(tmpdir(), 'botas-parity-'))
      try {
        const storage = new FileStorage(testDir)
        const testKey = 'channels/msteams/conversations/conv-1/users/user-abc'
        const testValue = { testData: 'cross-language-test' }

        // Write
        await storage.write({ [testKey]: testValue })

        // Verify the filename matches canonical encoding
        const expectedFilename = 'channels%2Fmsteams%2Fconversations%2Fconv-1%2Fusers%2Fuser-abc.json'
        const expectedPath = join(testDir, expectedFilename)
        assert.strictEqual(existsSync(expectedPath), true, `Expected file at ${expectedPath}`)

        // Read back
        const result = await storage.read([testKey])
        assert.strictEqual(testKey in result, true)
      } finally {
        rmSync(testDir, { recursive: true, force: true })
      }
    })
  })
})
