import type { SpriteRecipe } from '../../engine/types/manifest';

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
    // Hero character cape
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(ox + 9, oy + 12, 14, 14);

    // Blue adventurer tunic
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(ox + 11, oy + 11, 10, 10);

    // Leather belt & buckle
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 11, oy + 17, 10, 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(ox + 15, oy + 17, 2, 2);

    // Boots
    ctx.fillStyle = '#451a03';
    ctx.fillRect(ox + 11, oy + 22, 4, 6);
    ctx.fillRect(ox + 17, oy + 22, 4, 6);

    // Face / skin
    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(ox + 12, oy + 6, 8, 6);

    // Iron Helmet
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(ox + 11, oy + 3, 10, 4);
    ctx.fillRect(ox + 10, oy + 5, 2, 4);
    ctx.fillRect(ox + 20, oy + 5, 2, 4);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 15, oy + 1, 2, 4);

    // Steel Sword in hand
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(ox + 22, oy + 5, 2, 14);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 20, oy + 16, 6, 2);

    // Shield in other hand
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(ox + 8, oy + 16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(ox + 8, oy + 16, 2, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.fillStyle = '#047857';
    ctx.fillRect(ox + 9, oy + 12, 14, 14);

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(ox + 11, oy + 11, 10, 10);

    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 11, oy + 17, 10, 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(ox + 15, oy + 17, 2, 2);

    ctx.fillStyle = '#451a03';
    ctx.fillRect(ox + 11, oy + 22, 4, 6);
    ctx.fillRect(ox + 17, oy + 22, 4, 6);

    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(ox + 12, oy + 6, 8, 6);

    ctx.fillStyle = '#facc15';
    ctx.fillRect(ox + 11, oy + 3, 10, 4);
    ctx.fillRect(ox + 9, oy + 5, 3, 11);
    ctx.fillRect(ox + 20, oy + 5, 3, 11);

    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(ox + 11, oy + 4, 10, 2);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(ox + 15, oy + 3, 2, 2);

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(ox + 22, oy + 6, 2, 13);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(ox + 20, oy + 16, 6, 2);

    ctx.fillStyle = '#0369a1';
    ctx.beginPath();
    ctx.arc(ox + 8, oy + 16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();
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
};
