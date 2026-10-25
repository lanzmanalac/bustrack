import type { LatLng } from '../contracts/types';
import { CONFIG } from '../contracts/config';

/**
 * Location handling for the commuter side.
 *
 * HARD RULE: coordinates are read here and stay here. Nothing in this module
 * serialises a position, and no value it returns is ever placed in a request
 * body, a query string, or evidence sent to any model. DevTools → Network is
 * checked against this before every demo.
 */

export type LocationStatus = 'idle' | 'pending' | 'granted' | 'denied' | 'unavailable';

export interface LocationState {
  status: LocationStatus;
  loc: LatLng | null;
  message: string | null;
}

const DEMO_FLAG = 'demo';

/** `?demo=1` pins us to a fixed spot so the demo never depends on GPS. */
export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get(DEMO_FLAG) === '1';
  } catch {
    return false;
  }
}

/** Synchronous first paint: demo location immediately, otherwise wait for GPS. */
export function initialLocation(): LatLng | null {
  return isDemoMode() ? CONFIG.DEMO_USER_LOCATION : null;
}

const PERMISSION_MESSAGES: Record<Exclude<LocationStatus, 'granted' | 'pending' | 'idle'>, string> = {
  denied: 'Location is off — pick your stop instead.',
  unavailable: 'We could not read your location — pick your stop instead.',
};

/**
 * Ask for GPS once. Resolves with null rather than throwing so the screen can
 * fall straight into "Pick your stop" (onboarding step 2, one tap).
 */
export function requestLocation(timeoutMs = 8000): Promise<LocationState> {
  if (isDemoMode()) {
    return Promise.resolve({ status: 'granted', loc: CONFIG.DEMO_USER_LOCATION, message: null });
  }

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve({
      status: 'unavailable',
      loc: null,
      message: PERMISSION_MESSAGES.unavailable,
    });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          status: 'granted',
          loc: { lat: position.coords.latitude, lng: position.coords.longitude },
          message: null,
        }),
      (error) =>
        resolve({
          status: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable',
          loc: null,
          message:
            error.code === error.PERMISSION_DENIED
              ? PERMISSION_MESSAGES.denied
              : PERMISSION_MESSAGES.unavailable,
        }),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

/**
 * Follow the phone as it moves. Returns an unsubscribe function.
 * In demo mode this never touches the Geolocation API at all.
 */
export function watchLocation(onChange: (state: LocationState) => void): () => void {
  if (isDemoMode()) {
    onChange({ status: 'granted', loc: CONFIG.DEMO_USER_LOCATION, message: null });
    return () => {};
  }

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    onChange({ status: 'unavailable', loc: null, message: PERMISSION_MESSAGES.unavailable });
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) =>
      onChange({
        status: 'granted',
        loc: { lat: position.coords.latitude, lng: position.coords.longitude },
        message: null,
      }),
    (error) =>
      onChange({
        status: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable',
        loc: null,
        message:
          error.code === error.PERMISSION_DENIED
            ? PERMISSION_MESSAGES.denied
            : PERMISSION_MESSAGES.unavailable,
      }),
    { enableHighAccuracy: false, timeout: 15_000, maximumAge: 15_000 },
  );

  return () => navigator.geolocation.clearWatch(watchId);
}
