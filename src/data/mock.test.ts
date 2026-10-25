import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BusStatus, RiderReport } from '../contracts/types';
import { createMockAdapter } from './mock';
import { memoryStorage, throwingStorage } from './test-utils';

const T0 = Date.parse('2026-10-25T05:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

const bus = (over: Partial<BusStatus> = {}): BusStatus => ({
  bus_id: 'bus-1', route_id: 'demo-route', lat: 14.55, lng: 121.05, status: 'moving',
  current_stop_id: null, next_stop_id: 's2', arrived_at: null, departed_at: null,
  is_full: false, full_reported_at: null, source: 'driver',
  updated_at: '2000-01-01T00:00:00.000Z', ...over,
});

const report = (over: Partial<RiderReport> = {}): Omit<RiderReport, 'created_at'> => ({
  session_id: 'sess-1', kind: 'on_bus', bus_id: 'bus-1', stop_id: null, ...over,
});

// Each "tab" gets its own channel on a shared name, like two browser tabs.
let channels: BroadcastChannel[] = [];
function tab(storage: Storage, now = () => T0) {
  const channel = new BroadcastChannel('bus-demo-test');
  channels.push(channel);
  return createMockAdapter({ storage, channel, now });
}

afterEach(() => {
  channels.forEach((c) => c.close());
  channels = [];
});

describe('mock adapter: buses', () => {
  it('upsert sets updated_at from now()', async () => {
    const a = tab(memoryStorage());
    await a.upsertBus(bus());
    const [saved] = await a.getBuses('demo-route');
    expect(saved.updated_at).toBe('2026-10-25T05:00:00.000Z');
  });

  it('getBuses filters by route', async () => {
    const a = tab(memoryStorage());
    await a.upsertBus(bus());
    await a.upsertBus(bus({ bus_id: 'bus-9', route_id: 'other' }));
    const buses = await a.getBuses('demo-route');
    expect(buses.map((b) => b.bus_id)).toEqual(['bus-1']);
  });

  it('notifies subscribers in the same tab', async () => {
    const a = tab(memoryStorage());
    const cb = vi.fn();
    a.subscribeBuses('demo-route', cb);
    await a.upsertBus(bus());
    expect(cb).toHaveBeenLastCalledWith([expect.objectContaining({ bus_id: 'bus-1' })]);
  });

  it('syncs to another tab', async () => {
    const storage = memoryStorage();
    const a = tab(storage);
    const b = tab(storage);
    const cb = vi.fn();
    b.subscribeBuses('demo-route', cb);
    await a.upsertBus(bus({ status: 'moving' }));
    await vi.waitFor(() =>
      expect(cb).toHaveBeenLastCalledWith([expect.objectContaining({ bus_id: 'bus-1', status: 'moving' })]),
    );
  });

  it('emits current list on subscribe', async () => {
    const a = tab(memoryStorage());
    await a.upsertBus(bus());
    const cb = vi.fn();
    a.subscribeBuses('demo-route', cb);
    await vi.waitFor(() => expect(cb).toHaveBeenCalledTimes(1));
    expect(cb).toHaveBeenCalledWith([expect.objectContaining({ bus_id: 'bus-1' })]);
  });

  it('unsubscribe stops callbacks', async () => {
    const a = tab(memoryStorage());
    const cb = vi.fn();
    const unsubscribe = a.subscribeBuses('demo-route', cb);
    unsubscribe();
    await a.upsertBus(bus());
    await Promise.resolve();
    expect(cb).not.toHaveBeenCalled();
  });

  it('restores after reload', async () => {
    const storage = memoryStorage();
    await tab(storage).upsertBus(bus());
    const reloaded = tab(storage);
    expect(await reloaded.getBuses('demo-route')).toHaveLength(1);
  });

  it('works when storage throws', async () => {
    const a = createMockAdapter({ storage: throwingStorage(), channel: null, now: () => T0 });
    await a.upsertBus(bus());
    expect(await a.getBuses('demo-route')).toHaveLength(1);
  });

  it('ignores corrupt storage', async () => {
    const storage = memoryStorage();
    storage.setItem('bus-demo:buses', '{not json');
    storage.setItem('bus-demo:reports', '"not an array"');
    const a = tab(storage);
    expect(await a.getBuses('demo-route')).toEqual([]);
    expect(await a.getRecentRiderReports(iso(0))).toEqual([]);
  });
});

describe('mock adapter: rider reports and reset', () => {
  it('recent rider reports', async () => {
    let t = T0 - 400_000;
    const a = createMockAdapter({ storage: memoryStorage(), channel: null, now: () => t });
    await a.addRiderReport(report({ session_id: 'old' }));
    t = T0 - 10_000;
    await a.addRiderReport(report({ session_id: 'new' }));
    t = T0;

    const recent = await a.getRecentRiderReports(iso(T0 - 300_000));
    expect(recent.map((r) => r.session_id)).toEqual(['new']);

    const cb = vi.fn();
    a.subscribeRiderReports(cb);
    await vi.waitFor(() => expect(cb).toHaveBeenCalled());
    expect(cb.mock.lastCall?.[0].map((r: RiderReport) => r.session_id)).toEqual(['new']);
  });

  it('resetDemo clears both and notifies other tab', async () => {
    const storage = memoryStorage();
    const a = tab(storage);
    const b = tab(storage);
    await a.upsertBus(bus());
    await a.addRiderReport(report());
    const busCb = vi.fn();
    const reportCb = vi.fn();
    b.subscribeBuses('demo-route', busCb);
    b.subscribeRiderReports(reportCb);

    await a.resetDemo();
    await vi.waitFor(() => {
      expect(busCb).toHaveBeenLastCalledWith([]);
      expect(reportCb).toHaveBeenLastCalledWith([]);
    });
    expect(await tab(storage).getBuses('demo-route')).toEqual([]);
  });
});
