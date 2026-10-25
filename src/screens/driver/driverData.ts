// The driver screen writes through Backend 1's shared adapter (BUILD_PLAN 4.6).
// Kept as a one-line seam so the driver code never imports src/data/ directly in many places.
export { data } from '../../data/adapter';
export type { DataAdapter as DriverData } from '../../data/adapter';
