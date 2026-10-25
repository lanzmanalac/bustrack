import type { BusStatus, RiderReport } from '../../contracts/types';

// TEMPORARY stand-in for Backend 1's `data` adapter (src/data/adapter.ts, not merged yet).
// Same localStorage keys, BroadcastChannel name and message shape as their mock.ts,
// so a /driver tab already syncs with the commuter tab in mock mode.
// When adapter.ts lands on main, replace this whole file with:
//   export { data } from '../../data/adapter';

export interface DriverData {
  upsertBus(bus: Omit<BusStatus, 'updated_at'>): Promise<void>;
  addRiderReport(r: Omit<RiderReport, 'created_at'>): Promise<void>;
  resetDemo(): Promise<void>;
}

const BUSES_KEY = 'bus-demo:buses';
const REPORTS_KEY = 'bus-demo:reports';

type Message =
  | { kind: 'buses'; buses: BusStatus[] }
  | { kind: 'reports'; reports: RiderReport[] };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the BroadcastChannel message still reaches other tabs.
  }
}

const channel: BroadcastChannel | null =
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('bus-demo');

function publish(msg: Message) {
  try {
    channel?.postMessage(msg);
  } catch {
    // Channel closed: nothing else to do in a stand-in.
  }
}

export const data: DriverData = {
  async upsertBus(bus) {
    const buses = read<Record<string, BusStatus>>(BUSES_KEY, {});
    // The adapter plays the server, so it sets updated_at (real time, never TIME_SCALE).
    buses[bus.bus_id] = { ...bus, updated_at: new Date().toISOString() };
    write(BUSES_KEY, buses);
    publish({ kind: 'buses', buses: Object.values(buses) });
  },

  async addRiderReport(r) {
    const reports = [...read<RiderReport[]>(REPORTS_KEY, []), { ...r, created_at: new Date().toISOString() }];
    write(REPORTS_KEY, reports);
    publish({ kind: 'reports', reports });
  },

  async resetDemo() {
    write(BUSES_KEY, {});
    write(REPORTS_KEY, []);
    publish({ kind: 'buses', buses: [] });
    publish({ kind: 'reports', reports: [] });
  },
};
