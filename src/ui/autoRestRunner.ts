import type { GameEngine } from '../engine';
import { AutoRestManager, type AutoRestStepResult } from '../engine';

export interface AutoRestRunnerOptions {
  stepDelayMs?: number;
  maxTurns?: number;
  onStep?: (result: AutoRestStepResult) => void;
  onComplete?: (result: AutoRestStepResult) => void;
}

/**
 * UI runner that orchestrates an interruptible rest loop with visual frame yields.
 */
export class AutoRestRunner {
  private isRunning = false;
  private timerId: number | null = null;
  private readonly engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  public get active(): boolean {
    return this.isRunning;
  }

  /**
   * Starts an asynchronous resting sequence. Returns an abort function.
   */
  public start(options?: AutoRestRunnerOptions): () => void {
    if (this.isRunning) {
      this.cancel('Cancelled previous rest.');
    }

    const player = this.engine.player;
    if (player.hp >= player.maxHp && player.mana >= player.maxMana) {
      this.engine.log('You are already fully rested (HP and Mana full).');
      return () => {};
    }

    if (AutoRestManager.findVisibleHostile(this.engine)) {
      this.engine.log('Cannot rest now! A hostile creature is in sight!');
      return () => {};
    }

    this.isRunning = true;
    const initialHp = player.hp;
    const initialMana = player.mana;
    let currentTurn = 0;
    const maxTurns = options?.maxTurns ?? 100;
    const stepDelay = options?.stepDelayMs ?? 30;

    const step = () => {
      if (!this.isRunning) return;

      const result = AutoRestManager.stepRestTurn(
        this.engine,
        initialHp,
        initialMana,
        currentTurn,
        maxTurns
      );

      currentTurn = result.turn;
      if (options?.onStep) {
        options.onStep(result);
      }

      if (result.finished) {
        this.isRunning = false;
        this.timerId = null;
        if (options?.onComplete) {
          options.onComplete(result);
        }
        return;
      }

      // Schedule next step after delay
      this.timerId = window.setTimeout(step, stepDelay);
    };

    // Begin first step
    this.timerId = window.setTimeout(step, 0);

    return () => this.cancel('Rest interrupted by user.');
  }

  /**
   * Immediately halts the resting sequence.
   */
  public cancel(reason?: string): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (reason) {
      this.engine.log(reason);
    }
  }
}
