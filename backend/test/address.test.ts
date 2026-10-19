import { describe, expect, it } from 'vitest'
import { matchAddress, normalizeAddress, parseAddressFromLines } from '../src/core/address.js'

const home = { line1: '123 Maple Street', city: 'Springfield', state: 'IL', zip: '62704' }

describe('normalizeAddress', () => {
  it('handles suffix abbreviations and directions', () => {
    expect(normalizeAddress({ line1: '123 N. Maple St.' })).toMatchObject({ number: '123', streetName: 'maple', suffix: 'street', direction: 'north' })
    expect(normalizeAddress({ line1: '9 West St' })).toMatchObject({ streetName: 'west', suffix: 'street' })
    expect(normalizeAddress({ line1: '42 Oak Ave Apt 4B' })).toMatchObject({ number: '42', streetName: 'oak', unit: '4b' })
    expect(normalizeAddress({ line1: '42 Oak Ave #4B' })).toMatchObject({ unit: '4b' })
  })
})

describe('matchAddress', () => {
  it('matches abbreviations', () => {
    expect(matchAddress({ line1: '123 MAPLE ST', zip: '62704' }, home).result).toBe('match')
  })
  it('flags a different house number', () => {
    const r = matchAddress({ line1: '125 Maple St', zip: '62704' }, home)
    expect(r.result).toBe('mismatch')
    expect(r.reasons[0]).toContain('125')
  })
  it('flags a different street', () => {
    expect(matchAddress({ line1: '123 Oak St', zip: '62704' }, home).result).toBe('mismatch')
  })
  it('flags a different ZIP', () => {
    expect(matchAddress({ line1: '123 Maple St', zip: '62701' }, home).result).toBe('mismatch')
  })
  it('tolerates a small OCR typo when number and ZIP agree', () => {
    expect(matchAddress({ line1: '123 Mapel St', zip: '62704' }, home).result).toBe('match')
  })
  it('does not call a different but similar street a clean match', () => {
    expect(matchAddress({ line1: '123 Maplewood St', zip: '62704' }, home).result).not.toBe('match')
  })
  it('requires the right unit for apartments', () => {
    const apt = { line1: '42 Oak Ave Apt 4B', zip: '10001' }
    expect(matchAddress({ line1: '42 Oak Ave Apt 4C', zip: '10001' }, apt).result).toBe('mismatch')
    expect(matchAddress({ line1: '42 Oak Ave', zip: '10001' }, apt).result).toBe('uncertain')
  })
  it('returns unknown when nothing was read', () => {
    expect(matchAddress(undefined, home).result).toBe('unknown')
  })
})

describe('parseAddressFromLines', () => {
  it('takes the SHIP TO block and skips the recipient name', () => {
    const lines = ['ACME STORE', '1 Warehouse Rd', 'Reno, NV 89501', 'SHIP TO:', 'JANE DOE', '123 Maple St', 'Springfield IL 62704-1234', 'USPS TRACKING #']
    expect(parseAddressFromLines(lines)).toEqual({ line1: '123 Maple St', city: 'Springfield', state: 'IL', zip: '627041234' })
  })
  it('never falls back to the return address when the ship-to block is unreadable', () => {
    const lines = ['USPS PRIORITY MAIL', 'ACME FULFILLMENT', '1 WAREHOUSE RD', 'RENO NV 89501', 'SHIP TO:', 'J RIV~', '1Z3 MA#LE', 'TRACKING #']
    expect(parseAddressFromLines(lines)).toBeUndefined()
  })
  it('rejects OCR debris as a street line', () => {
    expect(parseAddressFromLines(['SHIP TO:', 'J. RIVERA', '9 -', 'SPRINGFIELD IL 62704'])).toBeUndefined()
  })
  it('falls back to the last address block', () => {
    const lines = ['From', '1 Warehouse Rd', 'Reno, NV 89501', 'Jane', '42 Oak Ave', 'Apt 4B', 'New York, NY 10001']
    expect(parseAddressFromLines(lines)).toMatchObject({ line1: '42 Oak Ave Apt 4B', zip: '10001' })
  })
})
