import type { SpriteRecipe } from '../../../engine';
import { COTW_ATLAS_THEME } from '../atlas';

const P = COTW_ATLAS_THEME.palette!;

/** Terrain, door, stair, trap, zone and town tile recipes. */
export const COTW_TILE_SPRITES: Record<string, SpriteRecipe> = {
  wall: (ctx, ox, oy) => {
    // Stone brick masonry
    ctx.fillStyle = '#1c2333';
    ctx.fillRect(ox, oy, 32, 32);

    // Brick rows
    const brickH = 7;
    for (let r = 0; r < 4; r++) {
      const y = oy + r * 8;
      const offset = r % 2 === 0 ? 0 : 8;

      ctx.fillStyle = r % 2 === 0 ? '#273349' : '#222d42';
      ctx.fillRect(ox, y, 32, brickH);

      // Mortar lines
      ctx.fillStyle = '#0f141f';
      ctx.fillRect(ox, y + brickH, 32, 1);

      // Vertical mortar
      ctx.fillRect(ox + ((offset + 16) % 32), y, 1, brickH);
      ctx.fillRect(ox + ((offset + 32) % 32), y, 1, brickH);

      // Highlight top bevel of brick
      ctx.fillStyle = '#3a4b6b';
      ctx.fillRect(ox, y, 32, 1);
    }
  },

  floor: (ctx, ox, oy) => {
    // Dungeon stone slab
    ctx.fillStyle = '#0c1017';
    ctx.fillRect(ox, oy, 32, 32);

    // Subtle stone texture
    ctx.fillStyle = '#141b27';
    ctx.fillRect(ox + 2, oy + 2, 13, 13);
    ctx.fillRect(ox + 17, oy + 2, 13, 13);
    ctx.fillRect(ox + 2, oy + 17, 13, 13);
    ctx.fillRect(ox + 17, oy + 17, 13, 13);

    // Flagstone seam
    ctx.fillStyle = '#080a0f';
    ctx.fillRect(ox + 15, oy, 2, 32);
    ctx.fillRect(ox, oy + 15, 32, 2);

    // Surface pebble flecks
    ctx.fillStyle = '#1f2a3c';
    ctx.fillRect(ox + 6, oy + 7, 2, 2);
    ctx.fillRect(ox + 22, oy + 10, 2, 2);
    ctx.fillRect(ox + 9, oy + 24, 2, 2);
    ctx.fillRect(ox + 25, oy + 22, 2, 2);
  },

  door_closed: (ctx, ox, oy) => {
    COTW_TILE_SPRITES.floor(ctx, ox, oy, 32);

    // Wooden door frame
    ctx.fillStyle = '#451a03';
    ctx.fillRect(ox + 4, oy + 2, 24, 28);

    // Vertical wooden planks
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 6, oy + 4, 6, 24);
    ctx.fillRect(ox + 13, oy + 4, 6, 24);
    ctx.fillRect(ox + 20, oy + 4, 6, 24);

    // Iron reinforcement hinges
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(ox + 4, oy + 8, 24, 3);
    ctx.fillRect(ox + 4, oy + 22, 24, 3);

    // Brass keyhole / handle
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 8, oy + 15, 3, 4);
  },

  door_open: (ctx, ox, oy) => {
    COTW_TILE_SPRITES.floor(ctx, ox, oy, 32);

    // Open stone passage
    ctx.fillStyle = '#030508';
    ctx.fillRect(ox + 6, oy + 2, 20, 28);

    // Door swung back against right wall
    ctx.fillStyle = '#552206';
    ctx.fillRect(ox + 22, oy + 4, 6, 24);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(ox + 24, oy + 8, 4, 2);
    ctx.fillRect(ox + 24, oy + 22, 4, 2);
  },

  stairs_up: (ctx, ox, oy) => {
    COTW_TILE_SPRITES.floor(ctx, ox, oy, 32);

    // Ascending stone steps
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(ox + 5, oy + 5, 22, 22);

    ctx.fillStyle = '#334155';
    ctx.fillRect(ox + 7, oy + 7, 18, 5);
    ctx.fillRect(ox + 9, oy + 12, 14, 5);
    ctx.fillRect(ox + 11, oy + 17, 10, 5);

    // Golden upward chevron
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(ox + 16, oy + 8);
    ctx.lineTo(ox + 22, oy + 15);
    ctx.lineTo(ox + 19, oy + 15);
    ctx.lineTo(ox + 16, oy + 11);
    ctx.lineTo(ox + 13, oy + 15);
    ctx.lineTo(ox + 10, oy + 15);
    ctx.closePath();
    ctx.fill();
  },

  stairs_down: (ctx, ox, oy) => {
    COTW_TILE_SPRITES.floor(ctx, ox, oy, 32);

    // Descending dark abyss
    ctx.fillStyle = '#020617';
    ctx.fillRect(ox + 5, oy + 5, 22, 22);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(ox + 7, oy + 7, 18, 5);
    ctx.fillRect(ox + 9, oy + 12, 14, 5);
    ctx.fillRect(ox + 11, oy + 17, 10, 5);

    // Cyan downward chevron
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(ox + 16, oy + 23);
    ctx.lineTo(ox + 22, oy + 16);
    ctx.lineTo(ox + 19, oy + 16);
    ctx.lineTo(ox + 16, oy + 20);
    ctx.lineTo(ox + 13, oy + 16);
    ctx.lineTo(ox + 10, oy + 16);
    ctx.closePath();
    ctx.fill();
  },

  trap: (ctx, ox, oy) => {
    COTW_TILE_SPRITES.floor(ctx, ox, oy, 32);

    // Stone plate border
    ctx.fillStyle = '#334155';
    ctx.fillRect(ox + 7, oy + 7, 18, 18);

    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + 7.5, oy + 7.5, 17, 17);

    // Dark pit / pressure slits
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(ox + 10, oy + 10, 4, 4);
    ctx.fillRect(ox + 18, oy + 10, 4, 4);
    ctx.fillRect(ox + 10, oy + 18, 4, 4);
    ctx.fillRect(ox + 18, oy + 18, 4, 4);

    // Center warning glyph / trigger plate
    ctx.fillStyle = '#d97706';
    ctx.fillRect(ox + 14, oy + 14, 4, 4);
  },

  secret_door: (ctx, ox, oy) => {
    COTW_TILE_SPRITES.wall(ctx, ox, oy, 32);
  },

  wall_rime_hollows: (ctx, ox, oy) => {
    ctx.fillStyle = P.rimeWall ?? '#1e293b';
    ctx.fillRect(ox, oy, 32, 32);
    // Frosty mortar and glacial ice bevels
    ctx.fillStyle = P.rimeIce ?? '#38bdf8';
    ctx.fillRect(ox, oy + 7, 32, 1);
    ctx.fillRect(ox, oy + 15, 32, 1);
    ctx.fillRect(ox, oy + 23, 32, 1);
    ctx.fillStyle = P.rimeFrost ?? '#e0f2fe';
    ctx.fillRect(ox + 4, oy + 1, 8, 2);
    ctx.fillRect(ox + 18, oy + 9, 10, 2);
  },

  floor_rime_hollows: (ctx, ox, oy) => {
    ctx.fillStyle = P.rimeFloor ?? '#0c1a2e';
    ctx.fillRect(ox, oy, 32, 32);
    // Pale ice sheen and permafrost cracks
    ctx.fillStyle = P.rimeIce ?? '#38bdf8';
    ctx.fillRect(ox + 3, oy + 5, 8, 1);
    ctx.fillRect(ox + 18, oy + 22, 10, 1);
    ctx.fillStyle = P.rimeFrost ?? '#e0f2fe';
    ctx.fillRect(ox + 7, oy + 14, 2, 2);
  },

  wall_dwarven_works: (ctx, ox, oy) => {
    ctx.fillStyle = P.dwarfStone ?? '#292524';
    ctx.fillRect(ox, oy, 32, 32);
    // Brass structural plates & rivets
    ctx.fillStyle = P.dwarfBrass ?? '#d97706';
    ctx.fillRect(ox, oy + 8, 32, 2);
    ctx.fillRect(ox, oy + 22, 32, 2);
    ctx.fillStyle = P.dwarfGlow ?? '#f97316';
    ctx.fillRect(ox + 6, oy + 9, 2, 1);
    ctx.fillRect(ox + 24, oy + 23, 2, 1);
  },

  floor_dwarven_works: (ctx, ox, oy) => {
    ctx.fillStyle = P.dwarfIron ?? '#44403c';
    ctx.fillRect(ox, oy, 32, 32);
    // Paved stone slabs with brass expansion lines
    ctx.fillStyle = P.dwarfStone ?? '#292524';
    ctx.fillRect(ox + 2, oy + 2, 13, 13);
    ctx.fillRect(ox + 17, oy + 2, 13, 13);
    ctx.fillRect(ox + 2, oy + 17, 13, 13);
    ctx.fillRect(ox + 17, oy + 17, 13, 13);
    ctx.fillStyle = P.dwarfBrass ?? '#d97706';
    ctx.fillRect(ox + 15, oy + 15, 2, 2);
  },

  wall_obsidian_siphon: (ctx, ox, oy) => {
    ctx.fillStyle = P.obsidianBlack ?? '#0a0a0c';
    ctx.fillRect(ox, oy, 32, 32);
    // Molten lava seams between obsidian blocks
    ctx.fillStyle = P.magmaRed ?? '#dc2626';
    ctx.fillRect(ox, oy + 10, 32, 1);
    ctx.fillRect(ox, oy + 21, 32, 1);
    ctx.fillStyle = P.magmaOrange ?? '#ea580c';
    ctx.fillRect(ox + 12, oy + 10, 8, 1);
    ctx.fillRect(ox + 4, oy + 21, 6, 1);
  },

  floor_obsidian_siphon: (ctx, ox, oy) => {
    ctx.fillStyle = P.obsidianBlack ?? '#0a0a0c';
    ctx.fillRect(ox, oy, 32, 32);
    // Glowing lava vein cracks
    ctx.fillStyle = P.magmaOrange ?? '#ea580c';
    ctx.fillRect(ox + 5, oy + 8, 12, 1);
    ctx.fillRect(ox + 16, oy + 8, 1, 9);
    ctx.fillRect(ox + 16, oy + 17, 11, 1);
    ctx.fillStyle = P.lavaYellow ?? '#fef08a';
    ctx.fillRect(ox + 10, oy + 8, 4, 1);
  },

  wall_tarnished_silver: (ctx, ox, oy) => {
    ctx.fillStyle = P.silverDark ?? '#181e29';
    ctx.fillRect(ox, oy, 32, 32);
    // Native silver ore veins glinting in stone
    ctx.fillStyle = P.silverVein ?? '#94a3b8';
    ctx.fillRect(ox + 4, oy + 6, 14, 2);
    ctx.fillRect(ox + 16, oy + 19, 12, 2);
    ctx.fillStyle = P.silverShine ?? '#e2e8f0';
    ctx.fillRect(ox + 8, oy + 6, 4, 1);
    ctx.fillRect(ox + 20, oy + 19, 5, 1);
  },

  floor_tarnished_silver: (ctx, ox, oy) => {
    ctx.fillStyle = P.silverDark ?? '#181e29';
    ctx.fillRect(ox, oy, 32, 32);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(ox + 2, oy + 2, 28, 28);
    // Scattered silver ore flecks
    ctx.fillStyle = P.silverShine ?? '#e2e8f0';
    ctx.fillRect(ox + 6, oy + 8, 2, 2);
    ctx.fillRect(ox + 22, oy + 14, 2, 2);
    ctx.fillRect(ox + 14, oy + 24, 2, 2);
  },

  wall_world_bark: (ctx, ox, oy) => {
    ctx.fillStyle = P.barkBrown ?? '#451a03';
    ctx.fillRect(ox, oy, 32, 32);
    // Mossy vertical bark crevices
    ctx.fillStyle = P.barkGreen ?? '#14532d';
    ctx.fillRect(ox + 7, oy, 3, 32);
    ctx.fillRect(ox + 21, oy, 3, 32);
    ctx.fillStyle = P.mossGreen ?? '#15803d';
    ctx.fillRect(ox + 8, oy + 6, 2, 8);
    ctx.fillRect(ox + 22, oy + 18, 2, 8);
  },

  floor_world_bark: (ctx, ox, oy) => {
    ctx.fillStyle = '#271202';
    ctx.fillRect(ox, oy, 32, 32);
    // Gnarly root tendrils crossing loam
    ctx.fillStyle = P.rootWood ?? '#78350f';
    ctx.fillRect(ox, oy + 14, 32, 3);
    ctx.fillRect(ox + 13, oy, 3, 32);
    ctx.fillStyle = P.mossGreen ?? '#15803d';
    ctx.fillRect(ox + 5, oy + 8, 3, 3);
    ctx.fillRect(ox + 22, oy + 22, 3, 3);
  },

  wall_maw_of_malice: (ctx, ox, oy) => {
    ctx.fillStyle = P.maliceVoid ?? '#090514';
    ctx.fillRect(ox, oy, 32, 32);
    // Chitinous purple ribs and crimson veins
    ctx.fillStyle = P.malicePurple ?? '#4c1d95';
    ctx.fillRect(ox, oy + 7, 32, 2);
    ctx.fillRect(ox, oy + 22, 32, 2);
    ctx.fillStyle = P.boneWhite ?? '#f1f5f9';
    ctx.fillRect(ox + 8, oy + 6, 2, 4);
    ctx.fillRect(ox + 22, oy + 21, 2, 4);
  },

  floor_maw_of_malice: (ctx, ox, oy) => {
    ctx.fillStyle = P.maliceVoid ?? '#090514';
    ctx.fillRect(ox, oy, 32, 32);
    // Necrotic malice pools
    ctx.fillStyle = P.maliceCrimson ?? '#991b1b';
    ctx.fillRect(ox + 6, oy + 7, 10, 3);
    ctx.fillRect(ox + 16, oy + 18, 11, 3);
    ctx.fillStyle = P.malicePurple ?? '#4c1d95';
    ctx.fillRect(ox + 8, oy + 8, 5, 2);
  },

  wall_rotting_root: (ctx, ox, oy) => {
    ctx.fillStyle = P.rootBlight ?? '#1a1c12';
    ctx.fillRect(ox, oy, 32, 32);
    // Blighted black heartwood with toxic green fungal growth
    ctx.fillStyle = P.blightCore ?? '#365314';
    ctx.fillRect(ox + 5, oy, 4, 32);
    ctx.fillRect(ox + 20, oy, 4, 32);
    ctx.fillStyle = P.eldritchGlow ?? '#a3e635';
    ctx.fillRect(ox + 6, oy + 10, 2, 4);
    ctx.fillRect(ox + 21, oy + 20, 2, 4);
  },

  floor_rotting_root: (ctx, ox, oy) => {
    ctx.fillStyle = P.rootBlight ?? '#1a1c12';
    ctx.fillRect(ox, oy, 32, 32);
    // Decaying wood with bioluminescent pustules
    ctx.fillStyle = P.toxicGreen ?? '#4d7c0f';
    ctx.fillRect(ox + 4, oy + 12, 14, 2);
    ctx.fillStyle = P.eldritchGlow ?? '#a3e635';
    ctx.fillRect(ox + 8, oy + 11, 3, 3);
    ctx.fillRect(ox + 22, oy + 20, 3, 3);
  },

  wall_town: (ctx, ox, oy) => {
    // Stacked Scandinavian timber logs with chinking
    ctx.fillStyle = P.townWood ?? '#78350f';
    ctx.fillRect(ox, oy, 32, 32);
    for (let r = 0; r < 4; r++) {
      const y = oy + r * 8;
      ctx.fillStyle = P.townPlank ?? '#92400e';
      ctx.fillRect(ox, y + 1, 32, 6);
      ctx.fillStyle = '#451a03';
      ctx.fillRect(ox, y + 7, 32, 1);
    }
  },

  floor_town: (ctx, ox, oy) => {
    // Timber wood planks with nail pegs
    ctx.fillStyle = P.townWood ?? '#78350f';
    ctx.fillRect(ox, oy, 32, 32);
    for (let i = 0; i < 4; i++) {
      const x = ox + i * 8;
      ctx.fillStyle = P.townPlank ?? '#92400e';
      ctx.fillRect(x + 1, oy, 6, 32);
      ctx.fillStyle = '#451a03';
      ctx.fillRect(x + 7, oy, 1, 32);
    }
  },

  floor_town_snow: (ctx, ox, oy) => {
    // Packed snow-dusted cobblestone path. Deliberately low-contrast and sparse —
    // this tile repeats across the entire town square, so anything bolder than a
    // faint dusting turns into a loud grid pattern at that scale.
    ctx.fillStyle = P.stoneDark ?? '#1c2333';
    ctx.fillRect(ox, oy, 32, 32);
    ctx.fillStyle = P.rimeWall ?? '#1e293b';
    ctx.fillRect(ox + 3, oy + 19, 12, 9);
    ctx.fillRect(ox + 17, oy + 4, 11, 8);
    // Faint snow dusting, just a couple of small flecks
    ctx.fillStyle = P.rimeFrost ?? '#e0f2fe';
    ctx.fillRect(ox + 7, oy + 10, 3, 2);
    ctx.fillRect(ox + 21, oy + 23, 3, 2);
  },

  wall_town_temple: (ctx, ox, oy) => {
    // Sacred ash-white stone with gold runic inlays
    ctx.fillStyle = P.townTempleStone ?? '#475569';
    ctx.fillRect(ox, oy, 32, 32);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(ox + 2, oy + 2, 28, 28);
    // Gilded Thor's Hammer motif
    ctx.fillStyle = P.townTempleGold ?? '#eab308';
    ctx.fillRect(ox + 13, oy + 11, 6, 11);
    ctx.fillRect(ox + 10, oy + 8, 12, 4);
  },

  floor_town_temple: (ctx, ox, oy) => {
    // Sacred temple mosaic floor — muted stone rather than a near-white fill, so
    // the gold inlay reads as the deliberate accent instead of everything glaring
    ctx.fillStyle = P.townTempleStone ?? '#475569';
    ctx.fillRect(ox, oy, 32, 32);
    ctx.fillStyle = P.silverVein ?? '#94a3b8';
    ctx.fillRect(ox + 4, oy + 4, 24, 24);
    ctx.fillStyle = P.townTempleGold ?? '#eab308';
    ctx.fillRect(ox + 14, oy + 14, 4, 4);
    ctx.strokeStyle = P.townTempleGold ?? '#eab308';
    ctx.strokeRect(ox + 8, oy + 8, 16, 16);
  },

  wall_town_smithy: (ctx, ox, oy) => {
    // Soot-stained rough stone smithy wall with tool hooks
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(ox, oy, 32, 32);
    ctx.fillStyle = P.townSmithyIron ?? '#334155';
    ctx.fillRect(ox + 3, oy + 3, 26, 26);
    // Iron hooks & rack
    ctx.fillStyle = '#78716c';
    ctx.fillRect(ox + 6, oy + 10, 20, 2);
    ctx.fillRect(ox + 10, oy + 12, 2, 4);
    ctx.fillRect(ox + 19, oy + 12, 2, 4);
  },

  floor_town_smithy: (ctx, ox, oy) => {
    // Heavy anvil-flagged ironstone with glowing embers
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(ox, oy, 32, 32);
    ctx.fillStyle = P.dwarfStone ?? '#292524';
    ctx.fillRect(ox + 2, oy + 2, 28, 28);
    // Embers
    ctx.fillStyle = P.hearthGlow ?? '#f97316';
    ctx.fillRect(ox + 8, oy + 12, 2, 2);
    ctx.fillRect(ox + 21, oy + 20, 2, 2);
  },

  wall_town_shop: (ctx, ox, oy) => {
    // Timber shop wall with shelves
    ctx.fillStyle = P.townWood ?? '#78350f';
    ctx.fillRect(ox, oy, 32, 32);
    ctx.fillStyle = P.townPlank ?? '#92400e';
    ctx.fillRect(ox + 2, oy + 12, 28, 3);
    // Jars & goods on shelf
    ctx.fillStyle = P.townShopTeal ?? '#0e7490';
    ctx.fillRect(ox + 6, oy + 7, 4, 5);
    ctx.fillStyle = P.goldYellow ?? '#f59e0b';
    ctx.fillRect(ox + 14, oy + 8, 5, 4);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(ox + 22, oy + 7, 4, 5);
  },

  floor_town_shop: (ctx, ox, oy) => {
    // Polished clean shopkeeper parquet floor
    ctx.fillStyle = P.townWood ?? '#78350f';
    ctx.fillRect(ox, oy, 32, 32);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(ox + 2, oy + 2, 13, 13);
    ctx.fillRect(ox + 17, oy + 17, 13, 13);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(ox + 17, oy + 2, 13, 13);
    ctx.fillRect(ox + 2, oy + 17, 13, 13);
  },

  wall_town_bank: (ctx, ox, oy) => {
    // Vault masonry with reinforced steel bands & rivets
    ctx.fillStyle = P.stoneDark ?? '#1c2333';
    ctx.fillRect(ox, oy, 32, 32);
    ctx.fillStyle = P.townBankSteel ?? '#1e293b';
    ctx.fillRect(ox, oy + 8, 32, 3);
    ctx.fillRect(ox, oy + 21, 32, 3);
    // Steel rivets
    ctx.fillStyle = P.silverShine ?? '#e2e8f0';
    ctx.fillRect(ox + 6, oy + 9, 2, 1);
    ctx.fillRect(ox + 16, oy + 9, 2, 1);
    ctx.fillRect(ox + 26, oy + 9, 2, 1);
  },

  floor_town_bank: (ctx, ox, oy) => {
    // Polished vault flagstones
    ctx.fillStyle = P.stoneDark ?? '#1c2333';
    ctx.fillRect(ox, oy, 32, 32);
    ctx.fillStyle = P.townBankSteel ?? '#1e293b';
    ctx.fillRect(ox + 3, oy + 3, 26, 26);
    ctx.strokeStyle = P.silverVein ?? '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + 6, oy + 6, 20, 20);
  },

  hearth_fire: (ctx, ox, oy) => {
    // Cozy stone hearth with crackling wood fire
    ctx.fillStyle = P.stoneDark ?? '#1c2333';
    ctx.fillRect(ox + 4, oy + 6, 24, 22);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(ox + 7, oy + 10, 18, 17);

    // Split oak firewood logs
    ctx.fillStyle = '#451a03';
    ctx.fillRect(ox + 8, oy + 21, 16, 4);

    // Bright glowing embers and fire flame
    ctx.fillStyle = P.hearthGlow ?? '#f97316';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 18, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.hearthAmber ?? '#fbbf24';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 17, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 15, oy + 15, 2, 2);
  },
};
