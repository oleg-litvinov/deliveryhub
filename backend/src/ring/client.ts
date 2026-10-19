// Ring Partner API (Amazon Vision) client: OAuth refresh + image snapshots.
// OAuth refresh flow adapted from AmazonAppDev/ring-api-helloworld (MIT).
import { getRingTokens, saveRingTokens } from '../lib/store.js'

const API = 'https://api.amazonvision.com'
const OAUTH = 'https://oauth.ring.com/oauth/token'

let cached: { token: string; expiresAt: number } | null = null

export async function getAccessToken(): Promise<string> {
  if (process.env.RING_ACCESS_TOKEN) return process.env.RING_ACCESS_TOKEN // Developer Playground token (dev only)
  if (cached && Date.now() < cached.expiresAt) return cached.token

  const stored = await getRingTokens()
  if (stored?.accessToken && Date.now() < stored.expiresAt) {
    cached = { token: stored.accessToken, expiresAt: stored.expiresAt }
    return stored.accessToken
  }
  const refreshToken = stored?.refreshToken ?? process.env.RING_REFRESH_TOKEN
  if (!refreshToken || !process.env.RING_CLIENT_ID || !process.env.RING_CLIENT_SECRET) {
    throw new Error('Ring auth not configured (need RING_REFRESH_TOKEN + RING_CLIENT_ID + RING_CLIENT_SECRET)')
  }
  const res = await fetch(OAUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.RING_CLIENT_ID,
      client_secret: process.env.RING_CLIENT_SECRET,
    }),
  })
  if (!res.ok) throw new Error(`Ring token refresh failed: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number }
  const expiresAt = Date.now() + data.expires_in * 1000 - 60_000
  cached = { token: data.access_token, expiresAt }
  await saveRingTokens({ accessToken: data.access_token, refreshToken: data.refresh_token ?? refreshToken, expiresAt })
  return data.access_token
}

export class RingMediaError extends Error {
  constructor(public status: number, public code: string) {
    super(`Ring media ${status} ${code}`)
  }
}

/**
 * Fetch one frame at a timestamp. Step 1 returns 303 + a pre-signed Location; step 2 GETs it
 * without our bearer token (pre-signed URLs reject a second auth mechanism).
 */
export async function fetchSnapshot(deviceId: string, timestamp: number, width = 1920, height = 1080): Promise<Uint8Array> {
  const token = await getAccessToken()
  const res = await fetch(`${API}/v1/devices/${encodeURIComponent(deviceId)}/media/image/download`, {
    method: 'POST',
    redirect: 'manual',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'at_timestamp', timestamp, image_options: { format: 'jpeg', resolution: { width, height } } }),
  })
  if (res.status !== 303 && res.status !== 302) {
    let code = 'UNKNOWN'
    try { code = ((await res.json()) as { errors?: { code?: string }[] }).errors?.[0]?.code ?? code } catch {}
    throw new RingMediaError(res.status, code)
  }
  const img = await fetch(res.headers.get('location')!)
  if (!img.ok) throw new RingMediaError(img.status, 'DOWNLOAD_FAILED')
  return new Uint8Array(await img.arrayBuffer())
}

/** Retry 425 RECORDING_NOT_READY / 5xx with exponential backoff + jitter. */
export async function fetchSnapshotWithRetry(deviceId: string, timestamp: number, deadlineMs = 12_000): Promise<Uint8Array> {
  const start = Date.now()
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchSnapshot(deviceId, timestamp)
    } catch (e) {
      const retryable = e instanceof RingMediaError && (e.status === 425 || e.status >= 500)
      const wait = Math.min(4000, 500 * 2 ** attempt) * (0.5 + Math.random() / 2)
      if (!retryable || Date.now() - start + wait > deadlineMs) throw e
      await new Promise((r) => setTimeout(r, wait))
    }
  }
}

export async function listDevices(): Promise<unknown> {
  const token = await getAccessToken()
  const res = await fetch(`${API}/v1/devices?include=status`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Ring devices failed: ${res.status}`)
  return res.json()
}

// ---- one-way account linking (architecture/app-deployment.md §5–6)
async function oauth(params: Record<string, string>) {
  const res = await fetch(OAUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, client_id: process.env.RING_CLIENT_ID!, client_secret: process.env.RING_CLIENT_SECRET! }),
  })
  if (!res.ok) throw new Error(`Ring OAuth ${params.grant_type} failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as { access_token: string; refresh_token: string; expires_in: number }
}

/** Exchange the authorization code Ring POSTed to our Token Exchange URL (must happen within 60 s). */
export async function exchangeCode(code: string) {
  const t = await oauth({ grant_type: 'authorization_code', code })
  return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000 - 60_000 }
}

async function ava(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed: ${res.status} ${await res.text()}`)
  return res.status === 204 ? {} : res.json()
}

export const getAccountId = async (token: string) => ((await ava('/v1/users/me', token)) as { data: { id: string } }).data.id

/** POST (nonce verification → "awaiting") then PATCH ("completed"); both are required by Ring. */
export async function completeIntegration(token: string, accountIdentifier: string, nonce: string) {
  await ava('/v1/accounts/me/app-integrations', token, { method: 'POST', body: JSON.stringify({ account_identifier: accountIdentifier, nonce }) })
  await ava('/v1/accounts/me/app-integrations', token, { method: 'PATCH', body: JSON.stringify({ account_identifier: accountIdentifier, status: 'completed' }) })
}

export async function listDeviceIds(token: string): Promise<{ id: string; name?: string; type?: string }[]> {
  const body = (await ava('/v1/devices', token)) as { data?: { id: string; type?: string; attributes?: { name?: string; kind?: string } }[] }
  return (body.data ?? []).map((d) => ({ id: d.id, name: d.attributes?.name, type: d.attributes?.kind ?? d.type }))
}
