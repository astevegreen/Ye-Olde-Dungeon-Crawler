import type { Action } from '../actions/action';
import type { GameEngine } from '../engine';
import type { GameContentManifest } from '../types/manifest';
import type { CharacterProfile, SaveData } from '../storage/types';
import type { Item, EquipmentSlot } from '../items/item';
import type { WandItem, ScrollItem, PotionItem } from '../items/consumables';
import type { Container } from '../items/container';
import { deserializeGame } from '../storage/serializer';
import { defaultMigrator } from '../storage/migrator';
import { classifyLoadError, type LoadOutcome } from '../storage/loadResult';
import { getItemById } from '../items/itemIndex';
import { MovementAction } from '../actions/movement';
import { WaitAction } from '../actions/wait';
import { ClimbStairsAction } from '../actions/stairs';
import { SearchAction } from '../actions/search';
import { RestAction } from '../actions/rest';
import { DisarmTrapAction } from '../actions/disarm';
import { OpenDoorAction, CloseDoorAction, SmartCloseDoorAction, BashDoorAction } from '../actions/door';
import {
  PickUpAction,
  DropAction,
  EquipAction,
  UnequipAction,
  QuickLootAction,
  LootFromContainerAction,
  StoreInContainerAction,
  LootAllFromContainerAction,
} from '../actions/inventory-actions';
import { MeleeAttackAction } from '../actions/combat';
import { RangedAttackAction } from '../actions/rangedAttack';
import { CastSpellAction, ZapWandAction, ReadScrollAction, DrinkPotionAction } from '../actions/spell-actions';
import { IdentifyAction } from '../actions/identificationActions';
import type { ReplayData, TrailEntry, TrailValue } from './types';

type Params = Record<string, TrailValue>;
type Builder = (engine: GameEngine, p: Params) => Action | null;

const num = (p: Params, k: string): number | undefined => (typeof p[k] === 'number' ? (p[k] as number) : undefined);
const str = (p: Params, k: string): string | undefined => (typeof p[k] === 'string' ? (p[k] as string) : undefined);
const bool = (p: Params, k: string): boolean => p[k] === true;
function item<T extends Item = Item>(p: Params, k: string): T | null {
  const id = str(p, k);
  return id ? ((getItemById(id) as T | undefined) ?? null) : null;
}

/**
 * How to rebuild each replayable player action from its trail entry (`describeAction`
 * output). An action missing here stops the replay: skipping it would desynchronize
 * everything after it.
 */
const BUILDERS: Record<string, Builder> = {
  MovementAction: (e, p) => new MovementAction(e.player, num(p, 'dx') ?? 0, num(p, 'dy') ?? 0),
  WaitAction: (e) => new WaitAction(e.player),
  ClimbStairsAction: (e) => new ClimbStairsAction(e.player),
  SearchAction: (e, p) => new SearchAction(e.player, e.rng, num(p, 'radius') ?? 2),
  RestAction: (e, p) => new RestAction(e.player, num(p, 'maxTicks') ?? 100),
  DisarmTrapAction: (e, p) => new DisarmTrapAction(e.player, num(p, 'targetX'), num(p, 'targetY')),
  OpenDoorAction: (e, p) => new OpenDoorAction(e.player, num(p, 'x') ?? 0, num(p, 'y') ?? 0),
  CloseDoorAction: (e, p) => new CloseDoorAction(e.player, num(p, 'x') ?? 0, num(p, 'y') ?? 0),
  BashDoorAction: (e, p) => new BashDoorAction(e.player, num(p, 'x') ?? 0, num(p, 'y') ?? 0),
  SmartCloseDoorAction: (e, p) => {
    const d = p.direction;
    const direction =
      d && typeof d === 'object' && typeof d.dx === 'number' && typeof d.dy === 'number' ? { dx: d.dx, dy: d.dy } : undefined;
    return new SmartCloseDoorAction(e.player, direction);
  },
  PickUpAction: (e, p) => new PickUpAction(e.player, str(p, 'itemId')),
  DropAction: (e, p) => {
    const it = item(p, 'itemId');
    const source = str(p, 'source') === 'paperdoll' ? 'paperdoll' : 'pack';
    return it ? new DropAction(e.player, it, source, str(p, 'slot') as EquipmentSlot | undefined) : null;
  },
  EquipAction: (e, p) => {
    const id = str(p, 'itemId');
    return id ? new EquipAction(e.player, id, str(p, 'targetSlot') as EquipmentSlot | undefined) : null;
  },
  UnequipAction: (e, p) => {
    const slot = str(p, 'slot');
    return slot ? new UnequipAction(e.player, slot as EquipmentSlot) : null;
  },
  QuickLootAction: (e) => new QuickLootAction(e.player),
  LootFromContainerAction: (e, p) => {
    const c = item<Container>(p, 'containerId');
    const it = item(p, 'itemId');
    return c && it ? new LootFromContainerAction(e.player, c, it) : null;
  },
  StoreInContainerAction: (e, p) => {
    const c = item<Container>(p, 'containerId');
    const it = item(p, 'itemId');
    return c && it ? new StoreInContainerAction(e.player, c, it) : null;
  },
  LootAllFromContainerAction: (e, p) => {
    const c = item<Container>(p, 'containerId');
    return c ? new LootAllFromContainerAction(e.player, c) : null;
  },
  MeleeAttackAction: (e, p) => {
    const id = str(p, 'defenderId');
    const defender = id ? e.map.getEntityById(id) : null;
    return defender ? new MeleeAttackAction(e.player, defender) : null;
  },
  RangedAttackAction: (e, p) =>
    new RangedAttackAction(e.player, num(p, 'targetX') ?? 0, num(p, 'targetY') ?? 0, item(p, 'weaponId') ?? undefined),
  CastSpellAction: (e, p) => {
    const spellId = str(p, 'spellId');
    return spellId
      ? new CastSpellAction(
          e.player,
          spellId,
          num(p, 'targetX') ?? e.player.x,
          num(p, 'targetY') ?? e.player.y,
          str(p, 'itemTargetId'),
          bool(p, 'freeCast'),
          bool(p, 'allowVitalityBurn')
        )
      : null;
  },
  ZapWandAction: (e, p) => {
    const wand = item<WandItem>(p, 'wandId');
    return wand ? new ZapWandAction(e.player, wand, num(p, 'targetX') ?? 0, num(p, 'targetY') ?? 0) : null;
  },
  ReadScrollAction: (e, p) => {
    const scroll = item<ScrollItem>(p, 'scrollId');
    return scroll
      ? new ReadScrollAction(e.player, scroll, num(p, 'targetX') ?? 0, num(p, 'targetY') ?? 0, str(p, 'itemTargetId'))
      : null;
  },
  DrinkPotionAction: (e, p) => {
    const potion = item<PotionItem>(p, 'potionId');
    return potion ? new DrinkPotionAction(e.player, potion) : null;
  },
  IdentifyAction: (e, p) => {
    const id = str(p, 'itemOrId') ?? str(p, 'itemOrIdId');
    return id ? new IdentifyAction(e.player, id) : null;
  },
};

/** Rebuilds a trail entry as an action for `engine`, or null if it can't be. */
export function rebuildAction(engine: GameEngine, entry: TrailEntry): Action | null {
  const build = BUILDERS[entry.action];
  return build ? build(engine, entry.params) : null;
}

export interface ReplayResult {
  replayed: number;
  total: number;
  /** Set when the replay stopped early; everything from this entry on was not replayed. */
  stoppedAt?: { seq: number; action: string; reason: string };
}

/**
 * Replays a trail through `handlePlayerAction`, in order. Stops at the first entry it
 * can't rebuild, since every later action would then run against the wrong state.
 */
export function replayActionTrail(engine: GameEngine, trail: readonly TrailEntry[]): ReplayResult {
  let replayed = 0;
  for (const entry of trail) {
    // Actions after the hero's death are recorded too; handlePlayerAction ignores them
    // in both the original run and this one, so they replay as no-ops.
    const action = rebuildAction(engine, entry);
    if (!action) {
      const reason = BUILDERS[entry.action]
        ? 'an item or entity it names no longer exists (the replay has diverged)'
        : 'no replay builder for this action type (add one in src/engine/debug/replay.ts)';
      return { replayed, total: trail.length, stoppedAt: { seq: entry.seq, action: entry.action, reason } };
    }
    engine.handlePlayerAction(action);
    replayed++;
  }
  return { replayed, total: trail.length };
}

export type ReplaySource = 'replay-checkpoint' | 'state-snapshot' | 'save';

export interface LoadedReplayState {
  engine: GameEngine;
  profile: CharacterProfile;
  source: ReplaySource;
  /** The actions to replay onto `engine`; empty unless `source` is `replay-checkpoint`. */
  trail: TrailEntry[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function isReplayData(value: unknown): value is ReplayData {
  const r = asRecord(value);
  return !!r && !!asRecord(r.checkpoint) && Array.isArray(r.trail) && !!asRecord(asRecord(r.checkpoint)?.save);
}

function isSaveLike(value: unknown): boolean {
  const r = asRecord(value);
  return !!r && !!asRecord(r.player) && !!asRecord(r.map);
}

/** Every JSON value in `text`: the whole text, or each ```json fenced block of a Markdown report. */
function parseCandidates(text: string): unknown[] {
  const trimmed = text.trim();
  try {
    return [JSON.parse(trimmed)];
  } catch {
    const out: unknown[] = [];
    for (const match of trimmed.matchAll(/```json\s*\n([\s\S]*?)\n```/g)) {
      try {
        out.push(JSON.parse(match[1]));
      } catch {
        // not JSON; keep looking
      }
    }
    return out;
  }
}

/** Finds the most replayable payload: replay data first, then a snapshot, then a save. */
function pickPayload(candidates: unknown[]): { source: ReplaySource; save: unknown; trail: TrailEntry[] } | null {
  for (const c of candidates) {
    const r = asRecord(c);
    const replay = isReplayData(c) ? c : isReplayData(asRecord(r?.reproduction)?.replay) ? (asRecord(r?.reproduction)?.replay as ReplayData) : null;
    if (replay) return { source: 'replay-checkpoint', save: replay.checkpoint.save, trail: replay.trail };
  }
  for (const c of candidates) {
    const snapshot = asRecord(c)?.stateSnapshot;
    if (isSaveLike(snapshot)) return { source: 'state-snapshot', save: snapshot, trail: [] };
  }
  for (const c of candidates) {
    const r = asRecord(c);
    if (isSaveLike(c) || (typeof r?.schemaVersion === 'number' && isSaveLike(r.data))) {
      return { source: 'save', save: c, trail: [] };
    }
  }
  return null;
}

/**
 * Loads the game a bug report describes, from a diagnostic package (.json), a copied
 * Markdown report, a bare replay block, or a save file. A replay checkpoint wins over
 * the report-time snapshot, since checkpoint + trail reproduces how the state was
 * reached. The caller replays `trail` (see `replayActionTrail`) if it wants to.
 */
export function loadReplayState(text: string, manifest?: GameContentManifest): LoadOutcome<LoadedReplayState> {
  const payload = pickPayload(parseCandidates(text));
  if (!payload) {
    return {
      ok: false,
      reason: 'corrupt',
      message: 'No replay data, state snapshot, or save was found in that text.',
    };
  }
  try {
    const envelope = asRecord(payload.save);
    const saveData =
      envelope && typeof envelope.schemaVersion === 'number' && envelope.data
        ? (defaultMigrator.migrate(JSON.stringify(envelope)).envelope.data as SaveData)
        : (payload.save as SaveData);
    const { engine, profile } = deserializeGame(saveData, manifest);
    return { ok: true, value: { engine, profile, source: payload.source, trail: payload.trail } };
  } catch (err) {
    return classifyLoadError(err);
  }
}
