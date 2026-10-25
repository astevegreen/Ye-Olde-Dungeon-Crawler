import { describe, it, expect } from 'vitest';
import { cotwManifest } from '..';
import { COTW_COMPANIONS } from '../companions';
import { GameEngine } from '../../../engine/engine';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { Player } from '../../../engine/entities/player';
import { Companion } from '../../../engine/entities/companion';
import { EngineCommandBus } from '../../../engine/commands/commandBus';

/** Rally Howl, commanded with the companion at `hp` (null: full health). */
function howl(hp: number | null) {
  const engine = new GameEngine({
    map: new GameMap(20, 20, TILES.FLOOR),
    player: new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 } }),
    manifest: cotwManifest,
  });
  const companion = Companion.fromDefinition(COTW_COMPANIONS[0].id, 'rally-comp', { x: 11, y: 10 })!;
  companion.unlockSkill('rally_howl');
  if (hp !== null) companion.hp = hp;
  engine.attachCompanion(companion);
  const turn = engine.turnCount;
  const bus = new EngineCommandBus(engine);
  const result = bus.dispatch({ type: 'use_companion_skill', payload: { skillId: 'rally_howl' } });
  return { engine, companion, result, turn, again: () => bus.dispatch({ type: 'use_companion_skill', payload: { skillId: 'rally_howl' } }) };
}

describe('Rally Howl', () => {
  // At full health the companion regains nothing, and the line read "(+0 HP to <hound>, ...)".
  it('at full health logs no heal, and still hastens the hero for its turn and cooldown', () => {
    const { engine, companion, result, turn, again } = howl(null);

    expect(result.success).toBe(true);
    expect(result.message).not.toMatch(/\+0 HP|\{healed\}|HP to/);
    expect(result.message).toContain(companion.name);
    expect(result.message).toContain('hastened for 3 turns');
    expect(engine.messages).toContain(result.message);
    expect(engine.player.statusManager.hasStatus('haste')).toBe(true);
    expect(engine.turnCount).toBe(turn + 1);
    expect(again().message).toBe('Rally Howl is ready in 49 turns.');
  });

  it('with the companion hurt logs the HP it actually regained', () => {
    const { engine, companion, result, turn, again } = howl(1);
    const healed = companion.hp - 1;

    expect(healed).toBeGreaterThan(0);
    expect(result).toMatchObject({
      success: true,
      message: `${companion.name} lets out a rallying howl! (+${healed} HP to ${companion.name}, you feel hastened for 3 turns)`,
    });
    expect(engine.player.statusManager.hasStatus('haste')).toBe(true);
    expect(engine.turnCount).toBe(turn + 1);
    expect(again().message).toBe('Rally Howl is ready in 49 turns.');
  });
});
