import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { MeleeAttackAction, WindUpDeclareAction, WindUpExecuteAction } from '../actions/combat';
import { selectMasteryPerk } from '../compendium/compendiumManager';
import { HookDispatcher } from '../hooks/hookDispatcher';
import { CastSpellAction } from '../actions/spell-actions';
import { SearchAction } from '../actions/search';
import { AutoRestManager } from '../actions/autoRest';
import { Companion } from '../entities/companion';
import { MonsterAI } from '../ai/behaviorTree';
import { sensesThroughWalls } from '../fov/sensing';
import { withSpellRangeBonus } from '../magic/grimoireMatrix';
import { TrapInstance } from '../dungeon/traps';
import { SpellPipeline } from '../magic/spellPipeline';
import { MovementAction } from '../actions/movement';
import { applyImpulse } from '../combat/impulse';
import { DeathResolver } from '../combat/deathResolver';
import { RangedAttackAction } from '../actions/rangedAttack';
import { ExecuteChoiceAction } from '../actions/choiceAction';
import { identifyCarriedSinceStairs } from '../actions/stairs';
import { Item } from '../items/item';
import type { PerkDefinition } from '../types/manifest';
import type { GameContentManifest } from '../types/manifest';
import type { SpellDefinition } from '../magic/types';

/** The seven effects the Saga tiers 10 and 20 added to the item-modifier vocabulary (tracker 3.6). */
const BOLT: SpellDefinition = {
  id: 'bolt',
  name: 'Bolt',
  school: 'Combat',
  basePower: 20,
  manaCost: 10,
  element: 'fire',
  range: 6,
  areaOfEffect: 0,
  reflects: false,
  targetType: 'tile',
  description: 'A test bolt.',
  effects: [{ type: 'damage', amount: 20, element: 'fire' }],
};

function perk(id: string, effects: PerkDefinition['effects']): PerkDefinition {
  return { id, name: id, description: id, source: 'saga', effects };
}

function build(extra: Partial<GameContentManifest> = {}) {
  const map = new GameMap(30, 30, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 }, stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 }, mana: 50, maxMana: 50, spellsKnown: ['bolt'] });
  const foe = new Monster({ id: 'foe', name: 'Foe', position: { x: 11, y: 10 }, stats: { hp: 1000, maxHp: 1000, attack: 20, defense: 0 }, speed: 100, definitionId: 'foe', aiType: 'melee', xpValue: 1 });
  map.addEntity(player);
  map.addEntity(foe);
  const manifest = { id: 'test', name: 'Test', monsters: [], items: [], spells: [BOLT], ...extra } as unknown as GameContentManifest;
  const engine = new GameEngine({ map, player, manifest });
  player.gainEnergy(100);
  foe.gainEnergy(100);
  return { engine, player, foe, map };
}

describe('perk effects', () => {
  it('belowHalfHpMeleeMultiplier replaces the melee multiplier at or below half health', () => {
    const { engine, player, foe } = build();
    player.grantPerk(perk('berserk', { meleeDamageMultiplier: 1.2, belowHalfHpMeleeMultiplier: 1.4 }));
    new MeleeAttackAction(player, foe).perform(engine);
    expect(1000 - foe.hp).toBe(12);
    player.hp = 50;
    player.gainEnergy(100);
    new MeleeAttackAction(player, foe).perform(engine);
    expect(1000 - foe.hp).toBe(12 + 14);
  });

  it('manaCostMultiplier takes its share off before a flat discount', () => {
    const { engine, player, foe } = build();
    player.grantPerk(perk('woven', { manaCostMultiplier: 0.8 }));
    new CastSpellAction(player, 'bolt', foe.x, foe.y).perform(engine);
    expect(50 - player.mana).toBe(8);
  });

  it('perceptionRadiusMultiplier doubles how far a search and a step reach', () => {
    const { engine, player, map } = build();
    map.setTile(14, 10, { ...TILES.DOOR_CLOSED, hidden: true });
    // Radius 2 misses a door four tiles away; the Wayfarer's 4 reaches it.
    engine.rng = () => 0.99;
    new SearchAction(player, () => 0.99).perform(engine);
    expect(map.getTile(14, 10)?.hidden).toBe(true);
    player.grantPerk(perk('wayfarer', { perceptionRadiusMultiplier: 2 }));
    player.gainEnergy(100);
    new SearchAction(player, () => 0.99).perform(engine);
    expect(map.getTile(14, 10)?.hidden).toBe(false);

    // A step's passive perception reaches two tiles instead of one.
    map.setTile(10, 13, { ...TILES.DOOR_CLOSED, hidden: true });
    player.intelligence = 18;
    player.dexterity = 18;
    player.gainEnergy(100);
    new MovementAction(player, 0, 1).perform(engine); // to (10, 11): the door at (10, 13) is two away
    expect(map.getTile(10, 13)?.hidden).toBe(false);
  });

  it('meleeDamageTakenMultiplier scales a melee blow after mitigation, and impulseImmune holds the ground', () => {
    const { engine, player, foe } = build();
    player.grantPerk(perk('wall', { meleeDamageTakenMultiplier: 0.85, impulseImmune: true }));
    new MeleeAttackAction(foe, player).perform(engine);
    expect(100 - player.hp).toBe(17);
    const result = applyImpulse(engine, foe, player, -1, 0, 3);
    expect(result.pushed).toBe(false);
    expect(player.x).toBe(10);
  });

  it('killHealPercent and killManaPercent pay the killer on a kill', () => {
    const { engine, player, foe } = build();
    player.grantPerk(perk('drinker', { killHealPercent: 0.1, killManaPercent: 0.1 }));
    player.hp = 50;
    player.mana = 20;
    DeathResolver.resolveDeath(engine, player, foe);
    expect(player.hp).toBe(60);
    expect(player.mana).toBe(25);
  });

  it('overflowDebtDecayMultiplier clears debt faster on a rest turn, the R key’s auto-rest included', () => {
    const { engine, player, foe } = build();
    engine.removeEntity(foe);
    player.grantPerk(perk('thief', { overflowDebtDecayMultiplier: 2 }));
    player.hp = 50;
    player.accrueVoidDebt(6);
    AutoRestManager.stepRestTurn(engine, player.hp, player.mana, 0, 100);
    expect(player.voidDebt).toBe(4);
  });

  it('carryMultiplier scales the Strength the hero carries with, and knockbackBonus throws farther', () => {
    const { engine, player, foe } = build();
    expect(player.carryStrength).toBe(player.strength);
    player.grantPerk(perk('ox', { carryMultiplier: 1.5, knockbackBonus: 1 }));
    expect(player.carryStrength).toBe(Math.round(player.strength * 1.5));
    const pushed = applyImpulse(engine, player, foe, 1, 0, 1);
    expect(pushed.distanceTraveled).toBe(2);
  });

  it('onHitStatus leaves its status on the foe after a landed blow', () => {
    const { engine, player, foe } = build();
    player.grantPerk(perk('breaker', { onHitStatus: { status: 'slow', chance: 1, duration: 1 } }));
    new MeleeAttackAction(player, foe).perform(engine);
    expect(foe.statusManager.hasStatus('slow')).toBe(true);
  });

  it('rangedHitBonus and rangedDamageBonus join the shooter’s roll', () => {
    const { engine, player, foe } = build();
    const bow = new Item({ id: 'bow', name: 'Bow', category: 'weapon', slot: 'mainHand', weight: 1000, bulk: 500, identified: true, rangedConfig: { range: 6, baseDamage: 5 } });
    player.inventory.paperdoll.equip(bow, 'mainHand');
    engine.rng = () => 0.5;
    new RangedAttackAction(player, foe.x, foe.y).perform(engine);
    const plain = 1000 - foe.hp; // 5 + the Dexterity bonus
    player.grantPerk(perk('sure', { rangedHitBonus: 15, rangedDamageBonus: 2 }));
    player.gainEnergy(100);
    new RangedAttackAction(player, foe.x, foe.y).perform(engine);
    expect(1000 - foe.hp).toBe(plain * 2 + 2);
  });

  it('shortenedAfflictions halves a bite’s poison on the bearer', () => {
    const { engine, player, map } = build();
    const viper = new Monster({ id: 'viper', name: 'Viper', position: { x: 9, y: 10 }, stats: { hp: 10, maxHp: 10, attack: 5, defense: 0 }, speed: 100, definitionId: 'viper', aiType: 'melee', xpValue: 1, onHitAffliction: { type: 'poison', chance: 1, duration: 4 } });
    map.addEntity(viper);
    viper.gainEnergy(100);
    player.grantPerk(perk('stomach', { shortenedAfflictions: { types: ['poison', 'burning'], multiplier: 0.5 } }));
    engine.rng = () => 0.5;
    new MeleeAttackAction(viper, player).perform(engine);
    expect(player.statusManager.getAll().find((s) => s.type === 'poison')?.duration).toBe(2);
  });

  it('identifiesCarriedOnStairs identifies what was carried since the last stairs, not what was picked up after', () => {
    const { engine, player } = build();
    player.grantPerk(perk('lore', { identifiesCarriedOnStairs: true }));
    const old = new Item({ id: 'old', name: 'Ring', unidentifiedName: 'Plain Band', category: 'ring', weight: 10, bulk: 5, identified: false });
    player.inventory.primaryPack.addItem(old);
    identifyCarriedSinceStairs(engine, player); // the first stairs: remembered, not yet known
    expect(old.identified).toBe(false);
    const fresh = new Item({ id: 'fresh', name: 'Amulet', unidentifiedName: 'Dull Pendant', category: 'amulet', weight: 10, bulk: 5, identified: false });
    player.inventory.primaryPack.addItem(fresh);
    identifyCarriedSinceStairs(engine, player); // the next stairs
    expect(old.identified).toBe(true);
    expect(fresh.identified).toBe(false);
    expect(player.carriedAtStairs).toContain('fresh');
  });

  it('modifyPermanentStat can raise speed for good (Fleet-Foot)', () => {
    const { engine, player } = build();
    const speed = player.speed;
    engine.handlePlayerAction(
      new ExecuteChoiceAction(player, { id: 'c', title: 'c', description: 'c', options: [{ id: 'fleet', label: 'Fleet', consequences: [{ type: 'modifyPermanentStat', stat: 'speed', delta: 10 }] }] }, 'fleet')
    );
    expect(player.speed).toBe(speed + 10);
  });

  it('a perk’s damageTakenMultiplier and healingReceivedMultiplier reach Actor.takeDamage and Actor.heal (Thick Hide)', () => {
    const { player } = build();
    player.grantPerk(perk('hide', { damageTakenMultiplier: 0.9, healingReceivedMultiplier: 0.5 }));
    expect(player.takeDamage(20).damageDealt).toBe(18);
    expect(player.heal(10)).toBe(5);
  });

  it('sightBonus widens the hero’s sight radius beside the pacts’ modifier (Wayfarer, Q56)', () => {
    const { engine, player } = build();
    engine.fovRadius = 4;
    engine.updateFov();
    expect(engine.fov.isVisible(player.x + 5, player.y)).toBe(false);
    player.grantPerk(perk('wayfarer', { sightBonus: 1 }));
    engine.updateFov();
    expect(engine.fov.isVisible(player.x + 5, player.y)).toBe(true);
    expect(engine.fov.isVisible(player.x + 6, player.y)).toBe(false);
  });
  // ── Saga tiers 30–50 (tracker 3.6) ──
  it('followUpStrikeShare strikes once more for its share of a blow (Twin Fangs)', () => {
    const { engine, player, foe } = build();
    player.grantPerk(perk('fangs', { followUpStrikeShare: 0.5 }));
    new MeleeAttackAction(player, foe).perform(engine);
    expect(1000 - foe.hp).toBe(10 + 5);
  });

  it('elementSpellMultiplier scales spells of its element only, and resistsElements halves that element on the bearer (Elementalist)', () => {
    const { engine, player, foe } = build();
    new CastSpellAction(player, 'bolt', foe.x, foe.y).perform(engine);
    const plain = 1000 - foe.hp;
    player.grantPerk(perk('kin', { elementSpellMultiplier: { element: 'fire', multiplier: 1.3 }, resistsElements: ['fire'] }));
    player.gainEnergy(100);
    new CastSpellAction(player, 'bolt', foe.x, foe.y).perform(engine);
    expect(1000 - foe.hp - plain).toBe(Math.round(plain * 1.3));
    expect(player.takeElementalDamage(20, 'fire').damageDealt).toBe(10);
    expect(player.takeElementalDamage(20, 'cold').damageDealt).toBe(20);
    expect(player.affinityTo('fire')).toBe('resistant');
  });

  it('critChanceBonus and critMultiplier make a critical in a pack with no base crit (Thor’s Wrath)', () => {
    const { engine, player, foe } = build();
    player.grantPerk(perk('wrath', { critChanceBonus: 0.25, critMultiplier: 2 }));
    engine.rng = () => 0.1;
    new MeleeAttackAction(player, foe).perform(engine);
    expect(1000 - foe.hp).toBe(20);
    engine.rng = () => 0.5;
    player.gainEnergy(100);
    new MeleeAttackAction(player, foe).perform(engine);
    expect(1000 - foe.hp).toBe(30);
  });

  it('lastStandPerFloor leaves the hero at 1 HP once each floor visit (Einherjar)', () => {
    const { engine, player, foe } = build();
    player.grantPerk(perk('einherjar', { lastStandPerFloor: true }));
    player.hp = 5;
    new MeleeAttackAction(foe, player).perform(engine);
    expect(player.hp).toBe(1);
    expect(player.isAlive()).toBe(true);
    foe.gainEnergy(100);
    new MeleeAttackAction(foe, player).perform(engine);
    expect(player.isAlive()).toBe(false);
    // A new visit to the floor (the hero left it at another tick) arms it again.
    player.hp = 5;
    engine.map.lastVisitedTick = 500;
    foe.gainEnergy(100);
    new MeleeAttackAction(foe, player).perform(engine);
    expect(player.hp).toBe(1);
  });

  it('companionStatMultiplier raises the companion once, and companionRisesPerFloor raises a fallen one once a floor visit (Beast-Friend)', () => {
    const { engine, player, map, foe } = build();
    const hound = new Companion({ id: 'hound', name: 'Hound', position: { x: 9, y: 10 }, stats: { hp: 30, maxHp: 30, attack: 6, defense: 0 }, speed: 100, companionDefinitionId: 'hound', packWeightCapacity: 1000, packBulkCapacity: 1000 });
    map.addEntity(hound);
    engine.companion = hound;
    player.grantPerk(perk('friend', { companionStatMultiplier: 1.5, companionRisesPerFloor: true }));
    MonsterAI.decideAction(hound, engine);
    MonsterAI.decideAction(hound, engine);
    expect(hound.maxHp).toBe(45);
    expect(hound.hp).toBe(45);
    expect(hound.attack).toBe(9);
    hound.takeDamage(45);
    DeathResolver.resolveDeath(engine, foe, hound);
    expect(hound.hp).toBe(45);
    expect(engine.companion).toBe(hound);
    hound.takeDamage(45);
    DeathResolver.resolveDeath(engine, foe, hound);
    expect(engine.companion).toBeNull();
    expect(engine.deadCompanionRecord).toBe(hound);
  });

  it('sensesAllMonsters senses every living monster through walls (Odin’s Eye), and spellRangeBonus lengthens a cast', () => {
    const { engine, player, foe } = build();
    expect(sensesThroughWalls(engine, foe)).toBe(false);
    player.grantPerk(perk('eye', { sensesAllMonsters: true, spellRangeBonus: 2 }));
    expect(sensesThroughWalls(engine, foe)).toBe(true);
    expect(sensesThroughWalls(engine, player)).toBe(false);
    expect(withSpellRangeBonus(player, BOLT).range).toBe(8);
    expect(withSpellRangeBonus(player, { ...BOLT, range: 0 }).range).toBe(0);
  });
  // ── Milestone tiers 25 and 30 (tracker 3.6) ──
  it('defensePenetration ignores its share of the foe’s defense (Sunder)', () => {
    const { engine, player, foe } = build();
    foe.defense = 8;
    player.grantPerk(perk('sunder', { defensePenetration: 0.25 }));
    new MeleeAttackAction(player, foe).perform(engine);
    expect(1000 - foe.hp).toBe(10 - 6);
  });

  it('shieldWithTwoHanded lets a shield sit beside a two-hander, not an off-hand weapon (Giant’s Grip)', () => {
    const { player } = build();
    const greatsword = new Item({ id: 'gs', name: 'Greatsword', category: 'weapon', slot: 'mainHand', twoHanded: true, weight: 10, bulk: 5, identified: true });
    const shield = new Item({ id: 'sh', name: 'Shield', category: 'shield', slot: 'offHand', weight: 10, bulk: 5, identified: true });
    const dagger = new Item({ id: 'dg', name: 'Dagger', category: 'weapon', slot: 'mainHand', weight: 10, bulk: 5, identified: true });
    const doll = player.inventory.paperdoll;
    expect(doll.equip(shield, 'offHand').success).toBe(true);
    doll.equip(greatsword, 'mainHand');
    expect(doll.getItem('offHand')).toBeNull(); // the two-hander pushed the shield off
    player.grantPerk(perk('grip', { shieldWithTwoHanded: true }));
    expect(doll.equip(shield, 'offHand').success).toBe(true);
    expect(doll.getItem('mainHand')).toBe(greatsword);
    expect(doll.isSlotBlocked('offHand', dagger)).toBe(true);
  });

  it('ripostesOnEvade strikes back after an evaded blow, and evadeBlinkRange slips the evader aside (Riposte, Shadow-Step)', () => {
    const { engine, player, foe } = build();
    player.grantPerk(perk('riposte', { evasionBonus: 1, ripostesOnEvade: true }));
    new MeleeAttackAction(foe, player).perform(engine);
    expect(player.hp).toBe(100);
    expect(1000 - foe.hp).toBe(10);
    player.grantPerk(perk('step', { evadeBlinkRange: 1 }));
    foe.gainEnergy(100);
    new MeleeAttackAction(foe, player).perform(engine);
    expect(Math.max(Math.abs(player.x - 10), Math.abs(player.y - 10))).toBe(1);
  });

  it('meleeHitBonus adds points to the melee hit roll, and meleeDamageFlatBonus to the blow (Sure Shot, Q59)', () => {
    const { engine, player, foe } = build({ combatConfig: { attributeScaling: { baseline: 10, meleeBaseHitPercent: 80 } } });
    engine.rng = () => 0.85; // misses at 80, lands at 90
    new MeleeAttackAction(player, foe).perform(engine);
    expect(foe.hp).toBe(1000);
    player.grantPerk(perk('sure', { meleeHitBonus: 10, meleeDamageFlatBonus: 2 }));
    player.gainEnergy(100);
    new MeleeAttackAction(player, foe).perform(engine);
    expect(1000 - foe.hp).toBe(12);
  });

  it('evasionPerIntelligence adds Intelligence above the baseline to evasion (Mind over Matter)', () => {
    const { engine, player, foe } = build({ combatConfig: { attributeScaling: { baseline: 10 } } });
    player.intelligence = 30;
    player.grantPerk(perk('mind', { evasionPerIntelligence: 0.01 }));
    engine.rng = () => 0.15; // under 20 points of evasion
    new MeleeAttackAction(foe, player).perform(engine);
    expect(player.hp).toBe(100);
  });

  it('trapImmune never springs a trap under the bearer, and shows it (Trap-Dancer)', () => {
    const { engine, player } = build();
    const pit = new TrapInstance({ id: 'pit', type: 'pit', x: 10, y: 10, damage: 8 });
    player.grantPerk(perk('dancer', { trapImmune: true }));
    pit.trigger(player, engine);
    expect(player.hp).toBe(100);
    expect(pit.revealed).toBe(true);
    expect(pit.triggered).toBe(false);
  });

  it('restHealMultiplier doubles a rest turn’s healing (Second Wind)', () => {
    const { engine, player, foe } = build();
    engine.removeEntity(foe);
    player.grantPerk(perk('wind', { restHealMultiplier: 2 }));
    player.hp = 50;
    AutoRestManager.stepRestTurn(engine, player.hp, player.mana, 0, 100);
    expect(player.hp).toBe(52);
  });

  it('grantsStatusImmunities keeps those statuses off the hero, after a reload too (Stalwart)', () => {
    const { engine, player } = build();
    const stalwart = perk('stalwart', { grantsStatusImmunities: ['slow', 'stunned'] });
    player.grantPerk(stalwart);
    expect(player.statusManager.applyStatus({ type: 'slow', duration: 3 }, player.statusImmunities, player, engine)).toBe(false);
    const reloaded = new Player({ id: 'hero', name: 'Hero', position: { x: 1, y: 1 }, stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 }, perks: [stalwart] });
    expect(reloaded.statusImmunities).toEqual(['slow', 'stunned']);
  });

  it('chainExtraHops lets the caster’s chains reach one more foe (Chain-Weaver)', () => {
    const { engine, player, foe, map } = build();
    const second = new Monster({ id: 'f2', name: 'F2', position: { x: 12, y: 10 }, stats: { hp: 100, maxHp: 100, attack: 1, defense: 0 }, speed: 100, definitionId: 'foe', aiType: 'melee', xpValue: 1 });
    map.addEntity(second);
    const chain = { type: 'chain' as const, maxHops: 0, hopRange: 4, damageDecay: 0 };
    SpellPipeline.executeChainEffect(engine, BOLT, player, [foe], chain, { type: 'damage', amount: 10, element: 'lightning' });
    expect(second.hp).toBe(100);
    player.grantPerk(perk('weaver', { chainExtraHops: 1 }));
    SpellPipeline.executeChainEffect(engine, BOLT, player, [foe], chain, { type: 'damage', amount: 10, element: 'lightning' });
    expect(second.hp).toBe(90);
  });

  it('firstSpellPerFloorMultiplier halves the first spell to hit the hero on each floor visit (Warding Glyph)', () => {
    const { engine, player, foe } = build();
    player.grantPerk(perk('ward', { firstSpellPerFloorMultiplier: 0.5 }));
    const hit = { type: 'damage' as const, amount: 20, element: 'arcane' };
    SpellPipeline.applyDamageEffect(engine, BOLT, foe, player, hit);
    expect(player.hp).toBe(90);
    SpellPipeline.applyDamageEffect(engine, BOLT, foe, player, hit);
    expect(player.hp).toBe(70);
    engine.map.lastVisitedTick = 77; // a new visit
    SpellPipeline.applyDamageEffect(engine, BOLT, foe, player, hit);
    expect(player.hp).toBe(60);
  });

  it('maxHpPercent raises max HP, and a choice granting it raises HP with it (Juggernaut)', () => {
    const juggernaut = perk('juggernaut', { maxHpPercent: 0.25 });
    const { engine, player } = build({ perks: [juggernaut] });
    player.hp = 80;
    new ExecuteChoiceAction(player, { id: 'c', title: 'c', description: 'c', options: [{ id: 'j', label: 'J', consequences: [{ type: 'grantPerk', perkId: 'juggernaut' }] }] }, 'j').perform(engine);
    expect(player.maxHp).toBe(125);
    expect(player.hp).toBe(105);
  });

  it('levelUpFullHeal makes a level-up heal in full (Undying)', () => {
    const { player } = build();
    player.grantPerk(perk('undying', { levelUpFullHeal: true }));
    player.hp = 10;
    player.gainXp(player.xpToNextLevel);
    expect(player.hp).toBe(player.maxHp);
  });
  it('wakeRadius keeps a sleeper farther off asleep when it sees the hero, in the hero’s sight and on its own turn (Shadow-Walker, Q57)', () => {
    const { engine, player, map } = build();
    const sleeper = new Monster({ id: 'sl', name: 'Sleeper', position: { x: 16, y: 10 }, stats: { hp: 50, maxHp: 50, attack: 5, defense: 0 }, speed: 100, definitionId: 'foe', aiType: 'melee', xpValue: 1 });
    map.addEntity(sleeper);
    sleeper.aiState = 'sleeping';
    player.grantPerk(perk('shadow', { wakeRadius: 4 }));
    engine.updateFov();
    expect(engine.fov.isVisible(16, 10)).toBe(true);
    expect(sleeper.aiState).toBe('sleeping');
    MonsterAI.decideAction(sleeper, engine);
    expect(sleeper.aiState).toBe('sleeping');
    map.moveEntity(sleeper, 14, 10);
    engine.updateFov();
    expect(sleeper.aiState).toBe('hunting');
  });

  // ── Family perks (tracker 3.6, Q53 "A"): pack perks chosen in the compendium, counting against one family ──
  describe('a family perk', () => {
    function withFamilyPerk(effects: PerkDefinition['effects']) {
      const familyPerk: PerkDefinition = { id: 'fp', name: 'Family Perk', description: 'fp', source: 'family', category: 'fam', effects };
      const built = build({ monsterCategories: [{ id: 'fam', name: 'Fam', members: ['foe'], masteryKills: 1 }], perks: [familyPerk] });
      built.engine.compendium.recordKill('foe', 'Foe');
      expect(selectMasteryPerk(built.engine, 'category', 'fam', 'fp').success).toBe(true);
      const stranger = new Monster({ id: 'other', name: 'Other', position: { x: 9, y: 10 }, stats: { hp: 1000, maxHp: 1000, attack: 20, defense: 8 }, speed: 100, definitionId: 'other', aiType: 'melee', xpValue: 10 });
      built.map.addEntity(stranger);
      return { ...built, stranger };
    }

    it('scales damage from its family only (Grave-Warden)', () => {
      const { engine, player, foe, stranger } = withFamilyPerk({ damageTakenMultiplier: 0.8 });
      new MeleeAttackAction(foe, player).perform(engine);
      expect(100 - player.hp).toBe(16);
      new MeleeAttackAction(stranger, player).perform(engine);
      expect(100 - player.hp).toBe(16 + 20);
    });

    it('ignores its share of the family’s defense (Rust-Touch), and knocks the family back (Giant-Bane)', () => {
      const { engine, player, foe } = withFamilyPerk({ defensePenetration: 0.5, meleeKnockback: 1 });
      foe.defense = 8;
      new MeleeAttackAction(player, foe).perform(engine);
      expect(1000 - foe.hp).toBe(10 - 4);
      expect(foe.x).toBe(12);
    });

    it('shrugs off the family’s afflictions (Spirit-Ward)', () => {
      const { engine, player, foe } = withFamilyPerk({ afflictionShrugChance: 1 });
      foe.onHitAffliction = { type: 'poison', chance: 1, duration: 3 };
      new MeleeAttackAction(foe, player).perform(engine);
      expect(player.statusManager.hasStatus('poison')).toBe(false);
    });

    it('pays more XP for the family (Iron Will)', () => {
      const { engine, player, foe, stranger } = withFamilyPerk({ xpMultiplier: 1.5 });
      foe.xpValue = 10;
      const before = player.totalXp;
      DeathResolver.resolveDeath(engine, player, foe);
      expect(player.totalXp - before).toBe(15);
      DeathResolver.resolveDeath(engine, player, stranger);
      expect(player.totalXp - before).toBe(25);
    });

    it('halves only the family’s wind-up (breath) damage, not its blows (Wyrm-Bane, Q58)', () => {
      const { engine, player, foe, stranger } = withFamilyPerk({ windUpDamageTakenMultiplier: 0.5 });
      new WindUpExecuteAction(foe, { x: 10, y: 10 }, 'Breath', 2).perform(engine);
      expect(100 - player.hp).toBe(20); // 20 × 2 = 40, halved
      player.hp = 100;
      new WindUpExecuteAction(stranger, { x: 10, y: 10 }, 'Slam', 2).perform(engine);
      expect(100 - player.hp).toBe(40);
      player.hp = 100;
      new MeleeAttackAction(foe, player).perform(engine);
      expect(100 - player.hp).toBe(20);
    });

    it('shrugs off the family’s afflictions from its spells and its hooks too (Grave-Warden, Iron Will, Q58)', () => {
      const { engine, player, foe, stranger } = withFamilyPerk({ afflictionShrugChance: 1 });
      const hex = { ...BOLT, id: 'hex', effects: [], basePower: 0, statusAffliction: { type: 'slow', duration: 3 } } as SpellDefinition;
      SpellPipeline.applyStatusEffect(engine, foe, player, { type: 'applyStatus', statusId: 'slow', duration: 3 });
      (SpellPipeline as unknown as { applyLegacySpellDamageAndStatus: (...a: unknown[]) => void }).applyLegacySpellDamageAndStatus(engine, hex, foe, player);
      expect(player.statusManager.hasStatus('slow')).toBe(false);
      foe.hooks = [{ event: 'onHit', chance: 1, action: { type: 'applyStatus', status: 'poison', duration: 3, target: 'target' } }];
      HookDispatcher.dispatch('onHit', { engine, attacker: foe, defender: player, damage: 1, blockedDamage: 0 });
      expect(player.statusManager.hasStatus('poison')).toBe(false);
      stranger.hooks = foe.hooks;
      HookDispatcher.dispatch('onHit', { engine, attacker: stranger, defender: player, damage: 1, blockedDamage: 0 });
      expect(player.statusManager.hasStatus('poison')).toBe(true);
    });

    it('keeps the family asleep beyond its wake radius, and no other (Reaver, Q57)', () => {
      const { engine, map, foe, stranger } = withFamilyPerk({ wakeRadius: 5 });
      map.moveEntity(foe, 17, 10);
      map.moveEntity(stranger, 17, 12);
      foe.aiState = 'sleeping';
      stranger.aiState = 'sleeping';
      engine.updateFov();
      expect(foe.aiState).toBe('sleeping');
      expect(stranger.aiState).toBe('hunting');
    });

    it('lengthens the family’s wind-up warning (Wyrm-Bane), and senses it through walls nearby (Pack-Sense)', () => {
      const { engine, foe, stranger } = withFamilyPerk({ windUpWarningBonus: 1, sensesWithin: 10 });
      new WindUpDeclareAction(foe, { x: 10, y: 10 }, 'Breath', 'The foe draws breath!').perform(engine);
      expect(foe.intent.turnsRemaining).toBe(2);
      new WindUpDeclareAction(stranger, { x: 10, y: 10 }, 'Slam', 'The other winds up!').perform(engine);
      expect(stranger.intent.turnsRemaining).toBe(1);
      expect(sensesThroughWalls(engine, foe)).toBe(true);
      expect(sensesThroughWalls(engine, stranger)).toBe(false);
      engine.map.moveEntity(foe, 25, 10);
      expect(sensesThroughWalls(engine, foe)).toBe(false);
    });
  });
});
