import { describe, expect, it } from 'vitest'
import { MAX_UNLOCKS_PER_HOUR, UNLOCK_TTL_MS, newBox, transition, unlockPolicy } from '../src/core/box.js'
import type { Decision } from '../src/core/types.js'

const ok: Decision = { verdict: 'right_address', expected: true, packageId: 'p', trackingNumber: 't', trackingSource: 'barcode', addressCheck: { result: 'match', reasons: [] }, confidence: 0.99, driverMessage: '' }
const t0 = 1_000_000

describe('unlockPolicy (fails closed)', () => {
  it('allows a barcode-verified expected package', () => {
    expect(unlockPolicy(ok, newBox('h', t0), t0).allow).toBe(true)
  })
  it.each([
    ['wrong address', { verdict: 'wrong_address' as const }],
    ['unreadable', { verdict: 'unreadable' as const }],
    ['unexpected package', { expected: false }],
    ['tracking read only by AI, not barcode', { trackingSource: 'label' as const }],
    ['low confidence', { confidence: 0.5 }],
  ])('denies: %s', (_, patch) => {
    expect(unlockPolicy({ ...ok, ...patch }, newBox('h', t0), t0).allow).toBe(false)
  })
  it('denies when the box is already open', () => {
    expect(unlockPolicy(ok, { ...newBox('h', t0), state: 'OPEN' }, t0).allow).toBe(false)
  })
  it('rate-limits unlocks', () => {
    const box = { ...newBox('h', t0), unlockHistory: Array(MAX_UNLOCKS_PER_HOUR).fill(t0 - 1000) }
    expect(unlockPolicy(ok, box, t0).allow).toBe(false)
  })
})

describe('box state machine', () => {
  it('unlock → open → close → secured', () => {
    let b = transition(newBox('h', t0), { type: 'unlock', token: 'abc', packageId: 'p', now: t0 })
    expect(b.state).toBe('UNLOCKED')
    b = transition(b, { type: 'lid_open', token: 'abc', now: t0 + 5000 })
    expect(b.state).toBe('OPEN')
    b = transition(b, { type: 'lid_close', now: t0 + 9000 })
    expect(b.state).toBe('SECURED')
  })
  it('relocks when the token expires', () => {
    const b = transition(newBox('h', t0), { type: 'unlock', token: 'abc', now: t0 })
    expect(transition(b, { type: 'tick', now: t0 + UNLOCK_TTL_MS + 1 }).state).toBe('LOCKED')
  })
  it('flags tamper on open without a valid token', () => {
    expect(transition(newBox('h', t0), { type: 'lid_open', now: t0 }).state).toBe('TAMPER')
    const b = transition(newBox('h', t0), { type: 'unlock', token: 'abc', now: t0 })
    expect(transition(b, { type: 'lid_open', token: 'abc', now: t0 + UNLOCK_TTL_MS + 1 }).state).toBe('TAMPER')
  })
})
