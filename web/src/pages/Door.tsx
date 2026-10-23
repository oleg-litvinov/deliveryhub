// Door Display: what the delivery driver sees and hears at the door.
// Ring's API can't play audio on the doorbell speaker yet, so this screen stands in for it.
import { useEffect, useRef, useState } from 'react'
import { BoxStatus, Button, DeliveryBoxArt } from '../components/ui'
import { api, usePoll, type Box, type Scan } from '../lib/api'

interface DoorData { scan: Scan | null; box: Box; home: { line1?: string } }
const SHOW_MS = 30_000

export default function Door() {
  const { data, reload } = usePoll<DoorData>('/door/latest', 1200)
  const [sound, setSound] = useState(false)
  const played = useRef<string | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const [, force] = useState(0)

  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 1000); return () => clearInterval(t) }, [])

  const scan = data?.scan
  const fresh = scan && Date.now() - scan.createdAt < SHOW_MS ? scan : null

  useEffect(() => {
    if (!sound || !fresh || fresh.status === 'processing' || !fresh.audioUrl || played.current === fresh.scanId) return
    played.current = fresh.scanId
    audio.current?.pause()
    audio.current = new Audio(fresh.audioUrl)
    audio.current.play().catch(() => undefined)
  }, [fresh, sound])

  const lid = async (action: string) => { await api('/box/lid', { method: 'POST', json: { action } }); reload() }

  const d = fresh?.decision
  const view = !fresh || fresh.status === 'ignored' ? 'idle'
    : fresh.status === 'processing' ? (fresh.trigger === 'motion_detected' ? 'looking' : 'reading')
    : fresh.status === 'error' ? 'retry' : d!.verdict
  const theme = {
    idle: { bg: 'from-slate-900 to-ink', icon: '🔔', title: 'Delivering a package?', color: 'text-white' },
    reading: { bg: 'from-teal-950 to-ink', icon: '⏳', title: 'Reading the label…', color: 'text-accent' },
    looking: { bg: 'from-teal-950 to-ink', icon: '📦', title: 'Hold the label up to the camera', color: 'text-accent' },
    right_address: { bg: 'from-green-950 to-ink', icon: '✓', title: 'Right address', color: 'text-ok' },
    wrong_address: { bg: 'from-red-950 to-ink', icon: '✕', title: 'Wrong address', color: 'text-bad' },
    unreadable: { bg: 'from-amber-950 to-ink', icon: '↻', title: 'Please try again', color: 'text-warn' },
    retry: { bg: 'from-amber-950 to-ink', icon: '↻', title: 'Please try again', color: 'text-warn' },
  }[view]

  const box = data?.box
  const secondsLeft = box?.unlockedUntil ? Math.max(0, Math.round((box.unlockedUntil - Date.now()) / 1000)) : 0

  return (
    <div className={`flex min-h-full flex-col bg-gradient-to-b ${theme.bg} px-5 py-6 transition-colors duration-500`}>
      <div className="flex items-center justify-between text-xs text-mute">
        <span className="font-semibold tracking-wide text-slate-300">DeliveryHub · {data?.home.line1 ?? '…'}</span>
        {!sound && <Button kind="ghost" className="!px-3 !py-1 text-xs" onClick={() => setSound(true)}>🔈 Tap to enable voice</Button>}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <div key={view + (fresh?.scanId ?? '')} className={`animate-pop grid h-32 w-32 place-items-center rounded-full border-4 border-current text-6xl font-black ${theme.color} ${view === 'reading' || view === 'looking' ? 'pulse-ring' : ''}`}>
          {theme.icon}
        </div>
        <h1 className={`text-4xl font-black tracking-tight sm:text-5xl ${theme.color}`}>{theme.title}</h1>

        {view === 'idle' && <p className="max-w-sm text-lg text-slate-300">Just hold the shipping label up to the doorbell camera. No need to press the bell.</p>}
        {view === 'looking' && <p className="max-w-sm text-lg text-slate-200">Label facing the camera, about a hand's width away.</p>}
        {view === 'wrong_address' && <p className="max-w-md text-xl text-slate-100">{d!.driverMessage}</p>}
        {(view === 'unreadable' || view === 'retry') && <p className="max-w-md text-lg text-slate-200">Hold the label a little closer to the camera, about a hand's width away.</p>}
        {view === 'right_address' && (
          <div className="max-w-md space-y-3">
            {fresh?.instruction
              ? <p className="rounded-2xl bg-white/10 p-4 text-2xl font-semibold leading-snug text-white">“{fresh.instruction}”</p>
              : <p className="text-lg text-slate-300">Thank you! You can leave the package at the door.</p>}
            <p className="text-sm text-mute">Instruction from the homeowner</p>
          </div>
        )}
      </div>

      {box && (
        <div className="mx-auto flex w-full max-w-md items-center gap-4 rounded-2xl border border-line bg-panel/80 p-3">
          <DeliveryBoxArt state={box.state} size={84} />
          <div className="flex-1 space-y-1">
            <div className="text-xs uppercase tracking-wider text-mute">Delivery Box</div>
            <BoxStatus state={box.state} />
            {box.state === 'UNLOCKED' && <div className="text-xs text-slate-300">Lift the lid within {secondsLeft}s</div>}
          </div>
          <div className="flex flex-col gap-2">
            {box.state === 'UNLOCKED' && <Button onClick={() => lid('open')}>Lift lid</Button>}
            {box.state === 'OPEN' && <Button onClick={() => lid('close')}>Close lid</Button>}
          </div>
        </div>
      )}
    </div>
  )
}
