/** Types for `agy.mjs`, which `scripts/second-look.mjs` runs under plain node. */

export const HEADLESS: string;
export const EFFORT: string;
/** Gemini's fast model families, newest first, as agy names them without the effort. */
export const LIGHT: readonly string[];
/** Gemini's deep model families, never asked. */
export const HEAVY: readonly string[];
/** The model ids in what `agy models` prints. */
export function parseModels(stdout: string | undefined): string[];
/** The models agy offers, or null when it cannot say. */
export function listModels(run: (args: string[]) => AgyRun): string[] | null;
/** The fast Gemini models to ask, newest family and version first; LIGHT as written when `listed` is null. */
export function lightModels(listed: readonly string[] | null, light?: readonly string[]): string[];
/** The listed Gemini models in neither LIGHT nor HEAVY. */
export function unsorted(listed: readonly string[] | null, light?: readonly string[], heavy?: readonly string[]): string[];
export type ClaudeKind = 'opus' | 'sonnet';
/** Claude's two models in agy, without the effort, as asked when agy cannot list its models. */
export const CLAUDE: Readonly<Record<ClaudeKind, string>>;
/** The newest listed version of a Claude model, null when agy no longer offers it; CLAUDE's when `listed` is null. */
export function claudeModel(listed: readonly string[] | null, kind: ClaudeKind, claude?: Readonly<Record<ClaudeKind, string>>): string | null;
export type Order = 'deep' | 'standard' | 'rail' | 'gemini';
export interface Asked {
  light: readonly string[];
  opus: string | null;
  sonnet: string | null;
}
/** Who is asked, in order, by kind of review. */
export const ORDERS: Record<Order, (asked: Asked) => (string | null)[]>;
/** The models a review asks, read from `agy models`, and a note for the report (empty when there is none). */
export function reviewModels(run: (args: string[]) => AgyRun, order?: Order): { models: string[]; note: string };
/** A model's name for the report, read from its id. */
export function modelName(model: string): string;

export type Depth = 'deep' | 'standard';

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
/** The files a diff changes (a rename or copy names its old path, then its new one) and its +/- line count. */
export function diffStats(diff: string): { files: string[]; lines: number };
/** Sort comparator: model versions ("3.8", "5-5") newest first, number by number, locale-free. */
export function newerFirst(a: string, b: string): number;

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
  meter?: Meter | null,
): string;
/** Adds up the tokens agy reports, for the ledger. */
export interface Meter {
  tokens?: number;
}
/** The tokens one agy run used (usage.total_tokens), or null. */
export function replyTokens(run: AgyRun | undefined): number | null;

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
  seconds: number;
  tokens: number | null;
}
export function askFirstAvailable(
  models: readonly string[],
  ask: (model: string, meter: Meter) => string,
  store?: QuotaStore,
  now?: () => number,
): Answer;
export function byLine(answer: Pick & { model: string; passed?: Passed[] }): string;

/** The quota ledger, one JSON line per review call, shared by every repo on this PC. */
export const LEDGER_FILE: string;
export interface LedgerLine {
  at?: string;
  repo?: string;
  pr?: number | null;
  sha?: string;
  mode?: 'full' | 'delta' | 'carry' | 'skip' | 'batch';
  depth?: string;
  model?: string | null;
  passed?: string[];
  seconds?: number | null;
  tokens?: number | null;
  verdict?: string;
  [field: string]: unknown;
}
export function appendLedger(entry: LedgerLine, file?: string, now?: () => number): void;
export function readLedger(file?: string): LedgerLine[];

export const SMALL: number;
export function isLockfile(file: string): boolean;
export function isTest(file: string): boolean;
export function isDoc(file: string): boolean;
/** Why agy may skip a change (docs, tests, lockfiles, Dependabot, a small one off the high-risk paths and rails), or null. */
export function skipReason(
  stats: { files?: readonly string[]; lines?: number },
  where?: { deep?: boolean; rails?: boolean; author?: string },
): string | null;

export const CARRY: number;
export interface Prior {
  sha: string;
  verdict: string;
  blockers?: readonly string[];
  notes?: readonly string[];
}
/** Whether a run reuses an earlier pass (carry), reviews only the changes since (delta), or reviews it all (full). */
export function carryOver(
  prior: Prior | null,
  delta: { lines: number },
  where?: { deep?: boolean; rails?: boolean; pass?: readonly string[]; fixable?: readonly string[] },
): { mode: 'carry' | 'delta' | 'full'; why: string };
export function deltaPreamble(prior: Prior): string;
