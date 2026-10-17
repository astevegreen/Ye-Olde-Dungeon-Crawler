import { describe, it, expect } from 'vitest';
import { fixtureManifest, FIXTURE_GRIMOIRES } from '../../../../tests/fixtures/fixture-pack';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { CastSpellAction } from '../../actions/spell-actions';
import { SpellPipeline } from '../spellPipeline';
import { effectiveHpCost, effectiveManaCost } from '../castNumbers';
import { leastResistedElement, piercedAffinity, DEFAULT_AFFINITY_MATRIX } from '../elements';
import type { DamageEffect, SpellDefinition } from '../types';
import type { ElementalAffinity } from '../elements';

const spell = (id: string): SpellDefinition => fixtureManifest.spells!.find((s) => s.id === id)!;

function setup(spellsKnown: string[] = ['forge_bolt'], grimoires = false): { engine: GameEngine; hero: Player } {
  const hero = new Player({
    position: { x: 2, y: 5 },
    spellsKnown,
    grimoireSystem: grimoires ? FIXTURE_GRIMOIRES : undefined,
  });
  hero.restoreMana(hero.maxMana);
  const engine = new GameEngine({ map: new GameMap(12, 12, TILES.FLOOR), player: hero, floor: 1, manifest: fixtureManifest });
  return { engine, hero };
}

function foe(engine: GameEngine, id: string, x: number, resistances: Record<string, ElementalAffinity> = {}): Monster {
  const m = new Monster({ id, name: id, position: { x, y: 5 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 0 }, resistances, speed: 100 });
  engine.map.addEntity(m);
  return m;
}

/** HP a fixed hit of `effect` takes off a fresh foe with these resistances. */
function hitFor(effect: DamageEffect, resistances: Record<string, ElementalAffinity>): number {
  const { engine, hero } = setup();
  const target = foe(engine, 'dummy', 6, resistances);
  SpellPipeline.applyDamageEffect(engine, spell('forge_bolt'), hero, target, effect);
  return target.maxHp - target.hp;
}

describe('spell building blocks: damage', () => {
  const fire = (extra: Partial<DamageEffect> = {}): DamageEffect => ({ type: 'damage', amount: 20, element: 'fire', ...extra });

  it('pierce lands a resisted hit as neutral, and leaves immunity and absorbing alone', () => {
    const neutral = hitFor(fire(), {});
    expect(hitFor(fire(), { fire: 'resistant' })).toBeLessThan(neutral);
    expect(hitFor(fire({ pierce: true }), { fire: 'resistant' })).toBe(neutral);
    expect(hitFor(fire({ pierce: true }), { fire: 'weak' })).toBeGreaterThan(neutral);
    expect(hitFor(fire({ pierce: true }), { fire: 'immune' })).toBe(0);
    expect(piercedAffinity('absorbing', true)).toBe('absorbing');
  });

  it('a hit with several elements lands as the one the target resists least', () => {
    const neutral = hitFor(fire(), {});
    const both = fire({ elements: ['cold'] });
    expect(hitFor(both, { fire: 'resistant' })).toBe(neutral);
    expect(hitFor(both, { fire: 'immune', cold: 'resistant' })).toBeLessThan(neutral);
    expect(hitFor(both, { fire: 'immune', cold: 'resistant' })).toBeGreaterThan(0);
    expect(hitFor(both, { cold: 'weak' })).toBeGreaterThan(neutral);

    const affinities: Record<string, ElementalAffinity> = { fire: 'resistant', cold: 'resistant' };
    const of = (e: string) => affinities[e] ?? 'neutral';
    expect(leastResistedElement(DEFAULT_AFFINITY_MATRIX, of, ['fire', 'cold'])).toBe('fire'); // a tie: the first listed
    expect(leastResistedElement(DEFAULT_AFFINITY_MATRIX, of, ['fire', 'cold', 'lightning'])).toBe('lightning');
  });

  it('the fixture Forge Bolt goes through a fire-resistant foe as fire, piercing', () => {
    const { engine, hero } = setup();
    const target = foe(engine, 'warded', 6, { fire: 'resistant', cold: 'immune' });
    engine.updateFov();
    expect(engine.handlePlayerAction(new CastSpellAction(hero, 'forge_bolt', 6, 5)).success).toBe(true);
    expect(target.maxHp - target.hp).toBe(hitFor(fire(), {}));
  });
});

describe('spell building blocks: statuses', () => {
  it('cleanse lifts the longest-lasting affliction, or with all every one, never a boon', () => {
    const { engine, hero } = setup(['cleansing_word']);
    const statuses = hero.statusManager;
    statuses.applyStatus({ type: 'poison', duration: 3, potency: 1 });
    statuses.applyStatus({ type: 'slow', duration: 8 });
    statuses.applyStatus({ type: 'haste', duration: 5 });

    SpellPipeline.applyEffectToTarget(engine, spell('cleansing_word'), hero, hero, { type: 'cleanse' });
    expect(statuses.hasStatus('slow')).toBe(false);
    expect(statuses.hasStatus('poison')).toBe(true);

    expect(engine.handlePlayerAction(new CastSpellAction(hero, 'cleansing_word', hero.x, hero.y)).success).toBe(true);
    expect(statuses.getAll().map((s) => s.type)).toEqual(['haste']);
  });

  it("hand-over moves the caster's afflictions to the target; one it is immune to stays", () => {
    const { engine, hero } = setup(['pass_the_burden']);
    const target = foe(engine, 'mule', 6);
    target.statusImmunities.push('slow');
    hero.statusManager.applyStatus({ type: 'poison', duration: 6, potency: 2 });
    hero.statusManager.applyStatus({ type: 'slow', duration: 4 });
    hero.statusManager.applyStatus({ type: 'haste', duration: 5 });
    engine.updateFov();

    expect(engine.handlePlayerAction(new CastSpellAction(hero, 'pass_the_burden', 6, 5)).success).toBe(true);
    expect(target.statusManager.getStatus('poison')).toMatchObject({ potency: 2, sourceEntityId: hero.id });
    expect(target.statusManager.hasStatus('slow')).toBe(false);
    expect(hero.statusManager.hasStatus('poison')).toBe(false);
    expect(hero.statusManager.hasStatus('slow')).toBe(true);
    expect(hero.statusManager.hasStatus('haste')).toBe(true);
  });
});

describe('spell building blocks: costs and cast time', () => {
  it('a blood spell costs current HP, never the last of it, and max HP stays', () => {
    const { engine, hero } = setup(['blood_bolt']);
    foe(engine, 'target', 6);
    engine.updateFov();
    const { hp, maxHp } = hero;
    expect(engine.handlePlayerAction(new CastSpellAction(hero, 'blood_bolt', 6, 5)).success).toBe(true);
    expect(hero.hp).toBe(hp - 5);
    expect(hero.maxHp).toBe(maxHp);

    hero.hp = 5;
    const refused = engine.handlePlayerAction(new CastSpellAction(hero, 'blood_bolt', 6, 5));
    expect(refused).toMatchObject({ success: false, cost: 0 });
    expect(hero.hp).toBe(5);
  });

  it("Thrift on the spell's slot lowers its HP and mana costs; elsewhere they stand", () => {
    const { hero } = setup(['blood_bolt', 'forge_bolt'], true);
    expect(hero.assignGrimoireStat('row', 'x', 'thrift')).toBe('ok');
    expect(hero.placeGrimoireSpell('blood_bolt', { grimoireId: 'row', x: 1, y: 0 })).toBe(true);
    expect(hero.placeGrimoireSpell('forge_bolt', { grimoireId: 'row', x: 0, y: 0 })).toBe(true);
    expect(effectiveHpCost(hero, spell('blood_bolt'))).toBe(4); // 5 × 0.8
    expect(effectiveManaCost(hero, spell('forge_bolt'))).toBe(6); // the centre has no axis

    expect(hero.placeGrimoireSpell('forge_bolt', { grimoireId: 'row', x: -1, y: 0 })).toBe(true);
    expect(effectiveManaCost(hero, spell('forge_bolt'))).toBe(5); // 6 × 0.8, rounded
    // Never below 1 while it costs any.
    expect(effectiveHpCost(hero, { id: 'blood_bolt', hpCost: 1 })).toBe(1);
  });

  it("Swift on the spell's slot casts it in a share of a turn", () => {
    const { engine, hero } = setup(['forge_bolt', 'blood_bolt'], true);
    foe(engine, 'target', 6);
    engine.updateFov();
    expect(hero.assignGrimoireStat('row', 'x', 'swift')).toBe('ok');
    expect(hero.placeGrimoireSpell('forge_bolt', { grimoireId: 'row', x: 1, y: 0 })).toBe(true);
    expect(hero.placeGrimoireSpell('blood_bolt', { grimoireId: 'row', x: 0, y: 0 })).toBe(true);

    expect(engine.handlePlayerAction(new CastSpellAction(hero, 'forge_bolt', 6, 5)).cost).toBe(75);
    expect(engine.handlePlayerAction(new CastSpellAction(hero, 'blood_bolt', 6, 5)).cost).toBe(100);
  });
});
