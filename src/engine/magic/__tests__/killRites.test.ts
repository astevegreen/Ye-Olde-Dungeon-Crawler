import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { DeathResolver } from '../../combat/deathResolver';
import { MonsterRegistry } from '../../bestiary/monsterDefinitions';
import type { SpellDefinition } from '../types';
import type { KillRiteDefinition } from '../killRites';

describe('Kill rites', () => {
  let engine: GameEngine;
  let player: Player;

  const riteSpell: SpellDefinition = {
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

  const baseManifest = {
    id: 'test_pack',
    name: 'Test Pack',
    version: '1.0.0',
    description: 'Test pack description',
    dungeonFloors: 10,
    spells: [riteSpell],
    monsters: [],
    items: [
      { id: 'essence_fire', name: 'Fire Essence', category: 'quest', weight: 1, bulk: 1, identified: true },
    ],
    magic: {
      killRites: {
        title: 'Rites',
        prophecyLabel: 'Hint',
        reapedLabel: 'Done',
        learnMessage: 'You learn {spell} from {monster}.',
        essenceMessage: '{monster} leaves a {essence}.',
        essenceItems: { fire: 'essence_fire' },
      },
    },
  };

  const register = (id: string, rite: Partial<KillRiteDefinition>) =>
    MonsterRegistry.register({
      id,
      name: id,
      stats: { hp: 40, maxHp: 40, attack: 1, defense: 0 },
      speed: 100,
      aiType: 'melee',
      fleeHealthPercent: 0,
      xpValue: 0,
      lootTable: [],
      killRite: { hintVerse: '', essenceElement: 'fire', teachesSpellId: 'jotunbrann', ...rite },
    });

  const spawn = (definitionId: string) => {
    const m = new Monster({
      id: `m_${definitionId}`,
      definitionId,
      name: definitionId,
      position: { x: 5, y: 6 },
      stats: { hp: 40, maxHp: 40, attack: 1, defense: 0 },
      speed: 100,
      aiType: 'melee',
      xpValue: 0,
    });
    engine.map.addEntity(m);
    return m;
  };

  const essencesAt = (x: number, y: number) =>
    engine.map.getItemsAt(x, y).filter((i) => i.definitionId === 'essence_fire');

  beforeEach(() => {
    player = new Player({
      position: { x: 5, y: 5 },
      mana: 50,
      maxMana: 50,
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 },
      spellsKnown: [],
    });
    engine = new GameEngine({ map: new GameMap(15, 15, TILES.FLOOR), player, manifest: baseManifest as any, seed: 1337 });
  });

  it('teaches its spell the first time the rite is met', () => {
    register('fire_rite', { requiredDamageElement: 'fire' });
    const capture = engine.beginEventCapture();

    DeathResolver.resolveDeath(engine, player, spawn('fire_rite'), { damageElement: 'fire' });

    expect(player.spellsKnown).toContain('jotunbrann');
    expect(engine.compendium.isKillRitePerformed('fire_rite')).toBe(true);
    expect(capture.some((e) => e.type === 'kill_rite_performed')).toBe(true);
  });

  it('does nothing when the killing blow has the wrong element', () => {
    register('fire_rite', { requiredDamageElement: 'fire' });
    const m = spawn('fire_rite');
    DeathResolver.resolveDeath(engine, player, m, { damageElement: 'cold' });
    expect(player.spellsKnown).not.toContain('jotunbrann');
    expect(engine.compendium.isKillRitePerformed('fire_rite')).toBe(false);
    expect(essencesAt(m.x, m.y)).toHaveLength(0);
  });

  it('drops an essence instead once the spell is known', () => {
    register('fire_rite', { requiredDamageElement: 'fire' });
    player.learnSpell('jotunbrann');
    const m = spawn('fire_rite');

    DeathResolver.resolveDeath(engine, player, m, { damageElement: 'fire' });

    expect(essencesAt(m.x, m.y)).toHaveLength(1);
  });

  it('counts a melee kill as a physical blow', () => {
    register('iron_rite', { requiredDamageElement: 'physical' });
    const m = spawn('iron_rite');
    DeathResolver.resolveDeath(engine, player, m, { damageElement: 'physical' });
    expect(player.spellsKnown).toContain('jotunbrann');
  });

  it('requires the victim to carry the named status', () => {
    register('slow_rite', { requiredVictimStatus: 'slow' });
    const fast = spawn('slow_rite');
    DeathResolver.resolveDeath(engine, player, fast, { damageElement: 'fire' });
    expect(player.spellsKnown).not.toContain('jotunbrann');

    const slowed = spawn('slow_rite');
    slowed.statusManager.applyStatus({ type: 'slow', duration: 5 }, slowed.statusImmunities, slowed, engine);
    DeathResolver.resolveDeath(engine, player, slowed, { damageElement: 'fire' });
    expect(player.spellsKnown).toContain('jotunbrann');
  });

  it('requires the player to carry debt for a debt rite', () => {
    register('debt_rite', { requiresCasterDebt: true });
    DeathResolver.resolveDeath(engine, player, spawn('debt_rite'), { damageElement: 'fire' });
    expect(player.spellsKnown).not.toContain('jotunbrann');

    player.voidDebt = 3;
    DeathResolver.resolveDeath(engine, player, spawn('debt_rite'), { damageElement: 'fire' });
    expect(player.spellsKnown).toContain('jotunbrann');
  });

  it("requires the player's HP at or below the rite's share", () => {
    register('desperate_rite', { maxCasterHpPercent: 50 });
    DeathResolver.resolveDeath(engine, player, spawn('desperate_rite'), { damageElement: 'fire' });
    expect(player.spellsKnown).not.toContain('jotunbrann');

    player.hp = 25;
    DeathResolver.resolveDeath(engine, player, spawn('desperate_rite'), { damageElement: 'fire' });
    expect(player.spellsKnown).toContain('jotunbrann');
  });

  describe('overkill', () => {
    it('reaps when the blow exceeds remaining HP by the required share of max HP', () => {
      register('overkill_rite', { requiresOverkillPercent: 50 });
      // 40 max HP -> 20 overkill needed; 40 into 10 remaining is 30 over
      DeathResolver.resolveDeath(engine, player, spawn('overkill_rite'), {
        damageElement: 'arcane',
        damageDealt: 40,
        remainingHpBeforeBlow: 10,
      });
      expect(player.spellsKnown).toContain('jotunbrann');
    });

    it('does not reap on too small an overkill', () => {
      register('overkill_rite', { requiresOverkillPercent: 50 });
      DeathResolver.resolveDeath(engine, player, spawn('overkill_rite'), {
        damageElement: 'arcane',
        damageDealt: 25,
        remainingHpBeforeBlow: 10,
      });
      expect(player.spellsKnown).not.toContain('jotunbrann');
    });

    it('does not reap from a kill that reports no blow', () => {
      register('overkill_rite', { requiresOverkillPercent: 50 });
      DeathResolver.resolveDeath(engine, player, spawn('overkill_rite'));
      expect(player.spellsKnown).not.toContain('jotunbrann');
    });
  });

  it('ignores kills by monsters and packs without a kill-rite config', () => {
    register('fire_rite', { requiredDamageElement: 'fire' });
    const other = spawn('fire_rite');
    DeathResolver.resolveDeath(engine, spawn('fire_rite'), other, { damageElement: 'fire' });
    expect(player.spellsKnown).not.toContain('jotunbrann');

    const bare = new GameEngine({
      map: new GameMap(15, 15, TILES.FLOOR),
      player,
      manifest: { ...baseManifest, magic: undefined } as any,
      seed: 1,
    });
    const m = new Monster({
      id: 'bare_m',
      definitionId: 'fire_rite',
      name: 'fire_rite',
      position: { x: 5, y: 6 },
      stats: { hp: 40, maxHp: 40, attack: 1, defense: 0 },
      speed: 100,
      aiType: 'melee',
      xpValue: 0,
    });
    bare.map.addEntity(m);
    DeathResolver.resolveDeath(bare, player, m, { damageElement: 'fire' });
    expect(player.spellsKnown).not.toContain('jotunbrann');
  });
});
