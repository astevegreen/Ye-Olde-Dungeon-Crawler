import type { SpriteRecipe } from '../../../engine';
import { drawOrganicBlob, drawTaperedTail, drawRoundedLimb } from '../organicShapes';
import { COTW_ATLAS_THEME } from '../atlas';

const P = COTW_ATLAS_THEME.palette!;

/** Player, NPC, and monster archetype recipes. */
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

  sorcerer: (ctx, ox, oy) => {
    // Tall dark hooded robe (narrower/taller silhouette than the hunched `hag`)
    ctx.fillStyle = P.obsidianPurple ?? '#1e1b4b';
    drawOrganicBlob(ctx, ox + 15, oy + 19, 6, 11, 0.12);

    // Hood shadow & pale gaunt face
    ctx.fillStyle = P.maliceVoid ?? '#090514';
    ctx.fillRect(ox + 11, oy + 6, 8, 7);
    ctx.fillStyle = P.skinTone ?? '#fed7aa';
    ctx.fillRect(ox + 12, oy + 9, 6, 4);

    // Hellfire-glowing eyes (matches the Hellfire Surge telegraph)
    ctx.fillStyle = P.magmaOrange ?? '#ea580c';
    ctx.fillRect(ox + 13, oy + 10, 1, 2);
    ctx.fillRect(ox + 16, oy + 10, 1, 2);

    // Gnarled staff topped with a fire orb, held out to the side
    ctx.fillStyle = P.barkBrown ?? '#451a03';
    ctx.fillRect(ox + 23, oy + 6, 2, 21);
    ctx.fillStyle = P.magmaOrange ?? '#ea580c';
    ctx.beginPath();
    ctx.arc(ox + 24, oy + 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.lavaYellow ?? '#fef08a';
    ctx.beginPath();
    ctx.arc(ox + 24, oy + 5, 1.3, 0, Math.PI * 2);
    ctx.fill();
  },

  giant: (ctx, ox, oy) => {
    // Towering frost-jotun frame — taller/more upright than the squat, bare-chested `troll`
    ctx.fillStyle = P.rimeWall ?? '#1e293b';
    drawOrganicBlob(ctx, ox + 16, oy + 18, 9, 10, 0.1);

    // Pale ice-blue giant hide (head & forearms)
    ctx.fillStyle = P.steelBlue ?? '#7dd3fc';
    ctx.fillRect(ox + 12, oy + 5, 9, 8);
    drawRoundedLimb(ctx, ox + 9, oy + 14, ox + 5, oy + 24, 4);
    drawRoundedLimb(ctx, ox + 23, oy + 14, ox + 27, oy + 24, 4);

    // Braided frost-giant beard
    ctx.fillStyle = P.rimeFrost ?? '#e0f2fe';
    ctx.fillRect(ox + 12, oy + 11, 9, 4);

    // Cold, pale eyes
    ctx.fillStyle = P.rimeIce ?? '#38bdf8';
    ctx.fillRect(ox + 13, oy + 8, 2, 2);
    ctx.fillRect(ox + 17, oy + 8, 2, 2);

    // Huge stone warclub
    ctx.fillStyle = P.dwarfStone ?? '#292524';
    ctx.fillRect(ox + 25, oy + 4, 4, 10);
    ctx.fillStyle = P.barkBrown ?? '#451a03';
    ctx.fillRect(ox + 26, oy + 14, 2, 13);
  },

  giant_fire: (ctx, ox, oy) => {
    // Same towering frame as `giant`, recolored molten — the fire-immune counterpart
    ctx.fillStyle = P.dwarfRust ?? '#7c2d12';
    drawOrganicBlob(ctx, ox + 16, oy + 18, 9, 10, 0.1);

    // Cracked magma-glow hide (head & forearms)
    ctx.fillStyle = P.magmaOrange ?? '#ea580c';
    ctx.fillRect(ox + 12, oy + 5, 9, 8);
    drawRoundedLimb(ctx, ox + 9, oy + 14, ox + 5, oy + 24, 4);
    drawRoundedLimb(ctx, ox + 23, oy + 14, ox + 27, oy + 24, 4);

    // Ember-crack lines across the torso
    ctx.fillStyle = P.lavaYellow ?? '#fef08a';
    ctx.fillRect(ox + 12, oy + 20, 8, 1);
    ctx.fillRect(ox + 14, oy + 24, 6, 1);

    // Burning eyes
    ctx.fillStyle = P.magmaRed ?? '#dc2626';
    ctx.fillRect(ox + 13, oy + 8, 2, 2);
    ctx.fillRect(ox + 17, oy + 8, 2, 2);

    // Molten warclub
    ctx.fillStyle = P.ashGray ?? '#3f3f46';
    ctx.fillRect(ox + 25, oy + 4, 4, 10);
    ctx.fillStyle = P.magmaOrange ?? '#ea580c';
    ctx.fillRect(ox + 26, oy + 14, 2, 13);
  },

  shadow: (ctx, ox, oy) => {
    // Jagged, flame-like smoke trail (vs `wraith`'s smoother hooded-mist silhouette)
    ctx.fillStyle = P.maliceVoid ?? '#090514';
    ctx.beginPath();
    ctx.moveTo(ox + 16, oy + 8);
    ctx.lineTo(ox + 24, oy + 16);
    ctx.lineTo(ox + 21, oy + 20);
    ctx.lineTo(ox + 26, oy + 28);
    ctx.lineTo(ox + 18, oy + 24);
    ctx.lineTo(ox + 16, oy + 29);
    ctx.lineTo(ox + 14, oy + 24);
    ctx.lineTo(ox + 6, oy + 28);
    ctx.lineTo(ox + 11, oy + 20);
    ctx.lineTo(ox + 8, oy + 16);
    ctx.closePath();
    ctx.fill();

    // Featureless dark head
    ctx.fillStyle = P.malicePurple ?? '#4c1d95';
    drawOrganicBlob(ctx, ox + 16, oy + 11, 5, 5, 0.15);

    // Burning malicious eyes
    ctx.fillStyle = P.maliceCrimson ?? '#991b1b';
    ctx.fillRect(ox + 13, oy + 10, 2, 2);
    ctx.fillRect(ox + 17, oy + 10, 2, 2);
  },

  ghost: (ctx, ox, oy) => {
    // Small, child-sized wisp — deliberately drawn tiny/centered so it reads as
    // frail rather than menacing, unlike the game's taller undead
    ctx.fillStyle = P.boneGray ?? '#cbd5e1';
    drawOrganicBlob(ctx, ox + 16, oy + 18, 5, 6, 0.2);
    ctx.fillStyle = P.boneWhite ?? '#f1f5f9';
    ctx.fillRect(ox + 13, oy + 10, 6, 6);

    // Tattered hem fading to nothing
    ctx.fillStyle = P.silverDark ?? '#181e29';
    ctx.fillRect(ox + 12, oy + 23, 2, 3);
    ctx.fillRect(ox + 15, oy + 24, 2, 3);
    ctx.fillRect(ox + 18, oy + 23, 2, 3);

    // Small, sorrowful pale-blue eyes
    ctx.fillStyle = P.rimeIce ?? '#38bdf8';
    ctx.fillRect(ox + 14, oy + 12, 1, 2);
    ctx.fillRect(ox + 17, oy + 12, 1, 2);
  },

  bound_spirit: (ctx, ox, oy) => {
    // Spectral prisoner still wrapped in chains
    ctx.fillStyle = P.phantomTeal ?? '#2dd4bf';
    drawOrganicBlob(ctx, ox + 16, oy + 16, 7, 10, 0.18);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 13, oy + 9, 2, 2);
    ctx.fillRect(ox + 17, oy + 9, 2, 2);

    // Iron chain links wrapped diagonally across the body — bright metallic against
    // the teal body for contrast, and kept well inside the blob's silhouette
    ctx.fillStyle = P.silverShine ?? '#e2e8f0';
    ctx.fillRect(ox + 12, oy + 12, 2, 2);
    ctx.fillRect(ox + 15, oy + 15, 2, 2);
    ctx.fillRect(ox + 18, oy + 18, 2, 2);
    ctx.fillRect(ox + 15, oy + 21, 2, 2);
  },

  duergar: (ctx, ox, oy) => {
    // Undead dwarf — same stocky `dwarf` silhouette, rotted and tarnished instead
    // of living and brass-trimmed
    ctx.fillStyle = P.silverDark ?? '#181e29';
    ctx.fillRect(ox + 10, oy + 13, 12, 10);
    ctx.fillStyle = P.dwarfRust ?? '#7c2d12';
    ctx.fillRect(ox + 10, oy + 18, 12, 2);

    // Grey, moss-shot beard
    ctx.fillStyle = P.ashGray ?? '#3f3f46';
    ctx.fillRect(ox + 11, oy + 12, 10, 8);

    // Rotted grey-green face
    ctx.fillStyle = P.toxicGreen ?? '#4d7c0f';
    ctx.fillRect(ox + 13, oy + 9, 6, 4);

    // Tarnished helmet
    ctx.fillStyle = P.dwarfIron ?? '#44403c';
    ctx.fillRect(ox + 11, oy + 6, 10, 4);

    // Sickly glowing eyes (no living highlight, unlike `dwarf`)
    ctx.fillStyle = P.eldritchGlow ?? '#a3e635';
    ctx.fillRect(ox + 13, oy + 10, 2, 2);
    ctx.fillRect(ox + 17, oy + 10, 2, 2);

    // Ceremonial pickaxe
    ctx.fillStyle = P.woodBrown ?? '#78350f';
    ctx.fillRect(ox + 23, oy + 8, 2, 16);
    ctx.fillStyle = P.silverOre ?? '#64748b';
    ctx.fillRect(ox + 20, oy + 6, 8, 3);
  },

  troll_witch: (ctx, ox, oy) => {
    // Robed & hatted — a narrower, upright silhouette vs the bulky bare-chested `troll`
    ctx.fillStyle = P.barkGreen ?? '#14532d';
    drawOrganicBlob(ctx, ox + 16, oy + 20, 6, 9, 0.15);

    // Ragged shawl
    ctx.fillStyle = P.malicePurple ?? '#4c1d95';
    ctx.fillRect(ox + 10, oy + 15, 12, 6);

    // Head with tusks (family resemblance to `troll`)
    ctx.fillStyle = P.barkGreen ?? '#14532d';
    ctx.fillRect(ox + 13, oy + 8, 7, 6);
    ctx.fillStyle = P.boneWhite ?? '#f1f5f9';
    ctx.fillRect(ox + 13, oy + 11, 1, 3);
    ctx.fillRect(ox + 19, oy + 11, 1, 3);

    // Pointed witch hat
    ctx.fillStyle = P.malicePurple ?? '#4c1d95';
    ctx.beginPath();
    ctx.moveTo(ox + 11, oy + 8);
    ctx.lineTo(ox + 21, oy + 8);
    ctx.lineTo(ox + 16, oy - 1);
    ctx.closePath();
    ctx.fill();

    // Glowing eyes & crooked staff
    ctx.fillStyle = P.lavaYellow ?? '#fef08a';
    ctx.fillRect(ox + 14, oy + 10, 2, 2);
    ctx.fillRect(ox + 17, oy + 10, 2, 2);
    ctx.fillStyle = P.woodBrown ?? '#78350f';
    ctx.fillRect(ox + 24, oy + 6, 2, 21);
  },

  dragon_elder: (ctx, ox, oy) => {
    // Larger, icier dragon variant — same wings/tail/snout language as `dragon`,
    // recolored frost-white/blue so the two never look interchangeable
    ctx.fillStyle = P.rimeIce ?? '#38bdf8';
    drawTaperedTail(ctx, ox + 16, oy + 21, ox + 3, oy + 27, 7, 2);
    drawOrganicBlob(ctx, ox + 16, oy + 16, 10, 9, 0.12);

    // Broad frost wings
    ctx.fillStyle = P.rimeFrost ?? '#e0f2fe';
    ctx.beginPath();
    ctx.moveTo(ox + 16, oy + 13);
    ctx.lineTo(ox + 4, oy + 5);
    ctx.lineTo(ox + 9, oy + 16);
    ctx.lineTo(ox + 16, oy + 13);
    ctx.moveTo(ox + 16, oy + 13);
    ctx.lineTo(ox + 28, oy + 5);
    ctx.lineTo(ox + 23, oy + 16);
    ctx.closePath();
    ctx.fill();

    // Head and snout
    ctx.fillStyle = P.rimeIce ?? '#38bdf8';
    ctx.fillRect(ox + 11, oy + 5, 9, 8);
    ctx.fillRect(ox + 9, oy + 8, 3, 4);

    // Frost-breath vapor & piercing eyes
    ctx.fillStyle = P.silverShine ?? '#e2e8f0';
    ctx.fillRect(ox + 6, oy + 9, 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + 13, oy + 8, 2, 2);
    ctx.fillRect(ox + 17, oy + 8, 2, 2);
  },
};
