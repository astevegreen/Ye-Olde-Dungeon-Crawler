import type { VaultBlueprint } from '../../engine';
import { SIPHON_ALTAR_TILE, SIPHON_RITUAL_FLOOR, SIPHON_VAULT_ID } from './hostageRitual';

export const DWARVEN_HEARTH_VAULT_ID = 'dwarven_hearth_grotto';
export const DWARVEN_HEARTH_FLOOR = 13;

export const WORLD_BARK_VAULT_ID = 'world_bark_grotto';
export const WORLD_BARK_FLOOR = 37;

export const CHARIOT_FORGE_VAULT_ID = 'floor25_chariot_forge';
export const CHARIOT_FORGE_FLOOR = 25;

export const COTW_VAULTS: VaultBlueprint[] = [
  // Zone landmarks (floorLayouts.ts `landmarkVaultIds`): one stamps on every floor of its zone.
  {
    id: 'draugr_barrow',
    name: 'The Draugr Barrow',
    description: 'A burial chamber cut into the permafrost, its dead laid out between frost-cracked pillars.',
    minFloor: 1,
    maxFloor: 9,
    layout: [
      '###########',
      '#P.......P#',
      '#..#...#..#',
      '@...M.C...@',
      '#..#...#..#',
      '#P.......P#',
      '###########',
    ],
    preferredMonsters: ['draugr', 'skeleton'],
  },
  {
    id: 'siphon_pylon',
    name: 'The Siphon Pylon',
    description: 'A barred obsidian pump-house where the siphon draws magma from the rift.',
    minFloor: 18,
    maxFloor: 25,
    layout: [
      '#########',
      '#B.....B#',
      '#...P...#',
      '@..MCM..@',
      '#...P...#',
      '#B.....B#',
      '#########',
    ],
    preferredMonsters: ['sol_brand_zealot', 'fire_giant'],
  },
  {
    id: 'sunken_cistern',
    name: 'The Sunken Cistern',
    description: 'An ancient water reservoir bisected by murky pools and elevated stone catwalks.',
    minFloor: 3,
    layout: [
      '#############',
      '#...~~~.~~~.#',
      '@...~~~.~~~.@',
      '#...~~~.~~~.#',
      '#...M..C..M.#',
      '#...~~~.~~~.#',
      '@...~~~.~~~.@',
      '#...~~~.~~~.#',
      '#############',
    ],
    preferredMonsters: ['giant_rat', 'kobold'],
  },
  {
    id: 'colonnade_arena',
    name: 'The Colonnade Arena',
    description: 'A grand vaulted chamber lined with stone pillars offering tactical cover and sightline breaks.',
    minFloor: 5,
    layout: [
      '#############',
      '#...P.P.P...#',
      '@...P.P.P...@',
      '#...........#',
      '#...M...M...#',
      '#...........#',
      '@...P.P.P...@',
      '#...P.P.P...#',
      '#############',
    ],
    preferredMonsters: ['kobold_shaman', 'skeleton'],
  },
  {
    id: 'fortified_strongroom',
    name: 'The Fortified Strongroom',
    description: 'A reinforced subterranean bunker with iron security slits guarding an opulent treasure vault.',
    minFloor: 8,
    layout: [
      '###########',
      '#BBB###BBB#',
      '#B.......B#',
      '#B..M.C..B#',
      '#B.......B#',
      '###++#++###',
      '#.........#',
      '@.........@',
      '###########',
    ],
    preferredMonsters: ['orc', 'ogre'],
  },
  {
    id: 'sunken_shrine',
    name: 'The Sunken Shrine of Njord',
    description: 'An ancient consecrated pool with stone idols guarding an offering chest.',
    minFloor: 4,
    layout: [
      '#############',
      '#.~~~P.P~~~.#',
      '@.~~~...~~~.@',
      '#.P...C...P.#',
      '#....M.M....#',
      '#.P...C...P.#',
      '@.~~~...~~~.@',
      '#.~~~P.P~~~.#',
      '#############',
    ],
    preferredMonsters: ['giant_rat', 'skeleton'],
  },
  {
    id: 'chasm_treasury',
    name: 'The Abyssal Treasury',
    description: 'A fortified stronghold suspended above an infinite void with barred gates.',
    minFloor: 7,
    layout: [
      '###############',
      '#XXXXX...XXXXX#',
      '#X###BB+BB###X#',
      '@...#..C..#...@',
      '#X#.#.M.M.#.#X#',
      '@...#..C..#...@',
      '#X###BB+BB###X#',
      '#XXXXX...XXXXX#',
      '###############',
    ],
    preferredMonsters: ['orc', 'ogre', 'kobold_shaman'],
  },
  {
    // Guaranteed floor-5 reward room (ARCHITECTURE.md §3, `dungeonArc.ts`'s
    // FLOOR5_RUNE_VAULT_ID) — forced onto floor 5 regardless of the normal
    // random-eligible-vault pool, so it always appears exactly once, guarded
    // by several Rime Hollows monsters. `dungeonArc.ts` adds the Rune of
    // Return to the chest after stamping; `minFloor`/`maxFloor` here are for
    // documentation only, since the forced-placement path bypasses them.
    id: 'floor5_rune_vault',
    name: 'The Frostbound Rune Chamber',
    description: 'A consecrated vault of perpetual frost where towering ice spires and a moat of cracked ice frame the ancient altar dais, guarded by Gálmr the Frost-Warden.',
    minFloor: 5,
    maxFloor: 5,
    minibossId: 'miniboss_frost_warden',
    layout: [
      '#############',
      '#P.~~...~~.P#',
      '@...P.K.P...@',
      '#.~...C...~.#',
      '#.~..M.M..~.#',
      '@...P...P...@',
      '#.~~.....~~.#',
      '#P.~~...~~.P#',
      '#############',
    ],
    preferredMonsters: ['hoarfrost_skraeling', 'skratti', 'brim_howler', 'glacier_borer'],
  },
  {
    id: 'chasm_crossing',
    name: 'The Chasm Crossing',
    description: 'A precarious stone bridge spanning a dizzying abyss, guarded by lurking subterranean predators.',
    minFloor: 12,
    layout: [
      '#############',
      '#...XXXXX...#',
      '#...XXXXX...#',
      '@...XXXXX...@',
      '#...X...X...#',
      '#...X.M.X...#',
      '@...XXXXX...@',
      '#...XXXXX...#',
      '#############',
    ],
    preferredMonsters: ['frost_drake', 'ogre'],
  },
  {
    id: 'floor36_matriarch_hollow',
    name: "The Matriarch's Rot-Hollow",
    description:
      'A hollow gnawed out of a dying taproot, its floor pooled with black sap, where Svartr the Taproot Matriarch tends the rot that feeds Níðhögg.',
    minFloor: 36,
    maxFloor: 36,
    scriptedOnly: true,
    minibossId: 'miniboss_rot_matriarch',
    layout: [
      '#############',
      '#P.~~...~~.P#',
      '@....P.P....@',
      '#.~...K...~.#',
      '#.~.M.C.M.~.#',
      '@....P.P....@',
      '#P.~~...~~.P#',
      '#############',
    ],
    preferredMonsters: ['rotwood_crawler', 'yggdrasil_parasite', 'amber_sap_weeper'],
  },
  {
    // The end of Act 1: the coven's forge, where the Sun-Chariot Warden keeps the stolen
    // solar core and the Hearth-Tear it was cut from. Placed once, on floor 25 only.
    id: CHARIOT_FORGE_VAULT_ID,
    name: 'The Chariot Forge',
    description:
      'A forge hall built around the stolen solar core, its anvils glowing with the sun-chariot’s fire, where the Sun-Chariot Warden stands over the Hearth-Tear.',
    minFloor: CHARIOT_FORGE_FLOOR,
    maxFloor: CHARIOT_FORGE_FLOOR,
    scriptedOnly: true,
    minibossId: 'sun_chariot_warden',
    layout: [
      '#############',
      '#P.~~...~~.P#',
      '@....P.P....@',
      '#.~...K...~.#',
      '#.~.M.C.M.~.#',
      '@....P.P....@',
      '#P.~~...~~.P#',
      '#############',
    ],
    preferredMonsters: ['sol_brand_zealot', 'ironwood_troll_wife', 'slag_amorphous'],
  },
  {
    id: 'floor45_fang_vault',
    name: "The Dragon's Maw Vault",
    description: 'A subterranean sanctum carved into the root-rock of the Maw of Malice, where Víðnir guards Níðhögg’s shed relic fang.',
    minFloor: 45,
    maxFloor: 45,
    minibossId: 'miniboss_maw_herald',
    layout: [
      '###############',
      '#P.~~.....~~.P#',
      '#.~~.......~~.#',
      '@....P.K.P....@',
      '#.~...C.C...~.#',
      '#.~..M...M..~.#',
      '@....P...P....@',
      '#.~~.......~~.#',
      '#P.~~.....~~.P#',
      '###############',
    ],
    preferredMonsters: ['primordial_drake', 'root_rot_abomination', 'void_gazer'],
  },
  {
    id: SIPHON_VAULT_ID,
    name: 'The Siphon Altar of Járnviðr',
    description:
      'An obsidian ritual chamber where troll-wife warlocks prepare captive Bjarnarhaven villagers for blood sacrifice.',
    // Stamped only on the scripted floor (hostageRitual.ts); the `N` markers hold the
    // four captives and `A` is the Siphon Altar tile.
    minFloor: SIPHON_RITUAL_FLOOR,
    maxFloor: SIPHON_RITUAL_FLOOR,
    scriptedOnly: true,
    legend: { A: SIPHON_ALTAR_TILE },
    layout: [
      '###############',
      '#P...B...B...P#',
      '#.N..B.M.B..N.#',
      '@....#####....@',
      '#.M....A....M.#',
      '@....#####....@',
      '#.N..B.M.B..N.#',
      '#P...B...B...P#',
      '###############',
    ],
    preferredMonsters: ['ironwood_troll_wife', 'sol_brand_zealot'],
  },
  {
    id: DWARVEN_HEARTH_VAULT_ID,
    name: 'The Dwarven Hearth Grotto',
    description:
      'A secluded thermal haven carved behind a roaring cascade of mountain runoff, warmed by an ancient stone hearth.',
    minFloor: DWARVEN_HEARTH_FLOOR,
    maxFloor: DWARVEN_HEARTH_FLOOR,
    scriptedOnly: true,
    legend: {
      '@': 'dwarven_cascade_veil',
      H: 'grotto_hearth',
      '~': 'grotto_mineral_spring',
      B: 'grotto_stone_bench',
      S: 'grotto_supplies',
    },
    layout: [
      '#####@#####',
      '#....~....#',
      '#..B.H.S..#',
      '#....~N...#',
      '#.........#',
      '###########',
    ],
  },
  {
    id: WORLD_BARK_VAULT_ID,
    name: 'The Heartwood Knothole',
    description:
      'A peaceful hollow nestled deep within an ancient knot of Yggdrasil, sheltered by woven roots and lit by an amber peat fire.',
    minFloor: WORLD_BARK_FLOOR,
    maxFloor: WORLD_BARK_FLOOR,
    scriptedOnly: true,
    legend: {
      '@': 'root_curtain_veil',
      F: 'world_bark_campfire',
      '~': 'world_bark_sap_pool',
      M: 'world_bark_moss_bed',
      T: 'world_bark_chimes',
    },
    layout: [
      '#####@#####',
      '#....~....#',
      '#..M.F.T..#',
      '#....~....#',
      '#.........#',
      '###########',
    ],
  },
];



