// Deterministic, explainable US address normalization and matching.
import type { Address, AddressCheck } from './types.js'

const SUFFIXES: Record<string, string> = {
  st: 'street', str: 'street', street: 'street',
  ave: 'avenue', av: 'avenue', avenue: 'avenue',
  rd: 'road', road: 'road',
  dr: 'drive', drive: 'drive',
  ln: 'lane', lane: 'lane',
  blvd: 'boulevard', boulevard: 'boulevard',
  ct: 'court', court: 'court',
  pl: 'place', place: 'place',
  ter: 'terrace', terrace: 'terrace',
  cir: 'circle', circle: 'circle',
  way: 'way', hwy: 'highway', highway: 'highway',
  pkwy: 'parkway', parkway: 'parkway', sq: 'square', square: 'square',
  trl: 'trail', trail: 'trail',
}
const DIRECTIONS: Record<string, string> = {
  n: 'north', s: 'south', e: 'east', w: 'west',
  ne: 'northeast', nw: 'northwest', se: 'southeast', sw: 'southwest',
  north: 'north', south: 'south', east: 'east', west: 'west',
}
const UNIT_WORDS = new Set(['apt', 'apartment', 'unit', 'ste', 'suite', '#', 'fl', 'floor', 'rm', 'room'])

export interface NormalizedAddress {
  number?: string
  streetName: string // name tokens without suffix/direction, e.g. "maple"
  suffix?: string
  direction?: string
  unit?: string
  zip5?: string
  state?: string
}

export function normalizeAddress(a: Address): NormalizedAddress {
  const tokens = a.line1
    .toLowerCase()
    .replace(/#\s*/g, ' # ')
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  let number: string | undefined
  if (tokens.length && /^\d+[a-z]?$/.test(tokens[0])) number = tokens.shift()

  let unit: string | undefined
  const unitIdx = tokens.findIndex((t) => UNIT_WORDS.has(t))
  if (unitIdx >= 0) {
    unit = tokens.slice(unitIdx + 1).join('').replace(/^#/, '') || undefined
    tokens.splice(unitIdx)
  }

  // Peel off trailing direction ("Main St NW"), then suffix, then leading direction ("N Main"),
  // always leaving at least one token as the street name ("West St" stays "west").
  let direction: string | undefined
  let suffix: string | undefined
  if (tokens.length > 2 && DIRECTIONS[tokens[tokens.length - 1]]) direction = DIRECTIONS[tokens.pop()!]
  if (tokens.length > 1 && SUFFIXES[tokens[tokens.length - 1]]) suffix = SUFFIXES[tokens.pop()!]
  if (tokens.length > 1 && DIRECTIONS[tokens[0]]) direction = DIRECTIONS[tokens.shift()!]

  return {
    number,
    streetName: tokens.join(' '),
    suffix,
    direction,
    unit,
    zip5: a.zip?.replace(/\D/g, '').slice(0, 5) || undefined,
    state: a.state?.toLowerCase(),
  }
}

/** Jaro-Winkler similarity in [0,1]. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1
  if (!a.length || !b.length) return 0
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1)
  const aM = new Array(a.length).fill(false)
  const bM = new Array(b.length).fill(false)
  let matches = 0
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (bM[j] || a[i] !== b[j]) continue
      aM[i] = bM[j] = true
      matches++
      break
    }
  }
  if (!matches) return 0
  let t = 0
  for (let i = 0, k = 0; i < a.length; i++) {
    if (!aM[i]) continue
    while (!bM[k]) k++
    if (a[i] !== b[k]) t++
    k++
  }
  const jaro = (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3
  let prefix = 0
  while (prefix < 4 && a[prefix] === b[prefix]) prefix++
  return jaro + prefix * 0.1 * (1 - jaro)
}

/** Compare an address read from a label with the home address. Every decision carries a reason. */
export function matchAddress(read: Address | undefined, home: Address): AddressCheck {
  if (!read || !read.line1?.trim()) return { result: 'unknown', reasons: ['No address read from label'] }
  const r = normalizeAddress(read)
  const h = normalizeAddress(home)
  const reasons: string[] = []

  if (r.zip5 && h.zip5 && r.zip5 !== h.zip5) {
    return { result: 'mismatch', read, reasons: [`ZIP ${r.zip5} ≠ ${h.zip5}`] }
  }
  if (r.number && h.number && r.number !== h.number) {
    return { result: 'mismatch', read, reasons: [`House number ${r.number} ≠ ${h.number}`] }
  }
  if (h.unit && r.unit && h.unit !== r.unit) {
    return { result: 'mismatch', read, reasons: [`Unit ${r.unit} ≠ ${h.unit}`] }
  }

  const sim = jaroWinkler(r.streetName, h.streetName)
  if (sim < 0.8) return { result: 'mismatch', read, reasons: [`Street "${r.streetName}" ≠ "${h.streetName}"`] }

  if (!r.number) reasons.push('House number not read')
  if (h.unit && !r.unit) reasons.push('Unit not read')
  if (sim < 0.92) reasons.push(`Street spelling differs (${Math.round(sim * 100)}% similar)`)
  if (r.suffix && h.suffix && r.suffix !== h.suffix) reasons.push(`Street type ${r.suffix} vs ${h.suffix}`)

  if (reasons.length) return { result: 'uncertain', read, reasons }
  return { result: 'match', read, reasons: ['Number, street' + (h.zip5 && r.zip5 ? ', ZIP' : '') + ' match'] }
}

const CITY_STATE_ZIP = /^(.*?)[,\s]+([A-Z]{2})\s+(\d{5})(?:-?(\d{4}))?\s*$/i

/**
 * Pull the ship-to address out of OCR'd label lines. Prefers the block after "SHIP TO";
 * otherwise uses the last city/state/zip line (the return address is usually printed first).
 * The line right after "SHIP TO" is the recipient name and is never returned.
 */
export function parseAddressFromLines(lines: string[]): Address | undefined {
  const clean = lines.map((l) => l.trim()).filter(Boolean)
  const shipTo = clean.findIndex((l) => /ship\s*to|deliver\s*to/i.test(l))
  const candidates: number[] = []
  clean.forEach((l, i) => CITY_STATE_ZIP.test(l) && candidates.push(i))
  if (!candidates.length) return undefined
  const cszIdx = shipTo >= 0 ? (candidates.find((i) => i > shipTo) ?? candidates[candidates.length - 1]) : candidates[candidates.length - 1]

  let streetIdx = -1
  for (let i = cszIdx - 1; i >= Math.max(0, cszIdx - 3); i--) {
    if (/^\d+[A-Z]?\s+\S+/i.test(clean[i])) { streetIdx = i; break }
  }
  if (streetIdx < 0) return undefined
  let line1 = clean[streetIdx]
  // Unit can be on its own line between street and city.
  if (streetIdx + 1 < cszIdx && /^(apt|unit|ste|suite|#)/i.test(clean[streetIdx + 1])) line1 += ' ' + clean[streetIdx + 1]
  const m = clean[cszIdx].match(CITY_STATE_ZIP)!
  return { line1, city: m[1].trim(), state: m[2].toUpperCase(), zip: m[3] + (m[4] ?? '') }
}

export function formatAddress(a: Address): string {
  return [a.line1, [a.city, [a.state, a.zip?.slice(0, 5)].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join(', ')
}
