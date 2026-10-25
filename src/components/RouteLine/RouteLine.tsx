import { motion, useReducedMotion } from 'motion/react'
import { Bus, Footprints } from 'lucide-react'
import type { BusStatus, RouteLineProps, Stop, Urgency } from '../../contracts/types'
import { busPosition } from './geometry'

const ROW_H = 52 // px per stop row
const LINE_X = 28 // px from the left edge to the line's center
const PASSED = '#94A3B8' // line and dots the bus has already passed
const MUTED_TEXT = '#64748B' // passes 4.5:1 on white

// Urgency drives the accent color. The hero text carries the meaning; color only supports it.
const ACCENT: Record<Urgency, string> = {
  relax: '#1F6F66',
  get_ready: '#B45309',
  leave_now: '#D9480F',
  missed: '#64748B',
  unknown: '#475569',
}

type Placed = { bus: BusStatus; pos: number }

const yOf = (pos: number) => pos * ROW_H + ROW_H / 2

function pickLeadBus(placed: Placed[], userIdx: number): Placed | null {
  if (placed.length === 0) return null
  const live = placed.filter((p) => p.bus.status !== 'offline')
  const pool = live.length > 0 ? live : placed
  if (userIdx < 0) return pool[0]
  // The bus that is coming toward the user's stop (closest behind it), else the nearest one.
  const behind = pool.filter((p) => p.pos <= userIdx).sort((a, b) => b.pos - a.pos)
  return behind[0] ?? pool.sort((a, b) => a.pos - b.pos)[0]
}

function describe(lead: Placed | null, stops: Stop[], userIdx: number): string {
  const you = userIdx >= 0 ? stops[userIdx].name : null
  if (!lead) return you ? `No live bus right now. Your stop is ${you}.` : 'No live bus right now.'

  const { bus, pos } = lead
  const lower = Math.floor(pos)
  const here = stops[lower]?.name ?? 'the route'
  const nextName = stops[Math.min(lower + 1, stops.length - 1)]?.name ?? here
  const where =
    bus.status === 'offline'
      ? `Bus signal lost near ${here}`
      : Number.isInteger(pos)
        ? `Bus is ${bus.status === 'waiting' ? 'waiting at' : 'at'} ${here}`
        : `Bus is between ${here} and ${nextName}`
  if (!you) return `${where}.`
  if (pos > userIdx) return `${where}. It has passed your stop, ${you}.`
  const away = Math.ceil(userIdx - pos)
  return `${where}. Your stop is ${you}${away > 0 ? `, ${away} ${away === 1 ? 'stop' : 'stops'} away` : ''}.`
}

export default function RouteLine({ stops, buses, userStopId, walkSec, urgency = 'unknown' }: RouteLineProps) {
  const reduceMotion = useReducedMotion() ?? false
  const ordered = [...stops].sort((a, b) => a.seq - b.seq)
  const accent = ACCENT[urgency]
  const userIdx = ordered.findIndex((s) => s.stop_id === userStopId)
  const height = Math.max(ordered.length, 1) * ROW_H

  const placed: Placed[] = []
  for (const bus of buses) {
    const pos = busPosition(bus, ordered)
    if (pos !== null) placed.push({ bus, pos })
  }
  const lead = pickLeadBus(placed, userIdx)
  const leadLive = lead !== null && lead.bus.status !== 'offline'
  const passedUntil = leadLive ? lead.pos : -1 // stops at or before this index are behind the bus
  const firstY = yOf(0)
  const lastY = yOf(ordered.length - 1)
  const splitY = leadLive ? yOf(lead.pos) : firstY
  const walkMin = walkSec !== undefined ? Math.max(1, Math.round(walkSec / 60)) : null
  const summary = describe(lead, ordered, userIdx)

  return (
    <figure className="relative w-full select-none" style={{ height }} aria-label={summary}>
      <figcaption className="sr-only">{summary}</figcaption>

      {/* Line and stop dots */}
      <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        {ordered.length > 1 && (
          <>
            <line x1={LINE_X} x2={LINE_X} y1={firstY} y2={splitY} stroke={PASSED} strokeWidth={4} strokeLinecap="round" />
            <line x1={LINE_X} x2={LINE_X} y1={splitY} y2={lastY} stroke={accent} strokeWidth={6} strokeLinecap="round" />
          </>
        )}
        {ordered.map((stop, i) => {
          const cy = yOf(i)
          const isUser = i === userIdx
          const passed = i < passedUntil
          if (isUser) {
            return (
              <g key={stop.stop_id}>
                <circle cx={LINE_X} cy={cy} r={11} fill={accent} />
                <circle cx={LINE_X} cy={cy} r={4.5} fill="#FFFFFF" />
              </g>
            )
          }
          return (
            <circle
              key={stop.stop_id}
              cx={LINE_X}
              cy={cy}
              r={6}
              fill="#FFFFFF"
              stroke={passed ? PASSED : accent}
              strokeWidth={3}
            />
          )
        })}
      </svg>

      {/* Stop names */}
      <ol className="absolute inset-0" aria-hidden="true">
        {ordered.map((stop, i) => {
          const isUser = i === userIdx
          const passed = i < passedUntil
          return (
            <li
              key={stop.stop_id}
              className="absolute right-0 flex items-center gap-2 pr-1"
              style={{ top: i * ROW_H, height: ROW_H, left: LINE_X + 26 }}
            >
              <span
                className={`truncate text-[15px] leading-tight ${isUser ? 'font-semibold text-slate-900' : ''}`}
                style={isUser ? undefined : { color: passed ? MUTED_TEXT : '#1E293B' }}
              >
                {stop.name}
              </span>
              {isUser && (
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="w-5 border-t-2 border-dashed" style={{ borderColor: accent }} />
                  <span
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: accent }}
                  >
                    <Footprints size={13} strokeWidth={2.5} aria-hidden="true" />
                    You{walkMin !== null ? ` · ${walkMin} min walk` : ''}
                  </span>
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {/* Buses */}
      {placed.map(({ bus, pos }) => {
        const offline = bus.status === 'offline'
        const isLead = lead?.bus.bus_id === bus.bus_id
        const pulse = isLead && urgency === 'leave_now' && !offline && !reduceMotion
        const color = offline ? '#94A3B8' : accent
        return (
          <motion.div
            key={bus.bus_id}
            className="absolute left-0 top-0"
            style={{ x: LINE_X - 16 }}
            initial={false}
            animate={{ y: yOf(pos) - 16 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 1, ease: 'easeOut' }}
            aria-hidden="true"
          >
            <div className={`relative h-8 w-8 ${isLead ? '' : 'opacity-50'}`}>
              {pulse && (
                <motion.span
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: color }}
                  initial={{ scale: 1, opacity: 0.45 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <span
                className={`relative flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white ${
                  offline ? 'opacity-70' : ''
                }`}
                style={{ backgroundColor: color }}
              >
                <Bus size={17} strokeWidth={2.5} />
              </span>
              {bus.is_full && !offline && (
                <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 rounded-full bg-slate-900 px-1.5 py-px text-[10px] font-bold uppercase leading-tight tracking-wide text-white ring-2 ring-white">
                  Full
                </span>
              )}
            </div>
          </motion.div>
        )
      })}
    </figure>
  )
}
