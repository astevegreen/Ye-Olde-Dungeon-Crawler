import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { CastSpellAction } from '../../actions/spell-actions';
import { useTestSpells } from '../../__fixtures__/testHelpers';

// With nothing in sight the aim cursor starts on the hero, and Enter fired Magic Arrow at
// her own tile: 2 Seiðr and a turn spent, "impacting a wall at (22, 28)" (playtest, 18 Oct).
describe('a ray aimed at the caster’s own tile', () => {
  useTestSpells([
    { id: 'magic_arrow', name: 'Magic Arrow', school: 'Combat', manaCost: 3, element: 'arcane', range: 6, basePower: 8, areaOfEffect: 0, reflects: false, targetType: 'ray', targetingMode: 'ray', description: '', effects: [{ type: 'damage', amount: 8, element: 'arcane' }] },
  ]);

  function setup() {
    const map = new GameMap(20, 20, TILES.FLOOR);
    const player = new Player({ id: 'p1', name: 'Sven', position: { x: 2, y: 2 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 } });
    player.mana = 50;
    player.maxMana = 50;
    return { engine: new GameEngine({ map, player }), player };
  }

  it('is refused, costing neither Seiðr nor the turn', () => {
    const { engine, player } = setup();
    const turn = engine.turnCount;
    const result = engine.handlePlayerAction(new CastSpellAction(player, 'magic_arrow', 2, 2));
    expect(result.success).toBe(false);
    expect(result.cost).toBe(0);
    expect(result.message).toContain('needs a direction');
    expect(player.mana).toBe(50);
    expect(engine.turnCount).toBe(turn);
  });

  it('still flies when aimed anywhere else', () => {
    const { engine, player } = setup();
    const result = engine.handlePlayerAction(new CastSpellAction(player, 'magic_arrow', 2, 6));
    expect(result.cost).toBeGreaterThan(0);
    expect(player.mana).toBeLessThan(50);
  });
});
