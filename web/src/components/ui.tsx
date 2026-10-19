import type { ReactNode } from 'react'
import type { BoxState, Scan } from '../lib/api'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-panel p-4 ${className}`}>{children}</div>
}

export function Button({ children, onClick, kind = 'primary', disabled, className = '', type = 'button' }: {
  children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; className?: string; type?: 'button' | 'submit'
}) {
  const styles = {
    primary: 'bg-accent text-ink hover:brightness-110',
    ghost: 'border border-line text-slate-200 hover:bg-white/5',
    danger: 'bg-bad/90 text-white hover:bg-bad',
  }[kind]
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-40 ${styles} ${className}`}>
      {children}
    </button>
  )
}

export const VERDICT = {
  right_address: { label: 'Right address', color: 'text-ok', bg: 'bg-ok/15', icon: '✓' },
  wrong_address: { label: 'Wrong address', color: 'text-bad', bg: 'bg-bad/15', icon: '✕' },
  unreadable: { label: 'Label not readable', color: 'text-warn', bg: 'bg-warn/15', icon: '?' },
} as const

export function ScanBadge({ scan }: { scan: Scan }) {
  if (scan.status === 'processing') return <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">Reading label…</span>
  if (scan.status === 'error' || !scan.decision) return <span className="rounded-full bg-warn/15 px-2.5 py-1 text-xs font-semibold text-warn">No label seen</span>
  const v = VERDICT[scan.decision.verdict]
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${v.bg} ${v.color}`}>{v.icon} {v.label}</span>
}

const BOX_LABEL: Record<BoxState, string> = {
  LOCKED: 'Locked', UNLOCKED: 'Unlocked for driver', OPEN: 'Lid open', SECURED: 'Package secured', TAMPER: 'Tamper alert',
}
const BOX_COLOR: Record<BoxState, string> = {
  LOCKED: 'text-mute', UNLOCKED: 'text-accent', OPEN: 'text-warn', SECURED: 'text-ok', TAMPER: 'text-bad',
}

/** Illustrated delivery box with an animated lid. */
export function DeliveryBoxArt({ state, size = 120 }: { state: BoxState; size?: number }) {
  const open = state === 'OPEN'
  const lock = state === 'LOCKED' || state === 'SECURED'
  const glow = state === 'UNLOCKED' ? '#2dd4bf' : state === 'TAMPER' ? '#ef4444' : state === 'SECURED' ? '#22c55e' : '#475569'
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-label={`Delivery box: ${BOX_LABEL[state]}`}>
      <rect x="14" y="52" width="92" height="56" rx="6" fill="#1f2a40" stroke={glow} strokeWidth="2.5" />
      {state === 'SECURED' && <rect x="38" y="66" width="44" height="28" rx="3" fill="#b88b5a" stroke="#7a5a37" />}
      <g style={{ transformOrigin: '14px 52px', transform: open ? 'rotate(-38deg)' : 'none', transition: 'transform .5s cubic-bezier(.2,.9,.3,1.2)' }}>
        <rect x="10" y="40" width="100" height="14" rx="4" fill="#26344f" stroke={glow} strokeWidth="2.5" />
      </g>
      <circle cx="60" cy="80" r="7" fill={glow} opacity={lock ? 0.9 : 0.35} />
    </svg>
  )
}

export function BoxStatus({ state }: { state: BoxState }) {
  return <span className={`text-sm font-semibold ${BOX_COLOR[state]}`}>{BOX_LABEL[state]}</span>
}
