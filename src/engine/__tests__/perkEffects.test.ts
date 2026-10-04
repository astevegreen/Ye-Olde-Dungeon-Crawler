import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { MeleeAttackAction } from '../actions/combat';
import { CastSpellAction } from '../actions/spell-actions';
import { SearchAction } from '../actions/search';
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

function build() {
  const map = new GameMap(30, 30, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 }, stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 }, mana: 50, maxMana: 50, spellsKnown: ['bolt'] });
  const foe = new Monster({ id: 'foe', name: 'Foe', position: { x: 11, y: 10 }, stats: { hp: 1000, maxHp: 1000, attack: 20, defense: 0 }, speed: 100, definitionId: 'foe', aiType: 'melee', xpValue: 1 });
  map.addEntity(player);
  map.addEntity(foe);
  const manifest = { id: 'test', name: 'Test', monsters: [], items: [], spells: [BOLT] } as unknown as GameContentManifest;
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

  it('overflowDebtDecayMultiplier clears debt faster while resting', () => {
    const { player } = build();
    player.accrueVoidDebt(6);
    player.grantPerk(perk('thief', { overflowDebtDecayMultiplier: 2 }));
    player.decayVoidDebt(2, 0); // the rest action's per-turn call multiplies: this models two turns
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
});
