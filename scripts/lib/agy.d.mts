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
/** How long a run resumed after a time-out may take. */
export const RESUME_TIMEOUT: string;
export function buildPrompt(text: string, materialFile?: string): string;

export interface AgyRun {
  status?: number | null;
  stdout?: string;
  stderr?: string;
  error?: { code?: string; message?: string };
}
export function parseReply(run: AgyRun): string;
/** How a model is asked through the Gemini API where agy is not installed. */
export type ApiAsk = (prompt: string, model: string) => string;
/**
 * One model's answer; a run cut off for a refused command or a time-out is resumed once. Where agy is not
 * installed, `api` (by default the Gemini API when GEMINI_API_KEY is set, else null) asks instead.
 */
export function askModel(
  run: (args: string[]) => AgyRun,
  prompt: string,
  model: string,
  extra?: string[],
  api?: ApiAsk | null,
): string;

export const API: string;
/** The Gemini API's id for each agy model it has; Claude's models are not on it. */
export const API_MODELS: Record<string, string>;
/** A buildPrompt prompt with the material's text in place of its path; throws when there is no material. */
export function apiPrompt(prompt: string, read?: (file: string) => string): string;
export interface ApiReply {
  status: number;
  text: string;
}
export function parseApiReply(reply: ApiReply): string;
export function postApi(url: string, body: unknown, key: string): ApiReply;
export function geminiApi(
  key?: string,
  post?: (url: string, body: unknown, key: string) => ApiReply,
  read?: (file: string) => string,
): ApiAsk | null;

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
