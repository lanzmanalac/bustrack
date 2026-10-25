import type { BusStatus, RiderReport } from '../contracts/types';
import { createMockAdapter } from './mock';

// Frozen contract (BUILD_PLAN 4.6). subscribe* also emits the current list once right after subscribing.
export interface DataAdapter {
  getBuses(routeId: string): Promise<BusStatus[]>;
  subscribeBuses(routeId: string, onChange: (buses: BusStatus[]) => void): () => void; // emits the full list
  upsertBus(bus: Omit<BusStatus, 'updated_at'>): Promise<void>;
  addRiderReport(r: Omit<RiderReport, 'created_at'>): Promise<void>;
  getRecentRiderReports(sinceIso: string): Promise<RiderReport[]>;
  subscribeRiderReports(onChange: (reports: RiderReport[]) => void): () => void;
  resetDemo(): Promise<void>;
}

export const data: DataAdapter = createMockAdapter();
