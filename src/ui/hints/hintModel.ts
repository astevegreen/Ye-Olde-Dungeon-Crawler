import {
  Monster,
  findRuneOfReturn,
  getKillRiteConfig,
  isPrologueRunning,
  getMonsterDefinition,
  getRenownTotal,
  learningStoneMarks,
  type BuiltInFirstTimeHintId,
  type FirstTimeHintDefinition,
  type FirstTimeHintTrigger,
  type GameEngine,
  type GameEvent,
} from '../../engine';
import { buildSaga } from '../characterMenu/storyModel';

/** The `Player.tutorialFlags` key that records a hint as shown. */
export function hintFlag(id: string): string {
  return `hint:${id}`;
}

/**
 * The systems the hero has come upon, judged from the game's state after a turn: a
 * companion at their side, renown earned, a Rune of Return carried, a faction standing
 * moved from where it began, a saga deed done, a creature with a kill rite in sight, an
 * unidentified item carried (worn containers included), the floor's shard carrier asleep in
 * sight, a spell offered while every grimoire slot was full.
 */
export function hintsMetByState(engine: GameEngine): BuiltInFirstTimeHintId[] {
  const met: BuiltInFirstTimeHintId[] = [];
  const p = engine.player;
  if (engine.companion?.isAlive()) met.push('companion');
  if (getRenownTotal(engine) > 0) met.push('renown');
  if (p.hasDiscoveredRune || findRuneOfReturn(p)) met.push('runeOfReturn');

  const start = engine.manifest.initialWorldState?.factions ?? {};
  const now = engine.worldState.factions ?? {};
  if (Object.entries(now).some(([id, value]) => value !== (start[id] ?? 0))) met.push('factionStanding');

  if (buildSaga(engine).achieved.length > 0) met.push('story');

  if (p.inventory?.getAllCarriedItems().some((item) => !item.identified && item.canBeIdentified())) met.push('unidentified');

  // The grimoires matter once there is something to arrange, and a fight to arrange it for.
  if (engine.manifest.magic?.grimoires && engine.currentFloor >= 1 && p.spellsKnown.length >= 2) met.push('grimoire');

  // Not in the prologue's fight, whose cues say what to do; the hint waits for the dungeon.
  if (getKillRiteConfig(engine) && !isPrologueRunning(engine.worldState, engine.manifest.prologue)) {
    const riteInSight = engine.map
      .getAllEntities()
      .some(
        (e) =>
          e instanceof Monster &&
          e.isAlive() &&
          e !== engine.companion &&
          engine.fov.isVisible(e.x, e.y) &&
          !!getMonsterDefinition(e.definitionId)?.killRite
      );
    if (riteInSight) met.push('killRite');
  }

  // The floor's shard carrier, asleep and in sight: the moment to choose how to take its shard.
  if (!isPrologueRunning(engine.worldState, engine.manifest.prologue)) {
    const carrierId = learningStoneMarks(engine).carrierId;
    const carrier = carrierId ? engine.map.getEntityById(carrierId) : undefined;
    if (carrier instanceof Monster && carrier.aiState === 'sleeping' && engine.fov.isVisible(carrier.x, carrier.y)) met.push('shardCarrier');
  }

  // A spell waits for a slot: every grimoire slot was full when it was offered.
  if (p.pendingSpellOffers.length > 0) met.push('grimoireFull');
  return met;
}

/** The `Player.tutorialFlags` key that records an item's first-pickup hint as shown. */
export function itemHintFlag(definitionId: string): string {
  return `hint:item:${definitionId}`;
}

/**
 * The items carried (worn containers included) whose definition has a first-pickup hint
 * this hero hasn't been shown, as definition ids in the pack's item order.
 */
export function itemHintsMet(engine: GameEngine): string[] {
  const hinted = (engine.manifest.items ?? []).filter((def) => def.firstPickupHint);
  if (hinted.length === 0) return [];
  const flags = engine.player.tutorialFlags ?? {};
  const unseen = hinted.filter((def) => !flags[itemHintFlag(def.id)]);
  if (unseen.length === 0) return [];
  const carried = new Set(engine.player.inventory?.getAllCarriedItems().map((item) => item.definitionId));
  return unseen.filter((def) => carried.has(def.id)).map((def) => def.id);
}

/** The ids of the pack's hints that `event` shows (`FirstTimeHintDefinition.showOn`), in the pack's order. */
export function hintsMetByEvent(engine: GameEngine, event: GameEvent): string[] {
  const hints = engine.manifest.firstTimeHints ?? {};
  return Object.keys(hints).filter((id) => hints[id].showOn?.some((trigger) => triggerMatches(trigger, event)));
}

/** Whether `event` is the trigger's type and carries each of its `where` values, top-level or in `data`. */
function triggerMatches(trigger: FirstTimeHintTrigger, event: GameEvent): boolean {
  if (trigger.type !== event.type) return false;
  const fields = event as unknown as Readonly<Record<string, unknown>>;
  return Object.entries(trigger.where ?? {}).every(([key, value]) => (key in fields ? fields[key] : event.data?.[key]) === value);
}

/** Of `ids`, those the pack has a hint for that this hero hasn't been shown, in order. */
export function unseenHints(engine: GameEngine, ids: readonly string[]): string[] {
  const hints = engine.manifest.firstTimeHints ?? {};
  const flags = engine.player.tutorialFlags ?? {};
  return [...new Set(ids)].filter((id) => hints[id] && !flags[hintFlag(id)]);
}

/** The hint's text with each `{key:<action>}` replaced by its key's label (or the action's word). */
export function resolveHintText(
  hint: FirstTimeHintDefinition,
  keyFor: (action: string) => string | undefined
): { title: string; text: string } {
  const text = hint.text.replace(/\{key:([a-z_]+)\}/g, (_, action: string) => keyFor(action) ?? action.replace(/_/g, ' '));
  return { title: hint.title, text };
}
