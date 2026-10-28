/** Types for `usage-limit.mjs`, which `scripts/sprint/queue.mjs` runs under plain node. */

export function resumeAfter(
  text: string,
  options?: { lastEventAt?: string; now?: Date },
): { start: boolean; reason: string; after?: string; restartAt?: string };

/** The reset a usage-limit error names, as epoch ms, the first after `last` (epoch ms); null when it names none. */
export function namedReset(text: string, last: number): number | null;
