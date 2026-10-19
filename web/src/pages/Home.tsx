// Homeowner app: expected packages, instructions, delivery feed with photo proof, alerts, Delivery Box.
import { useState, type FormEvent } from 'react'
import { BoxStatus, Button, Card, DeliveryBoxArt, ScanBadge } from '../components/ui'
import { api, fmtAddress, timeAgo, usePoll, type Box, type Home as HomeT, type Package, type Scan } from '../lib/api'

interface HomeData { home: HomeT; packages: Package[]; box: Box }
type Tab = 'activity' | 'packages' | 'settings'

const STATUS: Record<Package['status'], { label: string; cls: string }> = {
  expected: { label: 'Expected', cls: 'bg-slate-500/20 text-slate-300' },
  delivered: { label: 'Delivered at the door', cls: 'bg-ok/15 text-ok' },
  secured_in_box: { label: 'Secured in box', cls: 'bg-accent/15 text-accent' },
}

export default function Home() {
  const home = usePoll<HomeData>('/home', 2500)
  const scans = usePoll<{ scans: Scan[] }>('/scans?limit=20', 2500)
  const [tab, setTab] = useState<Tab>('activity')
  const reload = () => { home.reload(); scans.reload() }

  if (!home.data) return <div className="grid h-full place-items-center text-mute">{home.error ?? 'Loading…'}</div>
  const { home: h, packages, box } = home.data
  const pkgById = new Map(packages.map((p) => [p.packageId, p]))
  const alert = scans.data?.scans.find((s) => Date.now() - s.createdAt < 30 * 60_000 && s.decision && (s.decision.verdict === 'wrong_address' || !s.decision.expected))

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 pb-10 pt-5">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-accent">DeliveryHub</div>
          <h1 className="text-xl font-bold">{h.name}</h1>
          <p className="text-sm text-mute">{fmtAddress(h.address)}</p>
        </div>
        <img src="/favicon.svg" alt="" className="h-10 w-10" />
      </header>

      {box.state === 'TAMPER' && <Banner tone="bad" title="Delivery box opened without a verified delivery" body="A photo from the doorbell was saved. Check the activity feed." />}
      {alert && box.state !== 'TAMPER' && (
        alert.decision!.verdict === 'wrong_address'
          ? <Banner tone="bad" title="Wrong package at your door" body={`Label read: ${fmtAddress(alert.decision!.addressCheck.read) || 'another address'}. The driver was told. ${timeAgo(alert.createdAt)}.`} />
          : <Banner tone="warn" title="Unexpected package delivered" body={`Not on your expected list${alert.decision!.trackingNumber ? ` (tracking ${alert.decision!.trackingNumber})` : ''}. ${timeAgo(alert.createdAt)}.`} />
      )}

      <BoxCard box={box} pkg={box.packageId ? pkgById.get(box.packageId) : undefined} onChange={reload} />

      <nav className="grid grid-cols-3 rounded-xl border border-line bg-panel p-1 text-sm font-semibold">
        {(['activity', 'packages', 'settings'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg py-2 capitalize ${tab === t ? 'bg-accent text-ink' : 'text-mute'}`}>{t}</button>
        ))}
      </nav>

      {tab === 'activity' && <Activity scans={scans.data?.scans ?? []} pkgById={pkgById} home={h} />}
      {tab === 'packages' && <Packages packages={packages} onChange={reload} />}
      {tab === 'settings' && <Settings home={h} onChange={reload} />}
    </div>
  )
}

function Banner({ tone, title, body }: { tone: 'bad' | 'warn'; title: string; body: string }) {
  return (
    <div className={`animate-pop rounded-2xl border p-3 ${tone === 'bad' ? 'border-bad/40 bg-bad/10' : 'border-warn/40 bg-warn/10'}`}>
      <div className={`font-semibold ${tone === 'bad' ? 'text-bad' : 'text-warn'}`}>{tone === 'bad' ? '⚠︎' : 'ⓘ'} {title}</div>
      <div className="text-sm text-slate-300">{body}</div>
    </div>
  )
}

function BoxCard({ box, pkg, onChange }: { box: Box; pkg?: Package; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn() } finally { setBusy(false); onChange() } }
  return (
    <Card className="flex items-center gap-4">
      <DeliveryBoxArt state={box.state} size={76} />
      <div className="flex-1">
        <div className="text-xs uppercase tracking-wider text-mute">Delivery Box <span className="normal-case">(concept)</span></div>
        <BoxStatus state={box.state} />
        {pkg && (box.state === 'SECURED' || box.state === 'UNLOCKED') && <div className="text-xs text-slate-400">{pkg.nickname}</div>}
      </div>
      <div className="flex flex-col gap-2">
        {(box.state === 'LOCKED' || box.state === 'SECURED') && <Button kind="ghost" disabled={busy} onClick={() => act(() => api('/box/unlock', { method: 'POST' }))}>Remote unlock</Button>}
        {(box.state === 'SECURED' || box.state === 'TAMPER') && <Button kind="ghost" disabled={busy} onClick={() => act(() => api('/box/lid', { method: 'POST', json: { action: 'reset' } }))}>{box.state === 'TAMPER' ? 'Acknowledge' : 'Emptied'}</Button>}
      </div>
    </Card>
  )
}

function Activity({ scans, pkgById, home }: { scans: Scan[]; pkgById: Map<string, Package>; home: HomeT }) {
  if (!scans.length) return <Card className="text-center text-sm text-mute">No deliveries yet. Open the Doorbell Simulator and press the bell.</Card>
  return (
    <div className="space-y-3">
      {scans.map((s) => {
        const d = s.decision
        const pkg = d?.packageId ? pkgById.get(d.packageId) : undefined
        return (
          <Card key={s.scanId} className="space-y-3">
            <div className="flex items-start gap-3">
              {s.snapshotUrl
                ? <a href={s.snapshotUrl} target="_blank" rel="noreferrer"><img src={s.snapshotUrl} alt="Doorbell snapshot" className="h-20 w-32 rounded-lg object-cover" /></a>
                : <div className="grid h-20 w-32 place-items-center rounded-lg bg-black/30 text-xs text-mute">{s.status === 'processing' ? '…' : 'no photo'}</div>}
              <div className="min-w-0 flex-1 space-y-1">
                <ScanBadge scan={s} />
                <div className="truncate font-semibold">{pkg?.nickname ?? (d ? (d.expected ? 'Package' : 'Unexpected package') : 'Doorbell press')}</div>
                <div className="text-xs text-mute">{timeAgo(s.createdAt)}{s.simulated ? ' · simulator' : ''}{s.latencyMs ? ` · ${(s.latencyMs / 1000).toFixed(1)} s` : ''}</div>
              </div>
            </div>
            {d && (
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-black/20 p-3 text-xs">
                <span className="text-mute">Label</span><span>{fmtAddress(d.addressCheck.read) || '—'}</span>
                <span className="text-mute">Home</span><span>{fmtAddress(home.address)}</span>
                <span className="text-mute">Why</span><span>{d.addressCheck.reasons.join('; ')}</span>
                <span className="text-mute">Tracking</span><span className="break-all">{d.trackingNumber ?? '—'} {d.trackingNumber && <em className="not-italic text-mute">({d.trackingSource === 'barcode' ? 'barcode' : 'read by AI'})</em>}</span>
                <span className="text-mute">Read by</span><span>{s.label?.source === 'bedrock' ? 'Amazon Bedrock (vision)' : s.label?.source === 'textract' ? 'Amazon Textract (OCR fallback)' : 'barcode only'} · confidence {Math.round((d.confidence ?? 0) * 100)}%</span>
                {s.box && <><span className="text-mute">Box</span><span>{s.box.allow ? 'Unlocked for the driver' : `Stayed locked: ${s.box.reason}`}</span></>}
              </div>
            )}
            {s.spokenText && <p className="text-xs text-slate-400">Driver heard: “{s.spokenText}”</p>}
            {s.error && <p className="text-xs text-warn">{s.error}</p>}
          </Card>
        )
      })}
    </div>
  )
}

function Packages({ packages, onChange }: { packages: Package[]; onChange: () => void }) {
  const [form, setForm] = useState({ nickname: '', trackingNumber: '', carrier: '', instruction: '' })
  const [err, setErr] = useState<string | null>(null)
  const add = async (e: FormEvent) => {
    e.preventDefault()
    try { await api('/packages', { method: 'POST', json: form }); setForm({ nickname: '', trackingNumber: '', carrier: '', instruction: '' }); setErr(null); onChange() }
    catch (x) { setErr((x as Error).message) }
  }
  const input = 'w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-accent'
  return (
    <div className="space-y-3">
      <Card>
        <form onSubmit={add} className="space-y-2">
          <div className="text-sm font-semibold">Expecting a package?</div>
          <input className={input} placeholder="What is it? (e.g. Mom's medication)" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} required />
          <input className={input} placeholder="Tracking number" value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} required />
          <input className={input} placeholder="Instruction for the driver (optional)" value={form.instruction} onChange={(e) => setForm({ ...form, instruction: e.target.value })} />
          {err && <p className="text-xs text-bad">{err}</p>}
          <Button type="submit" className="w-full">Add package</Button>
        </form>
      </Card>
      {packages.map((p) => (
        <Card key={p.packageId} className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold">{p.nickname}</div>
              <div className="break-all text-xs text-mute">{[p.carrier, p.trackingNumber].filter(Boolean).join(' · ')}</div>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</span>
          </div>
          {p.instruction && <p className="rounded-lg bg-black/20 p-2 text-sm text-slate-300">“{p.instruction}”</p>}
          {p.deliveredAt && <p className="text-xs text-mute">Delivered {timeAgo(p.deliveredAt)}</p>}
          <button className="text-xs text-mute underline" onClick={async () => { await api(`/packages/${p.packageId}`, { method: 'DELETE' }); onChange() }}>Remove</button>
        </Card>
      ))}
    </div>
  )
}

function Settings({ home, onChange }: { home: HomeT; onChange: () => void }) {
  const [text, setText] = useState(home.defaultInstruction ?? '')
  const [saved, setSaved] = useState(false)
  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <div className="text-sm font-semibold">Instruction for every package</div>
        <textarea className="h-24 w-full rounded-xl border border-line bg-ink p-3 text-sm outline-none focus:border-accent" value={text} onChange={(e) => { setText(e.target.value); setSaved(false) }} />
        <Button onClick={async () => { await api('/home/instruction', { method: 'PUT', json: { instruction: text } }); setSaved(true); onChange() }}>{saved ? 'Saved ✓' : 'Save'}</Button>
      </Card>
      <Card className="space-y-2 text-sm text-slate-300">
        <div className="font-semibold text-white">Privacy</div>
        <p>A scan starts only when the driver shows the label and presses the bell. DeliveryHub reads the address and tracking number with AI, never the recipient's name, and does no face recognition. Photos are deleted after 30 days.</p>
      </Card>
      <DeleteData onChange={onChange} />
      <Button kind="ghost" onClick={async () => { await api('/demo/reset', { method: 'POST' }); onChange() }}>Reset demo data</Button>
    </div>
  )
}

function DeleteData({ onChange }: { onChange: () => void }) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'busy' | 'done'>('idle')
  const [result, setResult] = useState<{ deleted: Record<string, number | boolean>; at: string } | null>(null)
  const run = async () => {
    setStep('busy')
    const r = await api<{ deleted: Record<string, number | boolean>; at: string }>('/account/delete', { method: 'POST' })
    setResult(r); setStep('done'); onChange()
  }
  return (
    <Card className="space-y-2 text-sm">
      <div className="font-semibold text-white">Delete my data</div>
      {step === 'idle' && <><p className="text-slate-300">Permanently deletes your packages, delivery history, doorbell photos and voice clips. To disconnect Ring, remove DeliveryHub in the Ring app: we delete your Ring access tokens the moment you do.</p><Button kind="danger" onClick={() => setStep('confirm')}>Delete all my data</Button></>}
      {step === 'confirm' && <><p className="text-bad">This can't be undone. Delete everything?</p><div className="flex gap-2"><Button kind="danger" onClick={run}>Yes, delete everything</Button><Button kind="ghost" onClick={() => setStep('idle')}>Cancel</Button></div></>}
      {step === 'busy' && <p className="text-mute">Deleting…</p>}
      {step === 'done' && result && (
        <p className="text-ok">✓ Deleted {String(result.deleted.packages)} packages, {String(result.deleted.deliveries)} deliveries and {String(result.deleted.files)} files at {new Date(result.at).toLocaleString()}. The demo home has been recreated with sample data.</p>
      )}
    </Card>
  )
}
