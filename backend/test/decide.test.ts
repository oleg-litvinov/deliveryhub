import { describe, expect, it } from 'vitest'
import { decide, pickInstruction } from '../src/core/decide.js'
import { findPackage, zipFromBarcode } from '../src/core/tracking.js'
import type { Home, Package } from '../src/core/types.js'

const home: Home = { homeId: 'h', name: 'Demo', address: { line1: '123 Maple Street', city: 'Springfield', state: 'IL', zip: '62704' }, defaultInstruction: 'Leave it by the door', deviceIds: [] }
const pkg = (id: string, trackingNumber: string, extra: Partial<Package> = {}): Package => ({ packageId: id, homeId: 'h', trackingNumber, nickname: id, status: 'expected', createdAt: 0, ...extra })
const meds = pkg('meds', '9400 1000 0000 0000 0000 00', { instruction: 'Medication, please put it in the cooler box' })
const ups = pkg('shoes', '1Z999AA10123456784')
const label = (line1?: string, zip = '62704') => ({ source: 'bedrock' as const, confidence: 0.95, address: line1 ? { line1, zip } : undefined })

describe('tracking', () => {
  it('finds a USPS package inside an IMpb barcode', () => {
    const r = findPackage([meds], [{ text: '42062704\x1d9400100000000000000000', format: 'Code128' }])
    expect(r.pkg?.packageId).toBe('meds')
    expect(r.source).toBe('barcode')
  })
  it('extracts the destination ZIP from IMpb', () => {
    expect(zipFromBarcode('420627049400100000000000000000')).toBe('62704')
  })
})

describe('decide', () => {
  it('right address + expected package by barcode', () => {
    const d = decide({ home, expected: [meds, ups], barcodes: [{ text: '1Z999AA10123456784', format: 'Code128' }], label: label('123 Maple St') })
    expect(d).toMatchObject({ verdict: 'right_address', expected: true, packageId: 'shoes', trackingSource: 'barcode' })
    expect(d.confidence).toBeGreaterThan(0.95)
  })
  it('wrong address wins even if tracking matches', () => {
    const d = decide({ home, expected: [ups], barcodes: [{ text: '1Z999AA10123456784', format: 'Code128' }], label: label('42 Oak St') })
    expect(d.verdict).toBe('wrong_address')
    expect(d.driverMessage).toContain('42 Oak St')
  })
  it('right address, unexpected package', () => {
    const d = decide({ home, expected: [ups], barcodes: [], label: label('123 Maple St') })
    expect(d).toMatchObject({ verdict: 'right_address', expected: false })
  })
  it('USPS barcode ZIP mismatch without OCR', () => {
    const d = decide({ home, expected: [], barcodes: [{ text: '420100019400100000000000000099', format: 'Code128' }], label: { source: 'none', confidence: 0 } })
    expect(d.verdict).toBe('wrong_address')
  })
  it('nothing readable asks the driver to retry', () => {
    const d = decide({ home, expected: [ups], barcodes: [], label: { source: 'none', confidence: 0 } })
    expect(d.verdict).toBe('unreadable')
  })
  it('ignores already-delivered packages', () => {
    const d = decide({ home, expected: [{ ...ups, status: 'delivered' }], barcodes: [{ text: '1Z999AA10123456784', format: 'Code128' }], label: label('123 Maple St') })
    expect(d.expected).toBe(false)
  })
  it('package instruction beats the default', () => {
    expect(pickInstruction(home, meds)).toContain('cooler')
    expect(pickInstruction(home, ups)).toBe('Leave it by the door')
  })
})
