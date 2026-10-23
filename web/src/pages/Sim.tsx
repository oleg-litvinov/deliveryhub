// Doorbell Simulator: produces a doorbell-like frame and fires a Ring-format, HMAC-signed
// button_press webhook through the same pipeline a real Ring doorbell uses.
import { useEffect, useRef, useState } from 'react'
import { Button, Card, ScanBadge } from '../components/ui'
import { api, fmtAddress, usePoll, type Package, type SampleLabel, type Scan } from '../lib/api'
import { FRAME_H, FRAME_W, composeFrame, composePhotoFrame, toJpeg } from '../lib/scene'

type Source = 'label' | 'webcam' | 'upload'

const norm = (t: string) => t.toUpperCase().replace(/[^0-9A-Z]/g, '')

/** What pressing the bell with this label will do right now, given the homeowner's live package list. */
function labelOutcome(l: SampleLabel, packages: Package[] | undefined): { text: string; cls: string } {
  if (l.kind === 'wrong_house') return { text: 'Wrong house · box stays locked', cls: 'bg-bad/15 text-bad' }
  const pkg = packages?.find((p) => norm(l.barcode).includes(norm(p.trackingNumber)))
  if (!pkg) return { text: 'Not expected · box stays locked', cls: 'bg-warn/15 text-warn' }
  if (pkg.status === 'expected') return { text: 'Expected · unlocks the box', cls: 'bg-accent/15 text-accent' }
  return { text: 'Already delivered · reset to reuse', cls: 'bg-slate-500/20 text-slate-300' }
}
type Step = 'idle' | 'upload' | 'webhook' | 'processing' | 'done' | 'error'

export default function Sim() {
  const [labels, setLabels] = useState<SampleLabel[]>([])
  const [deviceId, setDeviceId] = useState('sim-front-door')
  const [source, setSource] = useState<Source>('label')
  const [labelId, setLabelId] = useState('meds')
  const [distance, setDistance] = useState(0.85)
  const [tilt, setTilt] = useState(-4)
  const [blur, setBlur] = useState(0)
  const [step, setStep] = useState<Step>('idle')
  const [scan, setScan] = useState<Scan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [upload, setUpload] = useState<HTMLImageElement | null>(null)
  const home = usePoll<{ packages: Package[] }>('/home', 3000)
  const [photos, setPhotos] = useState<Record<string, HTMLImageElement>>({})
  const preview = useRef<HTMLCanvasElement>(null)
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => { api<{ labels: SampleLabel[]; deviceId: string }>('/sim/labels').then((r) => { setLabels(r.labels); setDeviceId(r.deviceId) }).catch((e) => setError(e.message)) }, [])

  // Preload realistic sample photos.
  useEffect(() => {
    labels.filter((l) => l.photo).forEach((l) => {
      const img = new Image()
      img.onload = () => setPhotos((p) => ({ ...p, [l.id]: img }))
      img.src = l.photo!
    })
  }, [labels])
  const selected = labels.find((l) => l.id === labelId)
  const photoMode = source === 'label' && !!selected?.photo && !!photos[labelId]

  useEffect(() => {
    if (source !== 'webcam') return
    let stream: MediaStream | undefined
    navigator.mediaDevices?.getUserMedia({ video: { width: 1920, height: 1080, facingMode: 'environment' } })
      .then((s) => { stream = s; if (video.current) { video.current.srcObject = s; video.current.play() } })
      .catch(() => setError('Camera not available. Use a sample label or upload a photo.'))
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [source])

  const frame = (timestamp: number) => {
    const label = labels.find((l) => l.id === labelId)
    if (source === 'label' && label?.photo && photos[label.id]) return composePhotoFrame(photos[label.id], label, { deviceId, timestamp })
    if (source === 'label') return label ? composeFrame({ label }, { distance, tilt, blur, deviceId, timestamp }) : null
    if (source === 'webcam' && video.current?.videoWidth) {
      const v = video.current
      return composeFrame({ image: Object.assign(v, { width: v.videoWidth, height: v.videoHeight }) }, { distance, tilt, blur, deviceId, timestamp })
    }
    if (source === 'upload' && upload) return composeFrame({ image: upload }, { distance, tilt, blur, deviceId, timestamp })
    return null
  }

  // Live preview for sample labels and uploads.
  useEffect(() => {
    if (source === 'webcam') return
    const c = frame(Date.now())
    const p = preview.current
    if (!c || !p) return
    p.getContext('2d')!.drawImage(c, 0, 0, p.width, p.height)
  }, [labels, labelId, distance, tilt, blur, source, upload, photos]) // eslint-disable-line react-hooks/exhaustive-deps

  const press = async () => {
    setError(null); setScan(null)
    try {
      setStep('upload')
      const { timestamp, uploadUrl } = await api<{ timestamp: number; uploadUrl: string }>('/sim/frame', { method: 'POST' })
      const c = frame(timestamp)
      if (!c) throw new Error('No frame to send')
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: await toJpeg(c) })
      if (!put.ok) throw new Error(`Frame upload failed (${put.status})`)
      setStep('webhook')
      const r = await api<{ status: string; scanId?: string }>('/sim/press', { method: 'POST', json: { timestamp } })
      if (!r.scanId) throw new Error(`Webhook ${r.status}`)
      setStep('processing')
      for (let i = 0; i < 60; i++) {
        await new Promise((res) => setTimeout(res, 700))
        const { scans } = await api<{ scans: Scan[] }>('/scans?limit=5')
        const s = scans.find((x) => x.scanId === r.scanId)
        if (s) setScan(s)
        if (s && s.status !== 'processing') { setStep('done'); home.reload(); return }
      }
      throw new Error('Timed out waiting for the result')
    } catch (e) {
      setError((e as Error).message); setStep('error')
    }
  }

  const busy = step === 'upload' || step === 'webhook' || step === 'processing'
  const tabs: [Source, string][] = [['label', 'Sample label'], ['webcam', 'Webcam'], ['upload', 'Upload photo']]

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-5">
      <header>
        <div className="text-xs font-semibold uppercase tracking-widest text-accent">Doorbell Simulator</div>
        <h1 className="text-xl font-bold">Show a label to the doorbell</h1>
        <p className="text-sm text-mute">Sends the same HMAC-signed <code>button_press</code> webhook as a Ring doorbell, through the same pipeline. Only the camera is simulated.</p>
      </header>

      <div className="grid grid-cols-3 rounded-xl border border-line bg-panel p-1 text-sm font-semibold">
        {tabs.map(([k, t]) => <button key={k} onClick={() => setSource(k)} className={`rounded-lg py-2 ${source === k ? 'bg-accent text-ink' : 'text-mute'}`}>{t}</button>)}
      </div>

      {source === 'label' && (
        <div className="grid grid-cols-2 gap-2">
          {labels.map((l) => (
            <button key={l.id} onClick={() => setLabelId(l.id)}
              className={`rounded-xl border p-3 text-left text-sm ${labelId === l.id ? 'border-accent bg-accent/10' : 'border-line bg-panel'}`}>
              {l.photo && <img src={l.photo} alt="" className="mb-2 aspect-video w-full rounded-lg object-cover" />}
              <div className="font-semibold">{l.title}</div>
              <div className="text-xs text-mute">{l.to.join(', ')}</div>
              {(() => { const o = labelOutcome(l, home.data?.packages); return <div className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${o.cls}`}>{o.text}</div> })()}
            </button>
          ))}
        </div>
      )}
      {source === 'label' && (
        <div className="flex items-center justify-between text-xs text-mute">
          <span>Each expected package unlocks the box once, like a real delivery.</span>
          <button className="underline hover:text-white" onClick={async () => { await api('/demo/reset', { method: 'POST' }); setScan(null); setStep('idle'); home.reload() }}>Reset demo</button>
        </div>
      )}
      {source === 'upload' && (
        <input type="file" accept="image/*" className="text-sm" onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return
          const img = new Image(); img.onload = () => setUpload(img); img.src = URL.createObjectURL(f)
        }} />
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-black">
        {source === 'webcam'
          ? <video ref={video} muted playsInline className="aspect-video w-full object-cover" />
          : <canvas ref={preview} width={FRAME_W / 3} height={FRAME_H / 3} className="aspect-video w-full" />}
      </div>

      {photoMode && <p className="text-xs text-mute">Photo sample: a real-looking doorbell frame. The label's barcode is drawn as a real, scannable code with the tracking number printed under it.</p>}
      {source === 'label' && !photoMode && (
        <Card className="grid gap-3 text-sm">
          <Slider label="Label distance from the lens" value={distance} min={0.45} max={0.95} step={0.05} onChange={setDistance} display={`≈ ${Math.round(7.6 / distance)} cm`} />
          <Slider label="Tilt" value={tilt} min={-20} max={20} step={1} onChange={setTilt} unit="°" />
          <Slider label="Motion blur" value={blur} min={0} max={4} step={0.5} onChange={setBlur} unit="px" />
        </Card>
      )}

      <Button onClick={press} disabled={busy} className="!py-4 text-lg">{busy ? 'Working…' : '🔔 Press the doorbell'}</Button>

      <ol className="grid grid-cols-4 gap-2 text-center text-[11px] text-mute">
        {[['upload', 'Frame captured'], ['webhook', 'Signed webhook'], ['processing', 'Reading label'], ['done', 'Decision']].map(([k, t], i) => {
          const order = ['upload', 'webhook', 'processing', 'done']
          const reached = step === 'error' ? false : order.indexOf(step) >= i
          return <li key={k} className={`rounded-lg border px-1 py-2 ${reached ? 'border-accent/50 text-accent' : 'border-line'}`}>{t}</li>
        })}
      </ol>

      {error && <Card className="border-warn/50 text-sm text-warn">{error}</Card>}
      {scan && (
        <Card className="space-y-2 text-sm">
          <div className="flex items-center justify-between"><ScanBadge scan={scan} />{scan.latencyMs && <span className="text-xs text-mute">{(scan.latencyMs / 1000).toFixed(1)} s</span>}</div>
          {scan.decision && <p>Read: {fmtAddress(scan.decision.addressCheck.read) || '—'} · {scan.decision.addressCheck.reasons.join('; ')}</p>}
          {scan.spokenText && <p className="text-slate-300">Driver hears: “{scan.spokenText}”</p>}
        </Card>
      )}
    </div>
  )
}

// A 15 cm label filling fraction f of a ~90° vertical field of view sits about 7.6 / f cm from the lens.
function Slider({ label, value, min, max, step, onChange, unit = '', display }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string; display?: string }) {
  return (
    <label className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
      <span className="text-mute">{label}</span><span className="tabular-nums">{display ?? `${value}${unit}`}</span>
      <input type="range" className="col-span-2 accent-teal-400" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}
