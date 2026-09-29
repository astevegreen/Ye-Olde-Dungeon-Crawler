import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { DeathResolver } from '../../combat/deathResolver';
import { MonsterRegistry } from '../../bestiary/monsterDefinitions';
import type { SpellDefinition } from '../types';

describe('Galdr of the Slain (Thematic Ritual Harvesting)', () => {
  let engine: GameEngine;
  let player: Player;
  let monster: Monster;

  const harvestSpell: SpellDefinition = {
    id: 'jotunbrann',
    name: 'Jotunbrann',
    school: 'Combat',
    manaCost: 15,
    element: 'fire',
    range: 6,
    basePower: 25,
    areaOfEffect: 1,
    reflects: false,
    targetType: 'ray',
    targetingMode: 'ray',
    description: 'A primordial wave of thermal shock.',
  };

  const testManifest = {
    id: 'test_pack',
    name: 'Test Pack',
    version: '1.0.0',
    description: 'Test pack description',
    dungeonFloors: 10,
    spells: [harvestSpell],
    monsters: [],
    items: [],
  };

  beforeEach(() => {
    MonsterRegistry.register({
      id: 'frost_giant_caster',
      name: 'Frost Giant Shaman',
      stats: { hp: 40, maxHp: 40, attack: 8, defense: 2 },
      speed: 100,
      aiType: 'caster',
      fleeHealthPercent: 0,
      xpValue: 50,
      lootTable: [],
      galdrHarvest: {
        rewardSpellId: 'jotunbrann',
        hintVerse: 'The son of frost cannot endure the brand whilst wading in his mother tears.',
        requiredDamageElement: 'fire',
        requiredSurfaceOrTile: 'shallow_water',
      },
    });

    const map = new GameMap(15, 15, TILES.FLOOR);
    player = new Player({
      position: { x: 5, y: 5 },
      mana: 50,
      maxMana: 50,
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 },
    });
    engine = new GameEngine({ map, player, manifest: testManifest as any, seed: 1337 });

    monster = new Monster({
      id: 'm_giant_1',
      definitionId: 'frost_giant_caster',
      name: 'Frost Giant Shaman',
      position: { x: 5, y: 6 },
      stats: { hp: 40, maxHp: 40, attack: 8, defense: 2 },
      speed: 100,
      aiType: 'caster',
      xpValue: 50,
    });
    engine.map.addEntity(monster);
  });

  it('fails harvest if execution condition is not met (wrong element)', () => {
    // Put monster in water surface
    engine.surfaces!.setSurface(monster.x, monster.y, 'shallow_water', 10, 1);

    // Kill with cold damage
    DeathResolver.resolveDeath(engine, player, monster, {
      damageElement: 'cold',
      damageDealt: 45,
    });

    expect(player.spellsKnown).not.toContain('jotunbrann');
    expect(engine.compendium?.isGaldrHarvested('frost_giant_caster')).toBe(false);
  });

  it('fails harvest if execution condition is not met (not in water)', () => {
    // No water on tile
    DeathResolver.resolveDeath(engine, player, monster, {
      damageElement: 'fire',
      damageDealt: 45,
    });

    expect(player.spellsKnown).not.toContain('jotunbrann');
    expect(engine.compendium?.isGaldrHarvested('frost_giant_caster')).toBe(false);
  });

  it('reaps spell when thematic rite is fulfilled (fire on water)', () => {
    // Put monster on shallow_water surface
    engine.surfaces!.setSurface(monster.x, monster.y, 'shallow_water', 10, 1);

    const capture = engine.beginEventCapture();

    DeathResolver.resolveDeath(engine, player, monster, {
      damageElement: 'fire',
      damageDealt: 45,
    });

    // Spell is claimed!
    expect(player.spellsKnown).toContain('jotunbrann');
    expect(engine.compendium?.isGaldrHarvested('frost_giant_caster')).toBe(true);
    expect(capture.some((e) => e.type === 'galdr_harvested')).toBe(true);
  });

  it('awards bonus megin without duplicating spell if already known', () => {
    player.learnSpell('jotunbrann');
    expect(player.spellsKnown).toContain('jotunbrann');

    engine.surfaces!.setSurface(monster.x, monster.y, 'shallow_water', 10, 1);

    DeathResolver.resolveDeath(engine, player, monster, {
      damageElement: 'fire',
      damageDealt: 45,
    });

    // Still only has 1 copy
    expect(player.spellsKnown.filter((s) => s === 'jotunbrann').length).toBe(1);
    // Received 50 kill XP + 25 bonus Megin = 75 total, leveling up from 1 to 2
    expect(player.level).toBe(2);
    expect(player.xp).toBe(25);
  });
});
