// Demo console: the whole flow on one screen for judges (simulator → door → homeowner phone).
import { Link } from 'react-router-dom'

const panes = [
  { path: '/sim', title: '1 · Driver at the door', note: 'Pick a label, press the bell', w: 'lg:w-[34%]' },
  { path: '/door', title: '2 · Door Display', note: 'What the driver sees and hears', w: 'lg:w-[33%]' },
  { path: '/home', title: '3 · Homeowner app', note: 'Feed, photo proof, alerts, box', w: 'lg:w-[33%]' },
]

export default function Console() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-accent">DoorCheck · Ring doorbell package check</div>
          <h1 className="text-lg font-bold sm:text-xl">The driver shows the label. The doorbell confirms the house, plays your instructions, and logs the delivery.</h1>
        </div>
        <div className="flex gap-2 text-sm">
          {panes.map((p) => <Link key={p.path} to={p.path} className="rounded-lg border border-line px-3 py-1.5 text-mute hover:text-white">{p.path}</Link>)}
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-3 p-3 lg:flex-row">
        {panes.map((p) => (
          <section key={p.path} className={`flex min-h-[640px] flex-col overflow-hidden rounded-2xl border border-line bg-panel ${p.w}`}>
            <div className="flex items-baseline justify-between border-b border-line px-4 py-2">
              <span className="text-sm font-semibold">{p.title}</span>
              <span className="text-xs text-mute">{p.note}</span>
            </div>
            <iframe title={p.title} src={p.path} className="w-full flex-1" allow="camera; autoplay" />
          </section>
        ))}
      </main>
    </div>
  )
}
