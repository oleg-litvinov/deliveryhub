// Homeowner app, Door Display, virtual Delivery Box and Doorbell Simulator API.
// Demo mode: a single seeded home and no login, so judges can try it in 60 seconds.
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { newBox, transition } from '../core/box.js'
import { DEMO_HOME_ID, SAMPLE_LABELS, SIM_DEVICE_ID, demoHome, demoPackages } from '../core/demo.js'
import type { Box, Package } from '../core/types.js'
import { simFrameKey, type Scan } from '../lib/scan.js'
import {
  deletePackage, getBox, getHome, listPackages, listScans, markPackage, mediaGetUrl, mediaPutUrl, putBox, putHome, putPackage,
} from '../lib/store.js'
import { signBody } from '../ring/signature.js'
import { buildWebhook } from '../ring/webhook.js'

const HOME = process.env.HOME_ID ?? DEMO_HOME_ID
const res = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body),
})
const bad = (msg: string) => res(400, { error: msg })

async function currentBox(): Promise<Box> {
  const now = Date.now()
  const stored = (await getBox(HOME)) ?? newBox(HOME, now)
  const ticked = transition(stored, { type: 'tick', now })
  if (ticked !== stored) await putBox(ticked)
  return ticked
}
const publicBox = ({ token, ...b }: Box) => ({ ...b, unlockedUntil: b.state === 'UNLOCKED' ? b.tokenExpiresAt : undefined })

async function withMediaUrls(s: Scan) {
  return {
    ...s,
    snapshotUrl: s.snapshotKey ? await mediaGetUrl(s.snapshotKey) : undefined,
    audioUrl: s.audioKey ? await mediaGetUrl(s.audioKey) : undefined,
  }
}

async function reset() {
  const now = Date.now()
  const extra = (process.env.RING_DEVICE_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  for (const p of await listPackages(HOME)) await deletePackage(HOME, p.packageId)
  await putHome(demoHome(extra))
  await Promise.all(demoPackages(now).map(putPackage))
  await putBox(newBox(HOME, now))
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method
  const path = event.rawPath.replace(/^\/api/, '')
  const body = event.body ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : {}

  try {
    // ---- homeowner
    if (method === 'GET' && path === '/home') {
      let home = await getHome(HOME)
      if (!home) { await reset(); home = await getHome(HOME) }
      const [packages, box] = await Promise.all([listPackages(HOME), currentBox()])
      packages.sort((a, b) => b.createdAt - a.createdAt)
      return res(200, { home, packages, box: publicBox(box) })
    }
    if (method === 'PUT' && path === '/home/instruction') {
      const home = await getHome(HOME)
      if (!home) return res(404, { error: 'no home' })
      await putHome({ ...home, defaultInstruction: String(body.instruction ?? '').slice(0, 300) })
      return res(200, { ok: true })
    }
    if (method === 'POST' && path === '/packages') {
      const tracking = String(body.trackingNumber ?? '').trim()
      if (tracking.replace(/[^0-9A-Z]/gi, '').length < 10) return bad('Tracking number looks too short')
      const pkg: Package = {
        packageId: crypto.randomUUID().slice(0, 8),
        homeId: HOME,
        trackingNumber: tracking,
        nickname: String(body.nickname ?? 'Package').slice(0, 60),
        carrier: body.carrier ? String(body.carrier).slice(0, 20) : undefined,
        sender: body.sender ? String(body.sender).slice(0, 60) : undefined,
        instruction: body.instruction ? String(body.instruction).slice(0, 300) : undefined,
        status: 'expected',
        createdAt: Date.now(),
      }
      await putPackage(pkg)
      return res(201, pkg)
    }
    const pkgMatch = path.match(/^\/packages\/([\w-]+)$/)
    if (pkgMatch && method === 'DELETE') { await deletePackage(HOME, pkgMatch[1]); return res(200, { ok: true }) }
    if (pkgMatch && method === 'PATCH') {
      const fields: Partial<Package> = {}
      if (typeof body.instruction === 'string') fields.instruction = body.instruction.slice(0, 300)
      if (typeof body.nickname === 'string') fields.nickname = body.nickname.slice(0, 60)
      const pkgs = await listPackages(HOME)
      const p = pkgs.find((x) => x.packageId === pkgMatch[1])
      if (!p) return res(404, { error: 'not found' })
      await markPackage(HOME, p.packageId, p.status, fields)
      return res(200, { ok: true })
    }
    if (method === 'GET' && path === '/scans') {
      const scans = await listScans(HOME, Number(event.queryStringParameters?.limit ?? 30))
      return res(200, { scans: await Promise.all(scans.map(withMediaUrls)) })
    }
    if (method === 'POST' && path === '/demo/reset') { await reset(); return res(200, { ok: true }) }

    // ---- Door Display (driver-facing): latest scan for a door
    if (method === 'GET' && path === '/door/latest') {
      const [scan] = await listScans(HOME, 1)
      const box = await currentBox()
      return res(200, { scan: scan ? await withMediaUrls(scan) : null, box: publicBox(box), home: { line1: (await getHome(HOME))?.address.line1 } })
    }

    // ---- Delivery Box (virtual hardware + homeowner remote unlock)
    if (method === 'POST' && path === '/box/unlock') {
      // Human-in-the-loop: the homeowner approves an unexpected package from the app.
      const box = await currentBox()
      const next = transition(box, { type: 'unlock', token: crypto.randomUUID(), now: Date.now() })
      if (next === box) return bad(`Box is ${box.state}`)
      await putBox(next)
      return res(200, publicBox(next))
    }
    if (method === 'POST' && path === '/box/lid') {
      // Simulates the box firmware: it holds the token it received from the cloud (IoT shadow in production).
      const box = await currentBox()
      const now = Date.now()
      let next: Box
      if (body.action === 'open') next = transition(box, { type: 'lid_open', token: box.token, now })
      else if (body.action === 'force') next = transition(box, { type: 'lid_open', now })
      else if (body.action === 'close') {
        next = transition(box, { type: 'lid_close', now })
        if (next.state === 'SECURED' && box.packageId) await markPackage(HOME, box.packageId, 'secured_in_box').catch(() => undefined)
      } else if (body.action === 'reset') next = { ...newBox(HOME, now), unlockHistory: box.unlockHistory }
      else return bad('action must be open | close | force | reset')
      await putBox(next)
      return res(200, publicBox(next))
    }

    // ---- Doorbell Simulator: same signed Ring webhook, same pipeline; only the frame source differs.
    if (method === 'GET' && path === '/sim/labels') return res(200, { labels: SAMPLE_LABELS, deviceId: SIM_DEVICE_ID })
    if (method === 'POST' && path === '/sim/frame') {
      const timestamp = Date.now()
      return res(200, { timestamp, uploadUrl: await mediaPutUrl(simFrameKey(SIM_DEVICE_ID, timestamp), 'image/jpeg') })
    }
    if (method === 'POST' && path === '/sim/press') {
      const timestamp = Number(body.timestamp)
      if (!timestamp || Math.abs(Date.now() - timestamp) > 300_000) return bad('timestamp missing or stale')
      const hook = buildWebhook(SIM_DEVICE_ID, 'button_press', timestamp)
      const raw = JSON.stringify(hook)
      // Post to our own public webhook so the event goes through signature check + dedupe like a real Ring event.
      const r = await fetch(`https://${event.requestContext.domainName}/ring/webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-signature': signBody(raw, process.env.RING_WEBHOOK_SECRET!) },
        body: raw,
      })
      return res(r.status, await r.json())
    }

    return res(404, { error: `no route ${method} ${path}` })
  } catch (e) {
    console.error(JSON.stringify({ msg: 'api_error', path, error: String(e) }))
    return res(500, { error: 'internal error' })
  }
}
