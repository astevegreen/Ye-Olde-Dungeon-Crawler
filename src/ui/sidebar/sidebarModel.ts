import {
  Companion,
  Monster,
  getTileDefinition,
  getTimedEventCountdowns,
  parseCoinItem,
  type GameEngine,
  type Item,
} from '../../engine';
import type { UiIconName } from '../icons';

/**
 * What the combat sidebar shows, computed from the engine with no DOM: nearby
 * monsters, the hero's conditions, what lies on the ground in sight, and what the
 * hero stands on. Kept pure so each section is testable on its own.
 */

const DIRECTIONS: Record<string, string> = {
  '-1,-1': 'NW', '0,-1': 'N', '1,-1': 'NE',
  '-1,0': 'W', '0,0': '', '1,0': 'E',
  '-1,1': 'SW', '0,1': 'S', '1,1': 'SE',
};

/** Chebyshev distance and a compass direction from the hero, e.g. 3 and "NE". */
function bearing(engine: GameEngine, x: number, y: number): { distance: number; direction: string } {
  const dx = x - engine.player.x;
  const dy = y - engine.player.y;
  return {
    distance: Math.max(Math.abs(dx), Math.abs(dy)),
    direction: DIRECTIONS[`${Math.sign(dx)},${Math.sign(dy)}`] ?? '',
  };
}

export interface NearbyThreat {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  distance: number;
  direction: string;
  /** A telegraphed heavy attack, if the monster is winding one up. */
  windup?: { ability: string; turnsRemaining: number };
}

/** Hostile monsters the hero can see, nearest first. */
export function getNearbyThreats(engine: GameEngine): NearbyThreat[] {
  const threats: NearbyThreat[] = [];
  for (const entity of engine.map.getAllEntities()) {
    if (!(entity instanceof Monster) || entity instanceof Companion) continue;
    if (!entity.isAlive() || entity.faction === 'player') continue;
    if (!engine.fov.isVisible(entity.x, entity.y)) continue;
    const intent = entity.intent;
    threats.push({
      id: entity.id,
      name: entity.name,
      x: entity.x,
      y: entity.y,
      hp: entity.hp,
      maxHp: entity.maxHp,
      ...bearing(engine, entity.x, entity.y),
      windup:
        intent?.type === 'windup'
          ? { ability: intent.abilityName ?? 'a heavy attack', turnsRemaining: intent.turnsRemaining }
          : undefined,
    });
  }
  return threats.sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
}

export interface Condition {
  /** Stable key for tracking how long it started out as. */
  key: string;
  label: string;
  color: string;
  /** Turns left, or null for a condition with no countdown the player can act on. */
  turns: number | null;
  detail?: string;
}

/**
 * Ambient statuses (giant_blood, the energy-model afflictions) are applied with a
 * 9999-turn sentinel that the status manager still decrements each tick, so the
 * live value drifts to 9998, 9997, …. Anything this far out isn't a countdown.
 */
export function isAmbientDuration(duration: number): boolean {
  return duration >= 9000;
}

const BUILT_IN_STATUS_COLORS: Record<string, string> = {
  poison: '#22c55e',
  paralysis: '#eab308',
  slow: '#0ea5e9',
  haste: '#f97316',
  blindness: '#a855f7',
};

/**
 * Everything affecting the hero right now: statuses, sensing spells, story
 * countdowns, and encumbrance once it slows them.
 */
export function getConditions(engine: GameEngine): Condition[] {
  const p = engine.player;
  const conditions: Condition[] = [];

  for (const eff of p.statusManager.getAll()) {
    const def = engine.manifest?.statusEffects?.find((s) => s.id === eff.type);
    let label = def?.name ?? eff.type.replace(/_/g, ' ');
    let color = def?.hudColor ?? BUILT_IN_STATUS_COLORS[eff.type] ?? 'var(--ui-info)';
    if (eff.type === 'rune_of_return_channel') {
      label = 'Channeling rune';
      color = 'var(--ui-info)';
    }
    conditions.push({
      key: `status:${eff.type}`,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      color,
      turns: isAmbientDuration(eff.duration) ? null : eff.duration,
      detail: def?.damagePerTick ? `−${def.damagePerTick} HP each turn` : undefined,
    });
  }

  if (engine.detectMonstersTurns > 0) {
    conditions.push({ key: 'sense:monsters', label: 'Sensing creatures', color: 'var(--ui-info)', turns: engine.detectMonstersTurns });
  }
  if (engine.detectObjectsTurns > 0) {
    conditions.push({ key: 'sense:objects', label: 'Sensing objects', color: 'var(--ui-warn)', turns: engine.detectObjectsTurns });
  }

  for (const countdown of getTimedEventCountdowns(engine)) {
    conditions.push({
      key: `timer:${countdown.label}`,
      label: countdown.label,
      color: countdown.turnsRemaining <= 20 ? 'var(--ui-bad)' : 'var(--ui-warn)',
      turns: countdown.turnsRemaining,
    });
  }

  const enc = p.inventory.getEncumbrance(p.strength);
  if (enc !== 'Unencumbered') {
    conditions.push({
      key: 'encumbrance',
      label: enc,
      color: enc === 'Burdened' ? 'var(--ui-warn)' : enc === 'Overburdened' ? '#f97316' : 'var(--ui-bad)',
      turns: null,
      detail: enc === 'Immobilized' ? 'too heavy to move — drop something' : 'carrying too much slows you',
    });
  }

  return conditions;
}

export interface GroundPile {
  x: number;
  y: number;
  distance: number;
  direction: string;
  /** The first item, which the row's icon shows. */
  item: Item;
  label: string;
  /** Items in the pile beyond the first. */
  more: number;
  isCoins: boolean;
}

/** Item piles the hero can see, the one underfoot first, then nearest first. */
export function getGroundPiles(engine: GameEngine): GroundPile[] {
  const piles: GroundPile[] = [];
  for (const pile of engine.map.getAllGroundItems()) {
    if (!pile.items.length || !engine.fov.isVisible(pile.x, pile.y)) continue;
    const item = pile.items[0];
    piles.push({
      x: pile.x,
      y: pile.y,
      ...bearing(engine, pile.x, pile.y),
      item,
      label: item.displayName,
      more: pile.items.length - 1,
      isCoins: !!parseCoinItem(item),
    });
  }
  return piles.sort((a, b) => a.distance - b.distance || a.label.localeCompare(b.label));
}

export interface GroundStatusInfo {
  standingText: string;
  detailText: string;
  promptText: string;
  /** Icons drawn before the standing and prompt text. */
  standingIcon?: UiIconName;
  promptIcon?: UiIconName;
  /** A revealed trap underfoot. */
  hazard?: boolean;
}

/** What the hero stands on and what they can do there: stairs, doors, loot, traps. */
export function formatGroundStatus(engine: GameEngine, x: number, y: number): GroundStatusInfo {
  if (!engine || !engine.map || !engine.map.inBounds(x, y)) {
    return { standingText: 'Standing on: Unknown Void', detailText: '', promptText: '' };
  }
  const tile = engine.map.getTile(x, y);
  if (!tile) {
    return { standingText: 'Standing on: Unknown Void', detailText: '', promptText: '' };
  }
  const tileDef = getTileDefinition(tile.type);
  let buildingName = '';

  // A named town building (floor 0).
  if (engine.currentFloor === 0 && engine.manifest?.town?.buildings) {
    for (const b of engine.manifest.town.buildings) {
      if (x >= b.bounds.x1 && x <= b.bounds.x2 && y >= b.bounds.y1 && y <= b.bounds.y2) {
        buildingName = b.name;
        break;
      }
    }
  }

  let detailText = '';
  let promptText = '';
  let promptIcon: UiIconName | undefined;

  if (tile.type === 'stairs_down') {
    promptText = 'Stairs Down — Press [>] or [Enter] to descend';
    promptIcon = 'stairs';
  } else if (tile.type === 'stairs_up') {
    promptText = 'Stairs Up — Press [<] or [Enter] to ascend';
    promptIcon = 'stairs';
  } else if (tile.type === 'door_closed') {
    promptText = 'Closed Door — Bump or press [C] to open';
    promptIcon = 'door';
  } else if (tile.type === 'door_open') {
    promptText = 'Open Doorway — Press [C] to close';
    promptIcon = 'door';
  }

  const groundItems = engine.map.getItemsAt(x, y);
  if (groundItems && groundItems.length > 0) {
    detailText = `Floor: ${groundItems.map((item) => item.displayName).join(', ')}`;
    if (!promptText) {
      promptText = '[G] Pickup | [Shift+G] Quick-Loot | [I] Inventory';
      promptIcon = 'loot';
    }
  }

  const trap = engine.map.getTrapAt ? engine.map.getTrapAt(x, y) : undefined;
  const hazard = Boolean(trap && trap.revealed);
  if (trap && trap.revealed) {
    const hazardMsg = `Hazard: ${trap.type.replace('_', ' ').toUpperCase()} TRAP`;
    detailText = detailText ? `${detailText} | ${hazardMsg}` : hazardMsg;
  }

  // Say where the hero stands only when it tells them something: a building's name,
  // or ground that isn't ordinary walkable floor (streets and floors of every kind
  // are not worth a line) and that no prompt already names.
  let standingText = '';
  if (buildingName) standingText = buildingName;
  else if (!tile.passable && !promptText) standingText = `Standing on: ${tileDef.name}`;

  return { standingText, detailText, promptText, standingIcon: buildingName ? 'location' : undefined, promptIcon, hazard };
}

/** Share of the floor's walkable tiles the hero has seen, 0-100. */
export function getExploredPercent(engine: GameEngine): number {
  let walkable = 0;
  let explored = 0;
  const { map, fov } = engine;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = map.getTile(x, y);
      if (!tile?.passable) continue;
      walkable++;
      if (fov.isExplored(x, y)) explored++;
    }
  }
  return walkable === 0 ? 0 : Math.round((explored / walkable) * 100);
}
