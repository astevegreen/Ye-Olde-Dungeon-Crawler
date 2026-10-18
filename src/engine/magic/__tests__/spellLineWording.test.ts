import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { CastSpellAction } from '../../actions/spell-actions';
import { useTestSpells } from '../../__fixtures__/testHelpers';

// The log read like debug output: "impacting a wall at (22, 27)", "fades at (27, 21)",
// "catching 0 target(s)!" (playtest, 18 Oct). No map coordinates, and counts in words.
describe('the lines a cast logs', () => {
  useTestSpells([
    { id: 'magic_arrow', name: 'Magic Arrow', school: 'Combat', manaCost: 3, element: 'arcane', range: 6, basePower: 8, areaOfEffect: 0, reflects: false, targetType: 'ray', targetingMode: 'ray', description: '', effects: [{ type: 'damage', amount: 8, element: 'arcane' }] },
    { id: 'veil', name: 'Veil', school: 'Enchantment', manaCost: 3, element: 'arcane', range: 6, basePower: 0, areaOfEffect: 1, reflects: false, targetType: 'tile', targetingMode: 'area_burst', description: '', effects: [] },
    { id: 'glyph', name: 'Glyph', school: 'Enchantment', manaCost: 3, element: 'arcane', range: 6, basePower: 0, areaOfEffect: 0, reflects: false, targetType: 'tile', targetingMode: 'tile', description: '', effects: [] },
  ]);

  function castAt(map: GameMap, spellId: string, x: number, y: number): string[] {
    const player = new Player({ id: 'p1', name: 'Sven', position: { x: 2, y: 2 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 } });
    player.mana = 50;
    player.maxMana = 50;
    const engine = new GameEngine({ map, player });
    const before = engine.messages.length;
    engine.handlePlayerAction(new CastSpellAction(player, spellId, x, y));
    return engine.messages.slice(before);
  }

  const noCoordinates = (lines: string[]) => expect(lines.join('\n')).not.toMatch(/\(\d+, \d+\)/);

  it('a ray that meets a wall', () => {
    const map = new GameMap(20, 20, TILES.FLOOR);
    map.setTile(5, 2, TILES.WALL);
    const lines = castAt(map, 'magic_arrow', 8, 2);
    expect(lines).toContain('Sven casts Magic Arrow, impacting a wall.');
    noCoordinates(lines);
  });

  it('a ray that flies its full range', () => {
    const lines = castAt(new GameMap(20, 20, TILES.FLOOR), 'magic_arrow', 2, 10);
    expect(lines).toContain('Sven casts Magic Arrow, but it strikes nothing and fades.');
  });

  it('a blast that catches no one', () => {
    const lines = castAt(new GameMap(20, 20, TILES.FLOOR), 'veil', 5, 5);
    expect(lines.join('\n')).toContain('catching no one.');
    expect(lines.join('\n')).not.toContain('target(s)');
    noCoordinates(lines);
  });

  it('a tile spell on an empty tile', () => {
    const lines = castAt(new GameMap(20, 20, TILES.FLOOR), 'glyph', 4, 4);
    expect(lines).toContain('Sven casts Glyph.');
  });
});
