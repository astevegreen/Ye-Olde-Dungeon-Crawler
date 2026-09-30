import { describe, it, expect } from 'vitest';
import { cotwManifest, COTW_TILES, COTW_CHOICES } from '../index';
import { SKALDIC_RUNESTONE_PLACEMENTS, SKALDIC_RUNESTONE_TILES } from '../runestones';
import {
  VIDNIR_DEFEATED_TRIGGER,
  VIDNIR_REVELATION_CHOICE,
  COTW_ZONE_VIGNETTES_HOOK,
  COTW_TOWN_REACTIVE_HOOK,
  COTW_SVART_TAUNT_HOOK,
} from '../narrative';
import { GameMap, Monster, NPC, Player, setFlag, createWorldState } from '../../../engine';
import { COTW_DEEPEST_FLOOR_COUNTER } from '../spellTablets';

describe('CotW Narrative Progression & Skaldic Runestones', () => {
  it('registers all 6 skaldic runestone tiles in COTW_TILES', () => {
    for (const runeTile of SKALDIC_RUNESTONE_TILES) {
      const tile = COTW_TILES.find((t) => t.type === runeTile.type);
      expect(tile).toBeDefined();
      expect(tile?.passable).toBe(true);
      expect(tile?.walkable).toBe(true);
      expect(tile?.interactionHandlerId).toBe(runeTile.interactionHandlerId);
    }
  });

  it('declares 6 unique fixed tile placements for skaldic runestones', () => {
    const floors = SKALDIC_RUNESTONE_PLACEMENTS.map((p) => p.floor);
    expect(floors).toEqual([8, 14, 20, 28, 38, 48]);
    expect(new Set(floors).size).toBe(6);

    for (const placement of SKALDIC_RUNESTONE_PLACEMENTS) {
      expect(cotwManifest.fixedTilePlacements?.some((p) => p.tileId === placement.tileId)).toBe(true);
    }
  });

  it('provides a choice with a runic spell hint for every skaldic runestone', () => {
    for (const runeTile of SKALDIC_RUNESTONE_TILES) {
      const choiceId = runeTile.interactionHandlerId!;
      const choice = COTW_CHOICES[choiceId];
      expect(choice, `Choice for ${choiceId} should exist`).toBeDefined();
      expect(choice.options.length).toBeGreaterThanOrEqual(2);

      // Verify that every option commits a runic spell hint to the log
      for (const opt of choice.options) {
        const logConsequence = opt.consequences.find((c) => c.type === 'logMessage') as { message: string } | undefined;
        expect(logConsequence).toBeDefined();
        expect(logConsequence?.message).toContain('RUNIC SPELL HINT');
      }

      // Verify resolvedStates exists to prevent re-opening on revisit
      expect(choice.resolvedStates).toBeDefined();
      expect(choice.resolvedStates!.length).toBeGreaterThan(0);
    }
  });

  it('registers the Víðnir defeated trigger and reveals floor 50 stakes', () => {
    const trigger = cotwManifest.storyChoiceTriggers?.find((t) => t.id === VIDNIR_DEFEATED_TRIGGER.id);
    expect(trigger).toBeDefined();
    expect(trigger?.monsterDefinitionId).toBe('miniboss_maw_herald');
    expect(trigger?.killsRequired).toBe(1);

    const choice = COTW_CHOICES[VIDNIR_REVELATION_CHOICE.id];
    expect(choice).toBeDefined();
    expect(choice.title).toContain("The Herald's Dying Prophecy");

    // The choice must reveal both ending paths (Ragnarök vs sealing root)
    expect(choice.description).toContain('RAGNARÖK');
    expect(choice.description).toContain('Floor 50');
    expect(choice.description).toContain('DRIVE IT OFF');
    expect(choice.description).toContain('five turns');

    const heedOpt = choice.options.find((o) => o.id === 'heed_warning');
    const defyOpt = choice.options.find((o) => o.id === 'defy_warning');
    expect(heedOpt).toBeDefined();
    expect(defyOpt).toBeDefined();

    expect(heedOpt?.consequences.some((c) => c.type === 'setFlag' && c.flag === 'vidnir_slain')).toBe(true);
    expect(heedOpt?.consequences.some((c) => c.type === 'setFlag' && c.flag === 'vidnir_warning_heeded')).toBe(true);
    expect(defyOpt?.consequences.some((c) => c.type === 'setFlag' && c.flag === 'vidnir_warning_defied')).toBe(true);
  });

  it('tracks vidnir_slain and runestone milestones in manifest', () => {
    const milestones = cotwManifest.trackedMilestones ?? [];
    expect(milestones.some((m) => m.flag === 'vidnir_slain')).toBe(true);
    expect(milestones.some((m) => m.flag === 'skaldic_runestone_1_resolved')).toBe(true);
    expect(milestones.some((m) => m.flag === 'skaldic_runestone_4_resolved')).toBe(true);
  });

  it('logs zone threshold vignettes upon entering each zone', () => {
    const logs: string[] = [];
    const worldState = createWorldState();
    const player = new Player({ name: 'Sven', position: { x: 0, y: 0 } });
    const map = new GameMap(30, 30);

    const engineContext = {
      player,
      map,
      surfaces: null as any,
      worldState,
      rng: () => 0.5,
      log: (msg: string) => logs.push(msg),
      getWorldFlag: (f: string) => Boolean(worldState.flags[f]),
      setWorldFlag: (f: string, v: boolean) => {
        setFlag(worldState, f, v);
      },
      currentFloor: 1,
      removeEntity: () => true,
    };

    // Test floor 1 entry
    COTW_ZONE_VIGNETTES_HOOK.execute({ action: null as any, actionType: 'wait', actor: player, engine: engineContext });
    expect(logs.some((l) => l.includes('RIME HOLLOWS'))).toBe(true);
    expect(worldState.flags['cotw_vignette_f1']).toBe(true);

    // Re-executing on floor 1 does not duplicate log
    const prevCount = logs.length;
    COTW_ZONE_VIGNETTES_HOOK.execute({ action: null as any, actionType: 'wait', actor: player, engine: engineContext });
    expect(logs.length).toBe(prevCount);

    // Test floor 26 entry (Act 2 opening: Tarnished Silver)
    (engineContext as any).currentFloor = 26;
    COTW_ZONE_VIGNETTES_HOOK.execute({ action: null as any, actionType: 'wait', actor: player, engine: engineContext });
    expect(logs.some((l) => l.includes('TARNISHED SILVER VEINS'))).toBe(true);
    expect(worldState.flags['cotw_vignette_f26']).toBe(true);

    // Test floor 50 entry (The Heartwood)
    (engineContext as any).currentFloor = 50;
    COTW_ZONE_VIGNETTES_HOOK.execute({ action: null as any, actionType: 'wait', actor: player, engine: engineContext });
    expect(logs.some((l) => l.includes('THE HEARTWOOD'))).toBe(true);
    expect(worldState.flags['cotw_vignette_f50']).toBe(true);
  });

  it('updates town NPC greetings and dialogue dynamically in Bjarnarhaven', () => {
    const logs: string[] = [];
    const worldState = createWorldState();
    const player = new Player({ name: 'Sven', position: { x: 0, y: 0 } });
    const map = new GameMap(30, 30);

    const olaf = new NPC({
      id: 'npc-olaf',
      name: 'Olaf the Chandler',
      role: 'merchant',
      position: { x: 5, y: 5 },
      greeting: 'Initial greeting',
      dialogText: 'Initial dialog',
    });
    const mimir = new NPC({
      id: 'npc-sage',
      name: 'Sage Mimir',
      role: 'sage',
      position: { x: 6, y: 6 },
      greeting: 'Initial greeting',
      dialogText: 'Initial dialog',
    });
    map.addEntity(olaf);
    map.addEntity(mimir);

    const engineContext = {
      player,
      map,
      surfaces: null as any,
      worldState,
      rng: () => 0.5,
      log: (msg: string) => logs.push(msg),
      getWorldFlag: (f: string) => Boolean(worldState.flags[f]),
      setWorldFlag: (f: string, v: boolean) => {
        setFlag(worldState, f, v);
      },
      currentFloor: 0,
      removeEntity: () => true,
    };

    // Deepest floor 15 (Dwarven Works reached)
    worldState.counters[COTW_DEEPEST_FLOOR_COUNTER] = 15;
    COTW_TOWN_REACTIVE_HOOK.execute({ action: null as any, actionType: 'wait', actor: player, engine: engineContext });
    expect(olaf.greeting).toContain('Dwarven Works');

    // Sun recovered (Act 1 boss slain, deepest floor 26)
    setFlag(worldState, 'relic_recovered', true);
    worldState.counters[COTW_DEEPEST_FLOOR_COUNTER] = 26;
    COTW_TOWN_REACTIVE_HOOK.execute({ action: null as any, actionType: 'wait', actor: player, engine: engineContext });
    expect(logs.some((l) => l.includes('THE GREAT THAW'))).toBe(true);
    expect(mimir.dialogText).toContain('Níðhögg has awakened in the deep root');

    // Víðnir slain
    setFlag(worldState, 'vidnir_slain', true);
    worldState.counters[COTW_DEEPEST_FLOOR_COUNTER] = 45;
    COTW_TOWN_REACTIVE_HOOK.execute({ action: null as any, actionType: 'wait', actor: player, engine: engineContext });
    expect(olaf.greeting).toContain('You broke the Herald Víðnir');
    expect(mimir.dialogText).toContain('Slaying Níðhögg in fury will shatter the dying root');
  });
  it("has Víðnir taunt the hero once Svartr falls on floor 36, and not before", () => {
    const logs: string[] = [];
    const worldState = createWorldState();
    const player = new Player({ name: 'Sven', position: { x: 1, y: 1 } });
    const map = new GameMap(20, 20);
    const svartr = new Monster({
      id: 'svartr-1',
      name: 'Svartr, the Taproot Matriarch',
      definitionId: 'miniboss_rot_matriarch',
      position: { x: 5, y: 5 },
      stats: { hp: 180, maxHp: 180, attack: 22, defense: 10 },
    });
    map.addEntity(svartr);
    const engineContext = {
      player,
      map,
      surfaces: null as any,
      worldState,
      rng: () => 0.5,
      log: (msg: string) => logs.push(msg),
      getWorldFlag: (f: string) => Boolean(worldState.flags[f]),
      setWorldFlag: (f: string, v: boolean) => setFlag(worldState, f, v),
      currentFloor: 36,
      removeEntity: () => true,
    };
    const tick = () =>
      COTW_SVART_TAUNT_HOOK.execute({ action: null as any, actionType: 'wait', actor: player, engine: engineContext });

    tick();
    expect(logs.some((l) => l.includes('spectral silhouette'))).toBe(false);

    map.removeEntity(svartr);
    tick();
    expect(logs.filter((l) => l.includes('spectral silhouette'))).toHaveLength(1);

    tick();
    expect(logs.filter((l) => l.includes('spectral silhouette'))).toHaveLength(1);
  });
});
