/** Types for `second-look.mjs`, which `scripts/second-look.mjs` runs under plain node. */

export const RAILS: readonly string[];
/** Whether a rail audit may come from this model: Opus or one of Gemini's fast models; never Sonnet or a deep Gemini. */
export function railModel(model: string | undefined): boolean;
export function railFiles(files: readonly string[]): string[];
export function blockers(answer: string): number;
/** The blocker lines of an answer, each cut to 300 characters. */
export function blockerLines(answer: string | undefined): string[];
/** The newest usable earlier second look on this request, from the ledger, or null. */
export function priorReview<L extends { repo?: string; request?: unknown; verdict?: string; mode?: string; sha?: string }>(
  ledger: readonly L[],
  request: string,
  usable: (sha: string) => boolean,
): (L & { sha: string; verdict: string }) | null;
export function loosens(answer: string): boolean | null;

/** A review that ran: its answer and the model that gave it, or why it gave none. Null when it did not run. */
export type Ran = { answer: string; model?: string; error?: undefined } | { error: string; answer?: undefined } | null;
export interface Verdict {
  verdict: 'ship' | 'fix' | 'owner' | 'retry';
  why: string;
}
export function verdict(ran: { rails?: readonly string[]; rail?: Ran; look?: Ran }): Verdict;
