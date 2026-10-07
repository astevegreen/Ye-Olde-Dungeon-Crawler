import { describe, it, expect } from 'vitest';
import {
  cotwManifest,
  COTW_TILES,
  COTW_CHOICES,
  COTW_VAULTS,
  URDR_POOL_VAULT_ID,
  VERDANDI_LOOM_VAULT_ID,
  RATATOSKR_ROOST_VAULT_ID,
  SKULD_MIRROR_VAULT_ID,
} from '../index';
import { COTW_RENOWN_MILESTONES } from '../renown';
import {
  COTW_COMPANION_BARKS_HOOK,
  COTW_NORN_CHOICES_HOOK,
} from '../narrative';
import {
  GameMap,
  Player,
  Companion,
  TILES,
  setFlag,
  createWorldState,
  ExecuteChoiceAction,
  type EngineContext,
} from '../../../engine';
import { populateReturnedCaptives, RETURNED_CAPTIVE_POSITIONS } from '../hostageRitual';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { Monster } from '../../../engine/entities/monster';
import { createScaledItem } from '../../../engine/dungeon/lootSpawner';
import { PotionItem } from '../../../engine/items/consumables';
import { DrinkPotionAction } from '../../../engine/actions/spell-actions';

describe('Nornic Reliquaries & Mythic Encounters', () => {
  it('registers all 4 Nornic Reliquary tiles in COTW_TILES', () => {
    const expectedTiles = [
      { id: 'urdr_pool', handler: 'urdr_pool_choice' },
      { id: 'verdandi_loom', handler: 'verdandi_loom_choice' },
      { id: 'ratatoskr_perch', handler: 'ratatoskr_roost_choice' },
      { id: 'skuld_mirror', handler: 'skuld_mirror_choice' },
    ];

    for (const { id, handler } of expectedTiles) {
      const tile = COTW_TILES.find((t) => t.type === id);
      expect(tile, `Tile ${id} should be defined`).toBeDefined();
      expect(tile?.walkable).toBe(true);
      expect(tile?.passable).toBe(true);
      expect(tile?.interactionHandlerId).toBe(handler);
    }
  });

  it('declares vault blueprints and scripted placements for all 4 reliquaries', () => {
    const vaultIds = [
      URDR_POOL_VAULT_ID,
      VERDANDI_LOOM_VAULT_ID,
      RATATOSKR_ROOST_VAULT_ID,
      SKULD_MIRROR_VAULT_ID,
    ];

    for (const vId of vaultIds) {
      const v = COTW_VAULTS.find((vault) => vault.id === vId);
      expect(v, `Vault ${vId} should be in COTW_VAULTS`).toBeDefined();
      expect(v?.scriptedOnly, `Vault ${vId} should be scriptedOnly: true`).toBe(true);
    }

    const placements = cotwManifest.scriptedVaultPlacements ?? [];
    expect(placements.some((p) => p.vaultId === URDR_POOL_VAULT_ID && p.floor === 32)).toBe(true);
    expect(placements.some((p) => p.vaultId === VERDANDI_LOOM_VAULT_ID && p.floor === 39)).toBe(true);
    expect(placements.some((p) => p.vaultId === RATATOSKR_ROOST_VAULT_ID && p.floor === 42)).toBe(true);
    expect(placements.some((p) => p.vaultId === SKULD_MIRROR_VAULT_ID && p.floor === 49)).toBe(true);

    const fixedTiles = cotwManifest.fixedTilePlacements ?? [];
    expect(fixedTiles.some((p) => p.tileId === 'urdr_pool')).toBe(false);

    // A floor takes one scripted vault (dungeonArc's first match): a second on the same floor
    // never stamps. Urðr's Pool on floor 30 lost to the Bile-Sump that way.
    const floors = placements.map((p) => p.floor);
    expect(new Set(floors).size, `floors: ${floors.join(', ')}`).toBe(floors.length);
  });

  it('registers all reliquary renown milestones and provides tracked riddles', () => {
    const expectedMilestones = [
      { id: 'urdr_pool_blessing', renown: 15, flag: 'urdr_pool_resolved' },
      { id: 'verdandi_loom_insight', renown: 15, flag: 'verdandi_loom_resolved' },
      { id: 'ratatoskr_favor', renown: 10, flag: 'ratatoskr_roost_resolved' },
      { id: 'skuld_mirror_gazed', renown: 20, flag: 'skuld_mirror_resolved' },
    ];

    for (const { id, renown, flag } of expectedMilestones) {
      const def = COTW_RENOWN_MILESTONES.find((m) => m.id === id);
      expect(def, `Milestone ${id} should be in COTW_RENOWN_MILESTONES`).toBeDefined();
      expect(def?.category).toBe('exploration');
      expect(def?.renownValue).toBe(renown);

      const tracked = cotwManifest.trackedMilestones?.find((t) => t.flag === flag);
      expect(tracked, `Tracked milestone for ${flag} should exist`).toBeDefined();
      expect(tracked?.riddle).toBeDefined();
    }
  });

  it('defines valid choices and consequences for Urðr’s Pool', () => {
    const choice = COTW_CHOICES['urdr_pool_choice'];
    expect(choice).toBeDefined();
    expect(choice.options).toHaveLength(3);

    const heed = choice.options.find((o) => o.id === 'heed_fallen')!;
    expect(heed.predicate).toEqual({ type: 'hasFlag', flag: 'savior_of_jarnvidr' });
    expect(heed.consequences.some((c) => c.type === 'grantItem' && (c as any).itemId === 'urdr_cleansing_water')).toBe(true);
    expect(heed.consequences.some((c) => c.type === 'recordMilestone' && (c as any).milestoneId === 'urdr_pool_blessing')).toBe(true);

    const gaze = choice.options.find((o) => o.id === 'gaze_blood')!;
    expect(gaze.predicate).toEqual({ type: 'hasFlag', flag: 'blood_tainted_hero' });
    expect(gaze.consequences.some((c) => c.type === 'grantItem' && (c as any).itemId === 'draught_of_thawed_blood')).toBe(true);

    const drink = choice.options.find((o) => o.id === 'drink_deep')!;
    expect(drink.consequences.some((c) => c.type === 'learnSpell' && (c as any).spellId === 'clairvoyance')).toBe(true);
    expect(drink.consequences.some((c) => c.type === 'applyBuff' && (c as any).statusType === 'haste')).toBe(true);
  });

  it('defines valid choices and consequences for Verðandi’s Loom and spawns parasites upon sever_rot', () => {
    const choice = COTW_CHOICES['verdandi_loom_choice'];
    expect(choice).toBeDefined();
    expect(choice.options).toHaveLength(3);

    const bark = choice.options.find((o) => o.id === 'reinforce_bark')!;
    expect(bark.consequences.some((c) => c.type === 'grantItem' && (c as any).itemId === 'sap_sealed_cape')).toBe(true);

    const sever = choice.options.find((o) => o.id === 'sever_rot')!;
    expect(sever.consequences.some((c) => c.type === 'grantItem' && (c as any).itemId === 'heartwood_longsword')).toBe(true);
    // The parasites are real monsters from the hook, not a wake-up of the floor.
    expect(sever.consequences.some((c) => c.type === 'alertMonsters')).toBe(false);

    // Test parasite spawn hook execution
    const logs: string[] = [];
    const worldState = createWorldState();
    const player = new Player({ name: 'Sven', position: { x: 5, y: 5 } });
    const map = new GameMap(20, 20);
    // Fill room with walkable tiles
    for (let x = 0; x < 20; x++) {
      for (let y = 0; y < 20; y++) {
        map.setTile(x, y, TILES.FLOOR);
      }
    }
    const addedEntities: any[] = [];
    const ctx: EngineContext = {
      player,
      map,
      surfaces: null as any,
      worldState,
      rng: () => 0.42,
      log: (msg) => logs.push(msg),
      getWorldFlag: (f) => Boolean(worldState.flags[f]),
      setWorldFlag: (f, v) => setFlag(worldState, f, v),
      currentFloor: 39,
      removeEntity: () => true,
      addEntity: (e) => {
        addedEntities.push(e);
        return map.addEntity(e);
      },
      compendium: null as never,
    };

    const action = new ExecuteChoiceAction(player, choice, 'sever_rot');
    COTW_NORN_CHOICES_HOOK.execute({ action, actionType: 'executeChoice', actor: player, engine: ctx, result: { success: true, cost: 0 } });

    expect(addedEntities.length).toBe(2);
    expect(addedEntities.every((e) => e.definitionId === 'yggdrasil_parasite')).toBe(true);
    expect(addedEntities.every((e) => e.aiState === 'hunting')).toBe(true);
    // Scaled to floor 39, not a floor-1 35 HP.
    expect(addedEntities.every((e) => e.maxHp > 35)).toBe(true);
  });

  it('defines valid choices and consequences for Roost of Ratatoskr', () => {
    const choice = COTW_CHOICES['ratatoskr_roost_choice'];
    expect(choice).toBeDefined();

    const tribute = choice.options.find((o) => o.id === 'offer_tribute')!;
    expect(tribute.consequences.filter((c) => c.type === 'grantItem' && (c as any).itemId === 'scroll_teleport')).toHaveLength(2);
    expect(tribute.consequences.some((c) => c.type === 'recordMilestone' && (c as any).milestoneId === 'ratatoskr_favor')).toBe(true);
    expect(tribute.consequences.some((c) => c.type === 'setFlag' && (c as any).flag === 'ratatoskr_slander_mark')).toBe(true);

    const gossip = choice.options.find((o) => o.id === 'listen_gossip')!;
    expect(gossip.consequences.some((c) => c.type === 'recordMilestone' && (c as any).milestoneId === 'ratatoskr_favor')).toBe(true);
    expect(gossip.consequences.some((c) => c.type === 'setFlag' && (c as any).flag === 'ratatoskr_roost_resolved')).toBe(true);
  });

  it('defines valid choices and consequences for Skuld’s Mirror based on Víðnir prophecy', () => {
    const choice = COTW_CHOICES['skuld_mirror_choice'];
    expect(choice).toBeDefined();

    const renewal = choice.options.find((o) => o.id === 'gaze_renewal')!;
    expect(renewal.predicate).toEqual({ type: 'hasFlag', flag: 'vidnir_warning_heeded' });
    expect(renewal.consequences.some((c) => c.type === 'learnSpell' && (c as any).spellId === 'renewal')).toBe(true);

    const ragnarok = choice.options.find((o) => o.id === 'gaze_ragnarok')!;
    expect(ragnarok.predicate).toEqual({ type: 'hasFlag', flag: 'vidnir_warning_defied' });
    expect(ragnarok.consequences.some((c) => c.type === 'learnSpell' && (c as any).spellId === 'hel_fire')).toBe(true);

    const unbound = choice.options.find((o) => o.id === 'gaze_unbound')!;
    expect(unbound.consequences.some((c) => c.type === 'grantItem' && (c as any).itemId === 'supreme_health_potion')).toBe(true);
  });

  it('a savior finds the four captives freed on floor 22 home in Bjarnarhaven, as who they were', () => {
    const worldState = createWorldState();
    const player = new Player({ name: 'Sven', position: { x: 0, y: 0 } });
    const map = new GameMap(50, 50);
    const logs: string[] = [];
    const ctx: EngineContext = {
      player,
      map,
      surfaces: null as any,
      worldState,
      rng: () => 0.5,
      log: (m) => logs.push(m),
      getWorldFlag: (f) => Boolean(worldState.flags[f]),
      setWorldFlag: (f, v) => setFlag(worldState, f, v),
      currentFloor: 0,
      removeEntity: (e) => map.removeEntity(e),
      addEntity: (e) => map.addEntity(e),
      compendium: null as never,
    };

    populateReturnedCaptives(ctx);
    expect(map.getEntityById('npc-returned-1')).toBeNull();

    setFlag(worldState, 'savior_of_jarnvidr', true);
    populateReturnedCaptives(ctx);
    populateReturnedCaptives(ctx);

    // With no one taken in the raid, the captives were Ingrid, Torstein, Sigrid and Leif.
    const names = [1, 2, 3, 4].map((i) => map.getEntityById(`npc-returned-${i}`)?.name);
    expect(names).toEqual(['Ingrid of the Mill', 'Torstein the Cooper', 'Sigrid the Weaver', 'Young Leif']);
    RETURNED_CAPTIVE_POSITIONS.forEach((pos, i) => expect(map.getEntityById(`npc-returned-${i + 1}`)).toMatchObject(pos));
    expect(logs.filter((l) => l.includes('home from the Siphon Altar'))).toHaveLength(1);

    // Their talk follows the descent: seated again with the new line, never twice.
    setFlag(worldState, 'vidnir_slain', true);
    populateReturnedCaptives(ctx);
    expect((map.getEntityById('npc-returned-2') as any).dialogText).toContain('herald');
    expect(map.getAllEntities().filter((e) => e.id.startsWith('npc-returned-'))).toHaveLength(4);

    const broth = COTW_CHOICES['choice_returned_broth'];
    expect(broth.options[0].consequences.some((c) => c.type === 'grantItem' && (c as any).itemId === 'hearth_broth_flask')).toBe(true);
  });

  it('the returned captives stand on open town floor', () => {
    const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Home', { seed: 2 });
    engine.diagnostics.endPrologue?.();
    for (const pos of RETURNED_CAPTIVE_POSITIONS) expect(engine.map.isPassable(pos.x, pos.y), JSON.stringify(pos)).toBe(true);
  });

  it('each reliquary stands once on its floor, and floor 30 keeps Gloom-Tarr', () => {
    for (const [floor, tile] of [[32, 'urdr_pool'], [39, 'verdandi_loom'], [42, 'ratatoskr_perch'], [49, 'skuld_mirror']] as const) {
      for (let seed = 1; seed <= 3; seed++) {
        const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Norn', { seed });
        engine.changeFloor(floor);
        let n = 0;
        for (let y = 0; y < engine.map.height; y++) for (let x = 0; x < engine.map.width; x++) if (engine.map.getTile(x, y)?.type === tile) n++;
        expect(n, `floor ${floor} seed ${seed}`).toBe(1);
      }
    }
    const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Norn', { seed: 1 });
    engine.changeFloor(30);
    expect(engine.map.getAllEntities().some((e) => e instanceof Monster && e.definitionId === 'miniboss_tar_abomination')).toBe(true);
  }, 30_000);

  it('triggers contextual companion barks on floors 18, 32, 43, 47, and 50', () => {
    const logs: string[] = [];
    const worldState = createWorldState();
    const player = new Player({ name: 'Sven', position: { x: 5, y: 5 } });
    const map = new GameMap(30, 30);

    const companion = new Companion({
      id: 'companion-hearth_frost_hound-1',
      name: 'Frost-Ward Hound',
      position: { x: 5, y: 6 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
      speed: 100,
      companionDefinitionId: 'hearth_frost_hound',
      packWeightCapacity: 2000,
      packBulkCapacity: 3000,
    });
    map.addEntity(companion);

    let currentFloor = 18;
    const ctx: EngineContext = {
      player,
      map,
      surfaces: null as any,
      worldState,
      rng: () => 0.5,
      log: (msg) => logs.push(msg),
      getWorldFlag: (f) => Boolean(worldState.flags[f]),
      setWorldFlag: (f, v) => setFlag(worldState, f, v),
      get currentFloor() {
        return currentFloor;
      },
      removeEntity: () => true,
      addEntity: () => true,
      compendium: null as never,
    };

    // Floor 18 bark
    COTW_COMPANION_BARKS_HOOK.execute({ action: null as any, actionType: 'wait', actor: player, engine: ctx });
    expect(logs.some((l) => l.includes('Frost-Ward Hound bristles with cold defiance'))).toBe(true);
    expect(worldState.flags['bark_frost_hound_f18']).toBe(true);

    // Repeating does not duplicate
    const countAfterF18 = logs.length;
    COTW_COMPANION_BARKS_HOOK.execute({ action: null as any, actionType: 'wait', actor: player, engine: ctx });
    expect(logs.length).toBe(countAfterF18);

    // Urðr's Pool's floor (32)
    currentFloor = 32;
    COTW_COMPANION_BARKS_HOOK.execute({ action: null as any, actionType: 'wait', actor: player, engine: ctx });
    expect(logs.some((l) => l.includes('Urðr’s Pool'))).toBe(true);
    expect(worldState.flags['bark_frost_hound_urdr']).toBe(true);

    // Floor 50 bark (Níðhögg showdown)
    currentFloor = 50;
    COTW_COMPANION_BARKS_HOOK.execute({ action: null as any, actionType: 'wait', actor: player, engine: ctx });
    expect(logs.some((l) => l.includes('Níðhögg! A surge of courage steadies your grip!'))).toBe(true);
    expect(worldState.flags['bark_companion_f50']).toBe(true);
  });

  it('drinking Urðr’s Cleansing Water purges all afflictions and restores 100 HP', () => {
    const worldState = createWorldState();
    const player = new Player({ name: 'Sven', position: { x: 5, y: 5 } });
    player.maxHp = 150;
    player.hp = 30;
    player.statusManager.applyStatus({ type: 'poison', duration: 10 });
    player.statusManager.applyStatus({ type: 'slow', duration: 10 });
    player.statusManager.applyStatus({ type: 'paralysis', duration: 5 });

    const itemDef = cotwManifest.items?.find((i) => i.id === 'urdr_cleansing_water');
    expect(itemDef).toBeDefined();

    const potion = createScaledItem(itemDef!, 'test-urdr-water', 30, () => 0.5) as PotionItem;
    expect(potion).toBeInstanceOf(PotionItem);

    const engine: any = {
      player,
      map: new GameMap(10, 10),
      worldState,
      log: () => {},
      manifest: cotwManifest,
      identification: null,
    };
    const action = new DrinkPotionAction(player, potion);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(player.hp).toBe(130);
    expect(player.statusManager.hasStatus('poison')).toBe(false);
    expect(player.statusManager.hasStatus('slow')).toBe(false);
    expect(player.statusManager.hasStatus('paralysis')).toBe(false);
  });

  // The owner, 2026-10-05: keep the reliquaries, but what they give is not a stat boost.
  it('no Norn option changes a stat, and everything they give exists in the pack', () => {
    const itemIds = new Set(cotwManifest.items.map((i) => i.id));
    const spellIds = new Set(cotwManifest.spells.map((sp) => sp.id));
    for (const id of ['urdr_pool_choice', 'verdandi_loom_choice', 'ratatoskr_roost_choice', 'skuld_mirror_choice']) {
      for (const option of COTW_CHOICES[id].options) {
        for (const c of option.consequences) {
          expect(['modifyPermanentStat', 'modifyAttribute', 'grantPerk'], `${id}/${option.id}`).not.toContain(c.type);
          if (c.type === 'grantItem') expect(itemIds.has(c.itemId), c.itemId).toBe(true);
          if (c.type === 'learnSpell') expect(spellIds.has(c.spellId), c.spellId).toBe(true);
        }
      }
    }
  });
});
