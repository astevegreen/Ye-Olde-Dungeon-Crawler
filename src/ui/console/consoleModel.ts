import {
  Companion,
  Monster,
  NPC,
  RUNE_OF_RETURN_STATUS,
  findRuneOfReturn,
  getCurrentObjective,
  getOverflowConfig,
  type GameEngine,
} from '../../engine';
import type { UiIconName } from '../icons';
import { getNearbyThreats } from '../sidebar/sidebarModel';

/**
 * What the action console shows beside the spell belt, computed without the DOM:
 * the one-button context action, situational status chips, the companion card and
 * the objective line.
 */

// ── Context action ──────────────────────────────────────────────────────────

export type ContextActionKind =
  | 'attack'
  | 'take_all'
  | 'pickup'
  | 'descend'
  | 'ascend'
  | 'talk'
  | 'open_door'
  | 'rest'
  | 'close_door'
  | 'none';

export interface ContextAction {
  kind: ContextActionKind;
  /** The verb on the button: "Descend", "Pick up", "Talk". */
  verb: string;
  /** What it acts on, if anything: an item, a monster, an NPC. */
  target?: string;
  /** The pixel icon beside the verb; none when there is nothing to do. */
  icon: UiIconName | null;
  /** The key that does the same thing without the button, for the tooltip. */
  nativeKey?: string;
  /** The step a bump-style action takes (attack, talk, open a door). */
  dx?: number;
  dy?: number;
  /** The tile a door action works on. */
  x?: number;
  y?: number;
}

const NEIGHBOURS: Array<[number, number]> = [
  [0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1],
];

/**
 * The most useful single thing to do right here, in priority order: fight an
 * adjacent monster (the weakest), take what's underfoot, use the stairs, talk to
 * someone beside you, open a door, rest when hurt with nothing in sight, close a
 * door behind you. `none` when nothing applies.
 */
export function resolveContextAction(engine: GameEngine): ContextAction {
  const p = engine.player;
  const threats = getNearbyThreats(engine).filter((t) => t.distance === 1);
  if (threats.length > 0) {
    const target = threats.reduce((a, b) => (b.hp < a.hp ? b : a));
    return { kind: 'attack', verb: 'Attack', target: target.name, icon: 'attack', nativeKey: 'move into it', dx: target.x - p.x, dy: target.y - p.y };
  }

  const items = engine.map.getItemsAt(p.x, p.y) ?? [];
  if (items.length > 1) {
    return { kind: 'take_all', verb: 'Take all', target: `${items.length} items`, icon: 'loot', nativeKey: 'Shift+G' };
  }
  if (items.length === 1) {
    return { kind: 'pickup', verb: 'Pick up', target: items[0].displayName, icon: 'loot', nativeKey: 'G' };
  }

  const here = engine.map.getTile(p.x, p.y);
  if (here?.type === 'stairs_down') return { kind: 'descend', verb: 'Descend', target: 'the stairs', icon: 'stairs', nativeKey: '>' };
  if (here?.type === 'stairs_up') return { kind: 'ascend', verb: 'Ascend', target: 'the stairs', icon: 'stairs', nativeKey: '<' };

  for (const [dx, dy] of NEIGHBOURS) {
    const entity = engine.map.getEntityAt(p.x + dx, p.y + dy);
    if (entity instanceof NPC) return { kind: 'talk', verb: 'Talk', target: entity.name, icon: 'talk', nativeKey: 'move into them', dx, dy };
  }
  for (const [dx, dy] of NEIGHBOURS) {
    if (engine.map.getTile(p.x + dx, p.y + dy)?.type === 'door_closed') {
      return { kind: 'open_door', verb: 'Open', target: 'the door', icon: 'door', nativeKey: 'move into it', dx, dy };
    }
  }

  const hurt = p.hp < p.maxHp || p.mana < p.maxMana;
  if (hurt && getNearbyThreats(engine).length === 0) {
    return { kind: 'rest', verb: 'Rest', target: 'until recovered', icon: 'rest', nativeKey: 'R' };
  }

  for (const [dx, dy] of NEIGHBOURS) {
    const x = p.x + dx;
    const y = p.y + dy;
    if (engine.map.getTile(x, y)?.type === 'door_open' && !engine.map.getEntityAt(x, y) && !(engine.map.getItemsAt(x, y)?.length)) {
      return { kind: 'close_door', verb: 'Close', target: 'the door', icon: 'door', nativeKey: 'C', x, y };
    }
  }

  return { kind: 'none', verb: 'Nothing to do here', icon: null };
}

// ── Situational chips ───────────────────────────────────────────────────────

export type TrayChipAction = 'channel_rune' | 'open_pacts';

export interface TrayChip {
  id: string;
  icon: UiIconName;
  label: string;
  value: string;
  color: string;
  title: string;
  action?: TrayChipAction;
  /** Filled pips, e.g. rune charges; drawn instead of `value` when present. */
  pips?: { filled: number; total: number };
}

/**
 * Status that only matters sometimes, each shown only while it does: Rune of
 * Return charges (or channeling), overflow debt, and sealed pacts.
 * @param smithName who awakens a dormant rune, for its tooltip
 */
export function getTrayChips(engine: GameEngine, smithName: string): TrayChip[] {
  const p = engine.player;
  const chips: TrayChip[] = [];

  const rune = findRuneOfReturn(p);
  if (rune) {
    const channel = p.statusManager.getStatus?.(RUNE_OF_RETURN_STATUS);
    if (channel) {
      chips.push({
        id: 'rune', icon: 'rune', label: 'Recall', value: `${channel.duration} turns`, color: 'var(--ui-info)',
        title: 'Channeling the Rune of Return. Keep still (wait) to finish; most actions break it.',
      });
    } else if (!p.hasDiscoveredRune) {
      chips.push({
        id: 'rune', icon: 'rune', label: 'Rune', value: 'dormant', color: 'var(--ui-text-faint)',
        title: `A dormant Rune of Return. Take it to ${smithName} to awaken it.`,
      });
    } else {
      chips.push({
        id: 'rune', icon: 'rune', label: 'Recall', value: `${rune.charges}/${rune.maxCharges}`, color: 'var(--ui-info)',
        pips: { filled: rune.charges, total: rune.maxCharges },
        title: `Rune of Return: ${rune.charges} of ${rune.maxCharges} charges. Click or press T to channel a recall.`,
        action: rune.charges > 0 ? 'channel_rune' : undefined,
      });
    }
  }

  const overflow = getOverflowConfig(engine);
  if (overflow && p.voidDebt > 0) {
    const tier = [...overflow.tiers].reverse().find((t) => p.voidDebt >= t.minDebt);
    chips.push({
      id: 'debt', icon: 'debt', label: overflow.debtName, value: `${p.voidDebt}`, color: tier?.color ?? '#a855f7',
      title: `${overflow.debtName} ${p.voidDebt}${tier ? ` — ${tier.label}` : ''}. Resting lowers it.`,
    });
  }

  const pacts = engine.pacts?.getActivePacts() ?? [];
  if (pacts.length === 1) {
    chips.push({
      id: 'pacts', icon: 'pact', label: 'Pact', value: pacts[0].name, color: 'var(--ui-bad)',
      title: `${pacts[0].name}: ${pacts[0].curseDescription} Reward: ${pacts[0].rewardDescription}`, action: 'open_pacts',
    });
  } else if (pacts.length > 1) {
    chips.push({
      id: 'pacts', icon: 'pact', label: 'Pacts', value: `${pacts.length} sealed`, color: 'var(--ui-bad)',
      title: pacts.map((pact) => `${pact.name}: ${pact.rewardDescription}`).join('\n'), action: 'open_pacts',
    });
  }

  return chips;
}

// ── Companion card ──────────────────────────────────────────────────────────

export interface CompanionCard {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  /** Fell in combat and waits to be revived; not on the map. */
  downed: boolean;
  /** Out of sight of the hero. */
  away: boolean;
}

/** The hero's companion, alive or downed, or undefined when there is none. */
export function getCompanionCard(engine: GameEngine): CompanionCard | undefined {
  const companion = engine.companion;
  if (companion instanceof Companion && companion.isAlive()) {
    return {
      id: companion.id, name: companion.name, hp: companion.hp, maxHp: companion.maxHp,
      x: companion.x, y: companion.y, downed: false, away: !engine.fov.isVisible(companion.x, companion.y),
    };
  }
  const fallen = engine.deadCompanionRecord;
  if (fallen instanceof Monster) {
    return { id: fallen.id, name: fallen.name, hp: 0, maxHp: fallen.maxHp, x: fallen.x, y: fallen.y, downed: true, away: true };
  }
  return undefined;
}

// ── Objective line ──────────────────────────────────────────────────────────

/**
 * The pack's current objective, plus a bearing to the nearest stairs down the
 * hero has seen on this floor, e.g. "stairs 12 NE".
 */
export function getObjectiveLine(engine: GameEngine): { text: string; stairs?: string } | undefined {
  const objective = getCurrentObjective(engine);
  if (!objective) return undefined;

  const p = engine.player;
  let best: { d: number; x: number; y: number } | undefined;
  for (let y = 0; y < engine.map.height; y++) {
    for (let x = 0; x < engine.map.width; x++) {
      if (engine.map.getTile(x, y)?.type !== 'stairs_down' || !engine.fov.isExplored(x, y)) continue;
      const d = Math.max(Math.abs(x - p.x), Math.abs(y - p.y));
      if (!best || d < best.d) best = { d, x, y };
    }
  }
  let stairs: string | undefined;
  if (best && best.d > 0) {
    const dir = (best.y < p.y ? 'N' : best.y > p.y ? 'S' : '') + (best.x > p.x ? 'E' : best.x < p.x ? 'W' : '');
    stairs = `stairs down ${best.d} ${dir}`;
  } else if (best) {
    stairs = 'stairs down here';
  }
  return { text: objective.text, stairs };
}
