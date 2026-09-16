import type { SpriteRecipe } from '../../engine';

export const WARCRAFT_SPRITE_RECIPES: Record<string, SpriteRecipe> = {
  // Warcraft Wall: Dark Iron & Molten Blackrock Stone
  wall: (ctx, ox, oy) => {
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(ox, oy, 32, 32);

    // Dark iron plates
    for (let r = 0; r < 4; r++) {
      const y = oy + r * 8;
      ctx.fillStyle = r % 2 === 0 ? '#292524' : '#1f1d1b';
      ctx.fillRect(ox, y, 32, 7);

      // Red-hot magma seams
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(ox, y + 7, 32, 1);

      // Rivets
      ctx.fillStyle = '#d97706';
      ctx.fillRect(ox + 4, y + 3, 2, 2);
      ctx.fillRect(ox + 26, y + 3, 2, 2);
    }
  },

  // Warcraft Floor: Charred stone tiles
  floor: (ctx, ox, oy) => {
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(ox, oy, 32, 32);

    ctx.fillStyle = '#1c1917';
    ctx.fillRect(ox + 2, oy + 2, 13, 13);
    ctx.fillRect(ox + 17, oy + 2, 13, 13);
    ctx.fillRect(ox + 2, oy + 17, 13, 13);
    ctx.fillRect(ox + 17, oy + 17, 13, 13);

    // Faint ember specks
    ctx.fillStyle = '#b45309';
    ctx.fillRect(ox + 6, oy + 8, 1, 1);
    ctx.fillRect(ox + 22, oy + 19, 1, 1);
  },

  // Player: Stormwind Knight in blue plate armor & gold lion crest
  player: (ctx, ox, oy) => {
    // Blue cape
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(ox + 9, oy + 12, 14, 14);

    // Polished steel breastplate
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(ox + 11, oy + 10, 10, 11);

    // Gold lion crest emblem
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 14, oy + 13, 4, 5);

    // Full visor Greathelm
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(ox + 10, oy + 3, 12, 8);
    // Dark visor slit
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(ox + 12, oy + 7, 8, 2);
    // Golden lion plume
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(ox + 15, oy + 1, 2, 3);

    // Warhammer in hand
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 23, oy + 5, 2, 16);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(ox + 21, oy + 4, 6, 4);

    // Lion Shield in off-hand
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.arc(ox + 8, oy + 16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(ox + 8, oy + 16, 2, 0, Math.PI * 2);
    ctx.fill();
  },

  // Orc Peon: Brown leather vest, carrying pickaxe
  kobold: (ctx, ox, oy) => {
    // Green orc body
    ctx.fillStyle = '#15803d';
    ctx.fillRect(ox + 10, oy + 12, 12, 10);
    // Brown vest
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 11, oy + 12, 10, 6);

    // Head
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(ox + 11, oy + 6, 10, 7);
    // Tusks
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 12, oy + 11, 2, 2);
    ctx.fillRect(ox + 18, oy + 11, 2, 2);

    // Mining pickaxe
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 23, oy + 6, 2, 18);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(ox + 20, oy + 5, 8, 3);
  },

  // Orc Grunt: Heavy green orc warrior with twin-bladed axe
  orc: (ctx, ox, oy) => {
    ctx.fillStyle = '#14532d';
    ctx.fillRect(ox + 7, oy + 9, 18, 14);

    // Spiked iron shoulderpads
    ctx.fillStyle = '#44403c';
    ctx.fillRect(ox + 5, oy + 8, 5, 6);
    ctx.fillRect(ox + 22, oy + 8, 5, 6);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(ox + 6, oy + 6, 2, 3);
    ctx.fillRect(ox + 24, oy + 6, 2, 3);

    // Orc Head
    ctx.fillStyle = '#15803d';
    ctx.fillRect(ox + 10, oy + 4, 12, 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 11, oy + 9, 2, 3);
    ctx.fillRect(ox + 19, oy + 9, 2, 3);

    // Giant double-bitted battle axe
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 24, oy + 2, 3, 26);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(ox + 19, oy + 4, 13, 7);
  },

  // Warchief Blackhand: Massive armored orc warlord
  giant_boss: (ctx, ox, oy) => {
    // Massive blackrock armor
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(ox + 5, oy + 8, 22, 16);

    // Glowing magma harness
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(ox + 8, oy + 11, 16, 3);
    ctx.fillRect(ox + 15, oy + 14, 2, 8);

    // Warchief helmet with giant demonic horns
    ctx.fillStyle = '#44403c';
    ctx.fillRect(ox + 9, oy + 3, 14, 7);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 6, oy + 1, 4, 4);
    ctx.fillRect(ox + 22, oy + 1, 4, 4);

    // Glowing fiery red eyes
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(ox + 12, oy + 6, 3, 2);
    ctx.fillRect(ox + 17, oy + 6, 3, 2);

    // The Doomhammer
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 25, oy + 4, 3, 24);
    ctx.fillStyle = '#57534e';
    ctx.fillRect(ox + 22, oy + 3, 9, 8);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 24, oy + 5, 5, 4);
  },

  // Horde War Banner relic item
  sun_stone: (ctx, ox, oy) => {
    // Red glowing war banner
    ctx.fillStyle = '#78350f'; // Pole
    ctx.fillRect(ox + 15, oy + 3, 3, 26);

    // Crimson Horde Pennant
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(ox + 6, oy + 6, 12, 14);

    // Black Horde crest
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(ox + 9, oy + 9, 6, 8);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 11, oy + 11, 2, 4);
  },
};
