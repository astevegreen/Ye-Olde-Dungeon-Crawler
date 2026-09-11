import type { ActionResult } from '../types';
import type { GameEngine } from '../engine';

export interface Action {
  perform(engine: GameEngine): ActionResult;
}
