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
    // Any of the altar's mark opens it, half or full.
    expect(gaze.predicate).toEqual({ type: 'minCounter', counter: 'hostages_sacrificed', value: 1 });
    expect(gaze.consequences.some((c) => c.type === 'grantItem' && (c as any).itemId === 'draught_of_thawed_blood')).toBe(true);

    const drink = choice.options.find((o) => o.id === 'drink_deep')!;
    expect(drink.consequences.some((c) => c.type === 'learnSpell' && (c as any).spellId === 'hlidskjalf' && (c as any).orGrantItem === 'essence_ansuz')).toBe(true);
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
    expect(renewal.consequences).toContainEqual({ type: 'offerForge', source: 'Skuld’s mirror', element: 'healing', fated: 'of Renewal' });

    const ragnarok = choice.options.find((o) => o.id === 'gaze_ragnarok')!;
    expect(ragnarok.predicate).toEqual({ type: 'hasFlag', flag: 'vidnir_warning_defied' });
    expect(ragnarok.consequences).toContainEqual({ type: 'offerForge', source: 'Skuld’s mirror', element: 'shadow', fated: 'of Hel-fire' });

    const unbound = choice.options.find((o) => o.id === 'gaze_unbound')!;
    expect(unbound.consequences.some((c) => c.type === 'grantItem' && (c as any).itemId === 'supreme_health_potion')).toBe(true);
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

  describe('Act II companion barks on floors 26, 30 and 34', () => {
    const COMPANIONS = [
      { defId: 'hearth_frost_hound', name: 'Frost-Ward Hound', flag: 'frost_hound' },
      { defId: 'ember_fang_wolf', name: 'Ember-Fang Wolf', flag: 'ember_wolf' },
    ] as const;
    const ACT_II_FLOORS = [26, 30, 34] as const;

    /** A hero on `floor`, with the companion beside them (hp 0 for a dead one) or alone. */
    function barkWorld(companion?: { defId: string; name: string; hp: number }) {
      const logs: string[] = [];
      const worldState = createWorldState();
      const player = new Player({ name: 'Sven', position: { x: 5, y: 5 } });
      const map = new GameMap(30, 30);
      if (companion) {
        map.addEntity(
          new Companion({
            id: `companion-${companion.defId}-1`,
            name: companion.name,
            position: { x: 5, y: 6 },
            stats: { hp: companion.hp, maxHp: 50, attack: 10, defense: 5 },
            speed: 100,
            companionDefinitionId: companion.defId,
            packWeightCapacity: 2000,
            packBulkCapacity: 3000,
          })
        );
      }
      const state = { floor: 0 };
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
          return state.floor;
        },
        removeEntity: () => true,
        addEntity: () => true,
        compendium: null as never,
      };
      const act = (floor: number) => {
        state.floor = floor;
        COTW_COMPANION_BARKS_HOOK.execute({ action: null as any, actionType: 'wait', actor: player, engine: ctx });
      };
      const barkFlags = () => Object.keys(worldState.flags).filter((f) => f.startsWith('bark_'));
      return { logs, worldState, act, barkFlags };
    }

    for (const c of COMPANIONS) {
      it(`the ${c.name} says one line on each of floors 26, 30 and 34, once per run`, () => {
        const w = barkWorld({ ...c, hp: 50 });
        for (const floor of ACT_II_FLOORS) {
          const before = w.logs.length;
          w.act(floor);
          expect(w.logs.length, `floor ${floor}`).toBe(before + 1);
          expect(w.logs.at(-1), `floor ${floor}`).toContain(c.name);
          expect(w.worldState.flags[`bark_${c.flag}_f${floor}`], `floor ${floor}`).toBe(true);

          w.act(floor);
          expect(w.logs.length, `floor ${floor}, second action`).toBe(before + 1);
        }
      });

      it(`the ${c.name} stays silent on floor 27`, () => {
        const w = barkWorld({ ...c, hp: 50 });
        w.act(27);
        expect(w.logs).toEqual([]);
        expect(w.barkFlags()).toEqual([]);
      });

      it(`a dead ${c.name} says nothing on floors 26, 30 and 34`, () => {
        const w = barkWorld({ ...c, hp: 0 });
        for (const floor of ACT_II_FLOORS) w.act(floor);
        expect(w.logs).toEqual([]);
        expect(w.barkFlags()).toEqual([]);
      });
    }

    it('a hero with no companion hears nothing on floors 26, 30 and 34', () => {
      const w = barkWorld();
      for (const floor of ACT_II_FLOORS) w.act(floor);
      expect(w.logs).toEqual([]);
      expect(w.barkFlags()).toEqual([]);
    });

    it('the six lines are distinct, new, and name no hub, tally or unmet choice', () => {
      const actII: string[] = [];
      const older: string[] = [];
      for (const c of COMPANIONS) {
        const w = barkWorld({ ...c, hp: 50 });
        for (const floor of ACT_II_FLOORS) w.act(floor);
        actII.push(...w.logs);
        // Every existing bark, the altar's half and full marks at Náströnd and the Heartwood included.
        for (const sacrificed of [0, 2, 4]) {
          const o = barkWorld({ ...c, hp: 50 });
          o.worldState.counters['hostages_sacrificed'] = sacrificed;
          for (const floor of [18, 32, 43, 47, 50]) o.act(floor);
          older.push(...o.logs);
        }
      }
      expect(actII).toHaveLength(6);
      expect(new Set(actII).size).toBe(6);
      for (const line of actII) {
        expect(older, line).not.toContain(line);
        expect(line).not.toMatch(/rot_tapped|rot_mended|tapper|deserter|warden|elder|Great Tap|flask|oath|sworn|safe-conduct/i);
      }
    });
  });

  it('the companion reacts to the altar’s mark at Náströnd and the Heartwood', () => {
    const logs: string[] = [];
    const worldState = createWorldState();
    worldState.counters['hostages_sacrificed'] = 4;
    const player = new Player({ name: 'Sven', position: { x: 5, y: 5 } });
    const map = new GameMap(30, 30);
    map.addEntity(
      new Companion({
        id: 'companion-ember_fang_wolf-1',
        name: 'Ember-Fang Wolf',
        position: { x: 5, y: 6 },
        stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
        speed: 100,
        companionDefinitionId: 'ember_fang_wolf',
        packWeightCapacity: 2000,
        packBulkCapacity: 3000,
      })
    );
    let currentFloor = 43;
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

    COTW_COMPANION_BARKS_HOOK.execute({ action: null as any, actionType: 'wait', actor: player, engine: ctx });
    currentFloor = 50;
    COTW_COMPANION_BARKS_HOOK.execute({ action: null as any, actionType: 'wait', actor: player, engine: ctx });

    expect(logs).toEqual([
      expect.stringContaining('then turns and breathes yours'),
      expect.stringContaining('but it will not look at you'),
    ]);
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
    let given = 0;
    for (const id of ['urdr_pool_choice', 'verdandi_loom_choice', 'ratatoskr_roost_choice', 'skuld_mirror_choice']) {
      for (const option of COTW_CHOICES[id].options) {
        for (const c of option.consequences) {
          expect(['modifyPermanentStat', 'modifyAttribute', 'grantPerk'], `${id}/${option.id}`).not.toContain(c.type);
          if (c.type === 'grantItem') expect(itemIds.has(c.itemId), c.itemId).toBe(true);
          if (c.type === 'learnSpell') expect(spellIds.has(c.spellId), c.spellId).toBe(true);
          if (c.type === 'grantItem' || c.type === 'learnSpell') given++;
        }
      }
    }
    expect(given).toBeGreaterThan(0);
  });
});
