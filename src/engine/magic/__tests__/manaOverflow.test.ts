import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { CastSpellAction } from '../../actions/spell-actions';
import { ManaOverflowManager } from '../manaOverflow';
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
    const res1 = ManaOverflowManager.evaluateOverflow(engine, player, 3, testSpell);
    expect(res1.occurred).toBe(true);
    expect(res1.tier).toBe(1);
    expect(player.voidDebt).toBe(3);

    // Cumulative deficit: Tier 2 (6 - 15)
    const res2 = ManaOverflowManager.evaluateOverflow(engine, player, 5, testSpell);
    expect(res2.occurred).toBe(true);
    expect(res2.tier).toBe(2);
    expect(player.voidDebt).toBe(8);

    // Cumulative deficit: Tier 3 (16+)
    const res3 = ManaOverflowManager.evaluateOverflow(engine, player, 10, testSpell);
    expect(res3.occurred).toBe(true);
    expect(res3.tier).toBe(3);
    expect(player.voidDebt).toBe(18);
  });

  it('decays and clears void debt upon resting', () => {
    player.voidDebt = 5;
    player.decayVoidDebt(2);
    expect(player.voidDebt).toBe(3);

    player.clearVoidDebt();
    expect(player.voidDebt).toBe(0);
  });

  it('serializes and deserializes voidDebt accurately without data loss', () => {
    player.voidDebt = 14;
    const serialized = serializeGame(engine);
    const parsed = JSON.parse(JSON.stringify(serialized));
    const reloaded = deserializeGame(parsed);

    expect(reloaded.engine.player.voidDebt).toBe(14);
  });
});
