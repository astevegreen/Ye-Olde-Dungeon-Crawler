/**
 * Safe JSON serialization utilities.
 * Hardens state, telemetry, and error logging against circular reference crashes,
 * BigInt conversion exceptions, and recursive log cascades.
 */

/**
 * Creates a circular-safe JSON replacer function.
 * Replaces circular references with '[Circular]'.
 */
export function createSafeJsonReplacer(): (key: string, value: unknown) => unknown {
  const seen = new WeakSet<object>();

  return function (this: unknown, _key: string, value: unknown): unknown {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (typeof value === 'function') {
      return `[Function: ${(value as { name?: string }).name || 'anonymous'}]`;
    }
    return value;
  };
}

/**
 * Safely stringifies any value to JSON without throwing TypeError on circular references,
 * BigInt values, DOM/function values, or deeply recursive structures.
 *
 * @param value The value to stringify
 * @param space Indentation spaces or formatting string
 * @param fallback Fallback string if stringification fails completely
 */
export function safeJsonStringify(
  value: unknown,
  space?: string | number,
  fallback = '"[Unserializable]"'
): string {
  if (value === undefined) {
    return 'undefined';
  }
  try {
    const replacer = createSafeJsonReplacer();
    return JSON.stringify(value, replacer, space);
  } catch (_err) {
    if (typeof fallback === 'string') {
      return fallback;
    }
    try {
      return JSON.stringify(fallback);
    } catch {
      return '"[Unserializable]"';
    }
  }
}
