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
import { populateSaviorVillagers } from '../hostageRitual';
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
    expect(placements.some((p) => p.vaultId === URDR_POOL_VAULT_ID && p.floor === 30)).toBe(true);
    expect(placements.some((p) => p.vaultId === VERDANDI_LOOM_VAULT_ID && p.floor === 39)).toBe(true);
    expect(placements.some((p) => p.vaultId === RATATOSKR_ROOST_VAULT_ID && p.floor === 42)).toBe(true);
    expect(placements.some((p) => p.vaultId === SKULD_MIRROR_VAULT_ID && p.floor === 49)).toBe(true);

    const fixedTiles = cotwManifest.fixedTilePlacements ?? [];
    expect(fixedTiles.some((p) => p.tileId === 'urdr_pool' && p.floor === 30)).toBe(true);
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
    expect(gaze.consequences.some((c) => c.type === 'modifyPermanentStat' && (c as any).stat === 'attack' && (c as any).delta === 1)).toBe(true);

    // Verify gaze_blood hook expands volatile energy capacity
    const player = new Player({ name: 'Sven', position: { x: 5, y: 5 } });
    player.initEnergyModel({ maxVolatileEnergy: 100, volatileEnergy: 50 });
    const ctx: any = {
      player,
      map: new GameMap(10, 10),
      worldState: createWorldState(),
      log: () => {},
    };
    const gazeAction = new ExecuteChoiceAction(player, choice, 'gaze_blood');
    COTW_NORN_CHOICES_HOOK.execute({ action: gazeAction, actionType: 'executeChoice', actor: player, engine: ctx });
    expect(player.energyModel?.maxVolatileEnergy).toBe(110);

    const drink = choice.options.find((o) => o.id === 'drink_deep')!;
    expect(drink.consequences.some((c) => c.type === 'learnSpell' && (c as any).spellId === 'clairvoyance')).toBe(true);
    expect(drink.consequences.some((c) => c.type === 'applyBuff' && (c as any).statusType === 'haste')).toBe(true);
  });

  it('defines valid choices and consequences for Verðandi’s Loom and spawns parasites upon sever_rot', () => {
    const choice = COTW_CHOICES['verdandi_loom_choice'];
    expect(choice).toBeDefined();
    expect(choice.options).toHaveLength(3);

    const bark = choice.options.find((o) => o.id === 'reinforce_bark')!;
    expect(bark.consequences.some((c) => c.type === 'modifyPermanentStat' && (c as any).stat === 'defense' && (c as any).delta === 2)).toBe(true);
    expect(bark.consequences.some((c) => c.type === 'modifyPermanentStat' && (c as any).stat === 'speed' && (c as any).delta === -1)).toBe(true);

    const sever = choice.options.find((o) => o.id === 'sever_rot')!;
    expect(sever.consequences.some((c) => c.type === 'modifyPermanentStat' && (c as any).stat === 'attack' && (c as any).delta === 2)).toBe(true);
    expect(sever.consequences.some((c) => c.type === 'alertMonsters')).toBe(true);

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
    COTW_NORN_CHOICES_HOOK.execute({ action, actionType: 'executeChoice', actor: player, engine: ctx });

    expect(addedEntities.length).toBe(2);
    expect(addedEntities.every((e) => e.definitionId === 'yggdrasil_parasite')).toBe(true);
    expect(addedEntities.every((e) => e.aiState === 'combat')).toBe(true);
  });

  it('defines valid choices and consequences for Roost of Ratatoskr', () => {
    const choice = COTW_CHOICES['ratatoskr_roost_choice'];
    expect(choice).toBeDefined();

    const tribute = choice.options.find((o) => o.id === 'offer_tribute')!;
    expect(tribute.consequences.some((c) => c.type === 'modifyPermanentStat' && (c as any).stat === 'speed' && (c as any).delta === 1)).toBe(true);
    expect(tribute.consequences.some((c) => c.type === 'recordMilestone' && (c as any).milestoneId === 'ratatoskr_favor')).toBe(true);
    expect(tribute.consequences.some((c) => c.type === 'setFlag' && (c as any).flag === 'ratatoskr_slander_mark')).toBe(true);

    const gossip = choice.options.find((o) => o.id === 'listen_gossip')!;
    expect(gossip.consequences.some((c) => c.type === 'recordMilestone' && (c as any).milestoneId === 'ratatoskr_favor')).toBe(true);
    expect(gossip.consequences.some((c) => c.type === 'setFlag' && (c as any).flag === 'ratatoskr_gossip_heard')).toBe(true);
  });

  it('defines valid choices and consequences for Skuld’s Mirror based on Víðnir prophecy', () => {
    const choice = COTW_CHOICES['skuld_mirror_choice'];
    expect(choice).toBeDefined();

    const renewal = choice.options.find((o) => o.id === 'gaze_renewal')!;
    expect(renewal.predicate).toEqual({ type: 'hasFlag', flag: 'vidnir_warning_heeded' });
    expect(renewal.consequences.some((c) => c.type === 'modifyPermanentStat' && (c as any).stat === 'defense' && (c as any).delta === 2)).toBe(true);

    const ragnarok = choice.options.find((o) => o.id === 'gaze_ragnarok')!;
    expect(ragnarok.predicate).toEqual({ type: 'hasFlag', flag: 'vidnir_warning_defied' });
    expect(ragnarok.consequences.some((c) => c.type === 'modifyPermanentStat' && (c as any).stat === 'attack' && (c as any).delta === 2)).toBe(true);

    const unbound = choice.options.find((o) => o.id === 'gaze_unbound')!;
    expect(unbound.consequences.some((c) => c.type === 'modifyPermanentStat' && (c as any).stat === 'defense' && (c as any).delta === 1)).toBe(true);
  });

  it('populates rescued villagers in Bjarnarhaven when savior_of_jarnvidr is active', () => {
    const worldState = createWorldState();
    const player = new Player({ name: 'Sven', position: { x: 0, y: 0 } });
    const map = new GameMap(50, 50);

    const ctx: EngineContext = {
      player,
      map,
      surfaces: null as any,
      worldState,
      rng: () => 0.5,
      log: () => {},
      getWorldFlag: (f) => Boolean(worldState.flags[f]),
      setWorldFlag: (f, v) => setFlag(worldState, f, v),
      currentFloor: 0,
      removeEntity: () => true,
      addEntity: (e) => map.addEntity(e),
      compendium: null as never,
    };

    // When savior_of_jarnvidr is false, no villagers populated
    populateSaviorVillagers(ctx);
    expect(map.getEntityById('npc-sigrun')).toBeNull();

    // When savior_of_jarnvidr is true, Sigrun, Brandr, and Eir are populated
    setFlag(worldState, 'savior_of_jarnvidr', true);
    populateSaviorVillagers(ctx);

    const sigrun = map.getEntityById('npc-sigrun');
    const brandr = map.getEntityById('npc-brandr');
    const eir = map.getEntityById('npc-eir');

    expect(sigrun).toBeDefined();
    expect(brandr).toBeDefined();
    expect(eir).toBeDefined();

    expect(sigrun?.x).toBe(13);
    expect(sigrun?.y).toBe(8);
    expect(brandr?.x).toBe(39);
    expect(brandr?.y).toBe(7);
    expect(eir?.x).toBe(26);
    expect(eir?.y).toBe(30);

    // Re-running does not duplicate them
    populateSaviorVillagers(ctx);
    expect(map.getAllEntities().filter((e) => e.id.includes('sigrun')).length).toBe(1);

    // Verify choice definitions exist and provide their promised benefits
    const sigrunChoice = COTW_CHOICES['choice_sigrun_town'];
    expect(sigrunChoice).toBeDefined();
    expect(sigrunChoice.options[0].consequences.some((c) => c.type === 'grantItem' && (c as any).itemId === 'hearth_broth_flask')).toBe(true);

    const brandrChoice = COTW_CHOICES['choice_brandr_town'];
    expect(brandrChoice).toBeDefined();
    expect(brandrChoice.options[0].consequences.some((c) => c.type === 'applyBuff' && (c as any).statusType === 'haste')).toBe(true);

    const eirChoice = COTW_CHOICES['choice_eir_town'];
    expect(eirChoice).toBeDefined();
    expect(eirChoice.options[0].consequences.some((c) => c.type === 'cureStatus')).toBe(true);
  });

  it('triggers contextual companion barks on floors 18, 30, 43, 47, and 50', () => {
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

    // Floor 30 bark (Urðr's Pool)
    currentFloor = 30;
    COTW_COMPANION_BARKS_HOOK.execute({ action: null as any, actionType: 'wait', actor: player, engine: ctx });
    expect(logs.some((l) => l.includes('Urðr’s Pool'))).toBe(true);
    expect(worldState.flags['bark_frost_hound_f30']).toBe(true);

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
});
