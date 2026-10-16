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

/**
 * Set once the hero has known a tablet's spell, so Astrid stops selling that tablet. It stays
 * set after the spell is forgotten, since a forgotten spell is never learned again.
 */
export const tabletSpellKnownFlag = (spellId: string): string => `cotw:tablet_spell_known:${spellId}`;

/** Keeps the deepest-floor counter and the known-spell flags that Astrid's tablet stock reads. */
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
    for (const spellId of engine.player.spellsKnown) {
      if (TABLET_SPELL_IDS.has(spellId) && !engine.getWorldFlag(tabletSpellKnownFlag(spellId))) {
        engine.setWorldFlag(tabletSpellKnownFlag(spellId), true);
      }
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

/**
 * Tablets by the zone where a spell is first found (`learningStones.ts`): Astrid sells a zone's
 * spells once the hero reaches the next zone. The last band (floor 43) waits for the spells
 * the World-Bark zone gains in phase 6.
 */
const TABLET_BANDS: Array<{ soldFromFloor: number; value: number; spells: Array<[id: string, name: string]> }> = [
  {
    soldFromFloor: 10,
    value: 150,
    spells: [['firebolt', 'Firebolt'], ['slow', 'Slow'], ['phase_door', 'Phase Door'], ['call_the_pack', 'Call the Pack'], ['fafnirs_breath', "Fáfnir's Breath"]],
  },
  {
    soldFromFloor: 18,
    value: 225,
    spells: [['cold_ray', 'Cold Ray'], ['lightning_bolt', 'Lightning Bolt'], ['rockfall', 'Rockfall'], ['loki_switch', "Loki's Switch"], ['hlidskjalf', 'Hliðskjálf']],
  },
  { soldFromFloor: 26, value: 300, spells: [['rime_floor', 'Rime Floor'], ['shroud_of_mani', 'Shroud of Máni']] },
  { soldFromFloor: 34, value: 350, spells: [['thunderclap', 'Thunderclap'], ['paralyze', 'Paralyze'], ['fireball', 'Fireball']] },
  { soldFromFloor: 43, value: 400, spells: [] },
];

const TABLETS: TabletEntry[] = TABLET_BANDS.flatMap((band) =>
  band.spells.map(([spellId, spellName]) => ({ spellId, spellName, soldFromFloor: band.soldFromFloor, value: band.value }))
);

const TABLET_SPELL_IDS = new Set(TABLETS.map((t) => t.spellId));

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

/** Astrid's tablet stock: item id and its predicate, past the spell's zone and not yet known. */
export const COTW_TABLET_STOCK: Array<{ itemId: string; predicate: Predicate }> = TABLETS.map((t) => ({
  itemId: `tablet_${t.spellId}`,
  predicate: {
    type: 'and',
    predicates: [
      { type: 'minCounter', counter: COTW_DEEPEST_FLOOR_COUNTER, value: t.soldFromFloor },
      { type: 'not', predicate: { type: 'hasFlag', flag: tabletSpellKnownFlag(t.spellId) } },
    ],
  },
}));
