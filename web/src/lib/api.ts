import { useCallback, useEffect, useRef, useState } from 'react'

export interface Address { line1: string; city?: string; state?: string; zip?: string }
export interface Home { homeId: string; name: string; address: Address; defaultInstruction?: string; deviceIds: string[] }
export type PackageStatus = 'expected' | 'delivered' | 'secured_in_box'
export interface Package {
  packageId: string; trackingNumber: string; carrier?: string; sender?: string; nickname: string
  instruction?: string; status: PackageStatus; createdAt: number; deliveredAt?: number; scanId?: string
}
export type BoxState = 'LOCKED' | 'UNLOCKED' | 'OPEN' | 'SECURED' | 'TAMPER'
export interface Box { state: BoxState; packageId?: string; packageIds?: string[]; unlockedUntil?: number; updatedAt: number }
export type Verdict = 'right_address' | 'wrong_address' | 'unreadable'
export interface Decision {
  verdict: Verdict; expected: boolean; packageId?: string; trackingNumber?: string
  trackingSource: 'barcode' | 'label' | 'none'
  addressCheck: { result: 'match' | 'mismatch' | 'uncertain' | 'unknown'; read?: Address; reasons: string[] }
  confidence: number; driverMessage: string
}
export interface Scan {
  scanId: string; deviceId: string; trigger: string; createdAt: number; simulated: boolean
  status: 'processing' | 'done' | 'error' | 'ignored'; decision?: Decision
  label?: { source: 'bedrock' | 'textract' | 'none'; confidence: number; error?: string }
  barcodes?: { text: string; format: string }[]
  instruction?: string; spokenText?: string; snapshotUrl?: string; audioUrl?: string
  box?: { allow: boolean; reason: string; state: BoxState }; latencyMs?: number; error?: string
}
export interface SampleLabel {
  id: string; kind: 'expected' | 'wrong_house' | 'unexpected'; title: string; tracking: string; barcode: string
  symbology: 'code128' | 'qrcode'; carrier: string; to: string[]
  photo?: string // realistic doorbell photo of this delivery
  photoBarcodeBox?: [number, number, number, number] // x, y, w, h of the label's barcode area in photo pixels
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
  return data as T
}

/** Poll an endpoint; pauses while the tab is hidden. */
export function usePoll<T>(path: string, intervalMs: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const load = useCallback(async () => {
    try { setData(await api<T>(path)); setError(null) } catch (e) { setError((e as Error).message) }
  }, [path])
  useEffect(() => {
    let alive = true
    const tick = async () => {
      if (!document.hidden) await load()
      if (alive) timer.current = window.setTimeout(tick, intervalMs)
    }
    tick()
    return () => { alive = false; window.clearTimeout(timer.current) }
  }, [load, intervalMs])
  return { data, error, reload: load }
}

export const fmtAddress = (a?: Address) =>
  a ? [a.line1, [a.city, [a.state, a.zip?.slice(0, 5)].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join(', ') : ''

export const timeAgo = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(t).toLocaleDateString()
}
