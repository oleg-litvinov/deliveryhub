import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { computeNonce, linkFreshness, maskEmail, nonceMatches } from '../src/ring/linking.js'

const KEY = 'test-hmac-key'

describe('Ring account-linking nonce', () => {
  it('is URL-safe Base64 without padding of HMAC-SHA256("<time>:<account>")', () => {
    const nonce = computeNonce('1771130906289', 'acct-123', KEY)
    const std = createHmac('sha256', KEY).update('1771130906289:acct-123').digest('base64')
    expect(nonce).toBe(std.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''))
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })
  it('matches only the right account, time and key', () => {
    const n = computeNonce('1771130906289', 'acct-123', KEY)
    expect(nonceMatches(n, '1771130906289', 'acct-123', KEY)).toBe(true)
    expect(nonceMatches(n, '1771130906289', 'acct-999', KEY)).toBe(false)
    expect(nonceMatches(n, '1771130906290', 'acct-123', KEY)).toBe(false)
    expect(nonceMatches(n, '1771130906289', 'acct-123', 'other')).toBe(false)
  })
  it('enforces the 600 s window', () => {
    const t = 1_771_130_906_289
    expect(linkFreshness(String(t), t + 599_000)).toBe('ok')
    expect(linkFreshness(String(t), t + 601_000)).toBe('expired')
    expect(linkFreshness(String(t), t - 1)).toBe('future')
    expect(linkFreshness('12345', t)).toBe('invalid')
  })
  it('masks the account identifier', () => {
    expect(maskEmail('User@Example.com')).toBe('u***r@example.com')
    expect(maskEmail('ab@x.io')).toBe('a***@x.io')
  })
})
