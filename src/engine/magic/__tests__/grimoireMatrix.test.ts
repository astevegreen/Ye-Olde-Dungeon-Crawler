import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { CastSpellAction, AttuneGrimoirePageAction } from '../../actions/spell-actions';
import { GrimoireMatrixManager, GRIMOIRE_ATTUNE_STATUS } from '../grimoireMatrix';
import { Monster } from '../../entities/monster';
import type { SpellDefinition } from '../types';
import { serializeGame, deserializeGame } from '../../storage/serializer';

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

  it('applies Nexus multi-element resonance to Midgard center slot (4)', () => {
    // Place fireRay in slot 4 (Midgard), and coldBurst in slot 1 (North)
    player.setGrimoireSlot(0, null);
    player.setGrimoireSlot(4, 'fire_ray');
    player.setGrimoireSlot(1, 'cold_burst');

    const nexusSpell = GrimoireMatrixManager.resolveEffectiveSpell(engine, player, 4);
    expect(nexusSpell).toBeDefined();
    // Nexus increases cost by +15% per active neighbor (10 * 1.15 = 12)
    expect(nexusSpell!.manaCost).toBe(12);
    expect(nexusSpell!.description).toContain('Runic Nexus');
  });

  it('sacrifices a spell at an altar to permanently infuse a glyph onto another spell', () => {
    player.learnSpell('blink_self');
    player.setGrimoireSlot(2, 'blink_self');

    // Sacrifice Blink (slot 2) into Fire Ray (slot 0)
    const res = GrimoireMatrixManager.sacrificeAndInfuse(player, 2, 0);
    expect(res.success).toBe(true);
    expect(res.glyph?.type).toBe('vanish_step');

    // Blink is permanently removed from known spells and grimoire
    expect(player.spellsKnown).not.toContain('blink_self');
    expect(player.grimoire[2].spellId).toBeNull();

    // Fire Ray bears the vanish_step glyph
    expect(player.grimoire[0].infusedGlyphs?.length).toBe(1);
    expect(player.grimoire[0].infusedGlyphs![0].type).toBe('vanish_step');
  });

  it('triggers vanish_step displacement when casting an infused spell from its slot', () => {
    player.learnSpell('blink_self');
    player.setGrimoireSlot(2, 'blink_self');
    GrimoireMatrixManager.sacrificeAndInfuse(player, 2, 0);

    const initialPos = { x: player.x, y: player.y }; // (5, 5)

    // Cast Fire Ray from slot 0 at target (5, 8) to the south
    const action = new CastSpellAction(player, 'fire_ray', 5, 8, undefined, false, false, 0);
    const res = action.perform(engine);
    expect(res.success).toBe(true);

    // Player should have phased backwards to the north (away from target at y=8)
    expect(player.y).toBeLessThan(initialPos.y);
  });

  it('serializes and deserializes the full 9-slot grimoire and infused glyphs', () => {
    player.learnSpell('blink_self');
    player.setGrimoireSlot(2, 'blink_self');
    GrimoireMatrixManager.sacrificeAndInfuse(player, 2, 0);

    const serialized = serializeGame(engine);
    const parsed = JSON.parse(JSON.stringify(serialized));
    const reloaded = deserializeGame(parsed);

    const reloadedPlayer = reloaded.engine.player;
    expect(reloadedPlayer.grimoire.length).toBe(9);
    expect(reloadedPlayer.grimoire[0].spellId).toBe('fire_ray');
    expect(reloadedPlayer.grimoire[0].infusedGlyphs?.length).toBe(1);
    expect(reloadedPlayer.grimoire[0].infusedGlyphs![0].type).toBe('vanish_step');
    expect(reloadedPlayer.grimoire[2].spellId).toBeNull();
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

  it('never carries a vanish_step caster through a wall', () => {
    player.learnSpell('blink_self');
    player.setGrimoireSlot(2, 'blink_self');
    GrimoireMatrixManager.sacrificeAndInfuse(player, 2, 0);
    engine.map.setTile(5, 4, TILES.WALL);

    new CastSpellAction(player, 'fire_ray', 5, 8, undefined, false, false, 0).perform(engine);
    expect({ x: player.x, y: player.y }).toEqual({ x: 5, y: 5 });
  });

  it('removes a sacrificed spell from every page and the quick-cast bar', () => {
    player.learnSpell('blink_self');
    player.setGrimoireSlot(2, 'blink_self');
    player.setGrimoireSlot(4, 'blink_self', 1);
    player.setQuickSpell(3, 'blink_self');

    GrimoireMatrixManager.sacrificeAndInfuse(player, 2, 0);

    expect(player.spellsKnown).not.toContain('blink_self');
    expect(player.grimoirePages[1].slots[4].spellId).toBeNull();
    expect(player.quickSpells[3]).toBeNull();
  });
});
