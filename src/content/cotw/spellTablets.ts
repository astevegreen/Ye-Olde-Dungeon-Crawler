import { getCounter, incrementCounter } from '../../engine';
import type { ActionHook, ItemDefinition, Predicate, SpellDefinition } from '../../engine';

/**
 * Catch-up for spells a hero missed. Kill rites (killRites.ts) are the main way to learn
 * magic; once the hero has gone past the zone where a spell is normally learned, Astrid
 * sells a rune tablet that teaches it. Reading a tablet casts its "learn_*" spell, whose
 * only effect is the engine's `learn_spell` primitive.
 */

/** Deepest floor the hero has reached, kept by DEEPEST_FLOOR_HOOK for shop predicates. */
export const COTW_DEEPEST_FLOOR_COUNTER = 'cotw:deepest_floor';

export const DEEPEST_FLOOR_HOOK: ActionHook = {
  id: 'cotw-deepest-floor',
  phase: 'post',
  actionType: '*',
  execute: ({ actor, engine }) => {
    if (actor !== engine.player) return;
    const deepest = getCounter(engine.worldState, COTW_DEEPEST_FLOOR_COUNTER);
    if (engine.currentFloor > deepest) {
      incrementCounter(engine.worldState, COTW_DEEPEST_FLOOR_COUNTER, engine.currentFloor - deepest);
    }
  },
};

interface TabletEntry {
  spellId: string;
  spellName: string;
  /** Sold once the hero has reached this floor: the first floor past the spell's zone. */
  soldFromFloor: number;
  value: number;
}

const TABLETS: TabletEntry[] = [
  { spellId: 'slow', spellName: 'Slow', soldFromFloor: 10, value: 150 },
  { spellId: 'cold_ray', spellName: 'Cold Ray', soldFromFloor: 10, value: 150 },
  { spellId: 'firebolt', spellName: 'Firebolt', soldFromFloor: 10, value: 150 },
  { spellId: 'phase_door', spellName: 'Phase Door', soldFromFloor: 10, value: 150 },
  { spellId: 'detect_monsters', spellName: 'Detect Monsters', soldFromFloor: 10, value: 150 },
  { spellId: 'detect_objects', spellName: 'Detect Objects', soldFromFloor: 18, value: 225 },
  { spellId: 'lightning_bolt', spellName: 'Lightning Bolt', soldFromFloor: 18, value: 225 },
  { spellId: 'heal_medium', spellName: 'Heal Medium Wounds', soldFromFloor: 18, value: 225 },
  { spellId: 'identify', spellName: 'Identify', soldFromFloor: 18, value: 225 },
  { spellId: 'teleport', spellName: 'Teleportation', soldFromFloor: 26, value: 300 },
  { spellId: 'fireball', spellName: 'Fireball', soldFromFloor: 26, value: 300 },
  { spellId: 'paralyze', spellName: 'Paralyze', soldFromFloor: 34, value: 350 },
  { spellId: 'clairvoyance', spellName: 'Clairvoyance', soldFromFloor: 34, value: 350 },
];

/** The "learn_*" spells tablets cast. Never known or slotted; only read from a tablet. */
export const COTW_TABLET_SPELLS: SpellDefinition[] = TABLETS.map((t) => ({
  id: `learn_${t.spellId}`,
  name: `Learn ${t.spellName}`,
  school: 'Lore',
  manaCost: 0,
  element: 'arcane',
  range: 0,
  basePower: 0,
  areaOfEffect: 0,
  reflects: false,
  targetType: 'self',
  targetingMode: 'self',
  description: `Teaches ${t.spellName}.`,
  visual: { archetype: 'self_buff', color: '#facc15', durationMs: 220 },
  effects: [{ type: 'learn_spell', spellId: t.spellId }],
}));

/** Tablet items: sold in town only (makeItem's NON_CATALOG_ITEMS), never floor loot. */
export const COTW_SPELL_TABLETS: ItemDefinition[] = TABLETS.map((t) => ({
  id: `tablet_${t.spellId}`,
  name: `Rune Tablet of ${t.spellName}`,
  category: 'consumable',
  tier: 2,
  weight: 300,
  bulk: 150,
  identified: true,
  description: `A slate carved with the galdr of ${t.spellName}. Read it to learn the spell for good.`,
  value: t.value,
  itemType: 'scroll',
  scrollConfig: { spellId: `learn_${t.spellId}` },
}));

/** Astrid's tablet stock: item id and the depth predicate that unlocks it. */
export const COTW_TABLET_STOCK: Array<{ itemId: string; predicate: Predicate }> = TABLETS.map((t) => ({
  itemId: `tablet_${t.spellId}`,
  predicate: { type: 'minCounter', counter: COTW_DEEPEST_FLOOR_COUNTER, value: t.soldFromFloor },
}));
