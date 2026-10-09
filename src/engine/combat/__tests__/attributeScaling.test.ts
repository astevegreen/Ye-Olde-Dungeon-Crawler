import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { MeleeAttackAction } from '../../actions/combat';
import { CastSpellAction } from '../../actions/spell-actions';
import type { GameContentManifest, ProgressionConfig } from '../../types/manifest';
import type { AttributeScalingConfig } from '../../types/config';
import type { SpellDefinition } from '../../magic/types';
import { dexterityEvasion, meleeHitPercent, spellPowerMultiplier, strengthMeleeBonus } from '../attributeScaling';

/**
 * Q5 "C, and partial heal scaling off Constitution", Q26 "1 point", Q28 "approved" (tracker 3.2):
 * attributes drive combat through `CombatConfig.attributeScaling`, and a level gives one
 * point, no flat Attack or Defense, and a heal that grows with Constitution
 * (`ProgressionConfig.levelUpHeal`). Without either config nothing changes.
 */
const SCALING: AttributeScalingConfig = {
  baseline: 10,
  meleeDamagePerStrength: 1,
  meleeBaseHitPercent: 80,
  meleeHitPercentPerDexterity: 2,
  evasionPerDexterity: 0.01,
  spellPowerPerIntelligence: 0.03,
};

const BOLT: SpellDefinition = {
  id: 'bolt',
  name: 'Bolt',
  school: 'Combat',
  basePower: 20,
  manaCost: 1,
  element: 'fire',
  range: 6,
  areaOfEffect: 0,
  reflects: false,
  targetType: 'tile',
  description: 'A test bolt.',
  effects: [{ type: 'damage', amount: 20, element: 'fire' }],
};

function build(opts: { scaling?: AttributeScalingConfig; progression?: ProgressionConfig; attributes?: Partial<Record<'strength' | 'dexterity' | 'intelligence' | 'constitution', number>> } = {}) {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 5, y: 5 },
    stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 },
    strength: opts.attributes?.strength ?? 10,
    dexterity: opts.attributes?.dexterity ?? 10,
    intelligence: opts.attributes?.intelligence ?? 10,
    constitution: opts.attributes?.constitution ?? 10,
    mana: 50,
    maxMana: 50,
    spellsKnown: ['bolt'],
  });
  const foe = new Monster({
    id: 'foe',
    name: 'Foe',
    position: { x: 6, y: 5 },
    stats: { hp: 1000, maxHp: 1000, attack: 10, defense: 0 },
    speed: 100,
    definitionId: 'foe',
    aiType: 'melee',
    xpValue: 1,
  });
  map.addEntity(player);
  map.addEntity(foe);
  const manifest: Partial<GameContentManifest> = {
    id: 'test',
    name: 'Test',
    spells: [BOLT],
    combatConfig: opts.scaling ? { attributeScaling: opts.scaling } : undefined,
    progressionConfig: opts.progression,
  };
  const engine = new GameEngine({ map, player, manifest: manifest as GameContentManifest });
  player.gainEnergy(100);
  return { engine, player, foe };
}

describe('attribute scaling helpers', () => {
  it('read each attribute against the baseline, and give nothing to an actor without the attribute', () => {
    const strong = new Player({ id: 'p', name: 'P', position: { x: 0, y: 0 }, strength: 15, dexterity: 18, intelligence: 20 });
    expect(strengthMeleeBonus(strong, SCALING)).toBe(5);
    expect(meleeHitPercent(strong, SCALING)).toBe(96);
    expect(dexterityEvasion(strong, SCALING)).toBeCloseTo(0.08);
    expect(spellPowerMultiplier(strong, SCALING)).toBeCloseTo(1.3);

    const weak = new Player({ id: 'w', name: 'W', position: { x: 0, y: 0 }, strength: 8, dexterity: 8, intelligence: 8 });
    expect(strengthMeleeBonus(weak, SCALING)).toBe(-2);
    expect(meleeHitPercent(weak, SCALING)).toBe(76);
    expect(dexterityEvasion(weak, SCALING)).toBe(0); // never negative: a low Dexterity costs hits, not evasion
    expect(spellPowerMultiplier(weak, SCALING)).toBeCloseTo(0.94);

    const beast = new Monster({ id: 'm', name: 'M', position: { x: 0, y: 0 }, stats: { hp: 1, maxHp: 1, attack: 1, defense: 0 } });
    expect(strengthMeleeBonus(beast, SCALING)).toBe(0);
    expect(meleeHitPercent(beast, SCALING)).toBe(80);
    expect(dexterityEvasion(beast, SCALING)).toBe(0);
    expect(spellPowerMultiplier(beast, SCALING)).toBe(1);
  });

  it('are inert without a config: every melee blow lands and nothing scales', () => {
    const hero = new Player({ id: 'p', name: 'P', position: { x: 0, y: 0 }, strength: 18, dexterity: 18, intelligence: 18 });
    expect(strengthMeleeBonus(hero, {})).toBe(0);
    expect(meleeHitPercent(hero, {})).toBe(100);
    expect(dexterityEvasion(hero, {})).toBe(0);
    expect(spellPowerMultiplier(hero, {})).toBe(1);
  });
});

describe('melee under attribute scaling', () => {
  it('Strength adds flat damage: attack 10, STR 15 against defense 0 deals 15', () => {
    const { engine, player, foe } = build({ scaling: SCALING, attributes: { strength: 15, dexterity: 20 } });
    new MeleeAttackAction(player, foe).perform(engine);
    expect(1000 - foe.hp).toBe(15);
  });

  it('Dexterity sets the hit chance: a roll past it misses, costs the turn, and a Twinstrike miss still bleeds', () => {
    const { engine, player, foe } = build({ scaling: SCALING, attributes: { dexterity: 10 } }); // 80%
    engine.rng = () => 0.85;
    const miss = new MeleeAttackAction(player, foe).perform(engine);
    expect(miss.success).toBe(true);
    expect(miss.cost).toBeGreaterThan(0);
    expect(foe.hp).toBe(1000);
    expect(engine.messages.at(-1)).toBe('Hero misses Foe.');
    // Presentation draws the whiff from the event, attacker to target.
    expect(engine.recentGameEvents.at(-1)).toMatchObject({ type: 'attack_missed', actorId: player.id, targetId: foe.id });

    engine.rng = () => 0.79;
    player.gainEnergy(100);
    new MeleeAttackAction(player, foe).perform(engine);
    expect(foe.hp).toBe(990);
  });

  it('the defender’s Dexterity gives evasion on top of what it wears', () => {
    const { engine, player, foe } = build({ scaling: SCALING, attributes: { dexterity: 20 } }); // 10% evasion, 100% hit
    foe.gainEnergy(100);
    engine.rng = () => 0.05; // the monster's hit roll passes (80%), the evasion roll (10%) fires
    new MeleeAttackAction(foe, player).perform(engine);
    expect(player.hp).toBe(100);
    expect(engine.messages.at(-1)).toBe('Hero evades Foe\'s attack!');
    expect(engine.recentGameEvents.at(-1)).toMatchObject({ type: 'attack_missed', actorId: foe.id, targetId: player.id });
  });

  it('without a config a melee blow never misses, as before', () => {
    const { engine, player, foe } = build({ attributes: { strength: 8, dexterity: 8 } });
    engine.rng = () => 0.999;
    new MeleeAttackAction(player, foe).perform(engine);
    expect(1000 - foe.hp).toBe(10);
  });
});

describe('spells under attribute scaling', () => {
  it('Intelligence multiplies damage: 20 at INT 20 becomes 26', () => {
    const { engine, player, foe } = build({ scaling: SCALING, attributes: { intelligence: 20 } });
    new CastSpellAction(player, 'bolt', foe.x, foe.y).perform(engine);
    expect(1000 - foe.hp).toBe(26);
  });

  it('and leaves it alone without a config', () => {
    const { engine, player, foe } = build({ attributes: { intelligence: 20 } });
    new CastSpellAction(player, 'bolt', foe.x, foe.y).perform(engine);
    expect(1000 - foe.hp).toBe(20);
  });
});

describe('a level under the pack’s progression', () => {
  const PROGRESSION: ProgressionConfig = {
    statPointsPerLevel: 1,
    statGains: { maxHp: 5, maxMana: 4, baseAttack: 0, baseDefense: 0 },
    levelUpHeal: { percent: 0.3, perConstitutionAbove: 0.03, cap: 0.9 },
  };

  it('gives one point, no Attack or Defense, and heals 30% + 3% a Constitution point above 10', () => {
    const { player } = build({ progression: PROGRESSION, attributes: { constitution: 15 } });
    player.hp = 10;
    player.mana = 0;
    const attack = player.baseAttackValue;
    const defense = player.baseDefenseValue;

    const res = player.gainXp(player.xpToNextLevel, PROGRESSION);

    expect(res.leveledUp).toBe(true);
    expect(res.statPointsAwarded).toBe(1);
    expect(player.baseAttackValue).toBe(attack);
    expect(player.baseDefenseValue).toBe(defense);
    expect(player.maxHp).toBe(105);
    // 45% of 105 = 47.25 → 47
    expect(player.hp).toBe(10 + 47);
    expect(res.healed).toBe(47);
    expect(player.mana).toBe(Math.round(player.maxMana * 0.45));
  });

  it('caps the heal at 90% and never past max', () => {
    const { player } = build({ progression: PROGRESSION, attributes: { constitution: 40 } }); // 30% + 90% → 90%
    player.hp = 50;
    player.gainXp(player.xpToNextLevel, PROGRESSION);
    expect(player.hp).toBe(player.maxHp);
  });

  it('without the config a level still heals in full and gives three points, as before', () => {
    const { player } = build({ attributes: { constitution: 8 } });
    player.hp = 1;
    const res = player.gainXp(player.xpToNextLevel);
    expect(res.statPointsAwarded).toBe(3);
    expect(player.hp).toBe(player.maxHp);
    expect(player.baseAttackValue).toBe(11);
  });
});
