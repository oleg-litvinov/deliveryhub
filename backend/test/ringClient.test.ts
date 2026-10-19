import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSnapshot, fetchSnapshotWithRetry, uniqueFrames, type RingFrame } from '../src/ring/client.js'

const img = (ts: number) => new Response(new Uint8Array([0xff, 0xd8, ts % 256]), { status: 200, headers: { 'x-media-timestamp': String(ts), 'x-media-origin': 'recording' } })
const redirect = () => new Response(null, { status: 303, headers: { location: 'https://media.example/presigned?sig=1' } })
const err = (status: number, code: string) => new Response(JSON.stringify({ errors: [{ code }] }), { status })

describe('Ring image download', () => {
  beforeEach(() => { process.env.RING_ACCESS_TOKEN = 'test-token' })
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.RING_ACCESS_TOKEN })

  it('follows the 303 manually, without sending the bearer token to the pre-signed URL', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(redirect()).mockResolvedValueOnce(img(1_700_000_000_123))
    vi.stubGlobal('fetch', fetchMock)
    const f = await fetchSnapshot('dev1', 1_700_000_000_000)
    const [url1, init1] = fetchMock.mock.calls[0]
    expect(url1).toBe('https://api.amazonvision.com/v1/devices/dev1/media/image/download')
    expect(init1.redirect).toBe('manual')
    expect(JSON.parse(init1.body)).toMatchObject({ type: 'at_timestamp', timestamp: 1_700_000_000_000 })
    expect(fetchMock.mock.calls[1]).toEqual(['https://media.example/presigned?sig=1'])
    expect(f).toMatchObject({ mediaTimestamp: 1_700_000_000_123, origin: 'recording', requestedAt: 1_700_000_000_000 })
  })

  it('retries RECORDING_NOT_READY and MEDIA_NOT_FOUND until the frame exists', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(err(425, 'RECORDING_NOT_READY'))
      .mockResolvedValueOnce(err(416, 'MEDIA_NOT_FOUND'))
      .mockResolvedValueOnce(redirect())
      .mockResolvedValueOnce(img(5)))
    const f = await fetchSnapshotWithRetry('dev1', 1, 10_000)
    expect(f.mediaTimestamp).toBe(5)
  })

  it('does not retry a 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(err(403, 'REQUEST_FORBIDDEN')))
    await expect(fetchSnapshotWithRetry('dev1', 1, 10_000)).rejects.toThrow('403 REQUEST_FORBIDDEN')
  })
})

describe('uniqueFrames', () => {
  const frame = (requestedAt: number, mediaTimestamp?: number, b = 1): RingFrame => ({ bytes: new Uint8Array([b, b, b]), requestedAt, mediaTimestamp })
  it('drops frames Ring resolved to the same media timestamp', () => {
    const out = uniqueFrames([frame(0, 100), frame(1500, 100), frame(2500, 2600)])
    expect(out.map((f) => f.mediaTimestamp)).toEqual([100, 2600])
  })
  it('falls back to comparing bytes when the header is missing', () => {
    expect(uniqueFrames([frame(0, undefined, 7), frame(1, undefined, 7), frame(2, undefined, 8)])).toHaveLength(2)
  })
})
