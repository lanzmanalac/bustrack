import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { realNowMs } from '../../contracts/clock';

/** Tracks an element's rendered height, e.g. to keep the map's route clear of an overlay. */
export function useElementHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setHeight(Math.round(el.getBoundingClientRect().height));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, height] as const;
}

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
