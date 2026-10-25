import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BusStatus, RiderReport } from '../contracts/types';
import { CONFIG } from '../contracts/config';
import type { DataAdapter } from './adapter';
import { syncWithFallback, type ChannelStatus } from './realtime';

// Live mode: Supabase Postgres + Realtime, with 3 s polling while Realtime is down.
// The database trigger sets updated_at; the client never does.

const REPORT_COLUMNS = 'session_id,kind,bus_id,stop_id,created_at';

export function createLiveClient(): SupabaseClient | null {
  const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!rawUrl || !key) return null;
  // Tolerate the REST endpoint being pasted instead of the project URL.
  const url = rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  return createClient(url, key.trim(), { auth: { persistSession: false } });
}

let channelCount = 0;

export function createLiveAdapter(client: SupabaseClient): DataAdapter {
  const fail = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };

  async function getBuses(routeId: string): Promise<BusStatus[]> {
    const { data, error } = await client.from('bus_status').select('*').eq('route_id', routeId);
    fail(error);
    return (data ?? []) as BusStatus[];
  }

  async function getRecentRiderReports(sinceIso: string): Promise<RiderReport[]> {
    const { data, error } = await client
      .from('rider_reports')
      .select(REPORT_COLUMNS)
      .gte('created_at', sinceIso)
      .order('created_at');
    fail(error);
    return (data ?? []) as RiderReport[];
  }

  // One channel per subscription, so two subscribers never share (and close) the same one.
  function listenTo(table: string, filters: { event: '*' | 'INSERT' | 'DELETE'; filter?: string }[]) {
    return (onEvent: () => void, onStatus: (s: ChannelStatus) => void) => {
      let channel = client.channel(`${table}:${++channelCount}`);
      for (const f of filters) {
        channel = channel.on('postgres_changes', { schema: 'public', table, ...f }, onEvent);
      }
      channel.subscribe((status) => onStatus(status as ChannelStatus));
      return () => {
        void client.removeChannel(channel);
      };
    };
  }

  return {
    getBuses,
    getRecentRiderReports,

    subscribeBuses(routeId, onChange) {
      return syncWithFallback({
        // Supabase can't filter DELETE events, so listen to those unfiltered (resetDemo uses them).
        listen: listenTo('bus_status', [
          { event: '*', filter: `route_id=eq.${routeId}` },
          { event: 'DELETE' },
        ]),
        fetch: () => getBuses(routeId),
        onChange,
      });
    },

    subscribeRiderReports(onChange) {
      return syncWithFallback({
        listen: listenTo('rider_reports', [{ event: 'INSERT' }, { event: 'DELETE' }]),
        fetch: () =>
          getRecentRiderReports(new Date(Date.now() - CONFIG.RIDER_REPORT_TTL_SEC * 1000).toISOString()),
        onChange,
      });
    },

    async upsertBus(bus) {
      const row: Partial<BusStatus> = { ...bus };
      delete row.updated_at; // callers may spread a row they read back; the server owns this
      const { error } = await client.from('bus_status').upsert(row, { onConflict: 'bus_id' });
      fail(error);
    },

    async addRiderReport(r) {
      const row: Partial<RiderReport> = { ...r };
      delete row.created_at;
      const { error } = await client.from('rider_reports').insert(row);
      fail(error);
    },

    async resetDemo() {
      const buses = await client.from('bus_status').delete().eq('route_id', CONFIG.ROUTE_ID);
      fail(buses.error);
      const reports = await client.from('rider_reports').delete().gte('id', 0);
      fail(reports.error);
    },
  };
}
