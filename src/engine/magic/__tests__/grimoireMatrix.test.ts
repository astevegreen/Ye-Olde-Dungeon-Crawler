import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { CastSpellAction, AttuneGrimoirePageAction, ArrangeGrimoireSlotAction } from '../../actions/spell-actions';
import { describeAction } from '../../debug/actionTrail';
import { rebuildAction } from '../../debug/replay';
import { GrimoireMatrixManager, GRIMOIRE_ATTUNE_STATUS } from '../grimoireMatrix';
import { Monster } from '../../entities/monster';
import type { SpellDefinition } from '../types';
import { serializeGame, deserializeGame } from '../../storage/serializer';
import { COTW_MAGIC } from '../../../content/cotw/magic';

describe('Grimoire Spatial Matrix & Altar Sacrifice', () => {
  let engine: GameEngine;
  let player: Player;

  const fireRay: SpellDefinition = {
    id: 'fire_ray',
    name: 'Fire Ray',
    school: 'Combat',
    manaCost: 10,
    element: 'fire',
    range: 6,
    basePower: 20,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'ray',
    targetingMode: 'ray',
    description: 'A focused beam of fire.',
    effects: [{ type: 'damage', amount: 20, element: 'fire' }],
  };

  const coldBurst: SpellDefinition = {
    id: 'cold_burst',
    name: 'Cold Burst',
    school: 'Combat',
    manaCost: 12,
    element: 'cold',
    range: 5,
    basePower: 16,
    areaOfEffect: 1,
    reflects: false,
    targetType: 'tile',
    targetingMode: 'area_burst',
    description: 'A frosty detonation.',
    effects: [{ type: 'damage', amount: 16, element: 'cold' }],
  };

  const blinkSelf: SpellDefinition = {
    id: 'blink_self',
    name: 'Blink',
    school: 'Movement',
    manaCost: 8,
    element: 'arcane',
    range: 0,
    basePower: 0,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'self',
    targetingMode: 'self',
    description: 'Phase through space.',
    effects: [],
  };

  const fireLance: SpellDefinition = {
    id: 'fire_lance',
    name: 'Fire Lance',
    school: 'Combat',
    manaCost: 6,
    element: 'fire',
    range: 6,
    basePower: 20,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'ray',
    targetingMode: 'ray',
    description: 'A lance of flame.',
    effects: [{ type: 'damage', amount: 20, element: 'fire' }],
  };

  const testManifest = {
    id: 'test_pack',
    name: 'Test Pack',
    version: '1.0.0',
    description: 'Test pack description',
    dungeonFloors: 10,
    spells: [fireRay, coldBurst, blinkSelf, fireLance],
    monsters: [],
    items: [],
    magic: { grimoire: COTW_MAGIC.grimoire },
  };

  beforeEach(() => {
    const map = new GameMap(15, 15, TILES.FLOOR);
    player = new Player({
      position: { x: 5, y: 5 },
      mana: 50,
      maxMana: 50,
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 },
      spellsKnown: ['fire_ray', 'cold_burst'],
    });
    engine = new GameEngine({ map, player, manifest: testManifest as any, seed: 1337 });
  });

  it('initializes a 9-slot grimoire with starter spells in order', () => {
    expect(player.grimoire.length).toBe(9);
    expect(player.grimoire[0].spellId).toBe('fire_ray');
    expect(player.grimoire[1].spellId).toBe('cold_burst');
    expect(player.grimoire[2].spellId).toBeNull();
  });

  it('calculates correct orthogonal neighbors for corner, edge, and center', () => {
    // Corner [0,0] = index 0: neighbors are right (1) and down (3)
    expect(GrimoireMatrixManager.getOrthogonalNeighbors(0)).toEqual([3, 1]);

    // Edge [0,1] = index 1: neighbors are down (4), left (0), right (2)
    expect(GrimoireMatrixManager.getOrthogonalNeighbors(1)).toEqual([4, 0, 2]);

    // Center [1,1] = index 4 (Midgard): neighbors are up (1), down (7), left (3), right (5)
    expect(GrimoireMatrixManager.getOrthogonalNeighbors(4)).toEqual([1, 7, 3, 5]);
  });

  it('applies thermal shock and delivery synergies between adjacent spells', () => {
    // Slot 0: fireRay, Slot 1: coldBurst (adjacent)
    const effectiveFire = GrimoireMatrixManager.resolveEffectiveSpell(engine, player, 0);
    expect(effectiveFire).toBeDefined();

    // Fire Ray next to Cold Burst: gains Thermal Shock power bonus (20 * 1.25 = 25)
    expect(effectiveFire!.basePower).toBe(25);

    // Fire Ray (ray) next to Cold Burst (burst): gains +1 AoE
    expect(effectiveFire!.areaOfEffect).toBe(1);
  });

  it('counts each neighbor synergy once more for a hero holding grimoireSynergyRepeats (Galdr-Master)', () => {
    player.grantPerk({ id: 'galdr', name: 'Galdr', description: 'galdr', source: 'saga', effects: { grimoireSynergyRepeats: 1 } });
    const effectiveFire = GrimoireMatrixManager.resolveEffectiveSpell(engine, player, 0);
    // Opposed elements twice (20 × 1.25²), and the ray beside a burst bursts two wider.
    expect(effectiveFire!.basePower).toBe(31);
    expect(effectiveFire!.areaOfEffect).toBe(2);
    player.setGrimoireSlot(0, null);
    player.setGrimoireSlot(4, 'fire_ray');
    player.setGrimoireSlot(1, 'cold_burst');
    // The center's +20% a neighbor counts twice; its cost does not (10 × 1.15).
    const nexusSpell = GrimoireMatrixManager.resolveEffectiveSpell(engine, player, 4);
    expect(nexusSpell!.manaCost).toBe(12);
    expect(nexusSpell!.basePower).toBe(Math.round(Math.round(20 * 1.4) * 1.5625));
  });

  it('applies Nexus multi-element resonance to Midgard center slot (4)', () => {
    // Place fireRay in slot 4 (Midgard), and coldBurst in slot 1 (North)
    player.setGrimoireSlot(0, null);
    player.setGrimoireSlot(4, 'fire_ray');
    player.setGrimoireSlot(1, 'cold_burst');

    const nexusSpell = GrimoireMatrixManager.resolveEffectiveSpell(engine, player, 4);
    expect(nexusSpell).toBeDefined();
    // Nexus increases cost by +15% per active neighbor (10 * 1.15 = 12)
    expect(nexusSpell!.manaCost).toBe(12);
    // ...and power by +20% per neighbor; the cold neighbor is also opposed (20 * 1.2 * 1.25 = 30)
    expect(nexusSpell!.basePower).toBe(30);
    const detailed = GrimoireMatrixManager.resolveEffectiveSpellDetailed(engine, player, 4);
    expect(detailed!.notes.some((n) => n.includes('Midgard'))).toBe(true);
  });

  it('applies a glyph inscribed on a slot to the spell cast from it', () => {
    // Ansuz (+2 range) on slot 0
    player.grimoire[0].infusedGlyphs = [{ glyphId: 'ansuz', potency: 1, sourceName: 'test' }];
    const detailed = GrimoireMatrixManager.resolveEffectiveSpellDetailed(engine, player, 0);
    expect(detailed!.spell.range).toBe(8);
    expect(detailed!.notes.some((n) => n.includes('Ansuz'))).toBe(true);
  });

  it('adds a glyph rider only to damaging spells', () => {
    // Isa (slow rider) beside a self spell must not slow the caster
    player.learnSpell('blink_self');
    player.setGrimoireSlot(2, 'blink_self');
    player.grimoire[2].infusedGlyphs = [{ glyphId: 'isa', potency: 1, sourceName: 'test' }];
    const blink = GrimoireMatrixManager.resolveEffectiveSpell(engine, player, 2);
    expect(blink!.effects ?? []).toHaveLength(0);

    player.learnSpell('fire_lance');
    const slot = player.grimoire.findIndex((s) => s.spellId === 'fire_lance');
    player.grimoire[slot].infusedGlyphs = [{ glyphId: 'isa', potency: 1, sourceName: 'test' }];
    const lance = GrimoireMatrixManager.resolveEffectiveSpell(engine, player, slot);
    expect(lance!.effects!.some((e) => e.type === 'applyStatus')).toBe(true);
  });

  it('steps the caster back after casting from a retreat-glyph slot', () => {
    player.grimoire[0].infusedGlyphs = [{ glyphId: 'raido', potency: 1, sourceName: 'test' }];

    const initialPos = { x: player.x, y: player.y }; // (5, 5)

    // Cast Fire Ray from slot 0 at target (5, 8) to the south
    const action = new CastSpellAction(player, 'fire_ray', 5, 8, undefined, false, false, 0);
    const res = action.perform(engine);
    expect(res.success).toBe(true);

    // Player should have phased backwards to the north (away from target at y=8)
    expect(player.y).toBeLessThan(initialPos.y);
  });

  it('serializes and deserializes the full 9-slot grimoire, glyphs, seals and grounds', () => {
    player.grimoire[0].infusedGlyphs = [{ glyphId: 'raido', potency: 1, sourceName: 'Blink' }];
    player.grimoireOpenSlots = [0, 1, 3, 4, 5, 7];
    player.grimoireGrounds = { 0: 'fire' };

    const serialized = serializeGame(engine);
    const parsed = JSON.parse(JSON.stringify(serialized));
    const reloaded = deserializeGame(parsed);

    const reloadedPlayer = reloaded.engine.player;
    expect(reloadedPlayer.grimoire.length).toBe(9);
    expect(reloadedPlayer.grimoire[0].spellId).toBe('fire_ray');
    expect(reloadedPlayer.grimoire[0].infusedGlyphs?.length).toBe(1);
    expect(reloadedPlayer.grimoire[0].infusedGlyphs![0].glyphId).toBe('raido');
    expect(reloadedPlayer.grimoire[2].spellId).toBeNull();
    expect(reloadedPlayer.isGrimoireSlotOpen(2)).toBe(false);
    expect(reloadedPlayer.grimoireGrounds[0]).toBe('fire');
  });

  it('manages multiple grimoire pages independently', () => {
    expect(player.grimoirePages.length).toBe(3);
    expect(player.activeGrimoireIndex).toBe(0);
    expect(player.grimoire[0].spellId).toBe('fire_ray');

    // Switch to Page II (Máni)
    player.switchGrimoirePage(1);
    expect(player.activeGrimoireIndex).toBe(1);
    // Page II slots are initially null
    expect(player.grimoire[0].spellId).toBeNull();

    // Assign cold_burst to Page II slot 4 (nexus)
    player.setGrimoireSlot(4, 'cold_burst');
    expect(player.grimoire[4].spellId).toBe('cold_burst');

    // Switch back to Page I (Sol)
    player.switchGrimoirePage(0);
    expect(player.activeGrimoireIndex).toBe(0);
    expect(player.grimoire[0].spellId).toBe('fire_ray');
    expect(player.grimoire[4].spellId).toBeNull();

    // Verify Page II still retained cold_burst
    player.switchGrimoirePage(1);
    expect(player.grimoire[4].spellId).toBe('cold_burst');
  });

  it('swaps grimoire pages instantly when out of combat', () => {
    // In town / floor 0, or floor > 0 with no hostiles visible
    engine.currentFloor = 0;
    const action = new AttuneGrimoirePageAction(player, 1);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(result.cost).toBe(0);
    expect(player.activeGrimoireIndex).toBe(1);
  });

  it('initiates and channels 2-turn attunement when hostiles are in line-of-sight', () => {
    // Set dungeon floor > 0
    engine.currentFloor = 1;

    // Spawn a hostile monster in line of sight (player is at 5, 5)
    const hostile = new Monster({
      id: 'test_enemy',
      name: 'Test Enemy',
      position: { x: 5, y: 6 },
      stats: { hp: 20, maxHp: 20, attack: 5, defense: 0 },
      definitionId: 'test_enemy',
      faction: 'hostile',
    });
    engine.map.addEntity(hostile);
    engine.updateFov();

    expect(GrimoireMatrixManager.canSwitchPageInstantly(engine, player)).toBe(false);

    // Turn 1 of attunement channel
    const action1 = new AttuneGrimoirePageAction(player, 1);
    const res1 = action1.perform(engine);
    expect(res1.success).toBe(true);
    expect(res1.cost).toBe(100);
    expect(player.activeGrimoireIndex).toBe(0); // Not switched yet
    expect(player.statusManager.hasStatus(GRIMOIRE_ATTUNE_STATUS)).toBe(true);

    // Choosing the page again mid-channel sustains it (spends a turn) rather than finishing early
    const res2 = new AttuneGrimoirePageAction(player, 1).perform(engine);
    expect(res2.success).toBe(true);
    expect(res2.cost).toBe(100);
    expect(player.activeGrimoireIndex).toBe(0);

    // The status completes the ritual on its final tick
    player.statusManager.tick(player, engine);
    expect(player.activeGrimoireIndex).toBe(0);
    player.statusManager.tick(player, engine);
    expect(player.activeGrimoireIndex).toBe(1); // Switched to Page II
    expect(player.statusManager.hasStatus(GRIMOIRE_ATTUNE_STATUS)).toBe(false);
  });

  it('completes a channel on the page it targeted, not the first page', () => {
    engine.currentFloor = 1;
    const hostile = new Monster({
      id: 'test_enemy_3',
      name: 'Test Enemy 3',
      position: { x: 5, y: 6 },
      stats: { hp: 20, maxHp: 20, attack: 5, defense: 0 },
      definitionId: 'test_enemy_3',
      faction: 'hostile',
    });
    engine.map.addEntity(hostile);
    engine.updateFov();
    player.switchGrimoirePage(1);

    new AttuneGrimoirePageAction(player, 2).perform(engine);
    player.statusManager.tick(player, engine);
    player.statusManager.tick(player, engine);

    expect(player.activeGrimoireIndex).toBe(2);
    expect(player.statusManager.hasStatus(GRIMOIRE_ATTUNE_STATUS)).toBe(false);
  });

  it('interrupts channeled attunement when the player takes damage', () => {
    engine.currentFloor = 1;
    const hostile = new Monster({
      id: 'test_enemy_2',
      name: 'Test Enemy 2',
      position: { x: 5, y: 6 },
      stats: { hp: 20, maxHp: 20, attack: 5, defense: 0 },
      definitionId: 'test_enemy_2',
      faction: 'hostile',
    });
    engine.map.addEntity(hostile);
    engine.updateFov();

    // Start attunement
    const action = new AttuneGrimoirePageAction(player, 2);
    action.perform(engine);
    expect(player.statusManager.hasStatus(GRIMOIRE_ATTUNE_STATUS)).toBe(true);

    // Player takes damage mid-channel
    player.takeDamage(10);
    expect(player.hp).toBe(40);

    // The channel's next tick detects the damage and fizzles
    player.statusManager.tick(player, engine);
    expect(player.statusManager.hasStatus(GRIMOIRE_ATTUNE_STATUS)).toBe(false);
    player.statusManager.tick(player, engine);
    expect(player.activeGrimoireIndex).toBe(0); // Remains on page 0
  });

  it('serializes and deserializes multiple grimoire pages and active page index', () => {
    player.switchGrimoirePage(2); // Yggdrasil
    player.setGrimoireSlot(0, 'cold_burst');

    const serialized = serializeGame(engine);
    const parsed = JSON.parse(JSON.stringify(serialized));
    const reloaded = deserializeGame(parsed);

    const reloadedPlayer = reloaded.engine.player;
    expect(reloadedPlayer.activeGrimoireIndex).toBe(2);
    expect(reloadedPlayer.grimoirePages.length).toBe(3);
    expect(reloadedPlayer.grimoirePages[0].slots[0].spellId).toBe('fire_ray');
    expect(reloadedPlayer.grimoirePages[2].slots[0].spellId).toBe('cold_burst');
  });

  it('keeps one copy of a spell per page: placing it again moves it', () => {
    expect(player.grimoire[0].spellId).toBe('fire_ray');
    expect(player.setGrimoireSlot(4, 'fire_ray')).toBe(true);
    expect(player.grimoire.filter((s) => s.spellId === 'fire_ray').map((s) => s.slotIndex)).toEqual([4]);

    // Each page keeps its own copy.
    player.switchGrimoirePage(1);
    player.setGrimoireSlot(2, 'fire_ray');
    expect(player.grimoirePages[0].slots[4].spellId).toBe('fire_ray');
    expect(player.grimoirePages[1].slots[2].spellId).toBe('fire_ray');
  });

  it('loads a page holding copies as the one copy that casts', () => {
    // A save made before one-copy-per-page: the first slot holding a spell is the one that casts.
    player.grimoire[4].spellId = 'fire_ray';
    const reloaded = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine)))).engine.player;
    expect(reloaded.grimoirePages[0].slots.filter((s) => s.spellId === 'fire_ray').map((s) => s.slotIndex)).toEqual([0]);
  });

  it('rewrites a slot as a player action: free out of sight of foes, a turn with one in view', () => {
    const turn = engine.turnCount;
    const calm = engine.handlePlayerAction(new ArrangeGrimoireSlotAction(player, 4, 'fire_ray'));
    expect(calm).toMatchObject({ success: true, cost: 0 });
    expect(player.grimoire[4].spellId).toBe('fire_ray');
    expect(engine.turnCount).toBe(turn);

    engine.currentFloor = 1;
    engine.map.addEntity(
      new Monster({ id: 'watcher', name: 'Watcher', position: { x: 5, y: 7 }, stats: { hp: 20, maxHp: 20, attack: 1, defense: 0 }, faction: 'hostile' })
    );
    engine.updateFov();
    const tense = engine.handlePlayerAction(new ArrangeGrimoireSlotAction(player, 4, null));
    expect(tense).toMatchObject({ success: true, cost: 100 });
    expect(player.grimoire[4].spellId).toBeNull();
    expect(engine.turnCount).toBe(turn + 1);

    // A sealed slot or an unknown spell is refused, and costs nothing.
    player.grimoireOpenSlots = [0, 1, 4];
    expect(new ArrangeGrimoireSlotAction(player, 8, 'fire_ray').perform(engine)).toMatchObject({ success: false, cost: 0 });
    expect(new ArrangeGrimoireSlotAction(player, 4, 'no_such_spell').perform(engine)).toMatchObject({ success: false, cost: 0 });
  });

  it('records a grid edit in the replay trail and rebuilds it', () => {
    const entry = describeAction(new ArrangeGrimoireSlotAction(player, 4, 'cold_burst'));
    expect(entry).toEqual({ action: 'ArrangeGrimoireSlotAction', params: { slotIndex: 4, spellId: 'cold_burst' } });
    const rebuilt = rebuildAction(engine, { seq: 0, turn: 0, floor: 0, ...entry });
    expect(rebuilt).toBeInstanceOf(ArrangeGrimoireSlotAction);
    engine.handlePlayerAction(rebuilt!);
    expect(player.grimoire[4].spellId).toBe('cold_burst');

    const clear = describeAction(new ArrangeGrimoireSlotAction(player, 4, null));
    engine.handlePlayerAction(rebuildAction(engine, { seq: 1, turn: 0, floor: 0, ...clear })!);
    expect(player.grimoire[4].spellId).toBeNull();
  });

  it('resolves a cast for the HUD as CastSpellAction will: through its slot, else unmodified', () => {
    player.learnSpell('fire_lance');
    player.setGrimoireSlot(4, 'fire_ray');
    player.setGrimoireSlot(1, 'cold_burst');
    const ray = GrimoireMatrixManager.resolveCast(engine, player, 'fire_ray')!;
    expect(ray.spell.manaCost).toBe(12);
    expect(ray.notes.some((n) => n.includes('Midgard'))).toBe(true);

    for (const slot of player.grimoire) if (slot.spellId === 'fire_lance') player.setGrimoireSlot(slot.slotIndex, null);
    expect(GrimoireMatrixManager.resolveCast(engine, player, 'fire_lance')).toMatchObject({ spell: { manaCost: 6 }, notes: [] });
    expect(GrimoireMatrixManager.resolveCast(engine, player, 'no_such_spell')).toBeUndefined();
  });

  it('lists the neighboring slots whose spells shape each other, and why', () => {
    player.learnSpell('blink_self');
    player.setGrimoireSlot(2, 'blink_self');
    // fire_ray (0) beside cold_burst (1): opposed elements, and a ray beside a burst.
    expect(GrimoireMatrixManager.slotInteractions(engine, player)).toEqual([
      { a: 0, b: 1, reasons: ['fire beside cold: more power', 'a ray beside a burst bursts on impact'] },
    ]);

    // In the center, the fire ray draws on its neighbor too.
    player.setGrimoireSlot(4, 'fire_ray');
    const pairs = GrimoireMatrixManager.slotInteractions(engine, player);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ a: 1, b: 4 });
    expect(pairs[0].reasons[0]).toContain('Midgard');
    expect(pairs[0].reasons).toHaveLength(3);
  });

  it('applies grid synergies to a normal cast that names no slot', () => {
    // fire_lance auto-slots into slot 2, orthogonally next to cold_burst in slot 1
    player.learnSpell('fire_lance');
    expect(player.grimoire[2].spellId).toBe('fire_lance');

    const effective = GrimoireMatrixManager.resolveEffectiveSpell(engine, player, 2);
    expect(effective!.effects![0]).toMatchObject({ type: 'damage', amount: 25 });

    const target = new Monster({
      id: 'dummy',
      name: 'Dummy',
      position: { x: 5, y: 8 },
      stats: { hp: 100, maxHp: 100, attack: 0, defense: 0 },
      definitionId: 'dummy',
      faction: 'hostile',
    });
    engine.map.addEntity(target);

    // No slotIndex: the cast finds the spell's slot on the active page itself
    const res = new CastSpellAction(player, 'fire_lance', 5, 8).perform(engine);
    expect(res.success).toBe(true);
    expect(target.hp).toBe(75); // Thermal Shock: 20 * 1.25
  });

  it('says in the log how the grid shaped a cast, the first three times only', () => {
    player.learnSpell('fire_lance'); // slot 2, beside cold_burst in slot 1
    engine.map.addEntity(
      new Monster({ id: 'dummy', name: 'Dummy', position: { x: 5, y: 8 }, stats: { hp: 999, maxHp: 999, attack: 0, defense: 0 }, faction: 'hostile' })
    );
    const notes = () => engine.messages.filter((m) => m.startsWith('Your grimoire shapes the spell')).length;
    for (let i = 0; i < 5; i++) {
      player.mana = 50;
      expect(new CastSpellAction(player, 'fire_lance', 5, 8).perform(engine).success).toBe(true);
    }
    expect(notes()).toBe(3);
    expect(engine.messages.find((m) => m.startsWith('Your grimoire shapes the spell'))).toContain('Beside Cold Burst (cold)');

    // An unslotted spell says nothing.
    player.setGrimoireSlot(2, null);
    player.mana = 50;
    new CastSpellAction(player, 'fire_lance', 5, 8).perform(engine);
    expect(notes()).toBe(3);
  });

  it('never carries a retreating caster through a wall', () => {
    player.grimoire[0].infusedGlyphs = [{ glyphId: 'raido', potency: 1, sourceName: 'test' }];
    engine.map.setTile(5, 4, TILES.WALL);

    new CastSpellAction(player, 'fire_ray', 5, 8, undefined, false, false, 0).perform(engine);
    expect({ x: player.x, y: player.y }).toEqual({ x: 5, y: 5 });
  });

  it('forgets a spell from every page and the quick-cast bar', () => {
    player.learnSpell('blink_self');
    player.setGrimoireSlot(2, 'blink_self');
    player.setGrimoireSlot(4, 'blink_self', 1);
    player.setQuickSpell(3, 'blink_self');

    player.forgetSpell('blink_self');

    expect(player.spellsKnown).not.toContain('blink_self');
    expect(player.grimoirePages[1].slots[4].spellId).toBeNull();
    expect(player.quickSpells[3]).toBeNull();
  });

  it('keeps sealed slots out of the grid until they are opened', () => {
    const sealed = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 },
      spellsKnown: ['fire_ray', 'cold_burst'],
      grimoireOpenSlots: [1, 3, 4, 5, 7],
    });
    // Starting spells fill open slots in order, skipping the sealed corner 0
    expect(sealed.grimoire[0].spellId).toBeNull();
    expect(sealed.grimoire[1].spellId).toBe('fire_ray');
    expect(sealed.grimoire[3].spellId).toBe('cold_burst');
    expect(sealed.setGrimoireSlot(0, 'fire_ray')).toBe(false);

    expect(sealed.openGrimoireSlot(0, 'fire')).toBe(true);
    expect(sealed.setGrimoireSlot(0, 'fire_ray')).toBe(true);
    expect(sealed.grimoireGrounds[0]).toBe('fire');
  });

  it('grounds a matching spell in its grounded slot', () => {
    player.grimoireOpenSlots = [0, 1, 3, 4, 5, 7];
    player.grimoireGrounds = { 0: 'fire' };
    player.setGrimoireSlot(1, null); // no opposed-element neighbor
    const spell = GrimoireMatrixManager.resolveEffectiveSpell(engine, player, 0);
    expect(spell!.manaCost).toBe(9); // 10 - 1
    expect(spell!.basePower).toBe(22); // 20 * 1.1
  });
});
