import type { FixtureArt, PixelSprite } from '../../../engine';
import { bake, type Model, type Variant } from './sculpt/kit';
import { altarModel } from './sculpt/altar';
import { runestoneModel } from './sculpt/runestone';
import { portalModel } from './sculpt/portal';
import { siphonAltarModel, siphonCoreModel } from './sculpt/siphon';
import { chestModel } from './sculpt/chest';
import { lootPileModel } from './sculpt/lootPile';
import { SIPHON_CORE_TILE } from '../siphonPylon';

/** Altars, portals, the siphon and an opened chest's glint idle over four frames; shut and empty chests and heaps hold still. */
const FIXTURE_FRAMES = 4;

const sculpted = <V extends Variant>(model: Model<V>, variant?: V, frames = FIXTURE_FRAMES): PixelSprite => ({
  frames,
  render: (frame, size) => bake(model, { frame, px: size, variant }),
});

const tyrAltar = sculpted(altarModel, { kind: 'tyr' });
const barrow = sculpted(altarModel, { kind: 'barrow' });
const closedChest = sculpted(chestModel, { state: 'closed' }, 1);

/** The six Skaldic Runestones, one per chapter of the saga, in tile order. */
const RUNESTONES = ['frost', 'smithy', 'dawn', 'lament', 'norns', 'twilight'] as const;

/**
 * The fixtures from the style bible (`FixtureArt`). Altars are keyed by tile type, each god's
 * by its own look (both Týr altars share one, as do the three barrows); the Siphon Altar and its
 * core had no mark at all.
 */
export const COTW_FIXTURE_ART: FixtureArt = {
  tiles: {
    altar_tyr: tyrAltar,
    galdr_altar_tyr: tyrAltar,
    galdr_altar_odin: sculpted(altarModel, { kind: 'odin' }),
    galdr_altar_hel: sculpted(altarModel, { kind: 'hel' }),
    galdr_altar_loki: sculpted(altarModel, { kind: 'loki' }),
    urdr_pool: sculpted(altarModel, { kind: 'urdr' }),
    verdandi_loom: sculpted(altarModel, { kind: 'verdandi' }),
    skuld_mirror: sculpted(altarModel, { kind: 'skuld' }),
    ratatoskr_perch: sculpted(altarModel, { kind: 'ratatoskr' }),
    duergar_barrow_1: barrow,
    duergar_barrow_2: barrow,
    duergar_barrow_3: barrow,
    ...Object.fromEntries(RUNESTONES.map((kind, i) => [`skaldic_runestone_${i + 1}`, sculpted(runestoneModel, { kind })])),
    gateway_valhalla: sculpted(portalModel, { kind: 'root' }),
    gateway_home: sculpted(portalModel, { kind: 'light' }),
    siphon_altar: sculpted(siphonAltarModel),
    [SIPHON_CORE_TILE]: sculpted(siphonCoreModel),
  },
  containers: {
    // Shut and locked, open on its hoard, open and dark: the chest's state at a glance.
    chest: {
      unopened: closedChest,
      opened: sculpted(chestModel, { state: 'gold' }),
      empty: sculpted(chestModel, { state: 'empty' }, 1),
    },
  },
  lootPile: {
    small: sculpted(lootPileModel, { size: 'small' }, 1),
    large: sculpted(lootPileModel, { size: 'big' }, 1),
  },
};

/** The chest as an item (in a pack or a shop): shut. */
export const COTW_CHEST_SPRITE: PixelSprite = closedChest;
