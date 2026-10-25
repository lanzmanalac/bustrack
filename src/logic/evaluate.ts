import type { BusStatus, Confidence, CrowdLevel, RiderReport, Urgency } from '../contracts/types';
import { CONFIG } from '../contracts/config';

/**
 * How much we trust this number, straight from the data's age.
 * 'schedule' is always low: an estimate we never measured is still an estimate.
 */
export function confidence(source: string, dataAgeSec: number | null): Confidence {
  if (source === 'schedule') return 'low';
  if (dataAgeSec === null || !Number.isFinite(dataAgeSec)) return 'low';
  if (dataAgeSec <= CONFIG.FRESH_SEC.high) return 'high';
  if (dataAgeSec <= CONFIG.FRESH_SEC.medium) return 'medium';
  return 'low';
}

/**
 * Maps "seconds until you should walk out the door" onto an urgency band.
 * Thresholds are exclusive on the top edge, so each value lands in exactly one band:
 *   (300, inf) relax  |  (120, 300] get_ready  |  (-30, 120] leave_now  |  (-inf, -30] missed
 *
 * null means we genuinely do not know -> 'unknown', never a guessed urgency.
 */
export function urgencyFor(leaveInSec: number | null): Urgency {
  if (leaveInSec === null || !Number.isFinite(leaveInSec)) return 'unknown';
  if (leaveInSec > CONFIG.URGENCY_SEC.relax) return 'relax';
  if (leaveInSec > CONFIG.URGENCY_SEC.get_ready) return 'get_ready';
  if (leaveInSec > CONFIG.URGENCY_SEC.missed) return 'leave_now';
  return 'missed';
}

export interface CrowdEstimate {
  level: CrowdLevel;
  count: number;
}

/**
 * Crowd level from two honest signals: the driver's BUS FULL tap, and opt-in
 * rider reports. `count` is distinct reporting sessions, never passengers —
 * the UI must never render it as a headcount.
 */
export function crowdLevel(
  bus: BusStatus,
  reports: readonly RiderReport[],
  nowMs: number,
): CrowdEstimate {
  const count = distinctRiderReports(bus, reports, nowMs);

  if (bus.is_full && bus.full_reported_at !== null) {
    const reportedMs = Date.parse(bus.full_reported_at);
    const ageSec = (nowMs - reportedMs) / 1000;
    if (!Number.isNaN(reportedMs) && ageSec >= 0 && ageSec <= CONFIG.FULL_TTL_SEC) {
      return { level: 'full', count };
    }
  }

  if (count >= CONFIG.CROWD_REPORTS.likely_full) return { level: 'likely_full', count };
  if (count >= CONFIG.CROWD_REPORTS.busy) return { level: 'busy', count };
  if (count >= 1) return { level: 'seats', count };
  return { level: 'unknown', count };
}

/** Distinct opt-in sessions that reported riding THIS bus inside the TTL. */
function distinctRiderReports(
  bus: BusStatus,
  reports: readonly RiderReport[],
  nowMs: number,
): number {
  const sessions = new Set<string>();

  for (const report of reports) {
    if (report.kind !== 'on_bus') continue;
    if (report.bus_id !== bus.bus_id) continue;

    const createdMs = Date.parse(report.created_at);
    if (Number.isNaN(createdMs)) continue;

    const ageSec = (nowMs - createdMs) / 1000;
    if (ageSec < 0 || ageSec > CONFIG.RIDER_REPORT_TTL_SEC) continue;

    sessions.add(report.session_id);
  }

  return sessions.size;
}
