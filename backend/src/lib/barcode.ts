// Barcode / QR decoding with zxing-wasm. The wasm binary ships inside the Lambda bundle
// (no CDN fetch at runtime).
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import type { BarcodeRead } from '../core/types.js'

let ready = false
function ensureModule() {
  if (ready) return
  const local = fileURLToPath(new URL('./zxing_reader.wasm', import.meta.url))
  const path = existsSync(local) ? local : createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm')
  const bin = readFileSync(path)
  prepareZXingModule({ overrides: { wasmBinary: bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) } })
  ready = true
}

/** Decode every barcode in an encoded image (JPEG/PNG bytes). */
export async function decodeBarcodes(image: Uint8Array): Promise<BarcodeRead[]> {
  ensureModule()
  const results = await readBarcodes(image, {
    tryHarder: true,
    tryRotate: true,
    tryInvert: false,
    maxNumberOfSymbols: 8,
    formats: ['Code128', 'QRCode', 'DataMatrix', 'PDF417', 'Code39', 'MaxiCode'],
  })
  return results.filter((r) => r.isValid && r.text).map((r) => ({ text: r.text, format: r.format }))
}
