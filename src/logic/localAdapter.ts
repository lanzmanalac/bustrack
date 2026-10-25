import type { BusStatus, RiderReport } from '../contracts/types';
import type { DataAdapter } from './adapterContract';

/**
 * TEMPORARY adapter — a stand-in so the logic layer is never blocked on
 * Backend 1 (BUILD_PLAN Rule 1). Single-tab in-memory store that mirrors to
 * other tabs over BroadcastChannel so two tabs still sync with Wi-Fi off.
 *
 * DELETE / replace with `data` from `src/data/adapter.ts` once Backend 1 lands.
 */
const CHANNEL = 'bus-demo';
const BUS_KEY = 'bustrack.buses';
const REPORT_KEY = 'bustrack.reports';

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readJson<T>(key: string, fallback: T): T {
  const storage = safeStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode — in-memory still works */
  }
}

export function createLocalAdapter(): DataAdapter {
  const buses = new Map<string, BusStatus>(readJson<BusStatus[]>(BUS_KEY, []).map((b) => [b.bus_id, b]));
  const reports = new Map<string, RiderReport>(
    readJson<RiderReport[]>(REPORT_KEY, []).map((r) => [`${r.session_id}:${r.created_at}`, r]),
  );

  const busListeners = new Set<(buses: BusStatus[]) => void>();
  const reportListeners = new Set<(reports: RiderReport[]) => void>();

  const busList = () => [...buses.values()];
  const reportList = () => [...reports.values()];

  const channel: BroadcastChannel | null =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);

  const persist = () => {
    writeJson(BUS_KEY, busList());
    writeJson(REPORT_KEY, reportList());
  };

  const emitBuses = () => busListeners.forEach((fn) => fn(busList()));
  const emitReports = () => reportListeners.forEach((fn) => fn(reportList()));

  channel?.addEventListener('message', (event: MessageEvent) => {
    const payload = event.data as { kind: 'buses' | 'reports'; buses?: BusStatus[]; reports?: RiderReport[] };
    if (payload.kind === 'buses' && payload.buses) {
      buses.clear();
      payload.buses.forEach((b) => buses.set(b.bus_id, b));
      emitBuses();
    }
    if (payload.kind === 'reports' && payload.reports) {
      reports.clear();
      payload.reports.forEach((r) => reports.set(`${r.session_id}:${r.created_at}`, r));
      emitReports();
    }
  });

  return {
    async getBuses() {
      return busList();
    },

    subscribeBuses(_routeId, onChange) {
      busListeners.add(onChange);
      onChange(busList());
      return () => busListeners.delete(onChange);
    },

    async upsertBus(bus) {
      const next: BusStatus = { ...bus, updated_at: new Date().toISOString() };
      buses.set(next.bus_id, next);
      persist();
      emitBuses();
      channel?.postMessage({ kind: 'buses', buses: busList() });
    },

    async addRiderReport(report) {
      const next: RiderReport = { ...report, created_at: new Date().toISOString() };
      reports.set(`${next.session_id}:${next.created_at}`, next);
      persist();
      emitReports();
      channel?.postMessage({ kind: 'reports', reports: reportList() });
    },

    async getRecentRiderReports(sinceIso) {
      const since = Date.parse(sinceIso);
      return reportList().filter((r) => Date.parse(r.created_at) >= since);
    },

    subscribeRiderReports(onChange) {
      reportListeners.add(onChange);
      onChange(reportList());
      return () => reportListeners.delete(onChange);
    },

    async resetDemo() {
      buses.clear();
      reports.clear();
      persist();
      emitBuses();
      emitReports();
      channel?.postMessage({ kind: 'buses', buses: [] });
      channel?.postMessage({ kind: 'reports', reports: [] });
    },
  };
}
