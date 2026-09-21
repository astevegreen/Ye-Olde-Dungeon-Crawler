import type { GameEngine } from '../../engine';
import type { DiagnosticTabId, DiagnosticTabContext } from './types';
import { renderSimulationTab } from './simulationTab';
import { renderActorTab } from './actorTab';
import { renderPipelineTab } from './pipelineTab';
import { renderTriageTab } from './triageTab';

export * from './types';
export { renderSimulationTab } from './simulationTab';
export { renderActorTab } from './actorTab';
export { renderPipelineTab, formatEventSummary } from './pipelineTab';
export { renderTriageTab, spawnTestItem, spawnTestMonster } from './triageTab';

export const DIAGNOSTIC_TAB_RENDERERS: Record<
  DiagnosticTabId,
  (ctx: DiagnosticTabContext, engine: GameEngine) => void
> = {
  simulation: renderSimulationTab,
  actor: renderActorTab,
  pipeline: renderPipelineTab,
  triage: renderTriageTab,
};
