/**
 * Static metadata for every command palette entry (title, category, shortcut,
 * description). Deliberately data-only, with no execute logic: the execute
 * callbacks close over ~17 pieces of DOMContentLoaded's mutable session state
 * (renderer, inputHandler, active modals, ...) and stay in src/main.ts, which
 * still owns that state. Splitting this metadata out is what stays a clean,
 * zero-dependency extraction; see ARCHITECTURE.md §3 / Task 3.1.
 */

export type CommandCategory = 'Action' | 'Mode' | 'Help' | 'System';

export interface CommandMetadata {
  readonly id: string;
  readonly title: string;
  readonly category: CommandCategory;
  readonly shortcut: string;
  readonly description: string;
}

export const COMMAND_CATALOG = [
  {
    id: 'inspect',
    title: 'Look / Inspect Tile',
    category: 'Mode',
    shortcut: 'X or L',
    description: 'Pan targeting reticle to inspect monsters, terrain, and loot',
  },
  {
    id: 'spellbook',
    title: 'Cast Spell / Spellbook',
    category: 'Mode',
    shortcut: 'Z or C',
    description: 'Open spellbook to select and aim magical attacks',
  },
  {
    id: 'inventory',
    title: 'Open Inventory & Equipment',
    category: 'Mode',
    shortcut: 'I',
    description: 'Manage backpack, equip weapons/armor, and view paperdoll',
  },
  {
    id: 'compendium',
    title: "Slayer's Compendium & Codex",
    category: 'Help',
    shortcut: 'B',
    description: 'Review monster vulnerabilities, stats, and mastery combat perks',
  },
  {
    id: 'allocate-stats',
    title: 'Allocate Stat Points',
    category: 'Action',
    shortcut: 'U or E',
    description: 'Spend unspent attribute points on Strength, Dexterity, Constitution, or Intelligence',
  },
  {
    id: 'character_menu',
    title: 'Character Menu',
    category: 'Mode',
    shortcut: 'E',
    description: 'Open consolidated character menu (Character sheet, Inventory, Spells, Bestiary, Pacts, Story)',
  },
  {
    id: 'pacts',
    title: 'Ancient Run Pacts & Bounties',
    category: 'Mode',
    shortcut: 'P',
    description: 'View, seal, or renounce ancient difficulty pacts',
  },
  {
    id: 'story',
    title: 'Cartographer & World Ledger',
    category: 'Help',
    shortcut: 'Story',
    description: 'Inspect explored floor chronicle and faction standings',
  },
  {
    id: 'run-advisory',
    title: 'Town Sage Run Advisory',
    category: 'Help',
    shortcut: 'Sage / Cmds',
    description: 'Seek strategic analysis on inventory bulk, cursed gear, and threats',
  },
  {
    id: 'help',
    title: 'Context-Sensitive Help Card',
    category: 'Help',
    shortcut: 'F1 or /',
    description: 'View active keybindings and rules for the current game context',
  },
  {
    id: 'quick-loot',
    title: 'Quick-Loot Ground Tile',
    category: 'Action',
    shortcut: 'Shift+G',
    description: 'Instantly pick up all items lying on the current ground tile',
  },
  {
    id: 'sort-pack',
    title: 'Sort Backpack Items',
    category: 'Action',
    shortcut: 'O',
    description: 'Cycle inventory sorting by Category, Weight, or Bulk',
  },
  {
    id: 'consolidate-coins',
    title: 'Consolidate Loose Coins',
    category: 'Action',
    shortcut: 'C',
    description: 'Pack all loose coins in backpack into your coin purse',
  },
  {
    id: 'wait',
    title: 'Wait / Pass Turn',
    category: 'Action',
    shortcut: 'Space or .',
    description: 'Pass turn to recover energy or wait for monsters to advance',
  },
  {
    id: 'rest',
    title: 'Rest Until Healed',
    category: 'Action',
    shortcut: 'R',
    description: 'Rest safely until Hit Points and Mana are fully replenished',
  },
  {
    id: 'search',
    title: 'Search for Hidden Traps',
    category: 'Action',
    shortcut: 'S',
    description: 'Thoroughly search surrounding tiles for hidden traps and secret doors',
  },
  {
    id: 'stairs',
    title: 'Climb Stairs Up / Down',
    category: 'Action',
    shortcut: '> or <',
    description: 'Ascend or descend staircase to change dungeon floor',
  },
  {
    id: 'map',
    title: 'Explored Dungeon Map Viewer',
    category: 'Mode',
    shortcut: 'M',
    description: 'View fully explored rooms and navigate visited floor maps (0 energy cost)',
  },
  {
    id: 'diagnostics',
    title: 'Developer Diagnostics Flight Recorder',
    category: 'System',
    shortcut: 'F2 or `',
    description: 'Inspect live engine telemetry and copy diagnostic debug reports',
  },
  {
    id: 'save-quit',
    title: 'Save Character & System Menu',
    category: 'System',
    shortcut: 'Q',
    description: 'Open save and quit menu to export backups or return to title',
  },
  {
    id: 'export-save',
    title: 'Export Save File (.cotw)',
    category: 'System',
    shortcut: 'Ctrl+S',
    description: 'Download current game state as a standalone .cotw file',
  },
  {
    id: 'save-code',
    title: 'Transfer Save Code (Base64)',
    category: 'System',
    shortcut: 'Code',
    description: 'View or copy character Base64 backup save code to clipboard',
  },
  {
    id: 'settings',
    title: 'Settings & Keybinding Remapping',
    category: 'System',
    shortcut: 'Esc -> Settings',
    description: 'Configure 8-directional movement modes and customize keyboard bindings',
  },
  {
    id: 'summon_companion',
    title: 'Summon Companion',
    category: 'Action',
    shortcut: 'Cmds',
    description: 'Call your bonded companion to your side (Companions & Pet Progression)',
  },
  {
    id: 'dismiss_companion',
    title: 'Dismiss Companion',
    category: 'Action',
    shortcut: 'Cmds',
    description: 'Send your companion away until next summoned',
  },
  {
    id: 'use_companion_skill_rally_howl',
    title: 'Companion Skill: Rally Howl',
    category: 'Action',
    shortcut: 'Cmds',
    description: "Command your companion to use its Rally Howl, if it has learned one (Companions & Pet Progression)",
  },
  {
    id: 'rune_of_return_tree',
    title: 'Rune of Return Mastery Tree',
    category: 'Action',
    shortcut: 'Shift+T',
    description: 'Upgrade Channel Celerity, Steadfast Weave, and Unbound Casting using unspent points',
  },
  {
    id: 'channel_rune_of_return',
    title: 'Channel Rune of Return',
    category: 'Action',
    shortcut: 'T',
    description: 'Begin channeled recall ritual to escape dungeon and return to town',
  },
] as const satisfies readonly CommandMetadata[];

export type CommandId = (typeof COMMAND_CATALOG)[number]['id'];
