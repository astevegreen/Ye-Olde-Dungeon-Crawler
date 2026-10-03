import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { CastSpellAction } from '../../actions/spell-actions';
import { registerSpells, SPELL_REGISTRY } from '../spellRegistry';

describe('ray spell impact message', () => {
  beforeEach(() => {
    registerSpells([
      { id: 'magic_arrow', name: 'Magic Arrow', school: 'Combat', manaCost: 3, element: 'arcane', range: 6, basePower: 8, areaOfEffect: 0, reflects: false, targetType: 'ray', targetingMode: 'ray', description: '', effects: [{ type: 'damage', amount: 8, element: 'arcane' }] },
    ]);
  });
  afterEach(() => {
    for (const key of Object.keys(SPELL_REGISTRY)) delete SPELL_REGISTRY[key];
  });

  function castAt(map: GameMap, x: number, y: number): string {
    const player = new Player({ id: 'p1', name: 'Sven', position: { x: 2, y: 2 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 } });
    player.mana = 50;
    player.maxMana = 50;
    const engine = new GameEngine({ map, player });
    return engine.handlePlayerAction(new CastSpellAction(player, 'magic_arrow', x, y)).message ?? '';
  }

  it('says a wall was struck only when the ray met one', () => {
    const map = new GameMap(20, 20, TILES.FLOOR);
    map.setTile(5, 2, TILES.WALL);
    expect(castAt(map, 8, 2)).toContain('impacting a wall');
  });

  it('does not call an empty full-range flight a wall', () => {
    const map = new GameMap(20, 20, TILES.FLOOR);
    const message = castAt(map, 2, 10);
    expect(message).not.toContain('wall');
    expect(message).toContain('strikes nothing');
  });
});
