import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { CastSpellAction } from '../../actions/spell-actions';
import { RestAction } from '../../actions/rest';
import { ManaOverflowManager } from '../manaOverflow';
import { COTW_MAGIC } from '../../../content/cotw/magic';
import type { SpellDefinition } from '../types';
import { serializeGame, deserializeGame } from '../../storage/serializer';

describe('Ginnungagap / Mana Overflow System', () => {
  let engine: GameEngine;
  let player: Player;

  const testSpell: SpellDefinition = {
    id: 'test_burst',
    name: 'Test Burst',
    school: 'Combat',
    manaCost: 10,
    element: 'fire',
    range: 5,
    basePower: 12,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'ray',
    targetingMode: 'ray',
    description: 'A searing test spark.',
  };

  const testManifest = {
    id: 'test_pack',
    name: 'Test Pack',
    version: '1.0.0',
    description: 'Test pack description',
    dungeonFloors: 10,
    spells: [testSpell],
    monsters: [],
    items: [],
    magic: { overflow: COTW_MAGIC.overflow },
  };

  beforeEach(() => {
    const map = new GameMap(15, 15, TILES.FLOOR);
    player = new Player({
      position: { x: 5, y: 5 },
      mana: 10,
      maxMana: 10,
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 },
    });
    engine = new GameEngine({ map, player, manifest: testManifest as any, seed: 1337 });
  });

  it('casts normally and accrues no void debt when mana is sufficient', () => {
    expect(player.mana).toBe(10);
    expect(player.voidDebt).toBe(0);

    const action = new CastSpellAction(player, testSpell.id, 5, 8);
    const result = action.perform(engine);
    expect(result.success).toBe(true);
    expect(player.mana).toBe(0);
    expect(player.voidDebt).toBe(0);
  });

  it('permits casting past zero mana and accrues void debt for the deficit', () => {
    player.mana = 4;
    expect(player.voidDebt).toBe(0);

    const action = new CastSpellAction(player, testSpell.id, 5, 8);
    const result = action.perform(engine);

    // Spell must NOT be rejected
    expect(result.success).toBe(true);
    expect(player.mana).toBe(0);
    // Deficit was 10 - 4 = 6
    expect(player.voidDebt).toBe(6);
  });

  it('triggers tiered overflow backlash based on total debt', () => {
    // Low deficit: Tier 1 (1 - 5)
    player.mana = 7; // deficit = 3
    player.voidDebt = 0;
    const res1 = ManaOverflowManager.evaluateOverflow(engine, player, 3);
    expect(res1.occurred).toBe(true);
    expect(res1.tier).toBe(1);
    expect(player.voidDebt).toBe(3);

    // Cumulative deficit: Tier 2 (6 - 15)
    const res2 = ManaOverflowManager.evaluateOverflow(engine, player, 5);
    expect(res2.occurred).toBe(true);
    expect(res2.tier).toBe(2);
    expect(player.voidDebt).toBe(8);

    // Cumulative deficit: Tier 3 (16+)
    const res3 = ManaOverflowManager.evaluateOverflow(engine, player, 10);
    expect(res3.occurred).toBe(true);
    expect(res3.tier).toBe(3);
    expect(player.voidDebt).toBe(18);
  });

  it('a negative tier shift makes a surge a tier milder, and the mildest none (Arch-Seiðkona)', () => {
    player.voidDebt = 0;
    const none = ManaOverflowManager.evaluateOverflow(engine, player, 3, { tierShift: -1 });
    expect(none.occurred).toBe(false);
    expect(player.voidDebt).toBe(3); // the debt is still owed
    const milder = ManaOverflowManager.evaluateOverflow(engine, player, 15, { tierShift: -1 });
    expect(milder.occurred).toBe(true);
    expect(milder.tier).toBe(2);
  });

  it('decays and clears void debt upon resting', () => {
    player.voidDebt = 5;
    player.decayVoidDebt(2);
    expect(player.voidDebt).toBe(3);

    player.clearVoidDebt();
    expect(player.voidDebt).toBe(0);
  });

  it('lingers indefinitely at Tier 3 threshold (16) when decaying in dungeon', () => {
    // Starting with Tier 3 primordial void scar (debt >= 16)
    player.voidDebt = 25;

    // Decay by 20 without allowing Tier 3 clearing (dungeon exploration/rest)
    player.decayVoidDebt(20, 16);
    // Should cap/floor at 16 (Tier 3 primordial scar)
    expect(player.voidDebt).toBe(16);

    // Minor debt (< 16) decays naturally to 0 even in dungeons
    player.voidDebt = 10;
    player.decayVoidDebt(10, 0);
    expect(player.voidDebt).toBe(0);
  });

  it('clears Tier 3 primordial scars when resting in town sanctuary', () => {
    player.voidDebt = 25;
    // Clearing Tier 3 is permitted (in Town / Floor 0)
    player.decayVoidDebt(25, 0);
    expect(player.voidDebt).toBe(0);
  });

  it('retains Tier 3 void debt when resting in dungeon, but purges in Town', () => {
    // 1. Rest in dungeon (Floor 1)
    engine.currentFloor = 1;
    player.hp = 20;
    player.mana = 0;
    player.voidDebt = 22;

    const dungeonRest = new RestAction(player);
    const res1 = dungeonRest.perform(engine);
    expect(res1.success).toBe(true);
    // Player recovers HP/Mana, but Tier 3 void debt lingers at floor 16
    expect(player.hp).toBe(player.maxHp);
    expect(player.mana).toBe(player.maxMana);
    expect(player.voidDebt).toBe(16);

    // 2. Rest in Town (Floor 0)
    engine.currentFloor = 0;
    player.hp = 20;
    player.mana = 0;

    const townRest = new RestAction(player);
    const res2 = townRest.perform(engine);
    expect(res2.success).toBe(true);
    // Entire void debt is cleansed in town sanctuary
    expect(player.voidDebt).toBe(0);
  });

  it('serializes and deserializes voidDebt accurately without data loss', () => {
    player.voidDebt = 14;
    const serialized = serializeGame(engine);
    const parsed = JSON.parse(JSON.stringify(serialized));
    const reloaded = deserializeGame(parsed);

    expect(reloaded.engine.player.voidDebt).toBe(14);
  });

  it('settles even a very large debt down to the Tier 3 scar on a full dungeon rest', () => {
    engine.currentFloor = 1;
    player.hp = 20;
    player.voidDebt = 250;
    new RestAction(player).perform(engine);
    expect(player.voidDebt).toBe(16);
  });

  it('keeps the hard mana wall for a pack that declares no overflow', () => {
    const wallEngine = new GameEngine({
      map: new GameMap(15, 15, TILES.FLOOR),
      player,
      manifest: { ...testManifest, magic: undefined } as any,
      seed: 1337,
    });
    player.mana = 4;
    const result = new CastSpellAction(player, testSpell.id, 5, 8).perform(wallEngine);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Not enough Mana');
    expect(player.mana).toBe(4);
    expect(player.voidDebt).toBe(0);
  });
});
