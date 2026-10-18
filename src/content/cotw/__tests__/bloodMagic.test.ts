import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { Player } from '../../../engine/entities/player';
import { Monster } from '../../../engine/entities/monster';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { GameEngine } from '../../../engine/engine';
import { CastSpellAction } from '../../../engine/actions/spell-actions';
import { SpellPipeline } from '../../../engine/magic/spellPipeline';
import { SpellRegistry } from '../../../engine/magic/spellRegistry';
import { activateRegistries } from '../../../engine/registries';
import { COTW_BLOOD_SPELLS } from '../bloodMagic';
import { COTW_FRITH_SPELLS, DISIR_SPIRIT_ID } from '../frithMagic';
import { SUMMONED_MONSTERS } from '../monsters/summons';

/** The Siphon Altar's four spells: blood costs the hero's HP, frith costs Seiðr. */
describe('the altar spells: blood and frith', () => {
  let engine: GameEngine;
  let player: Player;
  let enemy: Monster;

  afterAll(() => {
    activateRegistries(null);
    SpellRegistry.clear();
  });

  beforeEach(() => {
    SpellPipeline.ensureBuiltinEffects();
    for (const spell of [...COTW_BLOOD_SPELLS, ...COTW_FRITH_SPELLS]) SpellRegistry.register(spell);

    const map = new GameMap(15, 15, TILES.FLOOR);
    player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
      mana: 30,
      maxMana: 30,
    });
    player.spellsKnown = ['blood_reap', 'draugr_call', 'grith', 'disir'];
    enemy = new Monster({
      id: 'foe',
      name: 'Raider',
      position: { x: 6, y: 5 },
      stats: { hp: 100, maxHp: 100, attack: 0, defense: 0 },
    });
    map.addEntity(player);
    map.addEntity(enemy);
    engine = new GameEngine({ map, player });
    for (const m of SUMMONED_MONSTERS) engine.registries.monsters.register(m);
  });

  const cast = (spellId: string, x = 6, y = 5) => new CastSpellAction(player, spellId, x, y).perform(engine);

  describe('Blood Reap', () => {
    it('refuses a healthy foe and costs nothing', () => {
      const result = cast('blood_reap');
      expect(result.success).toBe(false);
      expect(result.message).toContain('too healthy to reap');
      expect(player.hp).toBe(50);
    });

    it('finishes a badly wounded foe for 4 HP and drinks 10 of its life', () => {
      player.hp = 30;
      enemy.hp = 20;
      const result = cast('blood_reap');
      expect(result.success).toBe(true);
      expect(enemy.isAlive()).toBe(false);
      expect(player.hp).toBe(30 - 4 + 10);
      expect(player.mana).toBe(30);
    });

    it('is refused when it would spend the last of the hero\'s life', () => {
      player.hp = 4;
      enemy.hp = 20;
      const result = cast('blood_reap');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Not enough life');
      expect(enemy.hp).toBe(20);
    });

    // Its ray struck the healthy foe in front while the check judged the wounded one aimed at.
    it('judges the foe its ray strikes: a healthy one in the way refuses the cast, at no cost', () => {
      const wounded = new Monster({ id: 'wounded', name: 'Wounded Raider', position: { x: 7, y: 5 }, stats: { hp: 100, maxHp: 100, attack: 0, defense: 0 } });
      wounded.hp = 20;
      engine.map.addEntity(wounded);

      const result = cast('blood_reap', 7, 5);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Raider is too healthy to reap');
      expect(enemy.hp).toBe(100);
      expect(wounded.hp).toBe(20);
      expect(player.hp).toBe(50);
    });
  });

  describe('Draugr-call', () => {
    it('lays a 10-turn death-curse that raises the foe for 20 turns, paid in 6 HP', () => {
      const result = cast('draugr_call');
      expect(result.success).toBe(true);
      expect(player.hp).toBe(44);
      const curse = enemy.statusManager.getStatus('rises_when_slain');
      expect(curse?.duration).toBe(10);
      expect(curse?.potency).toBe(20);
    });
  });

  describe('Grið', () => {
    it('pacifies a foe for 8 turns, paid in 10 Seiðr', () => {
      const result = cast('grith');
      expect(result.success).toBe(true);
      expect(player.mana).toBe(20);
      expect(player.hp).toBe(50);
      expect(enemy.statusManager.getStatus('pacified')?.duration).toBe(8);
    });

    it('does not take on a foe that resists it', () => {
      enemy.statusImmunities = ['pacified'];
      cast('grith');
      expect(enemy.statusManager.hasStatus('pacified')).toBe(false);
    });
  });

  describe('the Dísir', () => {
    it('calls two spirits to the hero\'s side for 15 turns, paid in 14 Seiðr', () => {
      const result = cast('disir', 5, 5);
      expect(result.success).toBe(true);
      expect(player.mana).toBe(16);
      const spirits = engine.map.getAllEntities().filter((e) => e instanceof Monster && e.definitionId === DISIR_SPIRIT_ID) as Monster[];
      expect(spirits).toHaveLength(2);
      for (const spirit of spirits) {
        expect(spirit.faction).toBe('player');
        expect(spirit.statusManager.getStatus('summoned')?.duration).toBe(15);
        expect(spirit.lootTable).toEqual([]);
      }
    });
  });

  it('blood lends Blood-price and frith lends healing to their neighbours', () => {
    for (const spell of COTW_BLOOD_SPELLS) expect(spell.lends).toEqual(['blood-price']);
    for (const spell of COTW_FRITH_SPELLS) expect(spell.lends).toEqual(['healing']);
  });
});
