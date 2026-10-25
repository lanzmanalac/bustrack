import type { BusStatus, RiderReport } from '../contracts/types';

/**
 * The data contract from BUILD_PLAN Section 4.6.
 *
 * Lives here rather than in `src/data/` so the logic layer never waits on
 * Backend 1. When `src/data/adapter.ts` lands, pass its `data` export straight
 * into `useLeavePlan({ adapter: data })` — the shapes are identical.
 */
export interface DataAdapter {
  getBuses(routeId: string): Promise<BusStatus[]>;
  /** Emits the full list on every change. Returns an unsubscribe function. */
  subscribeBuses(routeId: string, onChange: (buses: BusStatus[]) => void): () => void;
  upsertBus(bus: Omit<BusStatus, 'updated_at'>): Promise<void>;
  addRiderReport(r: Omit<RiderReport, 'created_at'>): Promise<void>;
  getRecentRiderReports(sinceIso: string): Promise<RiderReport[]>;
  subscribeRiderReports(onChange: (reports: RiderReport[]) => void): () => void;
  resetDemo(): Promise<void>;
}
