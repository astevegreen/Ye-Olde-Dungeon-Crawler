export interface CommandMetadata {
  id: string;
  title: string;
  category: 'Action' | 'Mode' | 'Help' | 'System';
  shortcut: string;
  description: string;
}

/**
 * Static metadata catalog for all commands executable via the Command Palette.
 * Decoupled from runtime DOM / closures so it can be reasoned about and tested
 * purely, while src/main.ts supplies the actual executor map.
 */
export const COMMAND_CATALOG = [
  { id: 'inventory', title: 'Open Inventory', category: 'Action', shortcut: 'I', description: 'Inspect items, equip gear, and use consumables' },
  { id: 'spellbook', title: 'Open Spellbook', category: 'Action', shortcut: 'Z', description: 'Review spells, manage quick-spell bindings, and cast' },
  { id: 'inspect', title: 'Inspect Surroundings', category: 'Action', shortcut: 'L / X', description: 'Look at tiles, monsters, and items in view' },
  { id: 'compendium', title: 'Open Bestiary', category: 'Help', shortcut: 'B', description: 'View bestiary weaknesses, lore, and combat notes' },
  { id: 'allocate-stats', title: 'Allocate Stat Points', category: 'Action', shortcut: 'U', description: 'Spend unallocated stat points on attributes' },
  { id: 'character_menu', title: 'Open Character Sheet', category: 'Action', shortcut: 'E', description: 'View full hero attributes, resistances, traits, and status effects' },
  { id: 'pacts', title: 'Pacts', category: 'Action', shortcut: 'P', description: 'Review your sealed pacts: what they cost and what they pay' },
  { id: 'story', title: 'Campaign Story & Objectives', category: 'Help', shortcut: 'O', description: 'Check main quest progress and chapter goals' },
  { id: 'run-advisory', title: 'Seek Sage Run Advisory', category: 'Help', shortcut: '', description: 'Get tactical warnings and advice tailored to your active floor' },
  { id: 'help', title: 'Context Help Reference', category: 'Help', shortcut: 'F1 / ?', description: 'Review keyboard controls, combat rules, and status effects' },
  { id: 'quick-loot', title: 'Quick Loot Adjacent Items', category: 'Action', shortcut: 'Shift+G', description: 'Pick up everything beneath you or on passable adjacent tiles' },
  { id: 'sort-pack', title: 'Sort Inventory by Category', category: 'Action', shortcut: '', description: 'Organize backpack by weapons, armor, potions, and scrolls' },
  { id: 'consolidate-coins', title: 'Consolidate Coinage to Purse', category: 'Action', shortcut: '', description: 'Deposit loose coins into your total purchasing power' },
  { id: 'wait', title: 'Pass Turn (Wait)', category: 'Action', shortcut: 'Space / .', description: 'Wait one turn and let energy advance' },
  { id: 'rest', title: 'Rest Until Healed', category: 'Action', shortcut: 'R', description: 'Rest safely until fully recovered' },
  { id: 'search', title: 'Search for Secrets & Traps', category: 'Action', shortcut: 'S', description: 'Examine adjacent walls and floors for hidden traps or doors' },
  { id: 'stairs', title: 'Use Stairs Up / Down', category: 'Action', shortcut: '< / >', description: 'Descend deeper into the dungeon or return to the floor above' },
  { id: 'map', title: 'View Explored Dungeon Map', category: 'Action', shortcut: 'M', description: 'Pan and inspect the complete surveyed floor map' },
  { id: 'diagnostics', title: 'Developer Diagnostics & Triage', category: 'System', shortcut: 'F2 / `', description: 'Inspect active actor state, combat roll logs, and flight recorder' },
  { id: 'feedback', title: 'Send Feedback & Bug Report', category: 'Help', shortcut: 'F3', description: 'Submit an issue, bug report, or feature request to the developers' },
  { id: 'save-quit', title: 'Save and Return to Title', category: 'System', shortcut: 'Esc / Q', description: 'Open the menu to save and exit to the title' },
  { id: 'export-save', title: 'Export Save File', category: 'System', shortcut: '', description: 'Download current character file for backup or transfer' },
  { id: 'save-code', title: 'Generate Save Code', category: 'System', shortcut: '', description: 'Generate a shareable text-based save code' },
  { id: 'settings', title: 'Settings & Keybindings', category: 'System', shortcut: '', description: 'Display options, and the keys for every action' },
  { id: 'summon_companion', title: 'Summon Companion', category: 'Action', shortcut: '', description: 'Call your bonded companion to your side (Companions & Pet Progression)' },
  { id: 'dismiss_companion', title: 'Dismiss Companion', category: 'Action', shortcut: '', description: 'Send your companion away until next summoned' },
  { id: 'use_companion_skill_rally_howl', title: 'Companion Skill: Rally Howl', category: 'Action', shortcut: '', description: 'Command your companion to use its Rally Howl, if it has learned one (Companions & Pet Progression)' },
  { id: 'rune_of_return_tree', title: 'Rune of Return Mastery Tree', category: 'Action', shortcut: 'Shift+T', description: 'Upgrade Channel Celerity, Steadfast Weave, and Unbound Casting using unspent points' },
  { id: 'channel_rune_of_return', title: 'Channel Rune of Return', category: 'Action', shortcut: 'T', description: 'Begin channeled recall ritual to escape dungeon and return to town' },
] as const satisfies readonly CommandMetadata[];

export type CommandId = (typeof COMMAND_CATALOG)[number]['id'];
