import { describe, expect, it } from 'vitest';
import route from '../../data/route.json';
import type { Stop } from '../../contracts/types';
import { resolveTrip } from './tripIntent';

const stops = route.stops as Stop[];

describe('resolveTrip', () => {
  it('uses the backend stop decision and parses the deadline on the phone', async () => {
    let body: unknown;
    const request: typeof fetch = async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ answer: 'EDSA Ayala', confidence: 0.84, decided_by: 'decisions_api' }), { status: 200 });
    };

    const intent = await resolveTrip('EDSA Ayala by 9am', stops, request);

    expect(body).toEqual({ decision: 'destination', evidence: 'EDSA Ayala by 9am', options: [...stops.map((s) => s.name), 'Unclear'] });
    expect(intent).toEqual({ destination_stop_id: 's7', destination_confidence: 0.84, arrive_by: '09:00', clarify: null, decided_by: 'decisions_api' });
  });

  it('asks for a stop when the AI is unsure', async () => {
    const request: typeof fetch = async () => new Response(JSON.stringify({ answer: 'EDSA Ayala', confidence: 0.42, decided_by: 'decisions_api' }), { status: 200 });

    const intent = await resolveTrip('Ayala by 9', stops, request);

    expect(intent.destination_stop_id).toBe('s7');
    expect(intent.arrive_by).toBe('09:00');
    expect(intent.clarify).toBeTruthy();
  });

  it('rejects an invented stop and offers the stop picker', async () => {
    const request: typeof fetch = async () => new Response(JSON.stringify({ answer: 'High Street', confidence: 0.99, decided_by: 'decisions_api' }), { status: 200 });

    const intent = await resolveTrip('High Street by 9', stops, request);

    expect(intent.destination_stop_id).toBeNull();
    expect(intent.clarify).toBeTruthy();
  });

  it('falls back to local rules when the endpoint is unavailable', async () => {
    const request: typeof fetch = async () => { throw new Error('offline'); };

    const intent = await resolveTrip('EDSA Ayala by 9', stops, request);

    expect(intent).toEqual({ destination_stop_id: 's7', destination_confidence: null, arrive_by: '09:00', clarify: null, decided_by: 'rules' });
  });
});
