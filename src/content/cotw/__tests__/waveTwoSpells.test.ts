import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../../engine/engine';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { Player } from '../../../engine/entities/player';
import { Monster } from '../../../engine/entities/monster';
import { CastSpellAction } from '../../../engine/actions/spell-actions';
import { MeleeAttackAction } from '../../../engine/actions/combat';
import { findPath } from '../../../engine/ai/pathfinding';
import { serializeGame, deserializeGame } from '../../../engine/storage/serializer';
import type { SaveData } from '../../../engine/storage/types';
import { cotwManifest } from '../index';
import { FYLGJA_BURST_STATUS, FYLGJA_ID, MIRED_STATUS, MIRE_SURFACE, RIME_SHATTER_STATUS, RIME_THURS_ID } from '../waveTwoSpells';

/** 6b: the seven wave-2 spells, cast by a hero in an engine on the real pack. */
describe('the wave-2 spells in play', () => {
  let engine: GameEngine;
  let map: GameMap;
  let hero: Player;

  beforeEach(() => {
    map = new GameMap(20, 15, TILES.FLOOR);
    hero = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 3, y: 7 },
      stats: { hp: 100, maxHp: 100, attack: 10, defense: 5 },
      mana: 200,
      maxMana: 200,
      spellsKnown: ['mire', 'hammer_throw', 'fylgja', 'sols_glare', 'raise_cairn', 'rime_thurs', 'drench'],
    });
    map.addEntity(hero);
    engine = new GameEngine({ map, player: hero, seed: 7, manifest: cotwManifest });
  });

  const foe = (id: string, x: number, y: number, stats = { hp: 100, maxHp: 100, attack: 0, defense: 10 }) => {
    const m = new Monster({ id, name: id, position: { x, y }, stats });
    engine.addEntity(m);
    return m;
  };

  const cast = (spellId: string, x = hero.x, y = hero.y) => new CastSpellAction(hero, spellId, x, y).perform(engine);

  /** The one creature of `monsterId` the spell brought, on the hero's side. */
  const summoned = (monsterId: string) => {
    const found = map.getAllEntities().filter((e): e is Monster => e instanceof Monster && e.definitionId === monsterId);
    expect(found).toHaveLength(1);
    expect(found[0].faction).toBe('player');
    return found[0];
  };

  const onMap = (m: Monster) => map.getEntityById(m.id) === m;

  it('Mire fouls a 3×3 patch: a creature in it is eaten by poison and its armour worn down', () => {
    const wader = foe('wader', 8, 7);
    const armour = wader.defense;
    expect(cast('mire', 8, 7).success).toBe(true);
    for (let x = 7; x <= 9; x++) for (let y = 6; y <= 8; y++) expect(engine.surfaces.getSurface(x, y)).toBe(MIRE_SURFACE);
    expect(engine.surfaces.getSurface(10, 7)).toBeUndefined();

    engine.surfaces.tick(engine);

    expect(wader.hp).toBe(98);
    expect(wader.statusManager.hasStatus(MIRED_STATUS)).toBe(true);
    expect(wader.defense).toBe(Math.round(armour * 0.8));
  });

  it('Hammer-Throw strikes each foe in its path going out and coming back', () => {
    const near = foe('near', 5, 7);
    const far = foe('far', 9, 7);
    expect(cast('hammer_throw', 11, 7).success).toBe(true);
    const hits = (name: string) => engine.messages.filter((m) => m.includes(name) && /damage/.test(m)).length;
    expect(hits('near')).toBe(2);
    expect(hits('far')).toBe(2);
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(far.hp).toBeLessThan(far.maxHp);
  });

  it('Fylgja draws foes and bursts when struck: shadow and a stunned turn for the foes beside it', () => {
    expect(cast('fylgja').success).toBe(true);
    const fetch = summoned(FYLGJA_ID);
    expect(fetch.statusManager.hasStatus('decoy')).toBe(true);
    expect(fetch.statusManager.hasStatus(FYLGJA_BURST_STATUS)).toBe(true);
    map.moveEntity(fetch, 10, 7);
    const striker = foe('striker', 11, 7, { hp: 100, maxHp: 100, attack: 5, defense: 0 });
    const far = foe('far', 15, 7);

    for (let i = 0; i < 20 && onMap(fetch); i++) new MeleeAttackAction(striker, fetch).perform(engine);

    expect(onMap(fetch)).toBe(false);
    expect(striker.hp).toBeLessThan(striker.maxHp);
    expect(striker.statusManager.hasStatus('stunned')).toBe(true);
    expect(far.hp).toBe(far.maxHp);
    expect(hero.hp).toBe(hero.maxHp);
  });

  it('Fylgja bursts on a blow that fells it', () => {
    cast('fylgja');
    const fetch = summoned(FYLGJA_ID);
    map.moveEntity(fetch, 10, 7);
    const brute = foe('brute', 11, 7, { hp: 100, maxHp: 100, attack: 500, defense: 0 });

    for (let i = 0; i < 20 && onMap(fetch); i++) new MeleeAttackAction(brute, fetch).perform(engine);

    expect(fetch.isAlive()).toBe(false);
    expect(brute.hp).toBeLessThan(brute.maxHp);
    expect(engine.messages).toContain('Fylgja bursts in a shriek of dread!');
  });

  it('Fylgja bursts too when its ten turns run out', () => {
    cast('fylgja');
    const fetch = summoned(FYLGJA_ID);
    map.moveEntity(fetch, 10, 7);
    const near = foe('near', 11, 8);

    for (let i = 0; i < 10 && onMap(fetch); i++) fetch.statusManager.tick(fetch, engine);

    expect(onMap(fetch)).toBe(false);
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(engine.messages).toContain('Fylgja bursts in a shriek of dread!');
  });

  it("Sól's Glare blinds the foe it finds for 3 turns", () => {
    const target = foe('target', 7, 7);
    expect(cast('sols_glare', 7, 7).success).toBe(true);
    const blind = target.statusManager.getAll().find((s) => s.type === 'blindness');
    expect(blind?.duration).toBe(3);
  });

  it('Raise Cairn stands a 3-wide wall of 30 HP across the way', () => {
    const before = findPath(map, { x: 3, y: 7 }, { x: 12, y: 7 }).length;
    // A corridor three tiles high, so the wall closes it.
    for (let x = 0; x < 20; x++) for (const y of [5, 9]) map.setTile(x, y, TILES.WALL);
    expect(cast('raise_cairn', 8, 7).success).toBe(true);
    for (const y of [6, 7, 8]) {
      expect(map.tempWalls.has(8, y)).toBe(true);
      expect(map.tempWalls.hpAt(8, y)).toBe(30);
    }
    expect(before).toBeGreaterThan(0);
    expect(findPath(map, { x: 3, y: 7 }, { x: 12, y: 7 })).toEqual([]);
  });

  it('Rime-Thurs shatters when its twelve turns run out: cold and two frozen turns beside it', () => {
    expect(cast('rime_thurs').success).toBe(true);
    const giant = summoned(RIME_THURS_ID);
    expect(giant.statusManager.hasStatus(RIME_SHATTER_STATUS)).toBe(true);
    map.moveEntity(giant, 10, 7);
    const near = foe('near', 11, 7);
    const far = foe('far', 15, 7);

    for (let i = 0; i < 12 && onMap(giant); i++) giant.statusManager.tick(giant, engine);

    expect(onMap(giant)).toBe(false);
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(near.statusManager.hasStatus('paralysis')).toBe(true);
    expect(far.hp).toBe(far.maxHp);
    expect(hero.hp).toBe(hero.maxHp);
  });

  it('Rime-Thurs shatters when slain', () => {
    cast('rime_thurs');
    const giant = summoned(RIME_THURS_ID);
    map.moveEntity(giant, 10, 7);
    const killer = foe('killer', 11, 7, { hp: 100, maxHp: 100, attack: 500, defense: 0 });
    giant.hp = 1;

    for (let i = 0; i < 20 && giant.isAlive(); i++) new MeleeAttackAction(killer, giant).perform(engine);

    expect(giant.isAlive()).toBe(false);
    expect(killer.hp).toBeLessThan(killer.maxHp);
    expect(engine.messages).toContain('Rime-Thurs shatters into a spray of ice!');
  });

  it('Drench floods a 3×3 patch, and lightning strikes a creature standing in it twice as hard', () => {
    const dry = foe('dry', 6, 3, { hp: 200, maxHp: 200, attack: 0, defense: 0 });
    const wet = foe('wet', 6, 11, { hp: 200, maxHp: 200, attack: 0, defense: 0 });
    expect(cast('drench', 6, 11).success).toBe(true);
    for (let x = 5; x <= 7; x++) for (let y = 10; y <= 12; y++) expect(engine.surfaces.getSurface(x, y)).toBe('water');

    map.moveEntity(hero, 3, 3);
    cast('hammer_throw', 11, 3);
    map.moveEntity(hero, 3, 11);
    cast('hammer_throw', 11, 11);

    const dryLoss = dry.maxHp - dry.hp;
    const wetLoss = wet.maxHp - wet.hp;
    expect(dryLoss).toBeGreaterThan(0);
    expect(wetLoss).toBeGreaterThan(dryLoss * 1.5);
  });

  it("a saved hero's Lightning Bolt loads as Hammer-Throw", () => {
    hero.spellsKnown = ['lightning_bolt'];
    const saved = JSON.parse(JSON.stringify(serializeGame(engine))) as SaveData;
    const back = deserializeGame(saved, cotwManifest).engine;
    expect(back.player.spellsKnown).toEqual(['hammer_throw']);
  });
});
