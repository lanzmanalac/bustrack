import { useEffect, useMemo, useState } from 'react';
import type { BusStatus, LatLng, LeavePlan, RiderReport, Stop } from '../contracts/types';
import { CONFIG } from '../contracts/config';
import route from '../data/route.json';
import type { DataAdapter } from '../data/adapter';
import { data as defaultAdapter } from '../data/adapter';
import { buildLeavePlan } from './buildLeavePlan';
import { busEtaSeconds } from './eta';
import { haversineMeters } from './geo';
import { initialLocation, isDemoMode, watchLocation, type LocationState } from './location';

const TICK_MS = 1000;
const REPORT_LOOKBACK_SEC = CONFIG.RIDER_REPORT_TTL_SEC;

const ROUTE_STOPS = route.stops as unknown as Stop[];

export interface UseLeavePlanOptions {
  /**
   * Defaults to Backend 1's `data` export, which honours CONFIG.DATA_MODE
   * (mock vs live). Pass your own to inject a fixture adapter in tests:
   *   useLeavePlan({ adapter: data })
   */
  adapter?: DataAdapter;
  stops?: readonly Stop[];
  headwayMin?: number;
  /** An explicitly chosen stop wins over the nearest one (onboarding "Pick my stop"). */
  userStop?: Stop | null;
  /** Raw GPS position, bypassing the geolocation prompt (PM can feed it in). */
  user?: LatLng | null;
  /** Trip facts for the deadline verdict and the delayed Plan B. */
  walkSecToDest?: number | null;
  rideSecToDest?: number | null;
  timeLeftSec?: number | null;
}

/**
 * CONTRACT CHANGE: returns `{ plan, buses }` (plus `location`) instead of a
 * bare `LeavePlan`, because `LeavePlan` carries no bus positions and RouteLine
 * needs them. Requested by PM / UI and the All-arounder in their handoffs.
 *
 * Recomputes on every bus/location update AND once per second, so the countdown
 * and the freshness chip keep moving between updates.
 */
export interface LeavePlanResult {
  plan: LeavePlan;
  buses: BusStatus[];
  location: LocationState;
}

export function useLeavePlan(options: UseLeavePlanOptions = {}): LeavePlanResult {
  // `defaultAdapter` is a module-level singleton, so its identity is stable
  // across renders without needing an extra useState.
  const adapter = options.adapter ?? defaultAdapter;

  const [buses, setBuses] = useState<BusStatus[]>([]);
  const [reports, setReports] = useState<RiderReport[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [location, setLocation] = useState<LocationState>(() => ({
    status: isDemoMode() ? 'granted' : 'idle',
    loc: initialLocation(),
    message: null,
  }));

  // PM supplying a position means "don't touch the Geolocation API".
  const externallyLocated = options.user !== undefined;

  // Subscribe to bus positions.
  useEffect(() => {
    let alive = true;
    const unsubscribe = adapter.subscribeBuses(CONFIG.ROUTE_ID, (next) => {
      if (alive) setBuses(next);
    });
    void adapter.getBuses(CONFIG.ROUTE_ID).then((initial) => {
      if (alive && initial.length > 0) setBuses(initial);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [adapter]);

  // Subscribe to opt-in rider reports.
  useEffect(() => {
    let alive = true;
    const unsubscribe = adapter.subscribeRiderReports((next) => {
      if (alive) setReports(next);
    });
    const since = new Date(Date.now() - REPORT_LOOKBACK_SEC * 1000).toISOString();
    void adapter.getRecentRiderReports(since).then((initial) => {
      if (alive && initial.length > 0) setReports(initial);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [adapter]);

  // Follow the phone. Demo mode resolves immediately without touching GPS.
  useEffect(() => {
    if (externallyLocated) return;
    return watchLocation(setLocation);
  }, [externallyLocated]);

  // Advance the clock once a second so data_age and the countdown stay live
  // between bus updates. nowMs is a real dependency of the plan below.
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const plan = useMemo(() => {
    const stops = options.stops ?? ROUTE_STOPS;
    const headwayMin = options.headwayMin ?? route.headway_min;
    const user = options.user ?? (options.userStop ? null : location.loc);

    const userStop = options.userStop ?? resolveStop(user, stops);
    const leadBus = pickLeadBus(buses, userStop, stops);

    return buildLeavePlan({
      nowMs,
      stops,
      headway_min: headwayMin,
      user,
      userStop,
      bus: leadBus,
      reports,
      walkSecToDest: options.walkSecToDest ?? null,
      rideSecToDest: options.rideSecToDest ?? null,
      timeLeftSec: options.timeLeftSec ?? null,
    });
    // nowMs advances every second, so the countdown and freshness chip keep
    // moving even when no new bus data arrives.
  }, [nowMs, buses, reports, location.loc, options.stops, options.userStop, options.user,
      options.headwayMin, options.walkSecToDest, options.rideSecToDest, options.timeLeftSec]);

  return { plan, buses, location };
}

export function resolveStop(user: LatLng | null, stops: readonly Stop[]): Stop | null {
  if (!user || stops.length === 0) return null;
  let best = stops[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const stop of stops) {
    const distance = haversineMeters(user, stop);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = stop;
    }
  }
  return best;
}

/**
 * The bus that matters: the soonest one that will actually reach your stop.
 * If every bus is already past you, fall back to the closest one so the plan
 * can honestly report 'passed' and offer a next bus.
 */
export function pickLeadBus(buses: readonly BusStatus[], userStop: Stop | null, stops: readonly Stop[]): BusStatus | null {
  const usable = buses.filter((b) => b.status !== 'offline');
  if (usable.length === 0) return null;
  if (!userStop) return usable[0];

  let soonest: BusStatus | null = null;
  let soonestEta = Number.POSITIVE_INFINITY;
  for (const bus of usable) {
    const eta = busEtaSeconds(bus, userStop, stops);
    if (eta !== null && eta.eta_sec < soonestEta) {
      soonestEta = eta.eta_sec;
      soonest = bus;
    }
  }
  if (soonest) return soonest;

  let closest = usable[0];
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const bus of usable) {
    const distance = haversineMeters(bus, userStop);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = bus;
    }
  }
  return closest;
}
