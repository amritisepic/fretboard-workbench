/**
 * Small per-device settings kept in localStorage, outside presets. Reading and writing never throw:
 * private windows and blocked storage fall back to the defaults.
 */

export function readStored(key: string): unknown {
  try {
    const text = globalThis.localStorage?.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is unavailable or full; the setting lasts until the tab closes.
  }
}

/** The fields of a stored object, or none when it is anything else. */
export function storedFields(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
}
