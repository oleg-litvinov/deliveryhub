// Turns everything we read from the door into one explainable decision.
import { formatAddress, matchAddress } from './address.js'
import { findPackage, zipFromBarcode } from './tracking.js'
import type { BarcodeRead, Decision, Home, LabelRead, Package } from './types.js'

export function decide(input: {
  home: Home
  expected: Package[]
  barcodes: BarcodeRead[]
  label: LabelRead
}): Decision {
  const { home, expected, barcodes, label } = input
  const found = findPackage(expected.filter((p) => p.status === 'expected'), barcodes, label.trackingNumber)

  let addressCheck = matchAddress(label.address, home.address)
  // No readable address, but a USPS barcode carries the destination ZIP: use it as a weaker check.
  if (addressCheck.result === 'unknown') {
    const zip = barcodes.map((b) => zipFromBarcode(b.text)).find(Boolean)
    const homeZip = home.address.zip?.slice(0, 5)
    if (zip && homeZip) {
      addressCheck = zip === homeZip
        ? { result: 'uncertain', reasons: [`Barcode ZIP ${zip} matches; street not read`] }
        : { result: 'mismatch', reasons: [`Barcode ZIP ${zip} ≠ ${homeZip}`] }
    }
  }

  const base = {
    expected: !!found.pkg,
    packageId: found.pkg?.packageId,
    trackingNumber: found.tracking,
    trackingSource: found.source,
    addressCheck,
  }

  if (addressCheck.result === 'mismatch') {
    const where = addressCheck.read ? formatAddress(addressCheck.read) : 'a different address'
    return {
      ...base,
      verdict: 'wrong_address',
      confidence: Math.max(label.confidence, 0.9),
      driverMessage: `Wait, this package is for ${where}. This is ${home.address.line1}.`,
    }
  }

  const addressOk = addressCheck.result === 'match'
  const knownByBarcode = found.pkg && found.source === 'barcode'
  if (addressOk || knownByBarcode) {
    const confidence = addressOk && knownByBarcode ? 0.99 : addressOk ? label.confidence : 0.9
    return { ...base, verdict: 'right_address', confidence, driverMessage: `Thanks, this is the right address.` }
  }

  return {
    ...base,
    verdict: 'unreadable',
    confidence: label.confidence,
    driverMessage: 'Sorry, I could not read the label. Please hold it closer to the camera and press the doorbell again.',
  }
}

/** Package-specific instruction wins, then the home default. */
export function pickInstruction(home: Home, pkg?: Package): string | undefined {
  return pkg?.instruction?.trim() || home.defaultInstruction?.trim() || undefined
}
