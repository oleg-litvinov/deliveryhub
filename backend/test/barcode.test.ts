import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { prepareZXingModule, writeBarcode } from 'zxing-wasm/full'
import { decodeBarcodes } from '../src/lib/barcode.js'

const bin = readFileSync(createRequire(import.meta.url).resolve('zxing-wasm/full/zxing_full.wasm'))
prepareZXingModule({ overrides: { wasmBinary: bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) } })

describe('decodeBarcodes', () => {
  it('reads a UPS Code128 tracking number from a PNG', async () => {
    const { image } = await writeBarcode('1Z999AA10123456784', { format: 'Code128', scale: 3 })
    const bytes = new Uint8Array(await image!.arrayBuffer())
    const reads = await decodeBarcodes(bytes)
    expect(reads.map((r) => r.text)).toContain('1Z999AA10123456784')
  })
  it('reads a QR code', async () => {
    const { image } = await writeBarcode('TBA123456789012', { format: 'QRCode', scale: 4 })
    const reads = await decodeBarcodes(new Uint8Array(await image!.arrayBuffer()))
    expect(reads[0]?.text).toBe('TBA123456789012')
  })
})
