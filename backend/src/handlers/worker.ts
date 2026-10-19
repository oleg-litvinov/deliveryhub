// Scan worker: frames → barcodes + label read → decision → instruction voice → box → package status.
import { unlockPolicy, newBox, transition } from '../core/box.js'
import { decide, pickInstruction } from '../core/decide.js'
import type { BarcodeRead } from '../core/types.js'
import { decodeBarcodes } from '../lib/barcode.js'
import { readLabel } from '../lib/label.js'
import { simFrameKey, type Scan } from '../lib/scan.js'
import { getBox, getHome, getMedia, listPackages, markPackage, putBox, putMedia, putScan } from '../lib/store.js'
import { speak } from '../lib/voice.js'
import { fetchSnapshotWithRetry, uniqueFrames } from '../ring/client.js'

/**
 * Frames around the press. Ring returns the closest *existing* frame (±10 s), so we spread the requests
 * (the driver often lifts the label just before pressing and holds it a moment after) and drop duplicates
 * by X-Media-Timestamp. Later offsets may not be recorded yet; the client retries 425/416 until they are.
 */
const FRAME_OFFSETS_MS = [-1500, 0, 2500]

async function getFrames(scan: Scan): Promise<Uint8Array[]> {
  if (scan.simulated) {
    // The Doorbell Simulator stores its frame the way Ring stores recordings: by device + timestamp.
    const f = await getMedia(simFrameKey(scan.deviceId, scan.eventTimestamp))
    return f ? [f] : []
  }
  const results = await Promise.allSettled(FRAME_OFFSETS_MS.map((o) => fetchSnapshotWithRetry(scan.deviceId, scan.eventTimestamp + o)))
  results.forEach((r) => r.status === 'rejected' && console.warn(JSON.stringify({ msg: 'snapshot_failed', error: String(r.reason) })))
  const frames = uniqueFrames(results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])))
  console.log(JSON.stringify({
    msg: 'ring_frames', scanId: scan.scanId,
    frames: frames.map((f) => ({ offsetMs: (f.mediaTimestamp ?? f.requestedAt) - scan.eventTimestamp, origin: f.origin })),
  }))
  return frames.map((f) => f.bytes)
}

export async function handler(scan: Scan): Promise<void> {
  const t0 = Date.now()
  try {
    const [home, packages, frames] = await Promise.all([getHome(scan.homeId), listPackages(scan.homeId), getFrames(scan)])
    if (!home) throw new Error(`home ${scan.homeId} not found`)
    if (!frames.length) throw new Error('No frame available from the doorbell')

    // Pick the frame with the most barcodes; read the label on that one.
    const decoded = await Promise.all(frames.map((f) => decodeBarcodes(f).catch(() => [] as BarcodeRead[])))
    const best = decoded.reduce((bi, d, i) => (d.length > decoded[bi].length ? i : bi), 0)
    const barcodes = [...new Map(decoded.flat().map((b) => [b.text, b])).values()]
    const label = await readLabel(frames[best], 'jpeg')

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
    const spokenText = 'Sorry, I could not see the label. Please hold it closer to the camera and press the doorbell again.'
    const audioKey = await speak(spokenText).catch(() => undefined)
    await putScan({ ...scan, status: 'error', error: String(e), spokenText, audioKey, latencyMs: Date.now() - scan.createdAt })
  }
}
