import { useEffect, useState } from 'react';
import { realNowMs } from '../../contracts/clock';

/** Re-renders every `intervalMs` so countdowns and "8s ago" labels stay current. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(realNowMs);
  useEffect(() => {
    const id = window.setInterval(() => setNow(realNowMs()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}
