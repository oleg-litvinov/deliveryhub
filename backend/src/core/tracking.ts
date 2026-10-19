// Tracking-number helpers. Carrier barcodes often wrap the tracking number in extra data
// (USPS IMpb = "420" + ZIP + tracking; FedEx 34-digit = routing + tracking), so matching is
// done by containment against the expected list rather than by parsing every carrier format.
import type { BarcodeRead, Package } from './types.js'

export const normalizeTracking = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '')

export function guessCarrier(tracking: string): string | undefined {
  const t = normalizeTracking(tracking)
  if (/^1Z[0-9A-Z]{16}$/.test(t)) return 'UPS'
  if (/^TBA\d{9,}$/.test(t)) return 'Amazon'
  if (/^9[2-5]\d{20,32}$/.test(t) || /^420\d{5}/.test(t)) return 'USPS'
  if (/^(\d{12}|\d{15}|96\d{32})$/.test(t)) return 'FedEx'
  return undefined
}

/** USPS IMpb barcodes start with "420" + destination ZIP — a free, exact address signal. */
export function zipFromBarcode(text: string): string | undefined {
  const t = text.replace(/[^0-9A-Z\x1d]/gi, '')
  const m = t.match(/^420(\d{5})(\d{4})?\x1d?9[2-5]\d{20,}/)
  return m?.[1]
}

const MIN_LEN = 10

/** USPS IMpb: drop the "420" + ZIP(+4) routing prefix to get the printed tracking number. */
export const stripImpbRouting = (code: string) => code.replace(/^420(\d{5}|\d{9})(?=9[2-5]\d{20})/, '')

/** Find the expected package whose tracking number appears in any barcode (or equals the label read). */
export function findPackage(
  expected: Package[],
  barcodes: BarcodeRead[],
  labelTracking?: string,
): { pkg?: Package; source: 'barcode' | 'label' | 'none'; tracking?: string } {
  const codes = barcodes.map((b) => normalizeTracking(b.text)).filter((c) => c.length >= MIN_LEN)
  for (const p of expected) {
    const want = normalizeTracking(p.trackingNumber)
    if (want.length < MIN_LEN) continue
    if (codes.some((c) => c.includes(want))) return { pkg: p, source: 'barcode', tracking: p.trackingNumber }
  }
  if (labelTracking) {
    const got = normalizeTracking(labelTracking)
    const pkg = expected.find((p) => normalizeTracking(p.trackingNumber) === got)
    if (pkg) return { pkg, source: 'label', tracking: pkg.trackingNumber }
  }
  // Unknown package: report the most tracking-like code we saw, for the "unexpected package" log.
  const best = codes.map(stripImpbRouting).find((c) => guessCarrier(c)) ?? (labelTracking ? normalizeTracking(labelTracking) : undefined)
  return { source: best ? (codes.some((c) => c.includes(best)) ? 'barcode' : 'label') : 'none', tracking: best }
}
