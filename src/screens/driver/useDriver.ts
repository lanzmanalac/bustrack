import { useCallback, useEffect, useRef, useState } from 'react';
import type { Stop } from '../../contracts/types';
import { CONFIG } from '../../contracts/config';
import { haversineMeters, orderedStops } from '../../logic/geo';
import route from '../../data/route.json';
import { data } from './driverData';
import { BUS_ID, advance, arriveNext, atStop, depart, isLastStop, toBusStatus, type DriverState } from './sim';

export const STOPS: Stop[] = orderedStops(route.stops as Stop[]);

const UNDO_MS = 5000;
const LOCK_SPEED_MPS = 5 / 3.6;          // ~5 km/h
const ARRIVE_RADIUS_M = 40;
const GPS_MIN_INTERVAL_MS = 3000;
const GPS_MIN_MOVE_M = 15;
const HEARTBEAT_MS = 10000;              // keeps "Live · Xs ago" fresh while parked

export type SendState = { ok: true; atMs: number } | { ok: false; atMs: number } | null;

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported (e.g. iOS Safari): the on-screen "Sent ✓" still confirms.
  }
}

export function useDriver() {
  const [state, setState] = useState<DriverState>(() => atStop(STOPS, 0, Date.now()));
  const [simulate, setSimulate] = useState(true);
  const [autoDepart, setAutoDepart] = useState(false);
  const [sent, setSent] = useState<SendState>(null);
  const [undo, setUndo] = useState<{ prev: DriverState; label: string; untilMs: number } | null>(null);
  const [gpsSpeed, setGpsSpeed] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const lastWrite = useRef<{ atMs: number; lat: number; lng: number } | null>(null);

  const push = useCallback(
    async (s: DriverState) => {
      lastWrite.current = { atMs: Date.now(), lat: s.lat, lng: s.lng };
      try {
        await data.upsertBus(toBusStatus(s, STOPS, simulate ? 'simulated' : 'driver'));
        setSent({ ok: true, atMs: Date.now() });
      } catch {
        setSent({ ok: false, atMs: Date.now() });
      }
    },
    [simulate],
  );

  const commit = useCallback(
    (next: DriverState) => {
      setState(next);
      void push(next);
    },
    [push],
  );

  // Driver taps: save an undo point, vibrate, write immediately.
  const act = useCallback(
    (label: string, next: DriverState) => {
      setUndo({ prev: stateRef.current, label, untilMs: Date.now() + UNDO_MS });
      vibrate(40);
      commit(next);
    },
    [commit],
  );

  // First write so the commuter sees the bus as soon as /driver opens.
  useEffect(() => {
    void push(stateRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sim engine: every 1 s of real time, move TIME_SCALE seconds of world time and write.
  useEffect(() => {
    if (!simulate) return;
    let lastMs = Date.now();
    const id = window.setInterval(() => {
      const nowMs = Date.now();
      const worldSec = ((nowMs - lastMs) / 1000) * CONFIG.TIME_SCALE;
      lastMs = nowMs;
      const s = stateRef.current;
      if (s.offline) return;
      let next = s;
      if (s.moving) {
        next = advance(s, STOPS, worldSec, nowMs);
        if (!next.moving) vibrate([60, 60, 60]); // arrived at a stop
      } else if (autoDepart && !s.held && !isLastStop(s, STOPS) && s.arrivedAtMs != null) {
        const dwellRealMs = (CONFIG.DWELL_SEC_PER_STOP / CONFIG.TIME_SCALE) * 1000;
        if (nowMs - s.arrivedAtMs >= dwellRealMs) next = depart(s, STOPS, nowMs);
      }
      commit(next);
    }, 1000);
    return () => window.clearInterval(id);
  }, [simulate, autoDepart, commit]);

  // Real GPS mode: watchPosition, write at most every 3 s or 15 m, auto-arrive within 40 m.
  useEffect(() => {
    if (simulate) return;
    if (!('geolocation' in navigator)) {
      setGpsError('GPS not available on this device');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(null);
        setGpsSpeed(pos.coords.speed);
        const nowMs = Date.now();
        let next: DriverState = { ...stateRef.current, lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (next.moving && !isLastStop(next, STOPS)) {
          const dist = haversineMeters(next, STOPS[next.stopIndex + 1]);
          if (dist <= ARRIVE_RADIUS_M) {
            next = { ...arriveNext(next, STOPS, nowMs), lat: next.lat, lng: next.lng };
            vibrate([60, 60, 60]);
          }
        }
        const lw = lastWrite.current;
        const statusChanged = next.moving !== stateRef.current.moving;
        const due =
          !lw ||
          statusChanged ||
          (nowMs - lw.atMs >= GPS_MIN_INTERVAL_MS && haversineMeters(lw, next) >= GPS_MIN_MOVE_M);
        if (next.offline) setState(next);
        else if (due) commit(next);
        else setState(next);
      },
      (err) => setGpsError(err.code === err.PERMISSION_DENIED ? 'Location permission denied' : 'Waiting for GPS…'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
    const beat = window.setInterval(() => {
      const lw = lastWrite.current;
      if (!stateRef.current.offline && (!lw || Date.now() - lw.atMs >= HEARTBEAT_MS)) void push(stateRef.current);
    }, HEARTBEAT_MS);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(beat);
    };
  }, [simulate, commit, push]);

  // Expire the undo offer after 5 s.
  useEffect(() => {
    if (!undo) return;
    const id = window.setTimeout(() => setUndo(null), Math.max(0, undo.untilMs - Date.now()));
    return () => window.clearTimeout(id);
  }, [undo]);

  // Safety lock: sim → locked while moving; GPS → locked above ~5 km/h.
  const locked = simulate ? state.moving : (gpsSpeed ?? 0) > LOCK_SPEED_MPS;

  const nowMs = () => Date.now();
  const actions = {
    leavingNow: () => !locked && act('Leaving now', depart(state, STOPS, nowMs())),
    arrived: () => !locked && act('Arrived', arriveNext(state, STOPS, nowMs())),
    restartRoute: () => !locked && act('Back to first stop', atStop(STOPS, 0, nowMs(), state)),
    toggleFull: () =>
      !locked &&
      act(state.isFull ? 'Bus full off' : 'Bus full on', {
        ...state,
        isFull: !state.isFull,
        fullAtMs: state.isFull ? null : nowMs(),
      }),
    undo: () => {
      if (!undo) return;
      vibrate(20);
      commit({ ...undo.prev, lat: simulate ? undo.prev.lat : state.lat, lng: simulate ? undo.prev.lng : state.lng });
      setUndo(null);
    },

    // Demo drawer
    placeAtStop: (i: number) => commit(atStop(STOPS, i, nowMs(), state)),
    injectDelay: () => {
      if (state.moving) return;
      // Back-date the arrival so the commuter's "delayed" Plan B shows now, and hold the bus here.
      const backdated = nowMs() - (CONFIG.DELAY_STANDBY_SEC + 60) * 1000;
      commit({ ...state, held: true, offline: false, arrivedAtMs: backdated });
    },
    toggleSignal: () => {
      const next = { ...state, offline: !state.offline };
      setState(next);
      void push(next); // one 'offline' write, then silence until restored
    },
    addRiders: async (n = 6) => {
      for (let i = 0; i < n; i++) {
        await data.addRiderReport({
          session_id: `demo-${Math.random().toString(36).slice(2, 10)}`,
          kind: 'on_bus',
          bus_id: BUS_ID,
          stop_id: null,
        });
      }
    },
    resetDemo: async () => {
      await data.resetDemo();
      setUndo(null);
      commit(atStop(STOPS, 0, nowMs()));
    },
    setSimulate,
    setAutoDepart,
  };

  return { state, stops: STOPS, simulate, autoDepart, locked, sent, undo, gpsError, actions };
}
