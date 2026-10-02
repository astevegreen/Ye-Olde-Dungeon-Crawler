import {
  Monster,
  findRuneOfReturn,
  getKillRiteConfig,
  getMonsterDefinition,
  getRenownTotal,
  isGameEvent,
  type FirstTimeHintDefinition,
  type FirstTimeHintId,
  type GameEngine,
  type GameEvent,
} from '../../engine';
import { buildSaga } from '../characterMenu/storyModel';

/** The `Player.tutorialFlags` key that records a hint as shown. */
export function hintFlag(id: FirstTimeHintId): string {
  return `hint:${id}`;
}

/**
 * The systems the hero has come upon, judged from the game's state after a turn: a
 * companion at their side, renown earned, a Rune of Return carried, a faction standing
 * moved from where it began, a saga deed done, a creature with a kill rite in sight.
 */
export function hintsMetByState(engine: GameEngine): FirstTimeHintId[] {
  const met: FirstTimeHintId[] = [];
  const p = engine.player;
  if (engine.companion?.isAlive()) met.push('companion');
  if (getRenownTotal(engine) > 0) met.push('renown');
  if (p.hasDiscoveredRune || findRuneOfReturn(p)) met.push('runeOfReturn');

  const start = engine.manifest.initialWorldState?.factions ?? {};
  const now = engine.worldState.factions ?? {};
  if (Object.entries(now).some(([id, value]) => value !== (start[id] ?? 0))) met.push('factionStanding');

  if (buildSaga(engine).achieved.length > 0) met.push('story');

  if (getKillRiteConfig(engine)) {
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
  return met;
}

/** The systems a game event introduces: reaching an altar, performing a kill rite. */
export function hintsMetByEvent(event: GameEvent): FirstTimeHintId[] {
  if (isGameEvent(event, 'altar_reached')) return ['altar'];
  if (isGameEvent(event, 'kill_rite_performed')) return ['killRite'];
  return [];
}

/** Of `ids`, those the pack has a hint for that this hero hasn't been shown, in order. */
export function unseenHints(engine: GameEngine, ids: readonly FirstTimeHintId[]): FirstTimeHintId[] {
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
