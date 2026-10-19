// Ring webhook signatures: header `X-Signature: sha256=<hex HMAC-SHA256 of the raw body>`,
// keyed with the app's HMAC Signing Key from the Ring Developer Portal.
import { createHmac, timingSafeEqual } from 'node:crypto'

export function signBody(rawBody: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}

export function verifySignature(rawBody: string, header: string | undefined, secret: string): boolean {
  if (!header || !secret) return false
  const expected = Buffer.from(signBody(rawBody, secret))
  const got = Buffer.from(header.trim())
  return expected.length === got.length && timingSafeEqual(expected, got)
}
