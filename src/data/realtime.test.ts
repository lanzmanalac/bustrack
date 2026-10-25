import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncWithFallback, type ChannelStatus } from './realtime';

// A fake Realtime channel: the test drives events and status changes by hand.
function setup(fetch: () => Promise<string[]>) {
  let onEvent: () => void = () => {};
  let onStatus: (s: ChannelStatus) => void = () => {};
  const stopListening = vi.fn();
  const onChange = vi.fn();
  const dispose = syncWithFallback({
    listen: (e, s) => {
      onEvent = e;
      onStatus = s;
      return stopListening;
    },
    fetch,
    onChange,
  });
  return { event: () => onEvent(), status: (s: ChannelStatus) => onStatus(s), onChange, dispose, stopListening };
}

// Lets resolved fetch promises run their .then callbacks.
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('syncWithFallback', () => {
  it('fetches on SUBSCRIBED', async () => {
    const t = setup(vi.fn().mockResolvedValue(['x']));
    t.status('SUBSCRIBED');
    await flush();
    expect(t.onChange).toHaveBeenCalledWith(['x']);
  });

  it('fetches on event', async () => {
    const fetch = vi.fn().mockResolvedValue(['x']);
    const t = setup(fetch);
    t.event();
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(t.onChange).toHaveBeenCalledWith(['x']);
  });

  it('polls every 3000ms after CHANNEL_ERROR', async () => {
    const fetch = vi.fn().mockResolvedValue(['x']);
    const t = setup(fetch);
    t.status('CHANNEL_ERROR');
    await vi.advanceTimersByTimeAsync(9000);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('no duplicate timers', async () => {
    const fetch = vi.fn().mockResolvedValue(['x']);
    const t = setup(fetch);
    t.status('CHANNEL_ERROR');
    t.status('TIMED_OUT');
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('stops polling on resubscribe', async () => {
    const fetch = vi.fn().mockResolvedValue(['x']);
    const t = setup(fetch);
    t.status('CHANNEL_ERROR');
    await flush();
    t.status('SUBSCRIBED');
    await flush();
    const callsAfterResubscribe = fetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(9000);
    expect(fetch).toHaveBeenCalledTimes(callsAfterResubscribe);
  });

  it('no emits after dispose', async () => {
    let resolveSlow: (v: string[]) => void = () => {};
    const fetch = vi.fn(() => new Promise<string[]>((r) => { resolveSlow = r; }));
    const t = setup(fetch);
    t.event();
    t.dispose();
    resolveSlow(['late']);
    await flush();
    expect(t.onChange).not.toHaveBeenCalled();
    expect(t.stopListening).toHaveBeenCalled();

    t.status('CLOSED'); // Supabase reports CLOSED after our own removeChannel
    await vi.advanceTimersByTimeAsync(9000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('drops stale results', async () => {
    const resolvers: ((v: string[]) => void)[] = [];
    const fetch = vi.fn(() => new Promise<string[]>((r) => { resolvers.push(r); }));
    const t = setup(fetch);
    t.event();
    t.event();
    resolvers[1](['second']);
    await flush();
    resolvers[0](['first']);
    await flush();
    expect(t.onChange).toHaveBeenLastCalledWith(['second']);
    expect(t.onChange).toHaveBeenCalledTimes(1);
  });

  it('survives fetch errors', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(['x']);
    const t = setup(fetch);
    t.status('CHANNEL_ERROR');
    await vi.advanceTimersByTimeAsync(3000);
    expect(t.onChange).toHaveBeenCalledWith(['x']);
  });
});
