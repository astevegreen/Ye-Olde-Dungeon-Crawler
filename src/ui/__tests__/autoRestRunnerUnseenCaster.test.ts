import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameEngine, GameMap, TILES, Player, Monster, SpellRegistry, activateRegistries, type AutoRestStepResult } from '../../engine';
import { AutoRestRunner } from '../autoRestRunner';

// Sprint B9 (#46): the P-36 soak saw the game ignore keys for over 5 s while a blinded hero
// rested (the R key, this runner) and an unseen caster kept casting at them, each cast a
// tactical batch that holds input. Since P-36 a spell aimed at the hero ends the rest, so the
// runner stops on the first cast and the batches cannot pile up behind its timer.

describe('B9 · the R key’s rest stops on the first spell an unseen caster aims at the hero', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    activateRegistries(null);
    SpellRegistry.clear();
  });

  it('a harmless aimed spell ends the runner’s rest, with no rest step after the cast’s own', () => {
    const map = new GameMap(20, 9, TILES.FLOOR);
    const player = new Player({ id: 'hero', position: { x: 3, y: 4 }, stats: { hp: 40, maxHp: 400, attack: 1, defense: 0 } });
    const engine = new GameEngine({ map, player, seed: 3 });
    SpellRegistry.register({
      id: 'rest_hex', name: 'Hex', school: 'Combat', manaCost: 1, element: 'physical', range: 8, basePower: 0,
      areaOfEffect: 0, reflects: false, targetType: 'ray', targetingMode: 'ray', description: '', effects: [],
    } as never);
    player.statusManager.applyStatus({ type: 'blindness', duration: 200 });
    engine.addEntity(
      new Monster({
        id: 'hexer', name: 'Hexer', position: { x: 7, y: 4 }, stats: { hp: 30, maxHp: 30, attack: 0, defense: 0 },
        aiType: 'caster', aiState: 'hunting', spells: ['rest_hex'], fleeHealthPercent: 0, xpValue: 1, lootTable: [],
      } as never)
    );
    engine.updateFov();
    expect(engine.fov.isVisible(7, 4)).toBe(false);

    // What happened, in order: each rest step the runner took, and each spell aimed at the hero.
    const trail: string[] = [];
    const forward = engine.onGameEvent;
    engine.onGameEvent = (ev) => {
      if (ev.type === 'spell_aimed' && ev.targetId === player.id) trail.push('cast');
      forward?.(ev);
    };
    let completed: AutoRestStepResult | undefined;
    const runner = new AutoRestRunner(engine);
    runner.start({ stepDelayMs: 30, onStep: () => trail.push('step'), onComplete: (r) => (completed = r) });

    vi.advanceTimersByTime(30 * 100);

    expect(runner.active).toBe(false);
    expect(completed?.interrupted).toBe(true);
    expect(completed?.reason).toBe('Rest interrupted! Something unseen casts a spell at you!');
    const firstCast = trail.indexOf('cast');
    expect(firstCast).toBeGreaterThanOrEqual(0);
    expect(trail.filter((t) => t === 'cast')).toHaveLength(1);
    expect(trail.slice(firstCast + 1).filter((t) => t === 'step').length).toBeLessThanOrEqual(1);

    // The runner is done: its timer takes no further turns.
    const turn = engine.turnCount;
    vi.advanceTimersByTime(5000);
    expect(engine.turnCount).toBe(turn);
  });
});
