import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../../engine/engine';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { Player } from '../../../engine/entities/player';
import { NPC } from '../../../engine/entities/npc';
import { MovementAction } from '../../../engine/actions/movement';
import { evaluatePredicate } from '../../../engine/predicates/predicateEvaluator';
import { createWorldState, modifyFaction } from '../../../engine/state/worldState';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { serializeGame, deserializeGame } from '../../../engine/storage/serializer';
import { buildStanding } from '../../../ui/characterMenu/storyModel';
import { cotwManifest } from '../index';
import { ALTAR_MARKS } from '../hostageRitual';
import { IVALDA_ID } from '../ironClans';
import {
  GREAT_TAP_BROKEN_FLAG,
  ROT_DESERTER_ID,
  ROT_ELDER_ID,
  ROT_HOOKS,
  ROT_HUB_26_RESOLVED_FLAG,
  ROT_HUB_34_RESOLVED_FLAG,
  ROT_HUB_43_RESOLVED_FLAG,
  ROT_HUB_NPC_IDS,
  ROT_MARKS,
  ROT_MENDED_COUNTER,
  ROT_MENDED_ENDING,
  ROT_ROOT_WARDEN_ID,
  ROT_SAP_DRUNK_FLAG,
  ROT_TAPPED_COUNTER,
  ROT_TAPPED_ENDING,
  ROT_TAPPED_THRESHOLD,
  ROT_TRACKED_MILESTONES,
  SAP_TAPPERS_FACTION_ID,
  SAP_TAPPERS_MET_FLAG,
} from '../rot';

/** The milestones the pack tracked before Act II, in their order. */
const EARLIER_MILESTONES = [
  'relic_recovered',
  'nidhogg_slain',
  'tyr_purified',
  'oath_resolved',
  'nidhogg_root_sealed',
  'savior_of_jarnvidr',
  'blood_tainted_hero',
  'vidnir_slain',
  'dwarven_hearth_rested',
  'world_bark_hearth_rested',
  'urdr_pool_resolved',
  'verdandi_loom_resolved',
  'ratatoskr_roost_resolved',
  'skuld_mirror_resolved',
];

function engineOn(floor: number): { engine: GameEngine; map: GameMap } {
  const map = new GameMap(12, 12, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Sven', position: { x: 4, y: 5 }, stats: { hp: 40, maxHp: 40, attack: 10, defense: 5 } });
  const engine = new GameEngine({ map, player, floor, manifest: cotwManifest });
  return { engine, map };
}

/** Puts an NPC east of the hero, bumps it, and reports whether its talk ran. */
function bump(engine: GameEngine, map: GameMap, id: string): boolean {
  map.addEntity(new NPC({ id, name: 'Stranger', role: 'villager', position: { x: 5, y: 5 } }));
  let talked = false;
  engine.onNpcInteract = (npc) => {
    if (npc.id === id) talked = true;
  };
  engine.handlePlayerAction(new MovementAction(engine.player, 1, 0));
  const placed = map.getEntityById(id);
  if (placed) map.removeEntity(placed);
  return talked;
}

const sapTappersMet = (engine: GameEngine): boolean =>
  buildStanding(engine.worldState, cotwManifest).met.some((f) => f.id === SAP_TAPPERS_FACTION_ID);

describe('Act II scaffold: the Sap-tappers', () => {
  it('declares the faction with its met flag, starting at 0', () => {
    const faction = (cotwManifest.factions ?? []).find((f) => f.id === SAP_TAPPERS_FACTION_ID);
    expect(faction?.metFlag).toBe(SAP_TAPPERS_MET_FLAG);
    expect(SAP_TAPPERS_MET_FLAG).toBe('sap_tappers_met');
    expect(cotwManifest.initialWorldState?.factions?.[SAP_TAPPERS_FACTION_ID]).toBe(0);
  });

  it.each([ROT_DESERTER_ID, ROT_ROOT_WARDEN_ID, ROT_ELDER_ID])('meets them when the hero bumps hub NPC %s, and the talk goes ahead', (id) => {
    const { engine, map } = engineOn(26);
    expect(engine.getWorldFlag(SAP_TAPPERS_MET_FLAG)).toBe(false);
    expect(sapTappersMet(engine)).toBe(false);

    expect(bump(engine, map, id)).toBe(true);
    expect(engine.getWorldFlag(SAP_TAPPERS_MET_FLAG)).toBe(true);
    expect(sapTappersMet(engine)).toBe(true);
    expect(engine.player.x).toBe(4); // a bump, not a step
  });

  it('names exactly the three hub NPCs', () => {
    expect([...ROT_HUB_NPC_IDS]).toEqual([ROT_DESERTER_ID, ROT_ROOT_WARDEN_ID, ROT_ELDER_ID]);
    expect(new Set(ROT_HUB_NPC_IDS).size).toBe(3);
  });

  it('adds the standing at 0 to a save from before Act II', () => {
    const { engine, map } = engineOn(34);
    delete engine.worldState.factions[SAP_TAPPERS_FACTION_ID];
    expect(SAP_TAPPERS_FACTION_ID in engine.worldState.factions).toBe(false);

    bump(engine, map, ROT_ROOT_WARDEN_ID);
    expect(engine.worldState.factions[SAP_TAPPERS_FACTION_ID]).toBe(0);
    expect(engine.getWorldFlag(SAP_TAPPERS_MET_FLAG)).toBe(true);
  });

  it.each(['npc-gunther', IVALDA_ID])('is not met by bumping anyone else (%s)', (id) => {
    const { engine, map } = engineOn(0);
    bump(engine, map, id);
    expect(engine.getWorldFlag(SAP_TAPPERS_MET_FLAG)).toBe(false);
    expect(sapTappersMet(engine)).toBe(false);
  });

  it('keeps the standing and the met flag across a save', () => {
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine, profile } = pm.createCharacter('Tapper', { manifest: cotwManifest });
    modifyFaction(engine.worldState, SAP_TAPPERS_FACTION_ID, -5);
    engine.setWorldFlag(SAP_TAPPERS_MET_FLAG, true);

    const loaded = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine, profile))), cotwManifest).engine;
    expect(loaded.getFactionStanding(SAP_TAPPERS_FACTION_ID)).toBe(-5);
    expect(loaded.getWorldFlag(SAP_TAPPERS_MET_FLAG)).toBe(true);
  });
});

describe('Act II scaffold: the tally, the mark and the Story', () => {
  it('reads the ending as tapped from two tapped choices, mended below that, never both', () => {
    expect(ROT_TAPPED_THRESHOLD).toBe(2);
    for (const tapped of [0, 1, 2, 3]) {
      for (const mended of [0, 3]) {
        const ws = createWorldState();
        ws.counters[ROT_TAPPED_COUNTER] = tapped;
        ws.counters[ROT_MENDED_COUNTER] = mended;
        const isTapped = evaluatePredicate(ROT_TAPPED_ENDING, ws);
        const isMended = evaluatePredicate(ROT_MENDED_ENDING, ws);
        expect(isTapped, `tapped ${tapped}`).toBe(tapped >= 2);
        expect(isMended, `tapped ${tapped}`).toBe(tapped < 2);
        expect(isTapped && isMended).toBe(false);
      }
    }
    // A hero who skipped every hub reads "Mended".
    expect(evaluatePredicate(ROT_MENDED_ENDING, createWorldState())).toBe(true);
  });

  it('shows "Sap-drunk" exactly while the flag is set, beside the unchanged altar marks', () => {
    const marks = cotwManifest.heroMarks ?? [];
    expect(marks.slice(0, ALTAR_MARKS.length)).toEqual(ALTAR_MARKS);
    expect(marks.slice(ALTAR_MARKS.length)).toEqual(ROT_MARKS);
    expect(ROT_MARKS.map((m) => m.label)).toEqual(['Sap-drunk']);
    expect(ROT_MARKS[0].hudColor).toMatch(/^var\(--ui-[a-z-]+\)$/);
    expect(ROT_MARKS[0].detail).toBeTruthy();

    const shown = (ws: ReturnType<typeof createWorldState>): string[] =>
      marks.filter((m) => evaluatePredicate(m.when, ws)).map((m) => m.label);
    const ws = createWorldState();
    expect(shown(ws)).toEqual([]);
    ws.flags[ROT_SAP_DRUNK_FLAG] = true;
    expect(shown(ws)).toEqual(['Sap-drunk']);
    ws.flags[ROT_SAP_DRUNK_FLAG] = false;
    expect(shown(ws)).toEqual([]);
  });

  it('tracks four Act II milestones, each with a riddle, after every earlier one', () => {
    const milestones = cotwManifest.trackedMilestones ?? [];
    const flags = milestones.map((m) => m.flag);
    const rotFlags = [ROT_HUB_26_RESOLVED_FLAG, ROT_HUB_34_RESOLVED_FLAG, ROT_HUB_43_RESOLVED_FLAG, GREAT_TAP_BROKEN_FLAG];
    expect(rotFlags).toEqual(['rot_hub_26_resolved', 'rot_hub_34_resolved', 'rot_hub_43_resolved', 'great_tap_broken']);
    expect(ROT_TRACKED_MILESTONES.map((m) => m.flag)).toEqual(rotFlags);
    expect(flags.slice(-rotFlags.length)).toEqual(rotFlags);
    expect(flags.slice(0, -rotFlags.length)).toEqual(EARLIER_MILESTONES);
    for (const m of ROT_TRACKED_MILESTONES) {
      expect(m.label && m.description && m.icon && m.riddle, m.flag).toBeTruthy();
    }
  });

  it('runs the Act II hooks last', () => {
    const hooks = cotwManifest.actionHooks ?? [];
    expect(ROT_HOOKS.length).toBeGreaterThan(0);
    expect(hooks.slice(-ROT_HOOKS.length)).toEqual(ROT_HOOKS);
    hooks.slice(-ROT_HOOKS.length).forEach((h, i) => expect(h).toBe(ROT_HOOKS[i]));
  });
});
