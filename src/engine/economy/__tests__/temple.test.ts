import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { Player } from '../../entities/player';
import { Item } from '../../items/item';
import { ItemFactory } from '../../items/factory';
import type { ItemModifier } from '../../items/modifiers';
import { addCurrencyToPlayer, getPlayerTotalCp } from '../currency';
import { TempleService } from '../services';
import { cotwManifest } from '../../../content/cotw';
import { serializeGame, deserializeGame } from '../../storage/serializer';

/** Tracker 2.6: the temple (Q9 "A", Q34 "A", Q49 "A", Q50 "A"). */
const cursed: ItemModifier = { id: 'c', name: 'Cursed', alignment: 'negative', category: 'cursed', prefix: 'Cursed', binds: true };
const helTouched: ItemModifier = { id: 'h', name: 'Hel-touched', alignment: 'negative', category: 'unholy', prefix: 'Hel-touched', binds: true, templeShunned: true };

function heroEngine(): GameEngine {
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 }, stats: { hp: 10, maxHp: 40, attack: 10, defense: 5 }, strength: 15 });
  const engine = new GameEngine({ map: GameMap.createBoxRoom(12, 12), player, manifest: cotwManifest, floor: 0 });
  player.inventory.paperdoll.equip(ItemFactory.createCoinPurse('purse'), 'purse');
  return engine;
}

function wear(engine: GameEngine, modifier: ItemModifier, id = 'worn'): Item {
  const ring = new Item({ id, name: 'Iron Band', category: 'ring', slot: 'fingerLeft', weight: 50, bulk: 40, identified: true });
  ring.addModifier({ ...modifier });
  engine.player.inventory.paperdoll.equip(ring, 'fingerLeft');
  return ring;
}

describe('the temple after Tyr is desecrated (Q50 "A")', () => {
  let engine: GameEngine;
  beforeEach(() => {
    engine = heroEngine();
    engine.worldState.factions.temple_standing = -10;
  });

  it('still cleanses a bound item, at double the price', () => {
    const ring = wear(engine, cursed);
    addCurrencyToPlayer(engine.player, 1000);
    const result = TempleService.cleanseCurses(engine.player, undefined, undefined, engine);
    expect(result.success).toBe(true);
    expect(ring.isBound()).toBe(false);
    expect(1000 - getPlayerTotalCp(engine.player)).toBe(TempleService.CURSE_CLEANSE_COST_CP * 2);
  });

  it('does not double the double for a Hel-touched item', () => {
    wear(engine, helTouched);
    addCurrencyToPlayer(engine.player, 2000);
    expect(TempleService.cleanseCurses(engine.player, undefined, undefined, engine).success).toBe(true);
    expect(2000 - getPlayerTotalCp(engine.player)).toBe(TempleService.CURSE_CLEANSE_COST_CP * 2);
  });

  it('still refuses to heal', () => {
    addCurrencyToPlayer(engine.player, 1000);
    const result = TempleService.healAndRestore(engine.player, undefined, undefined, engine);
    expect(result.success).toBe(false);
    expect(getPlayerTotalCp(engine.player)).toBe(1000);
  });

  it('cleanses past the corruption refusal too: the cleanse is never refused', () => {
    engine.worldState.factions.temple_standing = 0;
    engine.player.corruptionScore = 80;
    wear(engine, cursed);
    addCurrencyToPlayer(engine.player, 1000);
    expect(TempleService.cleanseCurses(engine.player, undefined, undefined, engine).success).toBe(true);
    expect(TempleService.healAndRestore(engine.player, undefined, undefined, engine).success).toBe(false);
  });
});

describe('offerings (Q9 "A", Q49 "A", Q50 "A")', () => {
  let engine: GameEngine;
  beforeEach(() => {
    engine = heroEngine();
  });
  const carry = (modifier: ItemModifier | null, id: string, identified = true): Item => {
    const item = new Item({ id, name: 'Iron Band', category: 'ring', slot: 'fingerLeft', weight: 50, bulk: 40, identified });
    if (modifier) item.addModifier({ ...modifier, id: `${id}-m` });
    engine.player.inventory.primaryPack.addItem(item);
    return item;
  };

  it('takes an identified Cursed, Hexed or Unholy item from the pack: no coin, +5 piety, +1 standing', () => {
    const ring = carry(cursed, 'r1');
    expect(TempleService.offerableItems(engine)).toEqual([ring]);
    const before = getPlayerTotalCp(engine.player);
    const result = TempleService.makeOffering(engine, ring);
    expect(result.success).toBe(true);
    expect(engine.player.inventory.primaryPack.getItem('r1')).toBeFalsy();
    expect(getPlayerTotalCp(engine.player)).toBe(before);
    expect(TempleService.piety(engine)).toBe(5);
    expect(engine.worldState.factions.temple_standing).toBe(1);
  });

  it('will not take a plain item, an unidentified one, or anything worn', () => {
    const plain = carry(null, 'plain');
    const hidden = carry(cursed, 'hidden', false);
    expect(TempleService.offerableItems(engine)).toEqual([]);
    expect(TempleService.makeOffering(engine, plain).success).toBe(false);
    expect(TempleService.makeOffering(engine, hidden).success).toBe(false);
    expect(engine.player.inventory.primaryPack.getItem('hidden')).toBeTruthy();
  });

  it('accepts offerings at any standing, and each one earns standing back', () => {
    engine.worldState.factions.temple_standing = -10;
    const ring = carry(cursed, 'r2');
    expect(TempleService.makeOffering(engine, ring).success).toBe(true);
    expect(engine.worldState.factions.temple_standing).toBe(-9);
  });

  it('takes nothing from a hero wearing Hel’s mark: only the cleanse (Q34)', () => {
    wear(engine, helTouched);
    const ring = carry(cursed, 'r3');
    expect(TempleService.makeOffering(engine, ring).success).toBe(false);
    expect(engine.player.inventory.primaryPack.getItem('r3')).toBeTruthy();
  });
});

describe('blessings (Q49 "A")', () => {
  let engine: GameEngine;
  beforeEach(() => {
    engine = heroEngine();
  });
  const offerUntil = (piety: number) => {
    for (let i = 0; TempleService.piety(engine) < piety; i++) {
      const item = new Item({ id: `o-${i}`, name: 'Band', category: 'ring', slot: 'fingerLeft', weight: 50, bulk: 40, identified: true });
      item.addModifier({ ...cursed, id: `o-${i}-m` });
      engine.player.inventory.primaryPack.addItem(item);
      expect(TempleService.makeOffering(engine, item).success).toBe(true);
    }
  };
  const ids = () => TempleService.availableBlessings(engine).map((b) => b.id);

  it('opens Eir’s Mercy at piety 30: temple healing is free from then on', () => {
    offerUntil(25);
    expect(ids()).toEqual([]);
    offerUntil(30);
    expect(ids()).toEqual(['eirs_mercy']);
    expect(TempleService.receiveBlessing(engine, 'eirs_mercy').success).toBe(true);
    expect(ids()).toEqual([]);
    engine.player.hp = 1;
    const before = getPlayerTotalCp(engine.player);
    expect(TempleService.healAndRestore(engine.player, undefined, undefined, engine).success).toBe(true);
    expect(getPlayerTotalCp(engine.player)).toBe(before);
    expect(engine.player.hp).toBe(engine.player.maxHp);
  });

  it('Thor’s Hallowing at 60 makes one plain weapon or armor piece Holy, at the depth’s tier', () => {
    offerUntil(60);
    TempleService.receiveBlessing(engine, 'eirs_mercy');
    engine.modifyWorldCounter(engine.manifest.deepestFloorCounter!, 12);
    const sword = new Item({ id: 'sword', name: 'Sword', category: 'weapon', slot: 'mainHand', weight: 1000, bulk: 500, identified: true });
    const ring = new Item({ id: 'band', name: 'Band', category: 'ring', slot: 'fingerLeft', weight: 50, bulk: 40, identified: true });
    engine.player.inventory.primaryPack.addItem(sword);
    engine.player.inventory.primaryPack.addItem(ring);
    expect(TempleService.hallowableItems(engine, 'thors_hallowing')).toEqual([sword]);
    expect(TempleService.receiveBlessing(engine, 'thors_hallowing').success).toBe(false); // no item named
    const result = TempleService.receiveBlessing(engine, 'thors_hallowing', sword);
    expect(result.success).toBe(true);
    expect(sword.modifiers[0]?.category).toBe('holy');
    expect(sword.modifiers[0]?.name).toBe('of Dawn'); // the floor-10 tier
    expect(ids()).not.toContain('thors_hallowing');
  });

  it('Baldr’s Grace at 100 raises max HP by a tenth, for good', () => {
    offerUntil(100);
    const before = engine.player.maxHp;
    expect(TempleService.receiveBlessing(engine, 'baldrs_grace').success).toBe(true);
    expect(engine.player.maxHp).toBe(Math.round(before * 1.1));
    expect(TempleService.receiveBlessing(engine, 'baldrs_grace').success).toBe(false); // once
  });

  it('refuses blessings below 0 standing and to a hero wearing Hel’s mark', () => {
    offerUntil(30);
    engine.worldState.factions.temple_standing = -1;
    expect(TempleService.receiveBlessing(engine, 'eirs_mercy').success).toBe(false);
    engine.worldState.factions.temple_standing = 0;
    wear(engine, helTouched);
    expect(TempleService.receiveBlessing(engine, 'eirs_mercy').success).toBe(false);
  });
});

describe("a blessing's lasting max HP share in a save", () => {
  it('loads with the share and the full HP it allowed, and never compounds', () => {
    const engine = heroEngine();
    engine.player.maxHpPercentBonus = 0.1;
    engine.player.hp = engine.player.maxHp;
    const blessedMax = engine.player.maxHp;
    let restored = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine))), cotwManifest).engine;
    restored = deserializeGame(JSON.parse(JSON.stringify(serializeGame(restored))), cotwManifest).engine;
    expect(restored.player.maxHpPercentBonus).toBeCloseTo(0.1);
    expect(restored.player.maxHp).toBe(blessedMax);
    expect(restored.player.hp).toBe(blessedMax);
  });
});
