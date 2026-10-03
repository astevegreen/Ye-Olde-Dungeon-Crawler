import { describe, it, expect } from 'vitest';
import { Monster, ProfileManager, MemoryStorage, type GameEngine } from '../../engine';
import { findActionCues } from '../hints/actionCues';
import { cotwManifest } from '../../content/cotw';

/** A new cotw hero, in the night raid or (without it) in the plain town. */
function hero(prologue: boolean): GameEngine {
  return new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Hild', { manifest: cotwManifest, prologue }).engine;
}

/** Puts every monster on the map out of play but one, `dist` tiles east of the hero. */
function oneMonsterAt(engine: GameEngine, dist: number): Monster {
  const monsters = engine.map.getAllEntities().filter((e): e is Monster => e instanceof Monster);
  const [kept, ...rest] = monsters;
  for (const m of rest) engine.removeEntity(m);
  engine.map.moveEntity(engine.player, 22, 31);
  engine.map.moveEntity(kept, 22, 31 - dist);
  engine.updateFov();
  return kept;
}

describe('action cues (the prologue)', () => {
  it('cues a drink when the hero is badly hurt and a healing potion is pinned', () => {
    const engine = hero(true);
    expect(findActionCues(engine).drinkSlot).toBeNull();
    engine.player.takeDamage(engine.player.hp - 3);
    const slot = findActionCues(engine).drinkSlot;
    expect(slot).not.toBeNull();
  });

  it('cues the ranged spell for a wounded hostile in sight and out of reach, not for one beside the hero', () => {
    const engine = hero(true);
    const wolf = oneMonsterAt(engine, 3);
    expect(findActionCues(engine).castSlot).toBeNull(); // unhurt

    wolf.takeDamage(Math.ceil(wolf.maxHp * 0.6));
    expect(findActionCues(engine).castSlot).toBe(0);

    engine.map.moveEntity(wolf, 22, 30);
    engine.updateFov();
    expect(findActionCues(engine).castSlot).toBeNull(); // adjacent: strike it
  });

  it('gives no cues outside a prologue', () => {
    const engine = hero(false);
    engine.player.takeDamage(engine.player.hp - 3);
    expect(findActionCues(engine)).toEqual({ drinkSlot: null, castSlot: null });
  });
});
