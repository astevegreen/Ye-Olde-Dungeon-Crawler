import type { DiagnosticTabId, DiagnosticTabRenderer } from './types';
import { renderSimulationTab } from './simulationTab';
import { renderActorTab } from './actorTab';
import { renderPipelineTab } from './pipelineTab';
import { renderTriageTab } from './triageTab';

export * from './types';

/**
 * Every diagnostic tab's renderer, keyed by tab id.
 *
 * Typing this as a total `Record<DiagnosticTabId, ...>` is deliberate: it is
 * what replaces the exhaustiveness the old in-class switch gave for free, so
 * adding a `DiagnosticTabId` without a renderer fails `tsc` rather than
 * silently rendering nothing.
 */
export const DIAGNOSTIC_TAB_RENDERERS: Record<DiagnosticTabId, DiagnosticTabRenderer> = {
  simulation: renderSimulationTab,
  actor: renderActorTab,
  pipeline: renderPipelineTab,
  triage: renderTriageTab,
};
