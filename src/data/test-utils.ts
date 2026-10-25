// Storage stand-ins for tests (vitest runs in node, which has no localStorage).

export function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() { return items.size; },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => { items.delete(key); },
    setItem: (key, value) => { items.set(key, String(value)); },
  };
}

// Behaves like Safari private mode or blocked site data: every call throws.
export function throwingStorage(): Storage {
  const fail = (): never => { throw new Error('storage unavailable'); };
  return {
    get length() { return fail(); },
    clear: fail,
    getItem: fail,
    key: fail,
    removeItem: fail,
    setItem: fail,
  };
}
