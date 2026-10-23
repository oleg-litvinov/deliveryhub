import type { BarcodeRead, BoxState, Decision, LabelRead } from '../core/types.js'

export interface Scan {
  scanId: string
  homeId: string
  deviceId: string
  trigger: 'button_press' | 'motion_detected'
  eventTimestamp: number
  createdAt: number
  simulated: boolean
  status: 'processing' | 'done' | 'error' | 'ignored' // ignored = hands-free look with no label: nothing kept
  decision?: Decision
  label?: Pick<LabelRead, 'source' | 'confidence' | 'error'>
  barcodes?: BarcodeRead[]
  instruction?: string
  spokenText?: string
  audioKey?: string
  snapshotKey?: string
  box?: { allow: boolean; reason: string; state: BoxState }
  latencyMs?: number
  error?: string
}

/** Simulator frames are stored like Ring recordings: by device + event timestamp. */
export const simFrameKey = (deviceId: string, ts: number) => `sim/frames/${deviceId}/${ts}.jpg`
