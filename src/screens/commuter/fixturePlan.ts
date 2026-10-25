import { useState } from 'react';
import { FIXTURES } from '../../contracts/fixtures';
import type { LeavePlan, Stop } from '../../contracts/types';

/** Copy-table states that have no LeavePlan fixture: they come from the device, not the backend. */
const DEVICE_STATES = ['offline', 'location_off'] as const;

export const FIXTURE_STATES: string[] = [...Object.keys(FIXTURES), ...DEVICE_STATES];

export interface FixturePlan {
  plan: LeavePlan;
  offline: boolean;
}

function fixtureFor(name: string): FixturePlan {
  const computed_at_real_ms = Date.now();
  if (name === 'offline') {
    return { plan: { ...FIXTURES.relax, leave_in_sec: 300, data_age_sec: 120, computed_at_real_ms }, offline: true };
  }
  if (name === 'location_off') {
    return { plan: { ...FIXTURES.relax, user_stop: null, computed_at_real_ms }, offline: false };
  }
  return { plan: { ...(FIXTURES[name] ?? FIXTURES.relax), computed_at_real_ms }, offline: false };
}

const readStateParam = () => new URLSearchParams(window.location.search).get('state');

/** Hidden design switcher: `/?state=leave_now`. Without `?state=` the commuter screen runs on useLeavePlan(). */
export function useFixturePlan() {
  const [name, setName] = useState(() => readStateParam() ?? 'relax');
  const [fixture, setFixture] = useState(() => fixtureFor(name));

  const select = (next: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('state', next);
    window.history.replaceState(null, '', url);
    setName(next);
    setFixture(fixtureFor(next));
  };

  const pickStop = (stop: Stop) => {
    setName('relax');
    setFixture({ plan: { ...fixtureFor('relax').plan, user_stop: stop }, offline: false });
  };

  return { ...fixture, name, select, pickStop, showSwitcher: readStateParam() !== null };
}
