/** Types for `agy.mjs`, which `scripts/second-look.mjs` runs under plain node. */

export const EFFORT: string;
export const ARGON: string;
export const OPUS: string;
export const FLASH: string;
export const SONNET: string;
export function modelName(model: string): string;

export type Depth = 'deep' | 'standard';
export const ORDER: Record<Depth, readonly string[]>;
export const LARGE: number;

export interface Reviewed {
  kind: 'spec' | 'repo' | 'change';
  files?: string[];
  lines?: number;
}
export interface Pick {
  depth: Depth;
  why: string;
}
export function pickDepth(reviewed: Reviewed, deepPaths?: readonly string[]): Pick;
export function diffStats(diff: string): { files: string[]; lines: number };

export const TIMEOUT: string;
export function buildPrompt(text: string, materialFile?: string): string;

export interface AgyRun {
  status?: number | null;
  stdout?: string;
  stderr?: string;
  error?: { code?: string; message?: string };
}
export function parseReply(run: AgyRun): string;

export function resetsAt(message: string, now: number): Date;
export interface QuotaStore {
  outUntil(model: string, now: number): Date | null;
  markOut(model: string, until: Date): void;
}
export const QUOTA_FILE: string;
export function quotaFile(file?: string): QuotaStore;

/** A model the review went past: out of usage `until` a time, or for a passing reason (`why`). */
export interface Passed {
  model: string;
  until?: Date;
  why?: string;
}
export interface Answer {
  model: string;
  response: string;
  passed: Passed[];
}
export function askFirstAvailable(
  models: readonly string[],
  ask: (model: string) => string,
  store?: QuotaStore,
  now?: () => number,
): Answer;
export function byLine(answer: Pick & { model: string; passed?: Passed[] }): string;
