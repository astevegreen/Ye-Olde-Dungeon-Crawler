/** Types for `second-look.mjs`, which `scripts/second-look.mjs` runs under plain node. */

export const RAILS: readonly string[];
export function railFiles(files: readonly string[]): string[];
export function blockers(answer: string): number;
export function loosens(answer: string): boolean | null;

/** A review that ran: its answer, or why it gave none. Null when it did not run. */
export type Ran = { answer: string; error?: undefined } | { error: string; answer?: undefined } | null;
export interface Verdict {
  verdict: 'ship' | 'fix' | 'owner' | 'retry';
  why: string;
}
export function verdict(ran: { rails?: readonly string[]; rail?: Ran; look?: Ran }): Verdict;
