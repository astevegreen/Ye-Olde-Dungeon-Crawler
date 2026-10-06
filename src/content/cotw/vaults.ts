import type { VaultBlueprint } from '../../engine';
import { SIPHON_ALTAR_TILE, SIPHON_RITUAL_FLOOR, SIPHON_VAULT_ID } from './hostageRitual';
import { FLOOR21_PYLON_VAULT } from './siphonPylon';
import { FLOOR30 } from './bileSump';

export const DWARVEN_HEARTH_VAULT_ID = 'dwarven_hearth_grotto';
export const DWARVEN_HEARTH_FLOOR = 13;

export const WORLD_BARK_VAULT_ID = 'world_bark_grotto';
export const WORLD_BARK_FLOOR = 37;

export const CHARIOT_FORGE_VAULT_ID = 'floor25_chariot_forge';
export const CHARIOT_FORGE_FLOOR = 25;

export const BILE_SUMP_VAULT_ID = 'floor30_bile_sump';
export const MARROW_OSSUARY_VAULT_ID = 'floor47_marrow_ossuary';

// Floor 32, not 30: floor 30 is Gloom-Tarr's dark Bile-Sump (tracker 5.5), and a floor has one
// scripted vault.
export const URDR_POOL_VAULT_ID = 'floor32_urdr_pool';
export const URDR_POOL_FLOOR = 32;

export const VERDANDI_LOOM_VAULT_ID = 'floor39_verdandi_loom';
export const VERDANDI_LOOM_FLOOR = 39;

export const RATATOSKR_ROOST_VAULT_ID = 'floor42_ratatoskr_roost';
export const RATATOSKR_ROOST_FLOOR = 42;

export const SKULD_MIRROR_VAULT_ID = 'floor49_skuld_mirror';
export const SKULD_MIRROR_FLOOR = 49;


export const COTW_VAULTS: VaultBlueprint[] = [
  // Zone landmarks (floorLayouts.ts `landmarkVaultIds`): one stamps on every floor of its zone.
  {
    id: 'draugr_barrow',
    name: 'The Draugr Barrow',
    description: 'A burial chamber cut into the permafrost, its dead laid out between frost-cracked pillars.',
    // Floors 6-9 only (floorLayouts.ts): its Ancient Draugr is too much for floors 1-5.
    minFloor: 6,
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
    // A stone bridge leads from each side passage over the void to a gate: the top-left
    // and the bottom-right. Without them both chests sat sealed behind chasm and bars.
    layout: [
      '###############',
      '#XX......XXXXX#',
      '#X#.#BB+BB###X#',
      '@...#..C..#...@',
      '#X#.#.M.M.#.#X#',
      '@...#..C..#...@',
      '#X###BB+BB#.#X#',
      '#XXXXX......XX#',
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
    // Níðhögg's brood and the hounds of the Maw keep the herald's sanctum.
    preferredMonsters: ['grave_wyrmling', 'garmling', 'nastrond_feaster'],
  },
  {
    // Gloom-Tarr, placed once on floor 44 (index.ts scriptedVaultPlacements).
    id: BILE_SUMP_VAULT_ID,
    name: 'The Bile-Sump',
    description:
      "A flooded sump at the bottom of the silver workings. Since the Wyrm woke, its bile has seeped up the roots into the mine and pooled black and warm among the drowned ore-carts; Gloom-Tarr wallows in it and drinks, and its breath has put out every miner's lamp.",
    minFloor: FLOOR30,
    maxFloor: FLOOR30,
    scriptedOnly: true,
    minibossId: 'miniboss_tar_abomination',
    layout: [
      '###############',
      '#P.~~~...~~~.P#',
      '@...~~~.~~~...@',
      '#.M...~K~...M.#',
      '#....~~~~~....#',
      '#.C.........C.#',
      '@.....M.M.....@',
      '#P...........P#',
      '###############',
    ],
    preferredMonsters: ['deep_lode_pit_draugr', 'quicksilver_leech', 'choke_damp_phantasm'],
  },
  {
    // Sköll, placed once on floor 47 (index.ts scriptedVaultPlacements).
    id: MARROW_OSSUARY_VAULT_ID,
    name: 'The Marrow Ossuary',
    description:
      'A bone-hall behind iron bars, its floor a drift of split marrow-bones, where Sköll gnaws the void-bone and Hel’s wardens keep watch.',
    minFloor: 47,
    maxFloor: 47,
    scriptedOnly: true,
    minibossId: 'miniboss_marrow_eater',
    layout: [
      '#############',
      '#P.B.....B.P#',
      '@...........@',
      '#.M.P.K.P.M.#',
      '#...........#',
      '#.C.P...P.C.#',
      '@.....M.....@',
      '#P.........P#',
      '#############',
    ],
    preferredMonsters: ['hel_warden', 'shadow_fiend', 'nastrond_feaster'],
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
  // Floor 21 only, scripted (siphonPylon.ts): the zone's pylon with the light-drinking core.
  FLOOR21_PYLON_VAULT,
  {
    id: URDR_POOL_VAULT_ID,
    name: "Urðr's Sacred Pool",
    description:
      'A sacred grotto of tarnished silver where the holy water of Urðr wells up through the boiled permafrost, reflecting deeds of the past.',
    minFloor: URDR_POOL_FLOOR,
    maxFloor: URDR_POOL_FLOOR,
    scriptedOnly: true,
    legend: { U: 'urdr_pool' },
    layout: [
      '###########',
      '#P...~...P#',
      '#...~~~...#',
      '@....U....@',
      '#...~~~...#',
      '#P...~...P#',
      '###########',
    ],
    preferredMonsters: ['deep_lode_pit_draugr', 'quicksilver_leech'],
  },
  {
    id: VERDANDI_LOOM_VAULT_ID,
    name: "Verðandi's Loom Hall",
    description:
      'A vaulted gallery within Yggdrasil’s trunk where Verðandi weaves the warp of the living world amidst encroaching rot.',
    minFloor: VERDANDI_LOOM_FLOOR,
    maxFloor: VERDANDI_LOOM_FLOOR,
    scriptedOnly: true,
    legend: { W: 'verdandi_loom' },
    layout: [
      '#############',
      '#P.........P#',
      '@....~~~....@',
      '#.....W.....#',
      '@....~~~....@',
      '#P.........P#',
      '#############',
    ],
    preferredMonsters: ['rotwood_crawler', 'yggdrasil_parasite', 'amber_sap_weeper'],
  },
  {
    id: RATATOSKR_ROOST_VAULT_ID,
    name: 'The Roost of Ratatoskr',
    description:
      'A hidden moss hollow nestled high among the knotted roots, filled with shiny hoardings and pine-cones.',
    minFloor: RATATOSKR_ROOST_FLOOR,
    maxFloor: RATATOSKR_ROOST_FLOOR,
    scriptedOnly: true,
    legend: { R: 'ratatoskr_perch' },
    layout: [
      '###########',
      '#P.......P#',
      '#....R....#',
      '@.........@',
      '#P.......P#',
      '###########',
    ],
    preferredMonsters: ['rotwood_crawler', 'amber_sap_weeper'],
  },
  {
    id: SKULD_MIRROR_VAULT_ID,
    name: "Skuld's Obsidian Sanctum",
    description:
      'A bone-framed sanctuary overlooking the abyss of Náströnd where Skuld’s dark mirror shows what shall be.',
    minFloor: SKULD_MIRROR_FLOOR,
    maxFloor: SKULD_MIRROR_FLOOR,
    scriptedOnly: true,
    legend: { S: 'skuld_mirror' },
    layout: [
      '#############',
      '#P.B.....B.P#',
      '@...........@',
      '#.....S.....#',
      '@...........@',
      '#P.B.....B.P#',
      '#############',
    ],
    preferredMonsters: ['hel_warden', 'nastrond_feaster'],
  },
];




