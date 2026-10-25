// Keeps a list fresh from a Realtime channel, polling while the channel is down.
// Every event or (re)subscribe triggers a full refetch; we never patch from event payloads.

export type ChannelStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';

export function syncWithFallback<T>(opts: {
  listen: (onEvent: () => void, onStatus: (s: ChannelStatus) => void) => () => void;
  fetch: () => Promise<T>;
  onChange: (value: T) => void;
  pollMs?: number;
}): () => void {
  const pollMs = opts.pollMs ?? 3000;
  let disposed = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let lastSeq = 0;
  let lastEmitted = 0;

  const refresh = () => {
    if (disposed) return;
    const seq = ++lastSeq;
    opts.fetch().then(
      (value) => {
        // Drop results that arrive after dispose or after a newer fetch already landed.
        if (disposed || seq < lastEmitted) return;
        lastEmitted = seq;
        opts.onChange(value);
      },
      (err) => console.warn('[data] refresh failed, will retry', err),
    );
  };

  const startPolling = () => {
    if (disposed || pollTimer) return;
    refresh();
    pollTimer = setInterval(refresh, pollMs);
  };

  const stopPolling = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  };

  const stopListening = opts.listen(refresh, (status) => {
    if (status === 'SUBSCRIBED') {
      stopPolling();
      refresh();
    } else {
      startPolling();
    }
  });

  return () => {
    disposed = true;
    stopPolling();
    stopListening();
  };
}
