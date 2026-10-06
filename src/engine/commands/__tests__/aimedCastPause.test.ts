import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { cotwManifest } from '../../../content/cotw';

/**
 * GitHub #10: "Monsters do not take action when player casts spells. I cast magic arrow three
 * times and the monsters did not react." The aiming reticle sits on the modal stack, which
 * pauses the engine, and it fires the cast through the command bus. Since 8af8fad the bus
 * lifts the pause for the action it runs, so each aimed cast pays its monster turn as a
 * cast with no reticle open does, and the world is paused again behind the reticle after.
 */

function castThreeArrows(paused: boolean): { orcAttacks: number; pausedAfter: boolean } {
  const map = new GameMap(16, 10, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Sven',
    position: { x: 3, y: 4 },
    stats: { hp: 200, maxHp: 200, attack: 10, defense: 0 },
    spellsKnown: ['magic_arrow'],
    mana: 50,
    maxMana: 50,
  } as never);
  const engine = new GameEngine({ map, player, manifest: cotwManifest, seed: 10 });
  engine.addEntity(
    new Monster({
      id: 'orc',
      name: 'Orc Warrior',
      position: { x: 4, y: 4 },
      stats: { hp: 500, maxHp: 500, attack: 4, defense: 0 },
      speed: 100,
      definitionId: 'orc',
      aiType: 'melee',
      aiState: 'hunting',
      xpValue: 1,
    } as never)
  );
  if (paused) engine.setPaused(true);
  const before = engine.messages.length;

  for (let i = 0; i < 3; i++) {
    engine.commandBus.dispatch({ type: 'cast_spell', payload: { spellId: 'magic_arrow', targetX: 4, targetY: 4 } });
  }

  const orcAttacks = engine.messages.slice(before).filter((m) => m.startsWith('Orc Warrior attacks')).length;
  return { orcAttacks, pausedAfter: engine.isPaused };
}

describe('an aimed cast while the reticle pauses the world (GitHub #10)', () => {
  it('lets the monsters answer each cast, as a cast with no reticle open does', () => {
    const open = castThreeArrows(false);
    const aimed = castThreeArrows(true);

    expect(open.orcAttacks).toBeGreaterThanOrEqual(2);
    expect(aimed.orcAttacks).toBe(open.orcAttacks);
  });

  it('leaves the world paused behind the reticle afterwards', () => {
    expect(castThreeArrows(true).pausedAfter).toBe(true);
  });
});
