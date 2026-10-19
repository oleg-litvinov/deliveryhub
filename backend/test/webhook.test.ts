import { describe, expect, it } from 'vitest'
import { signBody, verifySignature } from '../src/ring/signature.js'
import { buildWebhook, isScanTrigger, parseWebhook } from '../src/ring/webhook.js'

describe('Ring webhook', () => {
  const raw = JSON.stringify(buildWebhook('sim-front-door', 'button_press', 1_760_000_000_000))
  it('verifies a valid signature and rejects tampering', () => {
    const sig = signBody(raw, 'secret')
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/)
    expect(verifySignature(raw, sig, 'secret')).toBe(true)
    expect(verifySignature(raw + ' ', sig, 'secret')).toBe(false)
    expect(verifySignature(raw, sig, 'other')).toBe(false)
    expect(verifySignature(raw, undefined, 'secret')).toBe(false)
  })
  it('parses and classifies triggers', () => {
    const w = parseWebhook(raw)!
    expect(w.data.attributes.source).toBe('sim-front-door')
    expect(isScanTrigger(w)).toBe(true)
    const motion = (sub?: string) => parseWebhook(JSON.stringify(buildWebhook('d', 'motion_detected', 1, sub)))!
    expect(isScanTrigger(motion('package_delivery'))).toBe(true)
    expect(isScanTrigger(motion('vehicle'))).toBe(false)
    expect(isScanTrigger(motion())).toBe(false)
    expect(parseWebhook('{"nope":1}')).toBeUndefined()
  })
})
