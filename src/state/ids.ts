let fallbackCount = 0;

/** A unique id for boxes, presets and folders. */
export function newId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${++fallbackCount}`;
}
