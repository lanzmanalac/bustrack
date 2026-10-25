import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import route from '../../data/route.json';
import type { Stop } from '../../contracts/types';
import { TripDropdown } from './Header';

describe('TripDropdown', () => {
  it('keeps the arrival verdict visible after the trip picker closes', () => {
    const html = renderToStaticMarkup(
      <TripDropdown
        stops={route.stops as Stop[]}
        routes={[{ route_id: route.route_id, name: route.name, direction: route.direction }]}
        routeId={route.route_id}
        onPickRoute={() => {}}
        trip={{
          intent: { destination_stop_id: 's7', destination_confidence: 0.84, arrive_by: '19:00', clarify: null, decided_by: 'decisions_api' },
          verdict: { kind: 'on_time' }, pending: false,
          onSubmit: () => {}, onPickStop: () => {}, onSetArriveBy: () => {}, onClear: () => {},
        }}
      />,
    );

    expect(html).toContain('To EDSA Ayala');
    expect(html).toContain('On time');
  });
});
