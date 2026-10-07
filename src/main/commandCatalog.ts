export interface CommandMetadata {
  id: string;
  title: string;
  category: 'Action' | 'Mode' | 'Help' | 'System';
  /** The rebindable action (`ACTION_METADATA` id) whose keys the palette chip shows, read at render. */
  binding?: string;
  /** The chip of a hard-wired key (`HARD_WIRED_KEYS`, or `>` for the stairs), shown after the binding's keys. */
  fixedKeys?: string;
  description: string;
}

/**
 * Static metadata catalog for all commands executable via the Command Palette.
 * Decoupled from runtime DOM / closures so it can be reasoned about and tested
 * purely, while src/main.ts supplies the actual executor map. A command's key chip
 * comes from its `binding`'s current keys, so it follows a rebind and never names a
 * key that does something else.
 */
export const COMMAND_CATALOG = [
  { id: 'inventory', title: 'Open Inventory', category: 'Action', binding: 'inventory', description: 'Inspect items, equip gear, and use consumables' },
  { id: 'spellbook', title: 'Open Spellbook', category: 'Action', binding: 'cast_spell', description: 'Review spells, manage quick-spell bindings, and cast' },
  { id: 'inspect', title: 'Inspect Surroundings', category: 'Action', binding: 'inspect', description: 'Look at tiles, monsters, and items in view' },
  { id: 'compendium', title: 'Open Bestiary', category: 'Help', binding: 'compendium', description: 'View bestiary weaknesses, lore, and combat notes' },
  { id: 'allocate-stats', title: 'Allocate Stat Points', category: 'Action', fixedKeys: 'U', description: 'Spend unallocated stat points on attributes' },
  { id: 'character_menu', title: 'Open Character Sheet', category: 'Action', binding: 'character_menu', description: 'View full hero attributes, resistances, traits, and status effects' },
  { id: 'pacts', title: 'Pacts', category: 'Action', binding: 'pact', description: 'Review your sealed pacts: what they cost and what they pay' },
  { id: 'story', title: 'Campaign Story & Objectives', category: 'Help', binding: 'story', description: 'Check main quest progress and chapter goals' },
  { id: 'run-advisory', title: 'Seek Sage Run Advisory', category: 'Help', description: 'Get tactical warnings and advice tailored to your active floor' },
  { id: 'help', title: 'Context Help Reference', category: 'Help', fixedKeys: 'F1 / /', description: 'Review keyboard controls, combat rules, and status effects' },
  { id: 'quick-loot', title: 'Quick Loot Adjacent Items', category: 'Action', binding: 'quick_loot', description: 'Pick up everything beneath you or on passable adjacent tiles' },
  { id: 'sort-pack', title: 'Sort Inventory by Category', category: 'Action', description: 'Organize backpack by weapons, armor, potions, and scrolls' },
  { id: 'consolidate-coins', title: 'Consolidate Coinage to Purse', category: 'Action', description: 'Deposit loose coins into your total purchasing power' },
  { id: 'wait', title: 'Pass Turn (Wait)', category: 'Action', binding: 'wait', description: 'Wait one turn and let energy advance' },
  { id: 'rest', title: 'Rest Until Healed', category: 'Action', binding: 'rest', description: 'Rest safely until fully recovered' },
  { id: 'search', title: 'Search for Secrets & Traps', category: 'Action', binding: 'search', description: 'Examine adjacent walls and floors for hidden traps or doors' },
  { id: 'stairs', title: 'Use Stairs Up / Down', category: 'Action', binding: 'stairs', fixedKeys: '>', description: 'Descend deeper into the dungeon or return to the floor above' },
  { id: 'message-log', title: 'Message Log History', category: 'Help', binding: 'message_log', description: 'Read back the recent lines of the log' },
  { id: 'map', title: 'View Explored Dungeon Map', category: 'Action', binding: 'map', description: 'Pan and inspect the complete surveyed floor map' },
  { id: 'diagnostics', title: 'Developer Diagnostics & Triage', category: 'System', fixedKeys: 'F2 / `', description: 'Inspect active actor state, combat roll logs, and flight recorder' },
  { id: 'feedback', title: 'Send Feedback & Bug Report', category: 'Help', fixedKeys: 'F3', description: 'Submit an issue, bug report, or feature request to the developers' },
  { id: 'save-quit', title: 'Save and Return to Title', category: 'System', fixedKeys: 'Esc / Q', description: 'Open the menu to save and exit to the title' },
  { id: 'export-save', title: 'Export Save File', category: 'System', description: 'Download current character file for backup or transfer' },
  { id: 'save-code', title: 'Generate Save Code', category: 'System', description: 'Generate a shareable text-based save code' },
  { id: 'settings', title: 'Settings & Keybindings', category: 'System', description: 'Display options, and the keys for every action' },
  { id: 'summon_companion', title: 'Summon Companion', category: 'Action', binding: 'companion_call', description: 'Call your bonded companion to your side (Companions & Pet Progression)' },
  { id: 'dismiss_companion', title: 'Dismiss Companion', category: 'Action', binding: 'companion_call', description: 'Send your companion away until next summoned' },
  { id: 'use_companion_skill', title: 'Companion Skill', category: 'Action', binding: 'companion_skill', description: 'Command your companion to use the skill it has learned at the trainer (Companions & Pet Progression)' },
  { id: 'rune_of_return_tree', title: 'Rune of Return Mastery Tree', category: 'Action', binding: 'rune_of_return_tree', description: 'Spend unspent points on the Rune of Return\'s three ranks' },
  { id: 'channel_rune_of_return', title: 'Channel Rune of Return', category: 'Action', binding: 'channel_rune_of_return', description: 'Begin channeled recall ritual to escape dungeon and return to town' },
] as const satisfies readonly CommandMetadata[];

export type CommandId = (typeof COMMAND_CATALOG)[number]['id'];
