/**
 * Safe JSON serialization utilities.
 * Hardens state, telemetry, and error logging against circular reference crashes,
 * BigInt conversion exceptions, and recursive log cascades.
 */

/**
 * Creates a circular-safe JSON replacer function.
 * Replaces circular references with '[Circular]'. Only an object's own ancestors count: an
 * object reached twice by separate paths (a save holds its compendium twice) is written twice.
 */
function createSafeJsonReplacer(): (key: string, value: unknown) => unknown {
  const ancestors: unknown[] = [];

  return function (this: unknown, _key: string, value: unknown): unknown {
    if (typeof value === 'object' && value !== null) {
      // `this` holds `value`: drop the ancestors whose subtrees are already written.
      while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) ancestors.pop();
      if (ancestors.includes(value)) {
        return '[Circular]';
      }
      ancestors.push(value);
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
