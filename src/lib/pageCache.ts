// Remembers what a page last showed, so going back to it is instant. The page shows the
// remembered data straight away and quietly fetches the latest (stale-while-revalidate).
// In memory only: cleared on reload and on logout, never stored on the device.

const cache = new Map<string, unknown>()

export function cached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined
}

export function remember<T>(key: string, value: T): T {
  cache.set(key, value)
  return value
}

export function forgetAll(): void {
  cache.clear()
}
