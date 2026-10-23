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
  it('denies when the box is already open or flagged for tamper', () => {
    expect(unlockPolicy(ok, { ...newBox('h', t0), state: 'OPEN' }, t0).allow).toBe(false)
    expect(unlockPolicy(ok, { ...newBox('h', t0), state: 'TAMPER' }, t0).allow).toBe(false)
  })
  it('a second verified parcel while unlocked restarts the window with a new token', () => {
    const first = transition(newBox('h', t0), { type: 'unlock', token: 'one', packageId: 'a', now: t0 })
    expect(unlockPolicy(ok, first, t0 + 20_000).allow).toBe(true)
    const second = transition(first, { type: 'unlock', token: 'two', packageId: 'b', now: t0 + 20_000 })
    expect(second).toMatchObject({ state: 'UNLOCKED', token: 'two', packageId: 'b', tokenExpiresAt: t0 + 20_000 + 60_000 })
    expect(second.packageIds).toEqual(['a', 'b'])
    expect(transition(second, { type: 'lid_open', token: 'one', now: t0 + 21_000 }).state).toBe('TAMPER') // old token is dead
    expect(transition(second, { type: 'relock', now: t0 + 22_000 }).packageIds).toBeUndefined()
  })
  it('rate-limits unlocks', () => {
    const box = { ...newBox('h', t0), unlockHistory: Array(MAX_UNLOCKS_PER_HOUR).fill(t0 - 1000) }
    expect(unlockPolicy(ok, box, t0).allow).toBe(false)
  })
})

describe('box state machine', () => {
  it('a fresh unlock after SECURED starts a new parcel list', () => {
    const secured = { ...newBox('h', t0), state: 'SECURED' as const, packageIds: ['old'] }
    expect(transition(secured, { type: 'unlock', token: 't', packageId: 'new', now: t0 }).packageIds).toEqual(['new'])
  })
  it('unlock → open → close → secured', () => {
    let b = transition(newBox('h', t0), { type: 'unlock', token: 'abc', packageId: 'p', now: t0 })
    expect(b.state).toBe('UNLOCKED')
    b = transition(b, { type: 'lid_open', token: 'abc', now: t0 + 5000 })
    expect(b.state).toBe('OPEN')
    b = transition(b, { type: 'lid_close', now: t0 + 9000 })
    expect(b.state).toBe('SECURED')
  })
  it('relocks immediately when a new unverified scan arrives', () => {
    const b = transition(newBox('h', t0), { type: 'unlock', token: 'abc', now: t0 })
    const r = transition(b, { type: 'relock', now: t0 + 5000 })
    expect(r.state).toBe('LOCKED')
    expect(r.token).toBeUndefined()
    expect(transition({ ...newBox('h', t0), state: 'SECURED' }, { type: 'relock', now: t0 }).state).toBe('SECURED')
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
