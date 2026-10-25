import type { BusStatus, RiderReport } from '../contracts/types';
import { CONFIG } from '../contracts/config';
import type { DataAdapter } from './adapter';

// Mock mode: state lives in memory, is saved to localStorage (survives reloads),
// and is pushed to other tabs over BroadcastChannel. Works with no internet.

const BUSES_KEY = 'bus-demo:buses';
const REPORTS_KEY = 'bus-demo:reports';
const KEEP_REPORTS_MS = 60 * 60 * 1000;

export type ChannelLike = Pick<BroadcastChannel, 'postMessage' | 'close' | 'onmessage'>;

export interface MockDeps {
  storage?: Storage | null;
  channel?: ChannelLike | null;
  now?: () => number;
}

// Messages carry the full state, so a receiving tab never depends on storage.
type Message =
  | { kind: 'buses'; buses: BusStatus[] }
  | { kind: 'reports'; reports: RiderReport[] };

function defaultStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function defaultChannel(): ChannelLike | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('bus-demo');
}

function load<T>(storage: Storage | null, key: string, isValid: (v: unknown) => boolean, fallback: T): T {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    return isValid(value) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

const isRecord = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);

export function createMockAdapter(deps: MockDeps = {}): DataAdapter {
  const storage = 'storage' in deps ? deps.storage ?? null : defaultStorage();
  const channel = 'channel' in deps ? deps.channel ?? null : defaultChannel();
  const now = deps.now ?? Date.now;

  let buses = load<Record<string, BusStatus>>(storage, BUSES_KEY, isRecord, {});
  let reports = load<RiderReport[]>(storage, REPORTS_KEY, Array.isArray, []);

  const busListeners = new Set<{ routeId: string; onChange: (buses: BusStatus[]) => void }>();
  const reportListeners = new Set<(reports: RiderReport[]) => void>();

  const busesFor = (routeId: string) => Object.values(buses).filter((b) => b.route_id === routeId);
  const recentReports = () => {
    const since = now() - CONFIG.RIDER_REPORT_TTL_SEC * 1000;
    return reports.filter((r) => Date.parse(r.created_at) >= since);
  };

  const notifyBuses = () => busListeners.forEach((l) => l.onChange(busesFor(l.routeId)));
  const notifyReports = () => reportListeners.forEach((onChange) => onChange(recentReports()));

  const save = (key: string, value: unknown) => {
    try {
      storage?.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or blocked: keep working in memory.
    }
  };

  const publish = (msg: Message) => {
    try {
      channel?.postMessage(msg);
    } catch {
      // Channel closed: this tab still works on its own.
    }
  };

  const commitBuses = () => {
    save(BUSES_KEY, buses);
    publish({ kind: 'buses', buses: Object.values(buses) });
    notifyBuses(); // BroadcastChannel doesn't deliver to the sending tab
  };

  const commitReports = () => {
    save(REPORTS_KEY, reports);
    publish({ kind: 'reports', reports });
    notifyReports();
  };

  if (channel) {
    channel.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as Message;
      if (msg?.kind === 'buses') {
        buses = Object.fromEntries(msg.buses.map((b) => [b.bus_id, b]));
        notifyBuses();
      } else if (msg?.kind === 'reports') {
        reports = msg.reports;
        notifyReports();
      }
    };
  }

  return {
    async getBuses(routeId) {
      return busesFor(routeId);
    },

    subscribeBuses(routeId, onChange) {
      const listener = { routeId, onChange };
      busListeners.add(listener);
      queueMicrotask(() => {
        if (busListeners.has(listener)) onChange(busesFor(routeId));
      });
      return () => {
        busListeners.delete(listener);
      };
    },

    async upsertBus(bus) {
      // The adapter plays the server here, so it owns updated_at (real time, never TIME_SCALE).
      buses = { ...buses, [bus.bus_id]: { ...bus, updated_at: new Date(now()).toISOString() } };
      commitBuses();
    },

    async addRiderReport(r) {
      const keepSince = now() - KEEP_REPORTS_MS;
      reports = [
        ...reports.filter((old) => Date.parse(old.created_at) >= keepSince),
        { ...r, created_at: new Date(now()).toISOString() },
      ];
      commitReports();
    },

    async getRecentRiderReports(sinceIso) {
      const since = Date.parse(sinceIso);
      return reports.filter((r) => Date.parse(r.created_at) >= since);
    },

    subscribeRiderReports(onChange) {
      reportListeners.add(onChange);
      queueMicrotask(() => {
        if (reportListeners.has(onChange)) onChange(recentReports());
      });
      return () => {
        reportListeners.delete(onChange);
      };
    },

    async resetDemo() {
      buses = {};
      reports = [];
      commitBuses();
      commitReports();
    },
  };
}
