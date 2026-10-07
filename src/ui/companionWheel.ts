import { GameEngine } from '../engine';

/**
 * The companion wheel (V, held): the radial menu is the companion's own, its controls and
 * interactions on fixed compass wedges so the hand learns them (docs/architecture/
 * simulation-and-input.md, content-companions.md). Today it calls or sends away, uses
 * each learned skill and opens the companion's pack; the two empty wedges are kept for
 * orders the companion will learn to take (hold, attack the hero's target). Every name
 * comes from the companion or the pack's `trainerSkills`, so the wheel names no pack (§3).
 */
export type CompanionWheelAction =
  | { kind: 'call' }
  | { kind: 'skill'; skillId: string }
  | { kind: 'pack' };

export interface CompanionWheelSlot {
  label: string;
  action: CompanionWheelAction;
}

/** Wedges in compass order, N first and clockwise (`RADIAL_DIRECTIONS`). */
export const COMPANION_WHEEL_SIZE = 8;
/** N: call or send away. NE, E, SE: up to three learned skills. S: the companion's pack. */
const CALL = 0;
const SKILL_WEDGES = [1, 2, 3];
const PACK = 4;

/**
 * The wheel for this moment, or null when the hero has no companion to command (never
 * bonded, or a pack with no companions): the key then explains instead of opening.
 */
export function companionWheelSlots(engine: GameEngine): (CompanionWheelSlot | null)[] | null {
  const present = engine.companion?.isAlive() ? engine.companion : null;
  const bonded = engine.getWorldFlag(GameEngine.COMPANION_BONDED_FLAG);
  if (!present && !bonded) return null;

  const slots: (CompanionWheelSlot | null)[] = new Array(COMPANION_WHEEL_SIZE).fill(null);
  const absentName = engine.dismissedCompanion?.name ?? engine.deadCompanionRecord?.name;
  slots[CALL] = {
    label: present ? `Send ${present.name} away` : absentName ? `Call ${absentName}` : 'Call companion',
    action: { kind: 'call' },
  };
  if (present) {
    const named = engine.manifest.town?.services?.trainerSkills ?? [];
    present.unlockedSkills.slice(0, SKILL_WEDGES.length).forEach((skillId, i) => {
      slots[SKILL_WEDGES[i]] = { label: named.find((s) => s.id === skillId)?.name ?? skillId, action: { kind: 'skill', skillId } };
    });
    slots[PACK] = { label: `${present.name}'s pack`, action: { kind: 'pack' } };
  }
  return slots;
}
