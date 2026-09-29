import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { CastSpellAction } from '../../actions/spell-actions';
import { GrimoireMatrixManager } from '../grimoireMatrix';
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

  const testManifest = {
    id: 'test_pack',
    name: 'Test Pack',
    version: '1.0.0',
    description: 'Test pack description',
    dungeonFloors: 10,
    spells: [fireRay, coldBurst, blinkSelf],
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
});
