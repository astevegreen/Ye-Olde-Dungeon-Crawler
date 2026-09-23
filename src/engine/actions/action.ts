
import type { ActionResult } from '../types';
import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';

export interface Action {
  /** Hook-matching name; overrides the constructor name as the pipeline's `actionType` (§4). */
  readonly actionType?: string;
  /** Alternate name that hook filters also match against; never reported as `actionType`. */
  readonly type?: string;
  // The acting entity. `ActionPipeline` resolves the actor from the first of these that is set,
  // in declaration order, falling back to `engine.player`.
  readonly entity?: Entity;
  readonly attacker?: Entity;
  readonly actor?: Entity;
  readonly player?: Entity;
  perform(engine: GameEngine): ActionResult;
}
