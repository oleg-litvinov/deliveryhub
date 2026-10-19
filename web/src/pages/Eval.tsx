// Accuracy & latency eval against the live pipeline. Every case is a real signed webhook through the
// deployed stack; only the camera is simulated. Grid: label × distance × tilt × motion blur.
import { useState } from 'react'
import { Button, Card } from '../components/ui'
import { api, type SampleLabel, type Scan, type Verdict } from '../lib/api'
import { composeFrame, toJpeg } from '../lib/scene'

const DISTANCES = [0.95, 0.85, 0.75, 0.65, 0.55]
const TILTS = [0, -10]
const BLURS = [0, 1, 2]
const CONCURRENCY = 4
const EXPECTED: Record<string, Verdict> = { meds: 'right_address', shoes: 'right_address', surprise: 'right_address', neighbor: 'wrong_address' }

export interface EvalRow {
  label: string; distance: number; cm: number; tilt: number; blur: number
  expected: Verdict; actual: Verdict | 'error'; outcome: 'correct' | 'safe_fail' | 'wrong'
  barcodeRead: boolean; addressRead: boolean; labelSource?: string; serverMs?: number; clientMs: number
}

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '—')
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0 }

async function runCase(label: SampleLabel, distance: number, tilt: number, blur: number, deviceId: string): Promise<EvalRow> {
  const t0 = performance.now()
  const { timestamp, uploadUrl } = await api<{ timestamp: number; uploadUrl: string }>('/sim/frame', { method: 'POST' })
  const frame = composeFrame({ label }, { distance, tilt, blur, deviceId, timestamp })
  await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: await toJpeg(frame) })
  const { scanId } = await api<{ scanId: string }>('/sim/press', { method: 'POST', json: { timestamp } })
  let scan: Scan | undefined
  for (let i = 0; i < 80 && (!scan || scan.status === 'processing'); i++) {
    await new Promise((r) => setTimeout(r, 600))
    scan = (await api<{ scans: Scan[] }>('/scans?limit=40')).scans.find((s) => s.scanId === scanId)
  }
  const expected = EXPECTED[label.id]
  const actual: Verdict | 'error' = scan?.decision?.verdict ?? 'error'
  const outcome = actual === expected ? 'correct' : actual === 'unreadable' || actual === 'error' ? 'safe_fail' : 'wrong'
  return {
    label: label.id, distance, cm: Math.round(7.6 / distance), tilt, blur, expected, actual, outcome,
    barcodeRead: !!scan?.barcodes?.some((b) => b.text.includes(label.barcode)),
    addressRead: !!scan?.decision?.addressCheck.read,
    labelSource: scan?.label?.source, serverMs: scan?.latencyMs, clientMs: Math.round(performance.now() - t0),
  }
}

export default function Eval() {
  const [rows, setRows] = useState<EvalRow[]>([])
  const [total, setTotal] = useState(0)
  const [running, setRunning] = useState(false)

  const run = async () => {
    setRunning(true); setRows([])
    const { labels, deviceId } = await api<{ labels: SampleLabel[]; deviceId: string }>('/sim/labels')
    const cases = labels.flatMap((l) => DISTANCES.flatMap((d) => TILTS.flatMap((t) => BLURS.map((b) => [l, d, t, b] as const))))
    setTotal(cases.length)
    const out: EvalRow[] = []
    let next = 0
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (next < cases.length) {
        const [l, d, t, b] = cases[next++]
        const row = await runCase(l, d, t, b, deviceId).catch((e): EvalRow => ({
          label: l.id, distance: d, cm: Math.round(7.6 / d), tilt: t, blur: b, expected: EXPECTED[l.id], actual: 'error', outcome: 'safe_fail',
          barcodeRead: false, addressRead: false, clientMs: 0, labelSource: String(e),
        }))
        out.push(row); setRows([...out])
      }
    }))
    ;(window as unknown as { __evalResults: EvalRow[] }).__evalResults = out
    await api('/demo/reset', { method: 'POST' })
    setRunning(false)
  }

  const by = (key: 'cm' | 'blur' | 'tilt' | 'label') => {
    const groups = new Map<string, EvalRow[]>()
    rows.forEach((r) => groups.set(String(r[key]), [...(groups.get(String(r[key])) ?? []), r]))
    return [...groups.entries()]
  }
  const correct = rows.filter((r) => r.outcome === 'correct').length
  const wrong = rows.filter((r) => r.outcome === 'wrong').length
  const server = rows.flatMap((r) => (r.serverMs ? [r.serverMs] : []))

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <header>
        <div className="text-xs font-semibold uppercase tracking-widest text-accent">DeliveryHub eval</div>
        <h1 className="text-xl font-bold">Accuracy and latency on the live pipeline</h1>
        <p className="text-sm text-mute">{DISTANCES.length * TILTS.length * BLURS.length * 4} signed doorbell presses: 4 labels × {DISTANCES.length} distances × {TILTS.length} tilts × {BLURS.length} blur levels. Resets the demo data when done.</p>
      </header>
      <Button onClick={run} disabled={running}>{running ? `Running… ${rows.length}/${total}` : 'Run eval'}</Button>

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat k="Correct decision" v={pct(correct, rows.length)} />
            <Stat k="Wrong decision" v={`${wrong}`} sub="right↔wrong house swaps" />
            <Stat k="Latency p50" v={`${(quantile(server, 0.5) / 1000).toFixed(1)} s`} sub="press → decision" />
            <Stat k="Latency p90" v={`${(quantile(server, 0.9) / 1000).toFixed(1)} s`} />
          </div>
          {(['cm', 'blur', 'tilt', 'label'] as const).map((k) => (
            <Card key={k}>
              <table className="w-full text-sm">
                <thead className="text-left text-mute"><tr><th>{{ cm: 'Distance from lens', blur: 'Motion blur (px)', tilt: 'Tilt (°)', label: 'Label' }[k]}</th><th>n</th><th>Correct</th><th>Asked to retry</th><th>Wrong</th><th>Barcode read</th><th>Address read</th></tr></thead>
                <tbody>
                  {by(k).map(([g, rs]) => (
                    <tr key={g} className="border-t border-line">
                      <td>{k === 'cm' ? `≈ ${g} cm` : g}</td><td>{rs.length}</td>
                      <td>{pct(rs.filter((r) => r.outcome === 'correct').length, rs.length)}</td>
                      <td>{pct(rs.filter((r) => r.outcome === 'safe_fail').length, rs.length)}</td>
                      <td>{rs.filter((r) => r.outcome === 'wrong').length}</td>
                      <td>{pct(rs.filter((r) => r.barcodeRead).length, rs.length)}</td>
                      <td>{pct(rs.filter((r) => r.addressRead).length, rs.length)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
          <Button kind="ghost" onClick={() => {
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }))
            a.download = 'deliveryhub-eval.json'; a.click()
          }}>Download results (JSON)</Button>
        </>
      )}
    </div>
  )
}

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return <Card><div className="text-xs text-mute">{k}</div><div className="text-2xl font-bold">{v}</div>{sub && <div className="text-xs text-mute">{sub}</div>}</Card>
}
