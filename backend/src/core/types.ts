// Shared domain types for DoorCheck. Kept free of AWS imports so core logic is unit-testable.

export interface Address {
  line1: string // "123 Maple Street Apt 4"
  city?: string
  state?: string // two-letter
  zip?: string // 5 or 9 digits
}

export interface Home {
  homeId: string
  name: string
  address: Address
  defaultInstruction?: string
  deviceIds: string[]
}

export type PackageStatus = 'expected' | 'delivered' | 'secured_in_box'

export interface Package {
  packageId: string
  homeId: string
  trackingNumber: string
  carrier?: string
  sender?: string
  nickname: string
  instruction?: string
  status: PackageStatus
  createdAt: number
  deliveredAt?: number
  scanId?: string
}

/** One decoded barcode from a frame. */
export interface BarcodeRead {
  text: string
  format: string
}

/** What a label reader (Bedrock vision or Textract OCR) extracted. Never contains the recipient name. */
export interface LabelRead {
  source: 'bedrock' | 'textract' | 'none'
  trackingNumber?: string
  carrier?: string
  address?: Address
  confidence: number // 0..1
  error?: string
}

export type Verdict = 'right_address' | 'wrong_address' | 'unreadable'

export interface AddressCheck {
  result: 'match' | 'mismatch' | 'uncertain' | 'unknown'
  read?: Address
  reasons: string[]
}

export interface Decision {
  verdict: Verdict
  expected: boolean // tracking number is on the homeowner's expected list
  packageId?: string
  trackingNumber?: string
  trackingSource: 'barcode' | 'label' | 'none'
  addressCheck: AddressCheck
  confidence: number
  driverMessage: string
}

export type BoxState = 'LOCKED' | 'UNLOCKED' | 'OPEN' | 'SECURED' | 'TAMPER'

export interface Box {
  homeId: string
  state: BoxState
  token?: string
  tokenExpiresAt?: number
  packageId?: string
  unlockHistory: number[] // epoch ms of recent unlocks, for rate limiting
  updatedAt: number
}
