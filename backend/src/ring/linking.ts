// Ring one-way account linking (architecture/app-deployment.md §6.3).
// nonce = Base64URL_NoPadding( HMAC-SHA256(K_hmac, "<time_ms>:<account_id>") ), valid for 600 s.
import { createHmac, timingSafeEqual } from 'node:crypto'

export const LINK_WINDOW_SECONDS = 600

export function computeNonce(timeMs: string, accountId: string, hmacKey: string): string {
  return createHmac('sha256', Buffer.from(hmacKey, 'utf8')).update(`${timeMs}:${accountId}`, 'utf8').digest('base64url')
}

export function nonceMatches(received: string, timeMs: string, accountId: string, hmacKey: string): boolean {
  const a = Buffer.from(computeNonce(timeMs, accountId, hmacKey))
  const b = Buffer.from(received)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Ring's freshness check: reject links older than 10 minutes or from the future. */
export function linkFreshness(timeMs: string, nowMs: number): 'ok' | 'expired' | 'future' | 'invalid' {
  if (!/^\d{13}$/.test(timeMs)) return 'invalid'
  const delta = (nowMs - Number(timeMs)) / 1000
  if (delta < 0) return 'future'
  return delta > LINK_WINDOW_SECONDS ? 'expired' : 'ok'
}

/** "user@example.com" → "u***r@example.com" (Ring's account_identifier format). */
export function maskEmail(email: string): string {
  const [local, domain] = email.trim().toLowerCase().split('@')
  if (!local || !domain) return '***'
  const masked = local.length <= 2 ? `${local[0]}***` : `${local[0]}***${local[local.length - 1]}`
  return `${masked}@${domain}`
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
