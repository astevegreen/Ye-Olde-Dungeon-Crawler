import type { SpriteRecipe } from '../../../engine';
import { COTW_ATLAS_THEME } from '../atlas';

const P = COTW_ATLAS_THEME.palette!;

/** The hero and heroine (the HUD's hero icons) and the townsfolk role looks: the fallback for an NPC without its own art. */
export const COTW_MONSTER_SPRITES: Record<string, SpriteRecipe> = {
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
};
