/** Types for `push-lock.mjs`, which `.githooks/pre-push` runs under plain node. */

export const INTEGRATOR: string;

export function pushLockRefusal(options: {
  refs: string;
  windowText: string | null;
  now: Date;
  toplevel: string;
  integrator?: string;
}): string | null;
