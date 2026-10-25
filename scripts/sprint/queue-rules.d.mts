/** Types for `queue-rules.mjs`, which `scripts/sprint/queue.mjs` runs under plain node. */

export const OWNER: string;
export const BOT: string;
export const AUDIT: string;
export const MEMORY_FLOOR_MB: number;
export const WINDOW_FILE: string;
export const TRIGGERS_FILE: string;
export const LOCK_FILE: string;
export const DEFAULT_HOURS: number;
export const SESSION_MB: number;
export const STATES: readonly string[];

export class QueueError extends Error {
  constructor(message: string, todo?: string, code?: number);
  do: string;
  code: number;
}

export type Ref = { issue: number } | { id: string };

export interface BacklogItem {
  id: string;
  text: string;
  waits: Ref[];
  soaks: boolean;
}

export interface SprintDoc {
  /** Set by `run` from this computer's window file; null when no sprint was started here. */
  window: { start: Date; end: Date } | null;
  lanes: { name: string; worktree: string }[];
  logIssue: number;
  preSprintTag: string | null;
  backlog: Record<string, BacklogItem[]>;
}

export function parseSprintDoc(text: string): SprintDoc;

/** One issue as `gh issue list --json number,title,body,labels,state,comments,closedAt,createdAt` gives it. */
export interface RawIssue {
  number: number;
  title: string;
  body?: string;
  state: string;
  labels?: { name: string }[];
  closedAt?: string | null;
  createdAt?: string | null;
  comments?: { author?: { login: string }; body?: string; createdAt: string }[];
}

export interface Issue {
  number: number;
  title: string;
  id: string | null;
  body: string;
  open: boolean;
  labels: string[];
  closedAt: Date | null;
  createdAt: Date | null;
  comments: { author: string; body: string; at: Date }[];
}

export function taskId(title: string): string | null;
export function normalizeIssues(raw: RawIssue[]): Issue[];
export function matchesId(issue: Issue, id: string): boolean;
export function bodyRefs(body: string): number[];
export function ownerReply(issue: Issue): Issue['comments'][number] | null;
export function heldRetry(issue: Issue, freeMb: number): { retry: boolean; why: string; concerns?: string };

export interface Deploy {
  headSha: string;
  displayTitle: string;
  status: string;
  conclusion: string;
  url: string;
}

export interface World {
  doc: SprintDoc;
  issues: Issue[];
  now: Date;
  freeMb: number;
  /** Commits on `sprint/<n>` ahead of origin/main; 0 when the branch doesn't exist. */
  branchAhead(n: number): number;
  /** The live process with this id, or null. */
  processInfo(pid: number): { name: string; start: Date } | null;
  lastDeploy: Deploy | null;
}

export interface Job {
  mode: 'build' | 'fix' | 'resume' | 'read' | 'soak' | 'hunt';
  issue: number | null;
  concerns?: string | null;
  reason: string;
  item?: string;
  folder?: string;
  since?: string | null;
}

export function laneQueue(world: World, lane: string, taken?: number[]): { job: Job | null; waiting: string[] };
export function researchQueue(world: World): { job: Job | null; waiting: string[] };
export function nextJob(world: World, lane: string, taken?: number[]): Job | null;
export function sessionTitles(doc: SprintDoc): string[];
export function hasWork(
  world: World,
  title: string,
  starting?: number,
): { start: boolean; reason: string; ready?: number; todo?: string[]; issues?: number[] };

export interface MovePlan {
  issue: number;
  from: string;
  to: string;
  comment: string | null;
  add: string[];
  remove: string[];
}
export function planMove(world: World, number: number, to: string, note?: string | null): MovePlan;

export function statusBlock(
  world: World,
  options?: { also?: string[]; oldBody?: string },
): { body: string; needsYou: string[]; new: string[] };

export interface QueueIO {
  sprintDoc(): string;
  gh(args: string[], input?: string): string;
  branchAhead(n: number): number;
  processInfo(pid: number): { name: string; start: Date } | null;
  freeMb(): number;
  now(): Date;
  /** This computer's sprint state, in the git common dir: JSON by file name. */
  local: {
    read(name: string): unknown;
    write(name: string, value: unknown): void;
    /** Creates the file only if it doesn't exist; false when it does. */
    claim(name: string, value: unknown): boolean;
    remove(name: string): void;
  };
  readFile(file: string): string;
}
export function run(argv: string[], io: QueueIO): { code: number; line: string };
