/** Types for `gemini-audit.mjs`, which runs under plain node; the test imports what it checks. */
import type { AgyRun, Answer, Pick, QuotaStore, Reviewed } from './lib/agy.mjs';

export type Audit = Answer & Pick & { note: string };
export function askGemini(
  promptName: string,
  material: string | null,
  what: Reviewed,
  agy?: (args: string[]) => AgyRun,
  store?: QuotaStore,
): Audit;
/** The comment: label, by-line, the model-list note quoted line by line when there is one, then the answer. */
export function report(label: string, answer: Pick & { model: string; response: string; note?: string }): string;
export function cleanUp(): void;
