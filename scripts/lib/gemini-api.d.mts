/** Types for `gemini-api.mjs`, the Gemini API half of agy.mjs. */
import type { ApiAsk, Reviewed } from './agy.mjs';

export const API: string;
/** The Gemini API's id for an agy model: a Gemini id without the effort; null for any other model. */
export function apiModel(model: string): string | null;
/** The repo files agy reads by itself, which the API prompt carries instead. */
export const CONTEXT: readonly string[];
/** The line the callers put where they cut a long diff; the API refuses material that has it on a line of its own. */
export const CUT_LINE: string;
/** The line an answer through the API ends with. */
export const API_NOTE: string;
/** askModel's `api` for an audit that reads the whole repository: refuses. */
export const NO_API: ApiAsk;
/** askModel's `api` for what an audit reviews: NO_API for a whole-repo or spec audit, else the default. */
export function apiFor(kind: Reviewed['kind']): ApiAsk | undefined;
/** The repo's rules, the task and the material's text; throws when there is no material or it is truncated. */
export function apiPrompt(
  prompt: string,
  read?: (file: string) => string,
  context?: readonly string[],
  list?: (dir: string) => string[],
): string;
export interface ApiReply {
  status: number;
  text: string;
}
export function parseApiReply(reply: ApiReply): string;
export function postApi(
  url: string,
  body: unknown,
  key: string,
  spawn?: (
    cmd: string,
    args: string[],
    opts: { input: string; env: Record<string, string | undefined> },
  ) => { error?: Error; stdout?: string; stderr?: string },
): ApiReply;
export function geminiApi(
  key?: string,
  post?: (url: string, body: unknown, key: string) => ApiReply,
  read?: (file: string) => string,
  context?: readonly string[],
): ApiAsk | null;
