import type {
  RenownMilestoneDefinition,
  RenownTitleDefinition,
} from '../../engine';

/**
 * Renown: every deed that earns it is a milestone here, recorded through the ledger
 * (engine triggers, a choice's `recordMilestone`, or `awardMilestone` from pack code), so
 * it reaches both its category and the total the HUD shows.
 *
 * Categories: exploration (what the hero finds and learns), piety (curses broken, Tyr's
 * altar), combat (the saga's great deeds).
 */
export const COTW_RENOWN_MILESTONES: RenownMilestoneDefinition[] = [
  // Engine triggers.
  {
    id: 'secret_door_found',
    category: 'exploration',
    label: 'Keen Eye',
    description: 'Discovered a secret door hidden in the dungeon masonry.',
    icon: '🚪',
    renownValue: 5,
    repeatable: true,
  },
  {
    id: 'item_uncursed',
    category: 'piety',
    label: 'Purifier',
    description: "Had a curse broken at Thor's temple.",
    icon: '✨',
    renownValue: 15,
    repeatable: true,
  },
  // Exploration: runestones, hearths, barrows, the forge.
  { id: 'runestone_read', category: 'exploration', label: 'Rune-Reader', description: "Read a skald's runestone.", renownValue: 10, repeatable: true },
  { id: 'twilight_prophecy_read', category: 'exploration', label: 'The Twilight Prophecy', description: 'Read the last runestone, of the Heartwood and Ragnarök.', renownValue: 15 },
  { id: 'dwarven_hearth_rest', category: 'exploration', label: 'Dwarven Hearth Respite', description: 'Rested by the hidden hearth behind the waterfall.', renownValue: 10 },
  { id: 'heartwood_rest', category: 'exploration', label: 'Heartwood Sanctuary', description: 'Meditated by the amber fire in the knot of Yggdrasil.', renownValue: 10 },
  { id: 'wayfarer_lore', category: 'exploration', label: 'Heeded the Wayfarers', description: 'Learned what earlier travellers left at a hearth.', renownValue: 5, repeatable: true },
  { id: 'barrow_honoured', category: 'exploration', label: 'Barrow-Warden', description: 'Said the rites over an Iron Clans barrow and left its silver.', renownValue: 5, repeatable: true },
  { id: 'forge_friend', category: 'exploration', label: 'Friend of the Forge', description: 'Learned the craft of the Accord from Ivalda, the last forge-keeper.', renownValue: 15 },
  // Piety.
  {
    // Q9 "A" + Q49 "A": each cursed thing given to the temple's fire.
    id: 'temple_offering',
    category: 'piety',
    label: 'Offering-Bearer',
    description: "Gave a cursed thing to the fire of Thor's temple.",
    renownValue: 5,
    repeatable: true,
  },
  { id: 'tyr_oath_kept', category: 'piety', label: 'Oath-Keeper', description: "Cleansed Tyr's altar with an oath on the sword hand.", renownValue: 15 },
  // Combat: the saga's deeds.
  { id: 'matriarch_bargain', category: 'combat', label: "The Matriarch's Blood-Oath", description: 'Ended the siphon on the village by a bargain with the troll-wife matriarch.', renownValue: 15 },
  { id: 'captives_saved', category: 'combat', label: 'Savior of Járnviðr', description: 'Rescued all four captives from the blood siphon.', renownValue: 25 },
  { id: 'hearth_tear_reclaimed', category: 'combat', label: 'Hearth-Tear Reclaimed', description: 'Took back the Hearth-Tear from the Sun-Chariot Warden.', renownValue: 25 },
  { id: 'herald_slain', category: 'combat', label: 'Herald-Slayer', description: 'Struck down Víðnir, Herald of the Wyrm.', renownValue: 20 },
];

/** Pack code that awards a milestone itself (`awardMilestone`) takes it from here by id. */
export function cotwMilestone(id: string): RenownMilestoneDefinition {
  const def = COTW_RENOWN_MILESTONES.find((m) => m.id === id);
  if (!def) throw new Error(`cotw renown: no milestone '${id}'`);
  return def;
}

export const COTW_RENOWN_TITLES: RenownTitleDefinition[] = [
  { title: 'the Watchful', threshold: 25, category: 'exploration' },
  { title: 'the Purifier', threshold: 30, category: 'piety' },
  { title: 'the Bold', threshold: 40, category: 'combat' },
  { title: 'Renowned', threshold: 100 },
  { title: 'Saga-Sung', threshold: 200 },
];
