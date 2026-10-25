import { useEffect, useState } from 'react'
import RouteLine from './RouteLine'
import route from '../../data/route.json'
import type { BusStatus, Stop, Urgency } from '../../contracts/types'

// Dev-only page: /dev/routeline. Fakes a bus driving stop 1 → last stop, 1 update per second.

const stops = [...(route.stops as Stop[])].sort((a, b) => a.seq - b.seq)
const TICKS_PER_SEGMENT = 5
const LAST_TICK = (stops.length - 1) * TICKS_PER_SEGMENT
const URGENCIES: Urgency[] = ['relax', 'get_ready', 'leave_now', 'missed', 'unknown']
const WALK_OPTIONS = [120, 240, 480]

function fakeBus(tick: number, full: boolean, offline: boolean): BusStatus {
  const i = Math.floor(tick / TICKS_PER_SEGMENT)
  const t = (tick % TICKS_PER_SEGMENT) / TICKS_PER_SEGMENT
  const atStop = tick % TICKS_PER_SEGMENT === 0
  const a = stops[i]
  const b = stops[Math.min(i + 1, stops.length - 1)]
  const now = new Date().toISOString()
  return {
    bus_id: 'bus-1',
    route_id: route.route_id,
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
    status: offline ? 'offline' : atStop ? 'waiting' : 'moving',
    current_stop_id: atStop ? a.stop_id : null,
    next_stop_id: atStop ? (b.stop_id !== a.stop_id ? b.stop_id : null) : b.stop_id,
    arrived_at: atStop ? now : null,
    departed_at: null,
    is_full: full,
    full_reported_at: full ? now : null,
    source: 'simulated',
    updated_at: now,
  }
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

export default function RouteLinePlayground() {
  const [tick, setTick] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [urgency, setUrgency] = useState<Urgency>('relax')
  const [full, setFull] = useState(false)
  const [offline, setOffline] = useState(false)
  const [userStopId, setUserStopId] = useState(stops[Math.min(3, stops.length - 1)].stop_id)
  const [walkSec, setWalkSec] = useState(240)
  const [twoBuses, setTwoBuses] = useState(false)

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setTick((t) => (t >= LAST_TICK ? 0 : t + 1)), 1000)
    return () => window.clearInterval(id)
  }, [playing])

  const buses: BusStatus[] = [fakeBus(tick, full, offline)]
  if (twoBuses) {
    const behind = (tick + LAST_TICK - 2 * TICKS_PER_SEGMENT) % (LAST_TICK + 1)
    buses.push({ ...fakeBus(behind, false, false), bus_id: 'bus-2' })
  }

  return (
    <main className="min-h-screen bg-[#F6F3EC] px-4 py-6 text-slate-900">
      <div className="mx-auto flex max-w-[390px] flex-col gap-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Dev only</p>
          <h1 className="text-2xl font-bold">RouteLine playground</h1>
          <p className="text-sm text-slate-600">
            Tick {tick}/{LAST_TICK} · stops come from <code>src/data/route.json</code>
          </p>
        </header>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <RouteLine stops={stops} buses={buses} userStopId={userStopId} walkSec={walkSec} urgency={urgency} />
        </section>

        <section className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <Chip active={playing} onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</Chip>
            <Chip active={false} onClick={() => setTick(0)}>Reset</Chip>
            <Chip active={full} onClick={() => setFull((f) => !f)}>Bus full</Chip>
            <Chip active={offline} onClick={() => setOffline((o) => !o)}>Kill signal</Chip>
            <Chip active={twoBuses} onClick={() => setTwoBuses((v) => !v)}>2 buses</Chip>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Urgency</p>
            <div className="flex flex-wrap gap-2">
              {URGENCIES.map((u) => (
                <Chip key={u} active={urgency === u} onClick={() => setUrgency(u)}>{u}</Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Your stop</p>
            <div className="flex flex-wrap gap-2">
              {stops.map((s) => (
                <Chip key={s.stop_id} active={userStopId === s.stop_id} onClick={() => setUserStopId(s.stop_id)}>
                  {s.name}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Walk to stop</p>
            <div className="flex flex-wrap gap-2">
              {WALK_OPTIONS.map((w) => (
                <Chip key={w} active={walkSec === w} onClick={() => setWalkSec(w)}>{`${w / 60} min`}</Chip>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
