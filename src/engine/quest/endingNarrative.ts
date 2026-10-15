import type { EndingDefinition } from '../types/manifest';
import type { WorldState } from '../state/worldState';
import { evaluatePredicate } from '../predicates/predicateEvaluator';

/**
 * The paragraphs an ending tells for this run: its narrative, with each conditional paragraph
 * whose condition holds placed before the paragraph it names, in declared order.
 */
export function endingNarrative(ending: EndingDefinition, worldState: WorldState): string[] {
  const base = ending.narrative ?? [];
  const told = (ending.conditionalNarrative ?? []).filter((p) => evaluatePredicate(p.when, worldState));
  const out: string[] = [];
  base.forEach((paragraph, index) => {
    for (const p of told) if (p.before === index) out.push(p.text);
    out.push(paragraph);
  });
  for (const p of told) if (p.before === undefined || p.before >= base.length) out.push(p.text);
  return out;
}
