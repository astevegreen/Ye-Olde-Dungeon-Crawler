import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { SpellPipeline } from '../spellPipeline';

/**
 * Review 2026-10-06 B5 (R-cmbt-17): a chain spell's hops scaled the roll by Intelligence
 * only, so an Elementalist's lightning bonus (or Galdr-Master's) reached the first target
 * and none of the hops.
 */
function hopDamage(bonus: boolean): number {
  const map = new GameMap(12, 12, TILES.FLOOR);
  const player = new Player({ id: 'hero', position: { x: 1, y: 1 } });
  if (bonus) {
    (player as unknown as { perkModifiers: unknown[] }).perkModifiers.push({
      id: 'perk:test-elementalist',
      name: 'Elementalist',
      alignment: 'positive',
      category: 'blessed',
      elementSpellMultiplier: { element: 'lightning', multiplier: 2 },
    });
  }
  const engine = new GameEngine({ map, player, seed: 4 });
  const mk = (id: string, x: number) =>
    new Monster({ id, name: id, position: { x, y: 5 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 0 }, definitionId: id, aiType: 'melee' });
  const first = mk('first', 5);
  const hop = mk('hop', 6);
  engine.addEntity(first);
  engine.addEntity(hop);

  SpellPipeline.executeChainEffect(
    engine,
    { id: 'test_chain', name: 'Test Chain', element: 'lightning' } as never,
    player,
    [first],
    { type: 'chain', maxHops: 1, hopRange: 3, damageDecay: 0 } as never,
    { type: 'damage', amount: 20, element: 'lightning' } as never
  );
  return 500 - hop.hp;
}

describe('chain-lightning hops', () => {
  it('take the caster’s element bonus, as the first hit does', () => {
    const plain = hopDamage(false);
    expect(plain).toBeGreaterThan(0);
    expect(hopDamage(true)).toBe(plain * 2);
  });
});
