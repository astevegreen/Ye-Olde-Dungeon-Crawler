/** Types for `usage-limit.mjs`, which `scripts/sprint/queue.mjs` runs under plain node. */

export function resumeAfter(
  text: string,
  options?: { lastEventAt?: string; now?: Date },
): { start: boolean; reason: string; after?: string; restartAt?: string };
