import { describe, it, expect } from 'vitest';
import { DungeonArc } from '../../../engine/quest/dungeonArc';
import { GameEngine } from '../../../engine/engine';
import { GameMap } from '../../../engine/grid/map';
import { Player } from '../../../engine/entities/player';
import { Monster } from '../../../engine/entities/monster';
import { cotwManifest } from '../index';
import { COTW_QUEST } from '../quest';
import {
  DWARVEN_HEARTH_FLOOR,
  DWARVEN_HEARTH_VAULT_ID,
  WORLD_BARK_FLOOR,
  WORLD_BARK_VAULT_ID,
} from '../vaults';
import { COTW_TILES } from '../tiles';
import { COTW_CHOICES } from '../choices';

const QUEST = { ...COTW_QUEST, maxFloor: 50, bossFloor: 50 };

describe('Campfire Grottos: Secluded Peaceful Sanctuaries', () => {
  it('defines thematic non-conspicuous entrance tiles with correct physical properties', () => {
    const cascadeVeil = COTW_TILES.find((t) => t.type === 'dwarven_cascade_veil');
    expect(cascadeVeil).toBeDefined();
    // Must be walkable to step through, but opaque (transparent: false) to hide the grotto from outside
    expect(cascadeVeil!.walkable).toBe(true);
    expect(cascadeVeil!.passable).toBe(true);
    expect(cascadeVeil!.transparent).toBe(false);

    const rootVeil = COTW_TILES.find((t) => t.type === 'root_curtain_veil');
    expect(rootVeil).toBeDefined();
    expect(rootVeil!.walkable).toBe(true);
    expect(rootVeil!.passable).toBe(true);
    expect(rootVeil!.transparent).toBe(false);

    // Verify vault blueprints are registered and marked scripted-only
    const dwarvenVault = cotwManifest.vaults?.find((v) => v.id === DWARVEN_HEARTH_VAULT_ID);
    expect(dwarvenVault).toBeDefined();
    expect(dwarvenVault!.scriptedOnly).toBe(true);

    const worldBarkVault = cotwManifest.vaults?.find((v) => v.id === WORLD_BARK_VAULT_ID);
    expect(worldBarkVault).toBeDefined();
    expect(worldBarkVault!.scriptedOnly).toBe(true);
  });

  it('defines calming environmental fixtures inside each grotto', () => {
    const dwarvenHearth = COTW_TILES.find((t) => t.type === 'grotto_hearth');
    expect(dwarvenHearth).toBeDefined();
    expect(dwarvenHearth!.interactionHandlerId).toBe('choice_dwarven_hearth');
    expect(dwarvenHearth!.landmarkLabel).toBe('Dwarven Hearth 🔥');

    const thermalSpring = COTW_TILES.find((t) => t.type === 'grotto_mineral_spring');
    expect(thermalSpring).toBeDefined();
    expect(thermalSpring!.interactionHandlerId).toBe('choice_dwarven_spring');

    const amberFire = COTW_TILES.find((t) => t.type === 'world_bark_campfire');
    expect(amberFire).toBeDefined();
    expect(amberFire!.interactionHandlerId).toBe('choice_world_bark_hearth');
    expect(amberFire!.landmarkLabel).toBe('Amber Hearth 🔥');

    const sapFont = COTW_TILES.find((t) => t.type === 'world_bark_sap_pool');
    expect(sapFont).toBeDefined();
    expect(sapFont!.interactionHandlerId).toBe('choice_world_bark_font');

    const mossBed = COTW_TILES.find((t) => t.type === 'world_bark_moss_bed');
    expect(mossBed).toBeDefined();
    expect(mossBed!.walkable).toBe(true);

    const chimes = COTW_TILES.find((t) => t.type === 'world_bark_chimes');
    expect(chimes).toBeDefined();
    expect(chimes!.walkable).toBe(true);
  });

  it('guarantees Act 1 Dwarven Hearth Grotto on Floor 13 across seeds', () => {
    const engine = new GameEngine({
      map: new GameMap(10, 10),
      player: new Player({ id: 'p', name: 'P', position: { x: 1, y: 1 } }),
      manifest: cotwManifest,
    });

    for (let seed = 1; seed <= 15; seed++) {
      const floorData = DungeonArc.generateFloor(
        DWARVEN_HEARTH_FLOOR,
        seed * 104729,
        QUEST,
        cotwManifest,
        1,
        undefined,
        engine.registries
      );

      let foundCascade = false;
      let foundHearth = false;
      let hearthPos = { x: 0, y: 0 };

      for (let y = 0; y < floorData.map.height; y++) {
        for (let x = 0; x < floorData.map.width; x++) {
          const t = floorData.map.getTile(x, y);
          if (t?.type === 'dwarven_cascade_veil') foundCascade = true;
          if (t?.type === 'grotto_hearth') {
            foundHearth = true;
            hearthPos = { x, y };
          }
        }
      }

      expect(foundCascade, `floor 13 seed ${seed} missing cascade veil entrance`).toBe(true);
      expect(foundHearth, `floor 13 seed ${seed} missing dwarven hearth`).toBe(true);

      // Sanctuary invariant: no monsters spawn inside the grotto vault
      const vaultBounds = {
        x1: hearthPos.x - 5,
        y1: hearthPos.y - 2,
        x2: hearthPos.x + 5,
        y2: hearthPos.y + 3,
      };

      const monstersInsideGrotto = floorData.map
        .getAllEntities()
        .filter(
          (e) =>
            e instanceof Monster &&
            e.x >= vaultBounds.x1 &&
            e.x <= vaultBounds.x2 &&
            e.y >= vaultBounds.y1 &&
            e.y <= vaultBounds.y2
        );
      expect(monstersInsideGrotto, `floor 13 seed ${seed} spawned monsters in peaceful grotto`).toHaveLength(0);

      // Player spawn and stairs are never placed inside the grotto
      expect(
        Math.hypot(floorData.playerSpawn.x - hearthPos.x, floorData.playerSpawn.y - hearthPos.y),
        `seed ${seed} spawned player inside the grotto`
      ).toBeGreaterThan(4);
    }
  });

  it('guarantees Act 2 Heartwood Knothole on Floor 37 across seeds', () => {
    const engine = new GameEngine({
      map: new GameMap(10, 10),
      player: new Player({ id: 'p', name: 'P', position: { x: 1, y: 1 } }),
      manifest: cotwManifest,
    });

    for (let seed = 1; seed <= 15; seed++) {
      const floorData = DungeonArc.generateFloor(
        WORLD_BARK_FLOOR,
        seed * 104729,
        QUEST,
        cotwManifest,
        1,
        undefined,
        engine.registries
      );

      let foundRootCurtain = false;
      let foundAmberCampfire = false;
      let campfirePos = { x: 0, y: 0 };

      for (let y = 0; y < floorData.map.height; y++) {
        for (let x = 0; x < floorData.map.width; x++) {
          const t = floorData.map.getTile(x, y);
          if (t?.type === 'root_curtain_veil') foundRootCurtain = true;
          if (t?.type === 'world_bark_campfire') {
            foundAmberCampfire = true;
            campfirePos = { x, y };
          }
        }
      }

      expect(foundRootCurtain, `floor 37 seed ${seed} missing root curtain entrance`).toBe(true);
      expect(foundAmberCampfire, `floor 37 seed ${seed} missing amber campfire`).toBe(true);

      // Sanctuary invariant: no monsters spawn inside the grotto vault
      const vaultBounds = {
        x1: campfirePos.x - 5,
        y1: campfirePos.y - 2,
        x2: campfirePos.x + 5,
        y2: campfirePos.y + 3,
      };

      const monstersInsideGrotto = floorData.map
        .getAllEntities()
        .filter(
          (e) =>
            e instanceof Monster &&
            e.x >= vaultBounds.x1 &&
            e.x <= vaultBounds.x2 &&
            e.y >= vaultBounds.y1 &&
            e.y <= vaultBounds.y2
        );
      expect(
        monstersInsideGrotto,
        `floor 37 seed ${seed} spawned monster inside peaceful grotto: ${JSON.stringify(monstersInsideGrotto.map(m => ({ x: m.x, y: m.y })))}`
      ).toHaveLength(0);

      // Player spawn is outside the grotto
      expect(
        Math.hypot(floorData.playerSpawn.x - campfirePos.x, floorData.playerSpawn.y - campfirePos.y),
        `seed ${seed} spawned player inside the grotto`
      ).toBeGreaterThan(4);
    }
  });

  it('provides immersive respite and lore choices without stat inflation', () => {
    const dwarvenHearthChoice = COTW_CHOICES.choice_dwarven_hearth;
    expect(dwarvenHearthChoice).toBeDefined();
    expect(dwarvenHearthChoice.cancelable).toBe(true);
    // Verify none of the options grant permanent combat stats (preserving anti-power-creep invariant)
    for (const opt of dwarvenHearthChoice.options) {
      const hasStatUpgrade = opt.consequences.some((c) => c.type === 'modifyPermanentStat');
      expect(hasStatUpgrade).toBe(false);
    }

    const worldBarkChoice = COTW_CHOICES.choice_world_bark_hearth;
    expect(worldBarkChoice).toBeDefined();
    expect(worldBarkChoice.cancelable).toBe(true);
    for (const opt of worldBarkChoice.options) {
      const hasStatUpgrade = opt.consequences.some((c) => c.type === 'modifyPermanentStat');
      expect(hasStatUpgrade).toBe(false);
    }
  });
});
