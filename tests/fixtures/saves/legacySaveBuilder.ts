import { cotwManifest } from '../../../src/content/cotw';
import { GameEngine } from '../../../src/engine/engine';
import { Player } from '../../../src/engine/entities/player';
import { GameMap } from '../../../src/engine/grid/map';
import { TILES } from '../../../src/engine/grid/tile';
import { EnergyModel } from '../../../src/engine/actors/energyModel';
import { GRIMOIRE_ATTUNE_STATUS } from '../../../src/engine/magic/grimoireMatrix';
import { serializeGame } from '../../../src/engine/storage/serializer';
import type { SaveData } from '../../../src/engine/storage/types';

/*
 * Stages the cotw grimoire as it stood before the three-grimoire redesign (the magic plan's
 * session 1a-1) and serializes it, once, into `tests/fixtures/saves/*.json`
 * (`CAPTURE_LEGACY_SAVES=1 npx vitest run src/engine/storage/__tests__/legacySaveFixtures.test.ts`).
 * The JSON is the fixture; this builder only made it, and goes when the old grimoire does.
 */

const STARTERS = ['magic_arrow', 'heal_minor'];

function stage(spellsKnown: string[], floor = 8): { engine: GameEngine; player: Player } {
  const map = new GameMap(12, 12, TILES.FLOOR);
  const player = new Player({
    id: 'legacy-hero',
    name: 'Legacy',
    position: { x: 5, y: 5 },
    intelligence: 14,
    spellsKnown,
    grimoireOpenSlots: cotwManifest.magic?.grimoire?.initialOpenSlots,
  });
  const engine = new GameEngine({ map, player, floor, manifest: cotwManifest });
  return { engine, player };
}

function save(engine: GameEngine): SaveData {
  return serializeGame(engine, {
    id: engine.player.id,
    name: engine.player.name,
    level: engine.player.level,
    floor: engine.currentFloor,
    lastSaved: 0,
    hp: engine.player.hp,
    maxHp: engine.player.maxHp,
    strength: engine.player.strength,
    mana: engine.player.mana,
    maxMana: engine.player.maxMana,
  });
}

export const LEGACY_SAVE_CASES: Record<string, () => SaveData> = {
  /** Kenaz on one slot, and Isa doubled by Loki's Cairn (potency 2) on the centre. */
  'glyphs-two-slots-one-doubled': () => {
    const { engine, player } = stage([...STARTERS, 'firebolt']);
    player.setGrimoireSlot(4, 'firebolt');
    player.grimoire[1].infusedGlyphs = [{ glyphId: 'kenaz', potency: 1, sourceName: 'Fire Essence' }];
    player.grimoire[4].infusedGlyphs = [{ glyphId: 'isa', potency: 2, sourceName: 'Cold Essence' }];
    return save(engine);
  },
  /** A sealed corner opened at Hel's altar, grounded in fire, holding Firebolt. */
  'grounded-slot': () => {
    const { engine, player } = stage([...STARTERS, 'firebolt']);
    player.openGrimoireSlot(0, 'fire');
    player.setGrimoireSlot(0, 'firebolt');
    return save(engine);
  },
  /** The second page active, with a spell written on it. */
  'page-two-active': () => {
    const { engine, player } = stage([...STARTERS, 'cold_ray']);
    player.setGrimoireSlot(4, 'cold_ray', 1);
    player.switchGrimoirePage(1);
    return save(engine);
  },
  /** Steam Lance forged at Odin's altar from Cold Ray, which the forge consumed. */
  'hybrid-steam-lance': () => {
    const { engine, player } = stage([...STARTERS, 'cold_ray']);
    player.forgetSpell('cold_ray');
    player.learnSpell('steam_lance');
    return save(engine);
  },
  /** Every Siphon Altar spell, Volatile Energy banked, and corruption 30. */
  'blood-spells-volatile-corruption': () => {
    const { engine, player } = stage([...STARTERS, 'blood_reap', 'blood_tap', 'crimson_ward', 'blood_spear', 'exsanguinate'], 22);
    player.energyModel = new EnergyModel({ volatileEnergy: 18, maxVolatileEnergy: 50 });
    player.energyModel.vitalityTenderBurned = 4;
    player.corruptionScore = 30;
    return save(engine);
  },
  /** Detect Monsters and Teleportation, both retired as learnable spells by the redesign. */
  'detect-and-teleport': () => {
    const { engine } = stage([...STARTERS, 'detect_monsters', 'teleport']);
    return save(engine);
  },
  /** The kobold's kill rite performed, so its Bestiary entry records it. */
  'kill-rite-performed': () => {
    const { engine } = stage([...STARTERS, 'firebolt'], 4);
    engine.compendium.recordKill('kobold', 'Kobold');
    engine.compendium.recordKillRite('kobold');
    return save(engine);
  },
  /** Mid-way through the 2-turn channel to the second page. */
  'attunement-channel': () => {
    const { engine, player } = stage([...STARTERS, 'cold_ray']);
    player.setGrimoireSlot(4, 'cold_ray', 1);
    player.statusManager.applyStatus(
      { type: GRIMOIRE_ATTUNE_STATUS, duration: 2, potency: 1, sourceEntityId: player.id, data: { targetPageIndex: 1, lastHp: player.hp } },
      player.statusImmunities,
      player,
      engine
    );
    return save(engine);
  },
};
