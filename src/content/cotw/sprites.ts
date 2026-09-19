import type { SpriteRecipe } from '../../engine';
import { COTW_ATLAS_THEME } from './atlas';
import { drawOrganicBlob, drawTaperedTail, drawRoundedLimb } from './organicShapes';

const P = COTW_ATLAS_THEME.palette!;

export const COTW_SPRITE_RECIPES: Record<string, SpriteRecipe> = {
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
    COTW_SPRITE_RECIPES.floor(ctx, ox, oy, 32);

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
    COTW_SPRITE_RECIPES.floor(ctx, ox, oy, 32);

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
    COTW_SPRITE_RECIPES.floor(ctx, ox, oy, 32);

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
    COTW_SPRITE_RECIPES.floor(ctx, ox, oy, 32);

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
    COTW_SPRITE_RECIPES.floor(ctx, ox, oy, 32);

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
    COTW_SPRITE_RECIPES.wall(ctx, ox, oy, 32);
  },

  player: (ctx, ox, oy) => {
    // Hero character cape — blue-shifted midnight sapphire
    ctx.fillStyle = P.heroBlueShift ?? '#1d4ed8';
    ctx.fillRect(ox + 9, oy + 12, 14, 14);

    // Blue adventurer tunic
    ctx.fillStyle = P.heroBlue ?? '#2563eb';
    ctx.fillRect(ox + 11, oy + 11, 10, 10);

    // Leather belt & buckle
    ctx.fillStyle = P.woodBrown ?? '#78350f';
    ctx.fillRect(ox + 11, oy + 17, 10, 2);
    ctx.fillStyle = P.goldYellow ?? '#fbbf24';
    ctx.fillRect(ox + 15, oy + 17, 2, 2);

    // Boots
    ctx.fillStyle = '#451a03';
    ctx.fillRect(ox + 11, oy + 22, 4, 6);
    ctx.fillRect(ox + 17, oy + 22, 4, 6);

    // Face / skin
    ctx.fillStyle = P.skinTone ?? '#fed7aa';
    ctx.fillRect(ox + 12, oy + 6, 8, 6);

    // Iron Helmet with cool blue steel glint
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(ox + 11, oy + 3, 10, 4);
    ctx.fillRect(ox + 10, oy + 5, 2, 4);
    ctx.fillRect(ox + 20, oy + 5, 2, 4);
    ctx.fillStyle = P.steelBlue ?? '#7dd3fc';
    ctx.fillRect(ox + 15, oy + 1, 2, 4);

    // Steel Sword with cyan glint
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(ox + 22, oy + 5, 2, 14);
    ctx.fillStyle = P.playerTintRim ?? '#93c5fd';
    ctx.fillRect(ox + 23, oy + 5, 1, 14);
    ctx.fillStyle = P.goldYellow ?? '#f59e0b';
    ctx.fillRect(ox + 20, oy + 16, 6, 2);

    // Shield in other hand with steel blue rim
    ctx.fillStyle = P.woodBrown ?? '#b45309';
    ctx.beginPath();
    ctx.arc(ox + 8, oy + 16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.steelBlue ?? '#7dd3fc';
    ctx.beginPath();
    ctx.arc(ox + 8, oy + 16, 2, 0, Math.PI * 2);
    ctx.fill();

    // Subtle blue shoulder rim highlight
    ctx.fillStyle = P.playerTintRim ?? '#93c5fd';
    ctx.fillRect(ox + 10, oy + 11, 1, 8);
  },


  kobold: (ctx, ox, oy) => {
    // Tail
    ctx.fillStyle = '#15803d';
    ctx.fillRect(ox + 6, oy + 20, 4, 3);
    ctx.fillRect(ox + 4, oy + 22, 3, 3);

    // Body
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(ox + 10, oy + 12, 10, 10);

    // Brown loincloth
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 10, oy + 18, 10, 4);

    // Legs
    ctx.fillStyle = '#15803d';
    ctx.fillRect(ox + 11, oy + 22, 3, 6);
    ctx.fillRect(ox + 16, oy + 22, 3, 6);

    // Head with snout
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(ox + 11, oy + 6, 11, 7);
    // Horns
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(ox + 12, oy + 4, 2, 3);
    ctx.fillRect(ox + 17, oy + 4, 2, 3);
    // Red glowing eyes
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(ox + 18, oy + 8, 2, 2);

    // Bone spear
    ctx.fillStyle = '#713f12';
    ctx.fillRect(ox + 22, oy + 4, 2, 22);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(ox + 21, oy + 2, 4, 4);
  },

  skeleton: (ctx, ox, oy) => {
    // Ribcage & spine
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(ox + 14, oy + 12, 4, 10);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(ox + 10, oy + 13, 12, 2);
    ctx.fillRect(ox + 11, oy + 16, 10, 2);
    ctx.fillRect(ox + 12, oy + 19, 8, 2);

    // Pelvis & legs
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(ox + 12, oy + 22, 3, 7);
    ctx.fillRect(ox + 17, oy + 22, 3, 7);

    // Skull
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(ox + 11, oy + 4, 10, 8);
    // Dark eye sockets
    ctx.fillStyle = '#020617';
    ctx.fillRect(ox + 13, oy + 7, 2, 3);
    ctx.fillRect(ox + 17, oy + 7, 2, 3);
    // Teeth
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(ox + 13, oy + 11, 6, 1);

    // Rusty Scimitar
    ctx.fillStyle = '#9a3412';
    ctx.fillRect(ox + 22, oy + 6, 3, 14);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(ox + 21, oy + 18, 5, 2);
  },

  giant_rat: (ctx, ox, oy) => {
    // Tail
    ctx.fillStyle = '#fda4af';
    ctx.fillRect(ox + 4, oy + 14, 4, 2);
    ctx.fillRect(ox + 2, oy + 16, 3, 5);

    // Fur body
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.ellipse(ox + 15, oy + 18, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Darker back fur
    ctx.fillStyle = '#451a03';
    ctx.fillRect(ox + 10, oy + 13, 8, 4);

    // Head
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.moveTo(ox + 21, oy + 14);
    ctx.lineTo(ox + 29, oy + 19);
    ctx.lineTo(ox + 21, oy + 22);
    ctx.closePath();
    ctx.fill();

    // Beady red eye
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(ox + 24, oy + 16, 2, 2);

    // Whiskers / nose
    ctx.fillStyle = '#fda4af';
    ctx.fillRect(ox + 28, oy + 18, 2, 2);

    // Claws
    ctx.fillStyle = '#451a03';
    ctx.fillRect(ox + 11, oy + 23, 3, 3);
    ctx.fillRect(ox + 19, oy + 23, 3, 3);
  },

  orc: (ctx, ox, oy) => {
    // Heavy green orc warrior
    ctx.fillStyle = '#14532d';
    ctx.fillRect(ox + 8, oy + 10, 16, 14);

    // Studded iron plate
    ctx.fillStyle = '#334155';
    ctx.fillRect(ox + 10, oy + 12, 12, 9);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(ox + 12, oy + 14, 2, 2);
    ctx.fillRect(ox + 18, oy + 14, 2, 2);

    // Massive head
    ctx.fillStyle = '#15803d';
    ctx.fillRect(ox + 10, oy + 4, 12, 8);
    // Horned helm
    ctx.fillStyle = '#64748b';
    ctx.fillRect(ox + 9, oy + 3, 14, 3);
    // Tusks
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 11, oy + 10, 2, 3);
    ctx.fillRect(ox + 19, oy + 10, 2, 3);
    // Red angry eyes
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(ox + 12, oy + 6, 2, 2);
    ctx.fillRect(ox + 18, oy + 6, 2, 2);

    // Battle axe
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 23, oy + 2, 3, 24);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(ox + 20, oy + 4, 9, 6);
  },

  shopkeeper: (ctx, ox, oy) => {
    ctx.fillStyle = '#15803d';
    ctx.fillRect(ox + 8, oy + 12, 16, 14);
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(ox + 11, oy + 14, 10, 12);

    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(ox + 11, oy + 5, 10, 8);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(ox + 10, oy + 4, 12, 3);
    ctx.fillRect(ox + 10, oy + 10, 12, 4);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(ox + 13, oy + 8, 2, 2);
    ctx.fillRect(ox + 17, oy + 8, 2, 2);

    ctx.fillStyle = '#d97706';
    ctx.fillRect(ox + 21, oy + 18, 5, 5);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(ox + 22, oy + 17, 3, 2);
  },

  townsperson: (ctx, ox, oy) => {
    ctx.fillStyle = '#b45309';
    ctx.fillRect(ox + 9, oy + 12, 14, 11);
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(ox + 10, oy + 23, 12, 6);

    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(ox + 11, oy + 6, 10, 7);
    ctx.fillStyle = '#475569';
    ctx.fillRect(ox + 10, oy + 4, 12, 3);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(ox + 13, oy + 8, 2, 2);
    ctx.fillRect(ox + 17, oy + 8, 2, 2);
  },

  priest: (ctx, ox, oy) => {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(ox + 8, oy + 10, 16, 18);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(ox + 14, oy + 10, 4, 18);
    ctx.fillRect(ox + 11, oy + 16, 10, 3);

    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(ox + 11, oy + 4, 10, 7);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(ox + 10, oy + 3, 12, 2);

    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(ox + 13, oy + 7, 2, 2);
    ctx.fillRect(ox + 17, oy + 7, 2, 2);

    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(ox + 22, oy + 12, 7, 5);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 24, oy + 17, 3, 10);
  },

  sage: (ctx, ox, oy) => {
    ctx.fillStyle = '#312e81';
    ctx.fillRect(ox + 7, oy + 10, 18, 18);
    ctx.fillStyle = '#a5b4fc';
    ctx.fillRect(ox + 10, oy + 18, 2, 2);
    ctx.fillRect(ox + 19, oy + 15, 2, 2);
    ctx.fillRect(ox + 12, oy + 24, 2, 2);

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(ox + 11, oy + 9, 10, 10);

    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(ox + 9, oy + 3, 14, 8);

    ctx.fillStyle = '#67e8f9';
    ctx.fillRect(ox + 12, oy + 7, 2, 2);
    ctx.fillRect(ox + 18, oy + 7, 2, 2);

    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(ox + 21, oy + 16, 8, 10);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(ox + 23, oy + 18, 4, 6);
  },

  banker: (ctx, ox, oy) => {
    ctx.fillStyle = '#581c87';
    ctx.fillRect(ox + 8, oy + 11, 16, 15);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(ox + 11, oy + 13, 10, 3);
    ctx.fillRect(ox + 15, oy + 16, 2, 3);

    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(ox + 11, oy + 5, 10, 7);
    ctx.fillStyle = '#475569';
    ctx.fillRect(ox + 10, oy + 3, 12, 3);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(ox + 13, oy + 7, 2, 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(ox + 17, oy + 7, 3, 3);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 21, oy + 10, 8, 2);
    ctx.fillRect(ox + 24, oy + 12, 2, 8);
    ctx.fillRect(ox + 20, oy + 14, 4, 2);
    ctx.fillRect(ox + 27, oy + 14, 4, 2);
  },

  guard: (ctx, ox, oy) => {
    ctx.fillStyle = '#475569';
    ctx.fillRect(ox + 8, oy + 10, 16, 17);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(ox + 11, oy + 11, 10, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 15, oy + 12, 2, 10);
    ctx.fillRect(ox + 12, oy + 15, 8, 2);

    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(ox + 10, oy + 3, 12, 8);
    ctx.fillStyle = '#334155';
    ctx.fillRect(ox + 15, oy + 6, 2, 5);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(ox + 12, oy + 7, 2, 2);
    ctx.fillRect(ox + 18, oy + 7, 2, 2);

    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 24, oy + 1, 2, 29);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(ox + 23, oy + 0, 4, 6);
  },

  player_female: (ctx, ox, oy) => {
    // Cape — cool Nordic blue sapphire
    ctx.fillStyle = P.heroBlueShift ?? '#1e40af';
    ctx.fillRect(ox + 9, oy + 12, 14, 14);

    // Cyan-blue adventurer tunic
    ctx.fillStyle = P.heroCyan ?? '#0284c7';
    ctx.fillRect(ox + 11, oy + 11, 10, 10);

    // Leather belt & buckle
    ctx.fillStyle = P.woodBrown ?? '#78350f';
    ctx.fillRect(ox + 11, oy + 17, 10, 2);
    ctx.fillStyle = P.goldYellow ?? '#fbbf24';
    ctx.fillRect(ox + 15, oy + 17, 2, 2);

    // Boots
    ctx.fillStyle = '#451a03';
    ctx.fillRect(ox + 11, oy + 22, 4, 6);
    ctx.fillRect(ox + 17, oy + 22, 4, 6);

    // Face / skin
    ctx.fillStyle = P.skinTone ?? '#fed7aa';
    ctx.fillRect(ox + 12, oy + 6, 8, 6);

    // Golden hair with cool blue circlet
    ctx.fillStyle = '#facc15';
    ctx.fillRect(ox + 11, oy + 3, 10, 4);
    ctx.fillRect(ox + 9, oy + 5, 3, 11);
    ctx.fillRect(ox + 20, oy + 5, 3, 11);

    ctx.fillStyle = P.playerTintRim ?? '#93c5fd';
    ctx.fillRect(ox + 11, oy + 4, 10, 2);
    ctx.fillStyle = P.steelBlue ?? '#7dd3fc';
    ctx.fillRect(ox + 15, oy + 3, 2, 2);

    // Steel Sword
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(ox + 22, oy + 6, 2, 13);
    ctx.fillStyle = P.playerTintRim ?? '#93c5fd';
    ctx.fillRect(ox + 23, oy + 6, 1, 13);
    ctx.fillStyle = P.goldYellow ?? '#f59e0b';
    ctx.fillRect(ox + 20, oy + 16, 6, 2);

    // Shield
    ctx.fillStyle = P.heroCyan ?? '#0369a1';
    ctx.beginPath();
    ctx.arc(ox + 8, oy + 16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = P.steelBlue ?? '#7dd3fc';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Subtle blue shoulder highlight
    ctx.fillStyle = P.playerTintRim ?? '#93c5fd';
    ctx.fillRect(ox + 10, oy + 11, 1, 8);
  },

  giant_boss: (ctx, ox, oy) => {
    ctx.fillStyle = '#78716c';
    ctx.fillRect(ox + 6, oy + 9, 20, 13);

    ctx.fillStyle = '#451a03';
    ctx.fillRect(ox + 5, oy + 10, 22, 5);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(ox + 8, oy + 15, 4, 7);
    ctx.fillRect(ox + 20, oy + 15, 4, 7);

    ctx.fillStyle = '#292524';
    ctx.fillRect(ox + 7, oy + 22, 6, 7);
    ctx.fillRect(ox + 19, oy + 22, 6, 7);

    ctx.fillStyle = '#57534e';
    ctx.fillRect(ox + 10, oy + 4, 12, 7);

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(ox + 12, oy + 6, 2, 2);
    ctx.fillRect(ox + 18, oy + 6, 2, 2);

    ctx.fillStyle = '#334155';
    ctx.fillRect(ox + 9, oy + 3, 14, 3);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(ox + 8, oy + 1, 3, 3);
    ctx.fillRect(ox + 21, oy + 1, 3, 3);

    ctx.fillStyle = '#1c1917';
    ctx.fillRect(ox + 6, oy + 20, 20, 3);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(ox + 8, oy + 20, 2, 3);
    ctx.fillRect(ox + 15, oy + 20, 2, 3);
    ctx.fillRect(ox + 22, oy + 20, 2, 3);

    ctx.fillStyle = '#334155';
    ctx.fillRect(ox + 25, oy + 4, 3, 22);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(ox + 23, oy + 3, 7, 9);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(ox + 21, oy + 5, 2, 2);
    ctx.fillRect(ox + 30, oy + 5, 2, 2);
    ctx.fillRect(ox + 26, oy + 1, 2, 2);
  },

  broadsword: (ctx, ox, oy) => {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(ox + 18, oy + 5, 4, 15);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(ox + 19, oy + 3, 2, 2);

    ctx.fillStyle = '#64748b';
    ctx.fillRect(ox + 19, oy + 7, 2, 11);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 14, oy + 20, 12, 3);

    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 18, oy + 23, 4, 4);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 18, oy + 27, 4, 3);
  },

  leather_armor: (ctx, ox, oy) => {
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 7, oy + 6, 18, 19);

    ctx.fillStyle = '#92400e';
    ctx.fillRect(ox + 5, oy + 6, 4, 8);
    ctx.fillRect(ox + 23, oy + 6, 4, 8);

    ctx.fillStyle = '#f59e0b';
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.fillRect(ox + 10 + c * 5, oy + 10 + r * 5, 2, 2);
      }
    }

    ctx.fillStyle = '#451a03';
    ctx.fillRect(ox + 7, oy + 21, 18, 3);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(ox + 14, oy + 21, 4, 3);
  },

  wooden_shield: (ctx, ox, oy) => {
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 11, oy + 6, 1, 20);
    ctx.fillRect(ox + 20, oy + 6, 1, 20);

    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 2, 0, Math.PI * 2);
    ctx.fill();
  },

  health_potion: (ctx, ox, oy) => {
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(ox + 13, oy + 6, 6, 5);

    ctx.fillStyle = '#b45309';
    ctx.fillRect(ox + 14, oy + 4, 4, 3);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 19, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 20, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fca5a5';
    ctx.fillRect(ox + 13, oy + 16, 2, 4);
  },

  gold_coins: (ctx, ox, oy) => {
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.ellipse(ox + 16, oy + 24, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    const drawCoin = (cx: number, cy: number) => {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 3, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    drawCoin(ox + 11, oy + 22);
    drawCoin(ox + 20, oy + 22);
    drawCoin(ox + 15, oy + 18);
    drawCoin(ox + 10, oy + 16);
    drawCoin(ox + 18, oy + 14);
    drawCoin(ox + 14, oy + 11);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 21, oy + 9, 2, 2);
    ctx.fillRect(ox + 8, oy + 12, 2, 2);
  },

  dagger: (ctx, ox, oy) => {
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(ox + 15, oy + 6, 3, 12);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(ox + 12, oy + 18, 9, 2);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(ox + 15, oy + 20, 3, 5);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 15, oy + 25, 3, 2);
  },

  helmet: (ctx, ox, oy) => {
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 10, Math.PI, 0);
    ctx.lineTo(ox + 26, oy + 24);
    ctx.lineTo(ox + 6, oy + 24);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(ox + 10, oy + 16, 12, 3);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 15, oy + 9, 2, 2);
  },

  boots: (ctx, ox, oy) => {
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 8, oy + 10, 6, 14);
    ctx.fillRect(ox + 6, oy + 20, 10, 4);

    ctx.fillRect(ox + 18, oy + 10, 6, 14);
    ctx.fillRect(ox + 16, oy + 20, 10, 4);

    ctx.fillStyle = '#451a03';
    ctx.fillRect(ox + 5, oy + 24, 11, 2);
    ctx.fillRect(ox + 15, oy + 24, 11, 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 10, oy + 14, 2, 2);
    ctx.fillRect(ox + 20, oy + 14, 2, 2);
  },

  backpack: (ctx, ox, oy) => {
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 7, oy + 8, 18, 18);

    ctx.fillStyle = '#92400e';
    ctx.fillRect(ox + 6, oy + 7, 20, 8);

    ctx.fillStyle = '#451a03';
    ctx.fillRect(ox + 10, oy + 7, 2, 19);
    ctx.fillRect(ox + 20, oy + 7, 2, 19);

    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(ox + 10, oy + 15, 2, 2);
    ctx.fillRect(ox + 20, oy + 15, 2, 2);
  },

  purse: (ctx, ox, oy) => {
    ctx.fillStyle = '#831843';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 19, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#9d174d';
    ctx.fillRect(ox + 13, oy + 9, 6, 4);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 12, oy + 12, 8, 2);
    ctx.fillRect(ox + 14, oy + 14, 2, 4);
    ctx.fillRect(ox + 17, oy + 14, 2, 4);
  },

  cursed_mace: (ctx, ox, oy) => {
    ctx.fillStyle = '#451a03';
    ctx.fillRect(ox + 15, oy + 12, 3, 16);

    ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 9, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(ox + 12, oy + 5, 9, 9);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(ox + 15, oy + 2, 3, 3);
    ctx.fillRect(ox + 9, oy + 8, 3, 3);
    ctx.fillRect(ox + 21, oy + 8, 3, 3);
  },

  chest: (ctx, ox, oy) => {
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 5, oy + 10, 22, 16);

    ctx.fillStyle = '#334155';
    ctx.fillRect(ox + 4, oy + 10, 3, 16);
    ctx.fillRect(ox + 25, oy + 10, 3, 16);
    ctx.fillRect(ox + 5, oy + 17, 22, 3);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 14, oy + 16, 4, 5);
  },

  belt: (ctx, ox, oy) => {
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 4, oy + 13, 24, 6);

    ctx.fillStyle = '#92400e';
    ctx.fillRect(ox + 6, oy + 11, 5, 8);
    ctx.fillRect(ox + 21, oy + 11, 5, 8);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 14, oy + 12, 4, 8);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 15, oy + 14, 2, 4);
  },

  sun_stone: (ctx, ox, oy) => {
    ctx.fillStyle = 'rgba(254, 240, 138, 0.4)';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 15, oy + 2, 2, 5);
    ctx.fillRect(ox + 15, oy + 25, 2, 5);
    ctx.fillRect(ox + 2, oy + 15, 5, 2);
    ctx.fillRect(ox + 25, oy + 15, 5, 2);

    ctx.fillRect(ox + 6, oy + 6, 3, 3);
    ctx.fillRect(ox + 23, oy + 6, 3, 3);
    ctx.fillRect(ox + 6, oy + 23, 3, 3);
    ctx.fillRect(ox + 23, oy + 23, 3, 3);

    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 14, oy + 13, 3, 3);
  },

  travel_bread: (ctx, ox, oy) => {
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.ellipse(ox + 16, oy + 17, 11, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.ellipse(ox + 16, oy + 15, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fde68a';
    ctx.fillRect(ox + 11, oy + 13, 10, 2);

    ctx.fillStyle = '#451a03';
    ctx.fillRect(ox + 10, oy + 14, 2, 4);
    ctx.fillRect(ox + 15, oy + 13, 2, 5);
    ctx.fillRect(ox + 20, oy + 14, 2, 4);

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(ox + 14, oy + 11, 4, 10);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(ox + 15, oy + 10, 2, 2);
  },

  // ==========================================
  // MONSTER ARCHETYPES (Phase 5)
  // ==========================================

  dragon: (ctx, ox, oy) => {
    // Tail
    ctx.fillStyle = P.crimsonRed ?? '#ef4444';
    drawTaperedTail(ctx, ox + 16, oy + 20, ox + 4, oy + 26, 6, 2);

    // Draconic body
    drawOrganicBlob(ctx, ox + 16, oy + 16, 9, 8, 0.12);

    // Wings
    ctx.fillStyle = P.maliceCrimson ?? '#991b1b';
    ctx.beginPath();
    ctx.moveTo(ox + 16, oy + 14);
    ctx.lineTo(ox + 6, oy + 8);
    ctx.lineTo(ox + 10, oy + 16);
    ctx.lineTo(ox + 16, oy + 14);
    ctx.moveTo(ox + 16, oy + 14);
    ctx.lineTo(ox + 26, oy + 8);
    ctx.lineTo(ox + 22, oy + 16);
    ctx.closePath();
    ctx.fill();

    // Head and snout
    ctx.fillStyle = P.crimsonRed ?? '#ef4444';
    ctx.fillRect(ox + 12, oy + 6, 8, 8);
    ctx.fillRect(ox + 10, oy + 9, 3, 4);

    // Horns
    ctx.fillStyle = P.goldYellow ?? '#f59e0b';
    drawRoundedLimb(ctx, ox + 14, oy + 7, ox + 11, oy + 2, 3);
    drawRoundedLimb(ctx, ox + 18, oy + 7, ox + 21, oy + 2, 3);

    // Eyes
    ctx.fillStyle = P.lavaYellow ?? '#fef08a';
    ctx.fillRect(ox + 12, oy + 8, 2, 2);
  },

  wyrm: (ctx, ox, oy) => {
    // Coiled serpentine body
    ctx.fillStyle = P.malicePurple ?? '#4c1d95';
    drawOrganicBlob(ctx, ox + 16, oy + 18, 11, 7, 0.22);
    ctx.fillStyle = P.obsidianPurple ?? '#1e1b4b';
    drawTaperedTail(ctx, ox + 16, oy + 18, ox + 6, oy + 25, 7, 2);

    // Head
    ctx.fillStyle = P.malicePurple ?? '#4c1d95';
    ctx.beginPath();
    ctx.arc(ox + 18, oy + 10, 6, 0, Math.PI * 2);
    ctx.fill();

    // Spines
    ctx.fillStyle = P.spectralCyan ?? '#67e8f9';
    ctx.fillRect(ox + 14, oy + 5, 2, 3);
    ctx.fillRect(ox + 18, oy + 3, 2, 4);
    ctx.fillRect(ox + 22, oy + 5, 2, 3);

    // Fangs & Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 21, oy + 12, 2, 3);
    ctx.fillStyle = P.eyeAmber ?? '#fbbf24';
    ctx.fillRect(ox + 17, oy + 8, 2, 2);
  },

  aberration: (ctx, ox, oy) => {
    // Chaotic amorphous eldritch blob
    ctx.fillStyle = P.maliceVoid ?? '#090514';
    drawOrganicBlob(ctx, ox + 16, oy + 16, 12, 11, 0.28);
    ctx.fillStyle = P.malicePurple ?? '#4c1d95';
    drawOrganicBlob(ctx, ox + 16, oy + 16, 9, 8, 0.2);

    // Writhing tentacles
    ctx.fillStyle = P.maliceCrimson ?? '#991b1b';
    drawTaperedTail(ctx, ox + 10, oy + 18, ox + 4, oy + 25, 4, 1);
    drawTaperedTail(ctx, ox + 22, oy + 18, ox + 28, oy + 25, 4, 1);
    drawTaperedTail(ctx, ox + 16, oy + 22, ox + 18, oy + 29, 5, 1);

    // Cluster of unblinking eyes
    ctx.fillStyle = P.eyeAmber ?? '#fbbf24';
    ctx.fillRect(ox + 12, oy + 11, 3, 3);
    ctx.fillRect(ox + 18, oy + 12, 2, 2);
    ctx.fillRect(ox + 14, oy + 16, 3, 3);
    ctx.fillStyle = '#000000';
    ctx.fillRect(ox + 13, oy + 12, 1, 2);
    ctx.fillRect(ox + 15, oy + 17, 1, 2);
  },

  fiend: (ctx, ox, oy) => {
    // Dark winged fiend torso
    ctx.fillStyle = P.maliceVoid ?? '#090514';
    ctx.fillRect(ox + 11, oy + 10, 10, 12);

    // Wings
    ctx.fillStyle = P.crimsonRed ?? '#ef4444';
    drawTaperedTail(ctx, ox + 13, oy + 12, ox + 3, oy + 6, 6, 2);
    drawTaperedTail(ctx, ox + 19, oy + 12, ox + 29, oy + 6, 6, 2);

    // Horns
    ctx.fillStyle = P.boneWhite ?? '#f1f5f9';
    drawRoundedLimb(ctx, ox + 13, oy + 8, ox + 9, oy + 3, 3);
    drawRoundedLimb(ctx, ox + 19, oy + 8, ox + 23, oy + 3, 3);

    // Glowing face
    ctx.fillStyle = P.magmaOrange ?? '#ea580c';
    ctx.fillRect(ox + 12, oy + 7, 8, 7);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(ox + 13, oy + 9, 2, 2);
    ctx.fillRect(ox + 17, oy + 9, 2, 2);

    // Legs / hooves
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(ox + 11, oy + 22, 3, 6);
    ctx.fillRect(ox + 18, oy + 22, 3, 6);
  },

  dragon_boss: (ctx, ox, oy) => {
    // Níðhögg / World Root Dragon
    ctx.fillStyle = P.rootBlight ?? '#1a1c12';
    drawOrganicBlob(ctx, ox + 16, oy + 16, 13, 10, 0.2);

    // Colossal wings
    ctx.fillStyle = P.blightCore ?? '#365314';
    drawTaperedTail(ctx, ox + 14, oy + 12, ox + 2, oy + 4, 8, 2);
    drawTaperedTail(ctx, ox + 18, oy + 12, ox + 30, oy + 4, 8, 2);

    // Spiked crown
    ctx.fillStyle = P.eldritchGlow ?? '#a3e635';
    ctx.fillRect(ox + 12, oy + 4, 2, 5);
    ctx.fillRect(ox + 15, oy + 2, 2, 6);
    ctx.fillRect(ox + 18, oy + 4, 2, 5);

    // Draconic head with glowing toxic maw
    ctx.fillStyle = P.toxicGreen ?? '#4d7c0f';
    ctx.fillRect(ox + 11, oy + 8, 10, 9);
    ctx.fillStyle = P.eldritchGlow ?? '#a3e635';
    ctx.fillRect(ox + 13, oy + 10, 2, 2);
    ctx.fillRect(ox + 17, oy + 10, 2, 2);
    ctx.fillRect(ox + 14, oy + 14, 4, 2);
  },

  draugr: (ctx, ox, oy) => {
    // Ancient rusted mail
    ctx.fillStyle = P.silverDark ?? '#181e29';
    ctx.fillRect(ox + 10, oy + 11, 12, 11);

    // Frostbitten limbs
    ctx.fillStyle = P.rimeWall ?? '#1e293b';
    ctx.fillRect(ox + 11, oy + 22, 4, 7);
    ctx.fillRect(ox + 17, oy + 22, 4, 7);

    // Skull / face
    ctx.fillStyle = P.boneGray ?? '#cbd5e1';
    ctx.fillRect(ox + 12, oy + 5, 8, 7);

    // Piercing ice blue eyes
    ctx.fillStyle = P.rimeIce ?? '#38bdf8';
    ctx.fillRect(ox + 13, oy + 7, 2, 2);
    ctx.fillRect(ox + 17, oy + 7, 2, 2);

    // Notched northern battleaxe
    ctx.fillStyle = P.woodBrown ?? '#78350f';
    ctx.fillRect(ox + 22, oy + 3, 2, 23);
    ctx.fillStyle = P.silverVein ?? '#94a3b8';
    ctx.fillRect(ox + 20, oy + 5, 6, 6);
  },

  wight: (ctx, ox, oy) => {
    // Tattered burial shroud
    ctx.fillStyle = '#334155';
    drawOrganicBlob(ctx, ox + 16, oy + 16, 8, 10, 0.15);

    // Gaunt skull
    ctx.fillStyle = P.boneWhite ?? '#f1f5f9';
    ctx.fillRect(ox + 12, oy + 5, 8, 7);

    // Ghostly cyan eyes
    ctx.fillStyle = P.spectralCyan ?? '#67e8f9';
    ctx.fillRect(ox + 13, oy + 7, 2, 2);
    ctx.fillRect(ox + 17, oy + 7, 2, 2);

    // Ancient broadsword
    ctx.fillStyle = P.silverShine ?? '#e2e8f0';
    ctx.fillRect(ox + 23, oy + 7, 2, 14);
    ctx.fillStyle = P.dwarfBrass ?? '#d97706';
    ctx.fillRect(ox + 21, oy + 17, 6, 2);
  },

  zombie: (ctx, ox, oy) => {
    // Shambling rotting corpse
    ctx.fillStyle = P.dwarfRust ?? '#7c2d12';
    ctx.fillRect(ox + 10, oy + 12, 12, 10);

    // Decayed flesh
    ctx.fillStyle = P.toxicGreen ?? '#4d7c0f';
    ctx.fillRect(ox + 12, oy + 6, 8, 7);
    ctx.fillRect(ox + 11, oy + 22, 3, 7);
    ctx.fillRect(ox + 18, oy + 22, 3, 7);

    // Exposed ribcage
    ctx.fillStyle = P.boneWhite ?? '#f1f5f9';
    ctx.fillRect(ox + 13, oy + 14, 6, 1);
    ctx.fillRect(ox + 13, oy + 16, 6, 1);

    // Dull eyes
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(ox + 13, oy + 8, 2, 2);
  },

  wraith: (ctx, ox, oy) => {
    // Billowing hooded dark mist
    ctx.fillStyle = P.maliceVoid ?? '#090514';
    drawOrganicBlob(ctx, ox + 16, oy + 14, 9, 10, 0.2);
    drawTaperedTail(ctx, ox + 16, oy + 18, ox + 12, oy + 29, 8, 1);

    // Twin cold cyan pinpoint eyes in hollow cowl
    ctx.fillStyle = P.spectralCyan ?? '#67e8f9';
    ctx.fillRect(ox + 13, oy + 10, 2, 2);
    ctx.fillRect(ox + 17, oy + 10, 2, 2);
  },

  spectral: (ctx, ox, oy) => {
    // Floating phantom visage with ethereal trails
    ctx.fillStyle = P.spectralCyan ?? '#67e8f9';
    drawOrganicBlob(ctx, ox + 16, oy + 12, 8, 7, 0.18);
    ctx.fillStyle = P.phantomTeal ?? '#2dd4bf';
    drawTaperedTail(ctx, ox + 14, oy + 15, ox + 8, oy + 26, 6, 1);
    drawTaperedTail(ctx, ox + 18, oy + 15, ox + 22, oy + 26, 6, 1);

    // Spectral eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 13, oy + 10, 2, 2);
    ctx.fillRect(ox + 17, oy + 10, 2, 2);
  },

  spirit: (ctx, ox, oy) => {
    // Luminous folklore wisp orb
    ctx.fillStyle = P.rimeFrost ?? '#e0f2fe';
    drawOrganicBlob(ctx, ox + 16, oy + 15, 7, 7, 0.15);
    ctx.fillStyle = P.rimeGlow ?? '#7dd3fc';
    drawOrganicBlob(ctx, ox + 16, oy + 15, 5, 5, 0.1);

    // Floating light particles
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 15, oy + 14, 2, 2);
    ctx.fillRect(ox + 11, oy + 22, 2, 2);
    ctx.fillRect(ox + 21, oy + 20, 2, 2);
  },

  fae: (ctx, ox, oy) => {
    // Delicate winged woodland fae
    ctx.fillStyle = P.leafGold ?? '#84cc16';
    ctx.fillRect(ox + 14, oy + 10, 4, 11);

    // Gossamer luminous wings
    ctx.fillStyle = P.spectralCyan ?? '#67e8f9';
    ctx.beginPath();
    ctx.ellipse(ox + 10, oy + 11, 6, 3, -0.4, 0, Math.PI * 2);
    ctx.ellipse(ox + 22, oy + 11, 6, 3, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Head with antennae
    ctx.fillStyle = P.skinTone ?? '#fed7aa';
    ctx.fillRect(ox + 14, oy + 6, 4, 4);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(ox + 13, oy + 3, 1, 3);
    ctx.fillRect(ox + 18, oy + 3, 1, 3);
  },

  imp: (ctx, ox, oy) => {
    // Small red imp with needle tail
    ctx.fillStyle = P.crimsonRed ?? '#ef4444';
    drawTaperedTail(ctx, ox + 16, oy + 18, ox + 6, oy + 24, 4, 1);
    ctx.fillRect(ox + 12, oy + 12, 8, 8);

    // Pointed ears / horns
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(ox + 11, oy + 6, 2, 3);
    ctx.fillRect(ox + 19, oy + 6, 2, 3);

    // Face & Eyes
    ctx.fillStyle = P.crimsonRed ?? '#ef4444';
    ctx.fillRect(ox + 12, oy + 7, 8, 6);
    ctx.fillStyle = P.lavaYellow ?? '#fef08a';
    ctx.fillRect(ox + 13, oy + 9, 2, 2);
    ctx.fillRect(ox + 17, oy + 9, 2, 2);
  },

  bone_horror: (ctx, ox, oy) => {
    // Fused skeletal torso
    ctx.fillStyle = P.boneWhite ?? '#f1f5f9';
    drawOrganicBlob(ctx, ox + 16, oy + 16, 9, 9, 0.2);

    // Jagged ribcage & skulls
    ctx.fillStyle = P.boneGray ?? '#cbd5e1';
    ctx.fillRect(ox + 11, oy + 8, 5, 5);
    ctx.fillRect(ox + 17, oy + 6, 6, 6);

    // Eye sockets
    ctx.fillStyle = '#000000';
    ctx.fillRect(ox + 12, oy + 10, 2, 2);
    ctx.fillRect(ox + 18, oy + 8, 2, 2);
    ctx.fillRect(ox + 21, oy + 8, 2, 2);

    // Reaching bone claws
    ctx.fillStyle = P.boneWhite ?? '#f1f5f9';
    drawRoundedLimb(ctx, ox + 10, oy + 16, ox + 4, oy + 12, 3);
    drawRoundedLimb(ctx, ox + 22, oy + 16, ox + 28, oy + 12, 3);
  },

  construct: (ctx, ox, oy) => {
    // Steam Automaton: brass plating and iron core
    ctx.fillStyle = P.dwarfBrass ?? '#d97706';
    ctx.fillRect(ox + 8, oy + 10, 16, 12);
    ctx.fillStyle = P.dwarfIron ?? '#44403c';
    ctx.fillRect(ox + 11, oy + 13, 10, 6);

    // Glowing boiler core
    ctx.fillStyle = P.dwarfGlow ?? '#f97316';
    ctx.fillRect(ox + 13, oy + 14, 6, 4);

    // Head / sensor eye
    ctx.fillStyle = P.steamMetal ?? '#78716c';
    ctx.fillRect(ox + 12, oy + 5, 8, 6);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(ox + 15, oy + 7, 2, 2);

    // Piston legs
    ctx.fillStyle = P.dwarfIron ?? '#44403c';
    ctx.fillRect(ox + 10, oy + 22, 4, 7);
    ctx.fillRect(ox + 18, oy + 22, 4, 7);
  },

  slime: (ctx, ox, oy) => {
    // Translucent amorphous slag/toxic slime
    ctx.fillStyle = P.toxicGreen ?? '#4d7c0f';
    drawOrganicBlob(ctx, ox + 16, oy + 20, 11, 7, 0.25);
    ctx.fillStyle = P.eldritchGlow ?? '#a3e635';
    drawOrganicBlob(ctx, ox + 16, oy + 19, 7, 4, 0.15);

    // Floating bubbles / debris
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 13, oy + 17, 2, 2);
    ctx.fillRect(ox + 18, oy + 19, 1, 1);
  },

  golem: (ctx, ox, oy) => {
    // Heavy obsidian/lava stone golem
    ctx.fillStyle = P.obsidianBlack ?? '#0a0a0c';
    ctx.fillRect(ox + 8, oy + 8, 16, 14);

    // Molten lava fissures
    ctx.fillStyle = P.magmaOrange ?? '#ea580c';
    ctx.fillRect(ox + 10, oy + 11, 12, 2);
    ctx.fillRect(ox + 14, oy + 13, 2, 7);
    ctx.fillRect(ox + 11, oy + 17, 8, 2);

    // Molten eye slit
    ctx.fillStyle = P.lavaYellow ?? '#fef08a';
    ctx.fillRect(ox + 12, oy + 9, 8, 2);

    // Chunky stone limbs
    ctx.fillStyle = P.ashGray ?? '#3f3f46';
    ctx.fillRect(ox + 9, oy + 22, 5, 7);
    ctx.fillRect(ox + 18, oy + 22, 5, 7);
  },

  hound: (ctx, ox, oy) => {
    // Predator canine silhouette
    ctx.fillStyle = P.ironSlate ?? '#334155';
    drawOrganicBlob(ctx, ox + 16, oy + 17, 8, 6, 0.15);
    drawTaperedTail(ctx, ox + 11, oy + 16, ox + 4, oy + 12, 3, 1);

    // Head and predatory snout
    ctx.fillRect(ox + 19, oy + 11, 8, 6);
    ctx.fillRect(ox + 21, oy + 8, 2, 4);

    // Fangs & Eyes
    ctx.fillStyle = P.magmaRed ?? '#dc2626';
    ctx.fillRect(ox + 21, oy + 12, 2, 2);

    // Legs
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(ox + 13, oy + 21, 3, 7);
    ctx.fillRect(ox + 18, oy + 21, 3, 7);
  },

  salamander: (ctx, ox, oy) => {
    // Sleek obsidian fiery salamander
    ctx.fillStyle = P.obsidianBlack ?? '#0a0a0c';
    drawOrganicBlob(ctx, ox + 16, oy + 16, 9, 5, 0.2);

    // Curled fiery tail
    ctx.fillStyle = P.magmaOrange ?? '#ea580c';
    drawTaperedTail(ctx, ox + 11, oy + 16, ox + 4, oy + 24, 5, 1);

    // Fiery dorsal frill
    ctx.fillStyle = P.magmaRed ?? '#dc2626';
    ctx.fillRect(ox + 13, oy + 10, 7, 2);
    ctx.fillRect(ox + 15, oy + 8, 4, 2);

    // Eyes
    ctx.fillStyle = P.lavaYellow ?? '#fef08a';
    ctx.fillRect(ox + 22, oy + 14, 2, 2);
  },

  parasite: (ctx, ox, oy) => {
    // Segmented pale grub/leech
    ctx.fillStyle = P.grubPale ?? '#fef3c7';
    drawOrganicBlob(ctx, ox + 16, oy + 16, 10, 6, 0.2);

    // Segment rings
    ctx.fillStyle = P.silverOre ?? '#64748b';
    ctx.fillRect(ox + 13, oy + 11, 2, 10);
    ctx.fillRect(ox + 17, oy + 11, 2, 10);

    // Circular biting maw
    ctx.fillStyle = P.crimsonRed ?? '#ef4444';
    ctx.beginPath();
    ctx.arc(ox + 23, oy + 16, 3, 0, Math.PI * 2);
    ctx.fill();
  },

  insect: (ctx, ox, oy) => {
    // Chitinous beetle / arachnid
    ctx.fillStyle = P.barkBrown ?? '#451a03';
    ctx.beginPath();
    ctx.ellipse(ox + 16, oy + 17, 7, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Carapace seam
    ctx.fillStyle = P.dwarfBrass ?? '#d97706';
    ctx.fillRect(ox + 15, oy + 11, 2, 13);

    // Pincers / Antennae
    ctx.fillRect(ox + 13, oy + 6, 2, 4);
    ctx.fillRect(ox + 17, oy + 6, 2, 4);

    // Legs
    ctx.fillStyle = '#0f172a';
    drawRoundedLimb(ctx, ox + 11, oy + 14, ox + 5, oy + 12, 2);
    drawRoundedLimb(ctx, ox + 21, oy + 14, ox + 27, oy + 12, 2);
    drawRoundedLimb(ctx, ox + 11, oy + 20, ox + 5, oy + 24, 2);
    drawRoundedLimb(ctx, ox + 21, oy + 20, ox + 27, oy + 24, 2);
  },

  spider: (ctx, ox, oy) => {
    // Cephalothorax and bulbous abdomen
    ctx.fillStyle = P.rimeDark ?? '#0f172a';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 13, 4, 0, Math.PI * 2);
    ctx.arc(ox + 16, oy + 20, 6, 0, Math.PI * 2);
    ctx.fill();

    // Glowing ice blue eyes
    ctx.fillStyle = P.rimeIce ?? '#38bdf8';
    ctx.fillRect(ox + 14, oy + 11, 1, 1);
    ctx.fillRect(ox + 17, oy + 11, 1, 1);
    ctx.fillRect(ox + 15, oy + 12, 2, 1);

    // 8 spindly legs
    ctx.fillStyle = P.rimeWall ?? '#1e293b';
    drawRoundedLimb(ctx, ox + 13, oy + 14, ox + 5, oy + 9, 2);
    drawRoundedLimb(ctx, ox + 19, oy + 14, ox + 27, oy + 9, 2);
    drawRoundedLimb(ctx, ox + 12, oy + 17, ox + 4, oy + 17, 2);
    drawRoundedLimb(ctx, ox + 20, oy + 17, ox + 28, oy + 17, 2);
    drawRoundedLimb(ctx, ox + 13, oy + 20, ox + 6, oy + 25, 2);
    drawRoundedLimb(ctx, ox + 19, oy + 20, ox + 26, oy + 25, 2);
  },

  wolf: (ctx, ox, oy) => {
    // Winter Wolf
    ctx.fillStyle = P.rimeWall ?? '#1e293b';
    drawOrganicBlob(ctx, ox + 16, oy + 17, 8, 6, 0.15);

    // Bushy frost tail
    ctx.fillStyle = P.rimeFrost ?? '#e0f2fe';
    drawTaperedTail(ctx, ox + 11, oy + 17, ox + 4, oy + 13, 4, 2);

    // Head
    ctx.fillStyle = P.rimeWall ?? '#1e293b';
    ctx.fillRect(ox + 18, oy + 11, 8, 6);
    ctx.fillRect(ox + 19, oy + 8, 2, 4);

    // Frost blue eyes & snout
    ctx.fillStyle = P.rimeIce ?? '#38bdf8';
    ctx.fillRect(ox + 21, oy + 12, 2, 2);
    ctx.fillStyle = P.rimeFrost ?? '#e0f2fe';
    ctx.fillRect(ox + 24, oy + 14, 2, 2);

    // Legs
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(ox + 13, oy + 22, 3, 6);
    ctx.fillRect(ox + 19, oy + 22, 3, 6);
  },

  dwarf: (ctx, ox, oy) => {
    // Chainmail & belt
    ctx.fillStyle = P.dwarfIron ?? '#44403c';
    ctx.fillRect(ox + 10, oy + 13, 12, 10);
    ctx.fillStyle = P.dwarfBrass ?? '#d97706';
    ctx.fillRect(ox + 10, oy + 18, 12, 2);

    // Heavy beard
    ctx.fillStyle = P.woodBrown ?? '#78350f';
    ctx.fillRect(ox + 11, oy + 12, 10, 8);

    // Face & Nose
    ctx.fillStyle = P.skinTone ?? '#fed7aa';
    ctx.fillRect(ox + 13, oy + 9, 6, 4);

    // Horned dwarven helmet
    ctx.fillStyle = P.steamMetal ?? '#78716c';
    ctx.fillRect(ox + 11, oy + 6, 10, 4);
    ctx.fillStyle = P.dwarfBrass ?? '#d97706';
    ctx.fillRect(ox + 9, oy + 4, 2, 4);
    ctx.fillRect(ox + 21, oy + 4, 2, 4);

    // Boots
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(ox + 11, oy + 23, 4, 5);
    ctx.fillRect(ox + 17, oy + 23, 4, 5);
  },

  hag: (ctx, ox, oy) => {
    // Ragged dark green cowl and robe
    ctx.fillStyle = P.barkGreen ?? '#14532d';
    drawOrganicBlob(ctx, ox + 16, oy + 16, 7, 10, 0.2);

    // Hood & pale withered face
    ctx.fillStyle = P.rimeDark ?? '#0f172a';
    ctx.fillRect(ox + 12, oy + 5, 8, 8);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(ox + 13, oy + 7, 6, 5);

    // Glowing sickly eyes
    ctx.fillStyle = P.eldritchGlow ?? '#a3e635';
    ctx.fillRect(ox + 14, oy + 8, 1, 2);
    ctx.fillRect(ox + 17, oy + 8, 1, 2);

    // Gnarled crooked wooden staff
    ctx.fillStyle = P.woodBrown ?? '#78350f';
    ctx.fillRect(ox + 22, oy + 4, 2, 23);
    ctx.fillStyle = P.rimeIce ?? '#38bdf8';
    ctx.fillRect(ox + 21, oy + 3, 4, 3);
  },

  zealot: (ctx, ox, oy) => {
    // Obsidian cult robe
    ctx.fillStyle = P.obsidianPurple ?? '#1e1b4b';
    ctx.fillRect(ox + 10, oy + 11, 12, 13);

    // Fiery magma sash
    ctx.fillStyle = P.magmaOrange ?? '#ea580c';
    ctx.fillRect(ox + 10, oy + 17, 12, 3);

    // Hood & mask
    ctx.fillStyle = P.obsidianBlack ?? '#0a0a0c';
    ctx.fillRect(ox + 12, oy + 5, 8, 7);
    ctx.fillStyle = P.magmaRed ?? '#dc2626';
    ctx.fillRect(ox + 14, oy + 8, 4, 2);

    // Ceremonial curved dagger
    ctx.fillStyle = P.silverShine ?? '#e2e8f0';
    ctx.fillRect(ox + 23, oy + 12, 2, 8);
  },

  cultist: (ctx, ox, oy) => {
    // Dark cowl & tunic
    ctx.fillStyle = P.obsidianBlack ?? '#0a0a0c';
    ctx.fillRect(ox + 10, oy + 10, 12, 14);

    // Crimson rune on chest
    ctx.fillStyle = P.crimsonRed ?? '#ef4444';
    ctx.fillRect(ox + 15, oy + 13, 2, 5);
    ctx.fillRect(ox + 13, oy + 15, 6, 2);

    // Pale mask
    ctx.fillStyle = P.boneWhite ?? '#f1f5f9';
    ctx.fillRect(ox + 13, oy + 6, 6, 6);
    ctx.fillStyle = '#000000';
    ctx.fillRect(ox + 14, oy + 8, 1, 2);
    ctx.fillRect(ox + 17, oy + 8, 1, 2);
  },

  troll: (ctx, ox, oy) => {
    // Massive brute torso
    ctx.fillStyle = P.barkGreen ?? '#14532d';
    drawOrganicBlob(ctx, ox + 16, oy + 15, 11, 9, 0.18);

    // Heavy shoulders & arms
    ctx.fillStyle = P.dwarfStone ?? '#292524';
    drawRoundedLimb(ctx, ox + 11, oy + 13, ox + 6, oy + 22, 5);
    drawRoundedLimb(ctx, ox + 21, oy + 13, ox + 26, oy + 22, 5);

    // Head with tusks
    ctx.fillStyle = P.barkGreen ?? '#14532d';
    ctx.fillRect(ox + 13, oy + 7, 7, 6);
    ctx.fillStyle = P.boneWhite ?? '#f1f5f9';
    ctx.fillRect(ox + 13, oy + 10, 1, 3);
    ctx.fillRect(ox + 19, oy + 10, 1, 3);

    // Glowing eyes
    ctx.fillStyle = P.lavaYellow ?? '#fef08a';
    ctx.fillRect(ox + 14, oy + 8, 2, 2);
    ctx.fillRect(ox + 17, oy + 8, 2, 2);
  },

  // ==========================================
  // EXPANDED ITEMS (Phase 5)
  // ==========================================

  iron_armor: (ctx, ox, oy) => {
    ctx.fillStyle = P.silverVein ?? '#94a3b8';
    ctx.fillRect(ox + 9, oy + 9, 14, 15);
    ctx.fillStyle = P.ironSlate ?? '#334155';
    ctx.fillRect(ox + 12, oy + 7, 8, 4);
    ctx.fillRect(ox + 9, oy + 17, 14, 2); // Belt
    ctx.fillStyle = P.silverShine ?? '#e2e8f0';
    ctx.fillRect(ox + 10, oy + 10, 4, 3);
    ctx.fillRect(ox + 18, oy + 10, 4, 3);
  },

  iron_shield: (ctx, ox, oy) => {
    ctx.fillStyle = P.ironSlate ?? '#334155';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.silverShine ?? '#e2e8f0';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = P.silverVein ?? '#94a3b8';
    ctx.lineWidth = 2;
    ctx.stroke();
  },

  mace: (ctx, ox, oy) => {
    ctx.fillStyle = P.woodBrown ?? '#78350f';
    ctx.fillRect(ox + 15, oy + 12, 2, 14);
    ctx.fillStyle = P.silverVein ?? '#94a3b8';
    ctx.fillRect(ox + 12, oy + 7, 8, 7);
    ctx.fillRect(ox + 10, oy + 9, 12, 3);
    ctx.fillRect(ox + 14, oy + 5, 4, 11);
  },

  battleaxe: (ctx, ox, oy) => {
    ctx.fillStyle = P.woodBrown ?? '#78350f';
    ctx.fillRect(ox + 15, oy + 6, 2, 22);
    ctx.fillStyle = P.silverShine ?? '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(ox + 15, oy + 7);
    ctx.lineTo(ox + 7, oy + 4);
    ctx.lineTo(ox + 7, oy + 14);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ox + 17, oy + 7);
    ctx.lineTo(ox + 25, oy + 4);
    ctx.lineTo(ox + 25, oy + 14);
    ctx.closePath();
    ctx.fill();
  },

  warhammer: (ctx, ox, oy) => {
    ctx.fillStyle = P.woodBrown ?? '#78350f';
    ctx.fillRect(ox + 15, oy + 7, 2, 21);
    ctx.fillStyle = P.ironSlate ?? '#334155';
    ctx.fillRect(ox + 9, oy + 8, 14, 8);
    ctx.fillStyle = P.silverShine ?? '#e2e8f0';
    ctx.fillRect(ox + 9, oy + 9, 2, 6);
  },

  bow: (ctx, ox, oy) => {
    ctx.strokeStyle = P.woodBrown ?? '#78350f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ox + 14, oy + 16, 11, -Math.PI / 2, Math.PI / 2, false);
    ctx.stroke();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ox + 14, oy + 5);
    ctx.lineTo(ox + 14, oy + 27);
    ctx.stroke();
  },

  ring: (ctx, ox, oy) => {
    ctx.strokeStyle = P.goldYellow ?? '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 17, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = P.spectralCyan ?? '#38bdf8';
    ctx.fillRect(ox + 14, oy + 8, 4, 4);
  },

  amulet: (ctx, ox, oy) => {
    ctx.strokeStyle = P.silverShine ?? '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ox + 10, oy + 9);
    ctx.lineTo(ox + 16, oy + 17);
    ctx.lineTo(ox + 22, oy + 9);
    ctx.stroke();
    ctx.fillStyle = P.crimsonRed ?? '#ef4444';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 19, 4, 0, Math.PI * 2);
    ctx.fill();
  },

  cloak: (ctx, ox, oy) => {
    ctx.fillStyle = P.obsidianPurple ?? '#1e1b4b';
    ctx.fillRect(ox + 8, oy + 9, 16, 15);
    ctx.fillStyle = P.dwarfBrass ?? '#d97706';
    ctx.fillRect(ox + 14, oy + 9, 4, 2);
  },

  gauntlets: (ctx, ox, oy) => {
    ctx.fillStyle = P.ironSlate ?? '#334155';
    ctx.fillRect(ox + 8, oy + 11, 7, 11);
    ctx.fillRect(ox + 17, oy + 11, 7, 11);
    ctx.fillStyle = P.silverShine ?? '#e2e8f0';
    ctx.fillRect(ox + 9, oy + 11, 5, 3);
    ctx.fillRect(ox + 18, oy + 11, 5, 3);
  },

  bracers: (ctx, ox, oy) => {
    ctx.fillStyle = P.woodBrown ?? '#78350f';
    ctx.fillRect(ox + 8, oy + 12, 6, 9);
    ctx.fillRect(ox + 18, oy + 12, 6, 9);
    ctx.fillStyle = P.dwarfBrass ?? '#d97706';
    ctx.fillRect(ox + 9, oy + 14, 4, 5);
    ctx.fillRect(ox + 19, oy + 14, 4, 5);
  },

  mana_potion: (ctx, ox, oy) => {
    ctx.fillStyle = '#64748b';
    ctx.fillRect(ox + 14, oy + 8, 4, 4);
    ctx.fillStyle = P.heroCyan ?? '#0284c7';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 19, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 14, oy + 16, 2, 2);
  },

  scroll: (ctx, ox, oy) => {
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(ox + 9, oy + 10, 14, 12);
    ctx.fillStyle = P.dwarfRust ?? '#7c2d12';
    ctx.fillRect(ox + 8, oy + 14, 16, 3);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(ox + 15, oy + 14, 2, 3);
  },

  gem: (ctx, ox, oy) => {
    ctx.fillStyle = P.spectralCyan ?? '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(ox + 16, oy + 8);
    ctx.lineTo(ox + 23, oy + 14);
    ctx.lineTo(ox + 16, oy + 24);
    ctx.lineTo(ox + 9, oy + 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 14, oy + 11, 3, 3);
  },

  key: (ctx, ox, oy) => {
    ctx.strokeStyle = P.goldYellow ?? '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 11, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = P.goldYellow ?? '#f59e0b';
    ctx.fillRect(ox + 15, oy + 15, 2, 11);
    ctx.fillRect(ox + 17, oy + 21, 3, 2);
    ctx.fillRect(ox + 17, oy + 24, 3, 2);
  },

  torch: (ctx, ox, oy) => {
    ctx.fillStyle = P.woodBrown ?? '#78350f';
    ctx.fillRect(ox + 15, oy + 13, 3, 13);
    ctx.fillStyle = P.magmaOrange ?? '#ea580c';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 10, 2.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // ==========================================
  // ZONE TERRAIN (Phase 6)
  // ==========================================

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

  // ==========================================
  // TOWN TERRAIN (Phase 7)
  // ==========================================

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
    // Snow-dusted cobblestone exterior path
    ctx.fillStyle = P.stoneDark ?? '#1c2333';
    ctx.fillRect(ox, oy, 32, 32);
    // Snow cover patches
    ctx.fillStyle = P.townSnow ?? '#e2e8f0';
    ctx.fillRect(ox + 2, oy + 2, 12, 10);
    ctx.fillRect(ox + 16, oy + 6, 13, 11);
    ctx.fillRect(ox + 4, oy + 18, 14, 11);
    // Icy glint
    ctx.fillStyle = P.rimeIce ?? '#38bdf8';
    ctx.fillRect(ox + 6, oy + 5, 3, 2);
    ctx.fillRect(ox + 22, oy + 12, 3, 2);
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
    // Sacred temple mosaic floor
    ctx.fillStyle = P.townTempleStone ?? '#475569';
    ctx.fillRect(ox, oy, 32, 32);
    ctx.fillStyle = '#f8fafc';
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

