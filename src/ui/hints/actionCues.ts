import { Monster, PotionItem, getSpell, isPrologueRunning, type GameEngine } from '../../engine';
import { resolvePotionSlots } from '../potionRow';

/**
 * Action cues: while the pack's prologue runs, the HUD slot for the move the moment calls
 * for glows, with its key beside it. Never a dialog, never a line in the log; the glow
 * goes out by itself once the moment passes. Two moments are cued:
 *   - drink: the hero is badly hurt and a pinned potion slot holds something that heals;
 *   - cast: a quick-spell slot holds a ranged attack the hero can afford, and a hostile
 *     in sight but out of reach is wounded or running.
 */

/** Hurt enough to drink: at or below this share of max HP. */
const DRINK_AT_HP_SHARE = 0.4;
/** Wounded enough to finish from range: at or below this share of max HP. */
const WOUNDED_HP_SHARE = 0.5;

export interface ActionCues {
  /** The potion-row slot to drink from, or null. */
  drinkSlot: number | null;
  /** The quick-spell slot to cast from, or null. */
  castSlot: number | null;
}

const NO_CUES: ActionCues = { drinkSlot: null, castSlot: null };

function heals(item: PotionItem): boolean {
  return item.potionType === 'health' || item.effects.some((e) => e.type === 'restore_hp');
}

function drinkSlot(engine: GameEngine): number | null {
  const p = engine.player;
  if (p.hp > p.maxHp * DRINK_AT_HP_SHARE) return null;
  const carried = engine.player.inventory.getAllCarriedItems();
  const slots = resolvePotionSlots(engine);
  const i = slots.findIndex((slot) => {
    const item = slot.carried && carried.find((it) => it.id === slot.carried!.itemId);
    return item instanceof PotionItem && heals(item);
  });
  return i >= 0 ? i : null;
}

function castSlot(engine: GameEngine): number | null {
  const p = engine.player;
  const quick = p.quickSpells ?? [];
  const slot = quick.findIndex((id) => {
    if (!id) return false;
    const spell = engine.manifest.spells?.find((s) => s.id === id) ?? getSpell(id);
    return !!spell && spell.targetingMode === 'ray' && spell.basePower > 0 && p.mana >= spell.manaCost;
  });
  if (slot < 0) return null;
  const spellId = quick[slot]!;
  const range = (engine.manifest.spells?.find((s) => s.id === spellId) ?? getSpell(spellId))!.range;

  const target = engine.map.getAllEntities().some((e) => {
    if (!(e instanceof Monster) || !e.isAlive() || e === engine.companion) return false;
    if (e.faction === 'player' || e.faction === 'neutral') return false;
    if (!engine.fov.isVisible(e.x, e.y)) return false;
    const d = Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y));
    return d >= 2 && d <= range && (e.aiState === 'fleeing' || e.hp <= e.maxHp * WOUNDED_HP_SHARE);
  });
  return target ? slot : null;
}

/** The cues for the hero's present moment; none outside the pack's prologue. */
export function findActionCues(engine: GameEngine): ActionCues {
  if (!engine?.player || !isPrologueRunning(engine.worldState, engine.manifest.prologue)) return NO_CUES;
  return { drinkSlot: drinkSlot(engine), castSlot: castSlot(engine) };
}
