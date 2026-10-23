// Amazon Delivery Box (concept): unlock policy + state machine. The box fails closed:
// it opens only for a barcode-verified, expected package at the right address.
import type { Box, Decision } from './types.js'

export const UNLOCK_TTL_MS = 60_000
export const MAX_UNLOCKS_PER_HOUR = 3
export const MIN_CONFIDENCE = 0.85

export interface PolicyResult {
  allow: boolean
  reason: string
}

export function unlockPolicy(d: Decision, box: Box, now: number): PolicyResult {
  if (d.verdict !== 'right_address') return { allow: false, reason: 'Address not verified' }
  if (!d.expected) return { allow: false, reason: 'Package is not on the expected list' }
  if (d.trackingSource !== 'barcode') return { allow: false, reason: 'Tracking number not confirmed by barcode' }
  if (d.addressCheck.result === 'mismatch') return { allow: false, reason: 'Address mismatch' }
  if (d.confidence < MIN_CONFIDENCE) return { allow: false, reason: `Confidence ${d.confidence.toFixed(2)} below ${MIN_CONFIDENCE}` }
  // UNLOCKED is fine too: a driver with several verified parcels restarts the window with a fresh token.
  if (box.state === 'OPEN' || box.state === 'TAMPER') return { allow: false, reason: `Box is ${box.state}` }
  const recent = box.unlockHistory.filter((t) => now - t < 3_600_000)
  if (recent.length >= MAX_UNLOCKS_PER_HOUR) return { allow: false, reason: 'Unlock rate limit reached' }
  return { allow: true, reason: 'Verified expected package' }
}

export type BoxEvent =
  | { type: 'unlock'; token: string; packageId?: string; now: number }
  | { type: 'lid_open'; token?: string; now: number }
  | { type: 'lid_close'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'relock'; now: number } // a new, unverified scan while the box waits for the previous driver

/** Pure state transition. Unknown or invalid events leave the box locked or flag tamper. */
export function transition(box: Box, ev: BoxEvent): Box {
  const next = { ...box, updatedAt: ev.now }
  switch (ev.type) {
    case 'unlock':
      if (box.state === 'OPEN' || box.state === 'TAMPER') return box
      return {
        ...next,
        state: 'UNLOCKED',
        token: ev.token,
        tokenExpiresAt: ev.now + UNLOCK_TTL_MS,
        packageId: ev.packageId,
        packageIds: [...new Set([...(box.state === 'UNLOCKED' ? (box.packageIds ?? []) : []), ...(ev.packageId ? [ev.packageId] : [])])],
        unlockHistory: [...box.unlockHistory.filter((t) => ev.now - t < 3_600_000), ev.now],
      }
    case 'lid_open': {
      const valid = box.state === 'UNLOCKED' && !!box.token && ev.token === box.token && ev.now <= (box.tokenExpiresAt ?? 0)
      if (valid) return { ...next, state: 'OPEN', token: undefined, tokenExpiresAt: undefined }
      return { ...next, state: 'TAMPER' }
    }
    case 'lid_close':
      if (box.state === 'OPEN') return { ...next, state: 'SECURED' }
      return box
    case 'relock':
      if (box.state !== 'UNLOCKED') return box
      return { ...next, state: 'LOCKED', token: undefined, tokenExpiresAt: undefined, packageId: undefined, packageIds: undefined }
    case 'tick':
      if (box.state === 'UNLOCKED' && ev.now > (box.tokenExpiresAt ?? 0)) {
        return { ...next, state: 'LOCKED', token: undefined, tokenExpiresAt: undefined, packageId: undefined, packageIds: undefined }
      }
      return box
  }
}

export const newBox = (homeId: string, now: number): Box => ({ homeId, state: 'LOCKED', unlockHistory: [], updatedAt: now })
