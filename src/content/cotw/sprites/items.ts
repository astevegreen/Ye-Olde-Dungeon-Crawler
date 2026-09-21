import type { SpriteRecipe } from '../../../engine';
import { COTW_ATLAS_THEME } from '../atlas';

const P = COTW_ATLAS_THEME.palette!;

/** Equipment, consumable, relic, and prop recipes. */
export const COTW_ITEM_SPRITES: Record<string, SpriteRecipe> = {
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

  nidhogg_fang: (ctx, ox, oy) => {
    // Sinew-wrapped hilt & pommel at bottom-left
    ctx.fillStyle = '#451a03';
    ctx.fillRect(ox + 7, oy + 23, 6, 5);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 8, oy + 22, 5, 4);
    // Gold filigree collar
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 10, oy + 20, 5, 3);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(ox + 11, oy + 21, 3, 1);

    // Colossal curved dragon tooth blade
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(ox + 11, oy + 20);
    ctx.quadraticCurveTo(ox + 13, oy + 10, ox + 24, oy + 4); // sharp forward curve to tip
    ctx.quadraticCurveTo(ox + 20, oy + 14, ox + 15, oy + 21); // inner belly curve
    ctx.closePath();
    ctx.fill();

    // Dark necrotic enamel core
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.moveTo(ox + 12, oy + 18);
    ctx.quadraticCurveTo(ox + 14, oy + 11, ox + 22, oy + 6);
    ctx.quadraticCurveTo(ox + 18, oy + 14, ox + 14, oy + 19);
    ctx.closePath();
    ctx.fill();

    // Poisoned runic venom channels along the spine
    ctx.fillStyle = '#10b981';
    ctx.fillRect(ox + 14, oy + 15, 2, 2);
    ctx.fillRect(ox + 16, oy + 12, 2, 2);
    ctx.fillRect(ox + 19, oy + 9, 2, 2);
    ctx.fillStyle = '#6ee7b7';
    ctx.fillRect(ox + 17, oy + 11, 1, 2);

    // Malice purple necrotic miasma droplets
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(ox + 23, oy + 3, 2, 2);
    ctx.fillRect(ox + 25, oy + 6, 2, 2);
    ctx.fillRect(ox + 21, oy + 2, 1, 2);

    // Blade razor highlight along outer spine
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 22, oy + 5, 2, 1);
    ctx.fillRect(ox + 18, oy + 8, 1, 2);
  },

  sol_shard_focus: (ctx, ox, oy) => {
    // Ambient solar radiance aura
    ctx.fillStyle = 'rgba(254, 240, 138, 0.25)';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 15, 13, 0, Math.PI * 2);
    ctx.fill();

    // Golden tripod gimbal / claw mount
    ctx.fillStyle = '#b45309';
    ctx.fillRect(ox + 14, oy + 23, 4, 6);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(ox + 9, oy + 25, 14, 2);
    ctx.fillRect(ox + 8, oy + 27, 3, 2);
    ctx.fillRect(ox + 21, oy + 27, 3, 2);

    // Claw prongs holding the prism
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 8, oy + 16, 3, 7);
    ctx.fillRect(ox + 21, oy + 16, 3, 7);
    ctx.fillRect(ox + 15, oy + 20, 2, 4);

    // Brilliant faceted solar quartz prism (hexagonal crystal)
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(ox + 16, oy + 4);
    ctx.lineTo(ox + 22, oy + 10);
    ctx.lineTo(ox + 22, oy + 18);
    ctx.lineTo(ox + 16, oy + 22);
    ctx.lineTo(ox + 10, oy + 18);
    ctx.lineTo(ox + 10, oy + 10);
    ctx.closePath();
    ctx.fill();

    // Luminous inner facets
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(ox + 16, oy + 6);
    ctx.lineTo(ox + 20, oy + 11);
    ctx.lineTo(ox + 16, oy + 16);
    ctx.lineTo(ox + 12, oy + 11);
    ctx.closePath();
    ctx.fill();

    // Radiant core
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(ox + 14, oy + 9, 4, 6);

    // Cross-glint light flares
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 15, oy + 2, 2, 4);
    ctx.fillRect(ox + 15, oy + 11, 2, 2);
    ctx.fillRect(ox + 4, oy + 13, 4, 2);
    ctx.fillRect(ox + 24, oy + 13, 4, 2);
  },

  petrified_world_bark_tower_shield: (ctx, ox, oy) => {
    // Massive rectangular ironwood slab body
    ctx.fillStyle = '#292524';
    ctx.fillRect(ox + 6, oy + 3, 20, 26);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(ox + 8, oy + 4, 16, 24);

    // Petrified bark vertical striations & fissures
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(ox + 10, oy + 5, 2, 22);
    ctx.fillRect(ox + 15, oy + 5, 2, 22);
    ctx.fillRect(ox + 20, oy + 5, 2, 22);

    // Living Yggdrasil sap-green growth rings & runic grain
    ctx.fillStyle = '#15803d';
    ctx.fillRect(ox + 11, oy + 8, 1, 8);
    ctx.fillRect(ox + 14, oy + 18, 1, 7);
    ctx.fillRect(ox + 19, oy + 9, 1, 10);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(ox + 11, oy + 11, 2, 2);
    ctx.fillRect(ox + 19, oy + 14, 2, 2);

    // Iron reinforcement boss & brackets
    ctx.fillStyle = '#334155';
    // Corner brackets
    ctx.fillRect(ox + 6, oy + 3, 5, 4);
    ctx.fillRect(ox + 21, oy + 3, 5, 4);
    ctx.fillRect(ox + 6, oy + 25, 5, 4);
    ctx.fillRect(ox + 21, oy + 25, 5, 4);
    // Center boss
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 5, 0, Math.PI * 2);
    ctx.fill();

    // Boss center spike & iron highlights
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(ox + 15, oy + 15, 2, 2);
    // Rivets
    ctx.fillRect(ox + 8, oy + 5, 1, 1);
    ctx.fillRect(ox + 23, oy + 5, 1, 1);
    ctx.fillRect(ox + 8, oy + 27, 1, 1);
    ctx.fillRect(ox + 23, oy + 27, 1, 1);
  },

  antler_crowned_mask: (ctx, ox, oy) => {
    // Stag Antlers (sweeping upward and outwards)
    ctx.fillStyle = '#78350f';
    // Left antler main beam & tines
    ctx.fillRect(ox + 10, oy + 8, 3, 5);
    ctx.fillRect(ox + 7, oy + 5, 4, 4);
    ctx.fillRect(ox + 4, oy + 2, 4, 4);
    ctx.fillRect(ox + 3, oy + 1, 2, 3);
    ctx.fillRect(ox + 7, oy + 1, 2, 4); // top tine
    ctx.fillRect(ox + 2, oy + 5, 4, 2); // brow tine
    // Right antler main beam & tines
    ctx.fillRect(ox + 19, oy + 8, 3, 5);
    ctx.fillRect(ox + 21, oy + 5, 4, 4);
    ctx.fillRect(ox + 24, oy + 2, 4, 4);
    ctx.fillRect(ox + 27, oy + 1, 2, 3);
    ctx.fillRect(ox + 23, oy + 1, 2, 4); // top tine
    ctx.fillRect(ox + 26, oy + 5, 4, 2); // brow tine

    // Antler tips bone highlights
    ctx.fillStyle = '#d97706';
    ctx.fillRect(ox + 3, oy + 1, 2, 1);
    ctx.fillRect(ox + 7, oy + 1, 2, 1);
    ctx.fillRect(ox + 27, oy + 1, 2, 1);
    ctx.fillRect(ox + 23, oy + 1, 2, 1);

    // Troll-Wife Bone Face Mask
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.ellipse(ox + 16, oy + 17, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mask shading & carved hollow eyes
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(ox + 11, oy + 14, 10, 1);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(ox + 13, oy + 15, 2, 3);
    ctx.fillRect(ox + 17, oy + 15, 2, 3);
    ctx.fillRect(ox + 15, oy + 20, 2, 2); // nose slit

    // Forehead runic mark of the Iviðja
    ctx.fillStyle = '#7e22ce';
    ctx.fillRect(ox + 15, oy + 11, 2, 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 15, oy + 9, 2, 1);

    // Hanging willow moss & charm beads below chin
    ctx.fillStyle = '#15803d';
    ctx.fillRect(ox + 13, oy + 24, 2, 5);
    ctx.fillRect(ox + 17, oy + 24, 2, 5);
    ctx.fillStyle = '#84cc16';
    ctx.fillRect(ox + 15, oy + 25, 2, 4);
  },

  marrow_gnawed_ring: (ctx, ox, oy) => {
    // Jagged primeval dragon vertebra bone ring (outer circle)
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 10, 0, Math.PI * 2);
    ctx.fill();

    // Bone texture and gnawed notches
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 8, 0, Math.PI * 2);
    ctx.fill();

    // Carved gnawed tooth marks along perimeter
    ctx.fillStyle = '#475569';
    ctx.fillRect(ox + 15, oy + 5, 2, 2);
    ctx.fillRect(ox + 24, oy + 15, 2, 2);
    ctx.fillRect(ox + 15, oy + 25, 2, 2);
    ctx.fillRect(ox + 6, oy + 15, 2, 2);
    ctx.fillRect(ox + 22, oy + 9, 2, 2);
    ctx.fillRect(ox + 8, oy + 21, 2, 2);

    // Hollow center containing pulsating void marrow
    ctx.fillStyle = '#090514';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 5, 0, Math.PI * 2);
    ctx.fill();

    // Dark void marrow core & corruption tendrils
    ctx.fillStyle = '#4c1d95';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7e22ce';
    ctx.fillRect(ox + 15, oy + 14, 2, 4);
    ctx.fillRect(ox + 14, oy + 15, 4, 2);

    // Glowing necrotic violet marrow flecks
    ctx.fillStyle = '#c084fc';
    ctx.fillRect(ox + 15, oy + 15, 2, 2);
    ctx.fillRect(ox + 19, oy + 12, 1, 2);
    ctx.fillRect(ox + 12, oy + 19, 1, 2);

    // Bone rim glint
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 12, oy + 8, 2, 2);
  },

  duergar_lodestone: (ctx, ox, oy) => {
    // Outer brass armillary gimbal ring
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 11, 0, Math.PI * 2);
    ctx.fill();

    // Hollow out outer ring
    ctx.fillStyle = '#0c1017';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 9, 0, Math.PI * 2);
    ctx.fill();

    // Inner tilted brass armillary ellipse
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(ox + 16, oy + 16, 8, 4, Math.PI / 4, 0, Math.PI * 2);
    ctx.stroke();

    // Top suspension loop & pivot screws
    ctx.fillStyle = '#d97706';
    ctx.fillRect(ox + 14, oy + 2, 4, 3);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(ox + 15, oy + 1, 2, 2);
    ctx.fillRect(ox + 4, oy + 15, 2, 2);
    ctx.fillRect(ox + 26, oy + 15, 2, 2);

    // Floating magnetic lodestone core (dark faceted iron octahedron)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(ox + 16, oy + 9);
    ctx.lineTo(ox + 21, oy + 16);
    ctx.lineTo(ox + 16, oy + 23);
    ctx.lineTo(ox + 11, oy + 16);
    ctx.closePath();
    ctx.fill();

    // Lodestone facet highlights
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(ox + 16, oy + 11);
    ctx.lineTo(ox + 19, oy + 16);
    ctx.lineTo(ox + 16, oy + 21);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#64748b';
    ctx.fillRect(ox + 15, oy + 14, 2, 4);

    // Cyan magnetic spark arcs and polar needles
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(ox + 15, oy + 7, 2, 3); // North pole flare
    ctx.fillRect(ox + 15, oy + 22, 2, 3); // South pole flare
    ctx.fillStyle = '#67e8f9';
    ctx.fillRect(ox + 9, oy + 11, 2, 2);
    ctx.fillRect(ox + 21, oy + 19, 2, 2);
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(ox + 15, oy + 8, 2, 1);
  },

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

  rune_stone: (ctx, ox, oy) => {
    // Ethereal azure halo/aura
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 13, 0, Math.PI * 2);
    ctx.fill();

    // Dark slate stone tablet body (rounded polygon)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(ox + 9, oy + 5);
    ctx.lineTo(ox + 23, oy + 5);
    ctx.lineTo(ox + 27, oy + 10);
    ctx.lineTo(ox + 27, oy + 22);
    ctx.lineTo(ox + 23, oy + 27);
    ctx.lineTo(ox + 9, oy + 27);
    ctx.lineTo(ox + 5, oy + 22);
    ctx.lineTo(ox + 5, oy + 10);
    ctx.closePath();
    ctx.fill();

    // Interior stone face texture
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(ox + 10, oy + 7);
    ctx.lineTo(ox + 22, oy + 7);
    ctx.lineTo(ox + 25, oy + 11);
    ctx.lineTo(ox + 25, oy + 21);
    ctx.lineTo(ox + 22, oy + 25);
    ctx.lineTo(ox + 10, oy + 25);
    ctx.lineTo(ox + 7, oy + 21);
    ctx.lineTo(ox + 7, oy + 11);
    ctx.closePath();
    ctx.fill();

    // Stone chiseled rim highlight (top-left)
    ctx.fillStyle = '#64748b';
    ctx.fillRect(ox + 9, oy + 5, 14, 1);
    ctx.fillRect(ox + 5, oy + 10, 1, 12);
    ctx.fillRect(ox + 6, oy + 8, 2, 2);

    // Weathered crack lines
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(ox + 8, oy + 13, 3, 1);
    ctx.fillRect(ox + 11, oy + 14, 2, 1);
    ctx.fillRect(ox + 22, oy + 18, 3, 1);

    // Glowing cyan etched runic lines (Odal / Algiz recall sigil)
    ctx.fillStyle = '#0284c7';
    // Vertical channel stem
    ctx.fillRect(ox + 15, oy + 9, 2, 14);
    // Upper diamond / wings
    ctx.fillRect(ox + 12, oy + 11, 2, 2);
    ctx.fillRect(ox + 18, oy + 11, 2, 2);
    ctx.fillRect(ox + 10, oy + 13, 2, 2);
    ctx.fillRect(ox + 20, oy + 13, 2, 2);
    // Crossed chevron base
    ctx.fillRect(ox + 12, oy + 19, 2, 2);
    ctx.fillRect(ox + 18, oy + 19, 2, 2);
    ctx.fillRect(ox + 10, oy + 21, 2, 2);
    ctx.fillRect(ox + 20, oy + 21, 2, 2);

    // Arcane cyan bright core
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(ox + 15, oy + 11, 2, 10);
    ctx.fillRect(ox + 13, oy + 15, 6, 2);

    // Hot-white focus center
    ctx.fillStyle = '#f0f9ff';
    ctx.fillRect(ox + 15, oy + 15, 2, 2);

    // Floating runic sparks
    ctx.fillStyle = '#7dd3fc';
    ctx.fillRect(ox + 7, oy + 6, 1, 1);
    ctx.fillRect(ox + 24, oy + 8, 1, 1);
    ctx.fillRect(ox + 23, oy + 24, 1, 1);
  },
};
