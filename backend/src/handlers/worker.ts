// Scan worker: frames → barcodes + label read → decision → instruction voice → box → package status.
import { unlockPolicy, newBox, transition } from '../core/box.js'
import { decide, isQuietMiss, pickInstruction } from '../core/decide.js'
import type { BarcodeRead } from '../core/types.js'
import { decodeBarcodes } from '../lib/barcode.js'
import { readLabel } from '../lib/label.js'
import { simFrameKey, type Scan } from '../lib/scan.js'
import { getBox, getHome, getMedia, listPackages, markPackage, putBox, putMedia, putScan } from '../lib/store.js'
import { speak } from '../lib/voice.js'
import { fetchSnapshotWithRetry, uniqueFrames, type RingFrame } from '../ring/client.js'

/**
 * Frames to read. Ring returns the closest *existing* frame (±10 s) and the client retries 425/416 until it exists.
 * - Doorbell press: frames around the press (−1.5 s, 0, +2.5 s), fetched in parallel.
 * - Hands-free (person / package motion): the label may not be up yet when motion starts, so look every ~1.5 s
 *   for up to 10 s and stop at the first frame with a barcode. Duplicates are dropped by X-Media-Timestamp.
 */
const PRESS_OFFSETS_MS = [-1500, 0, 2500]
const LOOK_OFFSETS_MS = [0, 1500, 3000, 4500, 6000, 8000, 10000]

interface Frames { frames: Uint8Array[]; decoded: BarcodeRead[][] }

const decodeAll = (frames: Uint8Array[]) => Promise.all(frames.map((f) => decodeBarcodes(f).catch(() => [] as BarcodeRead[])))

async function getFrames(scan: Scan): Promise<Frames> {
  if (scan.simulated) {
    // The Doorbell Simulator stores its frame the way Ring stores recordings: by device + timestamp.
    const f = await getMedia(simFrameKey(scan.deviceId, scan.eventTimestamp))
    const frames = f ? [f] : []
    return { frames, decoded: await decodeAll(frames) }
  }
  if (scan.trigger === 'button_press') {
    const results = await Promise.allSettled(PRESS_OFFSETS_MS.map((o) => fetchSnapshotWithRetry(scan.deviceId, scan.eventTimestamp + o)))
    results.forEach((r) => r.status === 'rejected' && console.warn(JSON.stringify({ msg: 'snapshot_failed', error: String(r.reason) })))
    const ring = uniqueFrames(results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])))
    logFrames(scan, ring)
    const frames = ring.map((f) => f.bytes)
    return { frames, decoded: await decodeAll(frames) }
  }
  const seen: RingFrame[] = []
  const decoded: BarcodeRead[][] = []
  for (const offset of LOOK_OFFSETS_MS) {
    const f = await fetchSnapshotWithRetry(scan.deviceId, scan.eventTimestamp + offset, 6_000).catch((e) => {
      console.warn(JSON.stringify({ msg: 'snapshot_failed', offset, error: String(e) }))
      return undefined
    })
    if (!f || uniqueFrames([...seen, f]).length === seen.length) continue // missing or same frame as before
    seen.push(f)
    const codes = await decodeBarcodes(f.bytes).catch(() => [] as BarcodeRead[])
    decoded.push(codes)
    if (codes.length) break // label found: stop looking
  }
  logFrames(scan, seen)
  return { frames: seen.map((f) => f.bytes), decoded }
}

function logFrames(scan: Scan, frames: RingFrame[]) {
  console.log(JSON.stringify({
    msg: 'ring_frames', scanId: scan.scanId, trigger: scan.trigger,
    frames: frames.map((f) => ({ offsetMs: (f.mediaTimestamp ?? f.requestedAt) - scan.eventTimestamp, origin: f.origin })),
  }))
}

export async function handler(scan: Scan): Promise<void> {
  const t0 = Date.now()
  try {
    const [home, packages, { frames, decoded }] = await Promise.all([getHome(scan.homeId), listPackages(scan.homeId), getFrames(scan)])
    if (!home) throw new Error(`home ${scan.homeId} not found`)
    if (!frames.length) throw new Error('No frame available from the doorbell')

    // Pick the frame with the most barcodes (on a hands-free look with none, the latest frame); read the label there.
    const best = decoded.some((d) => d.length) ? decoded.reduce((bi, d, i) => (d.length > decoded[bi].length ? i : bi), 0) : frames.length - 1
    const barcodes = [...new Map(decoded.flat().map((b) => [b.text, b])).values()]
    const label = await readLabel(frames[best], 'jpeg')

    if (isQuietMiss(scan.trigger, barcodes, label)) {
      // Nobody showed a label: keep nothing, say nothing, and leave the Delivery Box exactly as it is.
      await putScan({ ...scan, status: 'ignored', latencyMs: Date.now() - scan.createdAt })
      console.log(JSON.stringify({ msg: 'look_no_label', scanId: scan.scanId, frames: frames.length }))
      return
    }

    const decision = decide({ home, expected: packages, barcodes, label })
    const pkg = packages.find((p) => p.packageId === decision.packageId)
    const instruction = decision.verdict === 'right_address' ? pickInstruction(home, pkg) : undefined
    const spokenText = [decision.driverMessage, instruction].filter(Boolean).join(' ')

    const snapshotKey = `snapshots/${scan.homeId}/${scan.scanId}.jpg`
    const now = Date.now()

    // Delivery box: fail closed unless the policy allows it.
    let box = transition((await getBox(scan.homeId)) ?? newBox(scan.homeId, now), { type: 'tick', now })
    const policy = unlockPolicy(decision, box, now)
    if (policy.allow) box = transition(box, { type: 'unlock', token: crypto.randomUUID(), packageId: pkg?.packageId, now })
    // Someone else is at the door now: an open unlock window from an earlier driver closes.
    else box = transition(box, { type: 'relock', now })

    const [audioKey] = await Promise.all([
      // Voice is best-effort: the decision and proof of delivery must not depend on it.
      speak(policy.allow ? `${spokenText} The delivery box is open for you.` : spokenText).catch((e) => {
        console.warn(JSON.stringify({ msg: 'speech_failed', error: String(e) }))
        return undefined
      }),
      putMedia(snapshotKey, frames[best], 'image/jpeg'),
      putBox(box),
      pkg && decision.verdict === 'right_address' ? markPackage(scan.homeId, pkg.packageId, 'delivered', { deliveredAt: now, scanId: scan.scanId }) : undefined,
    ])

    const latencyMs = Date.now() - scan.createdAt
    await putScan({
      ...scan,
      status: 'done',
      decision,
      label: { source: label.source, confidence: label.confidence, error: label.error },
      barcodes,
      instruction,
      spokenText,
      audioKey,
      snapshotKey,
      box: { allow: policy.allow, reason: policy.reason, state: box.state },
      latencyMs,
    })
    // CloudWatch Embedded Metric Format: latency and outcome without extra API calls.
    console.log(JSON.stringify({
      _aws: { Timestamp: Date.now(), CloudWatchMetrics: [{ Namespace: 'DeliveryHub', Dimensions: [['Verdict']], Metrics: [{ Name: 'ScanLatencyMs', Unit: 'Milliseconds' }, { Name: 'WorkerMs', Unit: 'Milliseconds' }] }] },
      Verdict: decision.verdict, ScanLatencyMs: latencyMs, WorkerMs: Date.now() - t0,
      labelSource: label.source, barcodes: barcodes.length, expected: decision.expected, boxUnlocked: policy.allow, simulated: scan.simulated,
    }))
  } catch (e) {
    console.error(JSON.stringify({ msg: 'scan_failed', scanId: scan.scanId, error: String(e) }))
    if (scan.trigger === 'motion_detected') {
      await putScan({ ...scan, status: 'ignored', error: String(e), latencyMs: Date.now() - scan.createdAt })
      return
    }
    const spokenText = 'Sorry, I could not see the label. Please hold it a little closer to the camera.'
    const audioKey = await speak(spokenText).catch(() => undefined)
    await putScan({ ...scan, status: 'error', error: String(e), spokenText, audioKey, latencyMs: Date.now() - scan.createdAt })
  }
}
