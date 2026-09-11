import type { Paperdoll } from '../engine/inventory/paperdoll';
import type { Item } from '../engine/items/item';
import type { SpriteAtlas } from './atlas/sprite-atlas';
import { getItemSpriteKey } from './atlas/sprite-mapper';
import type { ItemSpriteKey } from './atlas/types';
import type { ThemeTokens } from '../engine/types/theme';

export interface PaperdollRenderOptions {
  selectedSlot?: string | null;
  hoveredSlot?: string | null;
  focused?: boolean;
  focusedSlotIndex?: number;
  registerClickZone?: (
    x: number,
    y: number,
    w: number,
    h: number,
    action: () => void,
    slotId: string,
    item: Item | null
  ) => void;
  onSlotClick?: (slotId: string, item: Item | null) => void;
}

export const FALLBACK_SLOT_LAYOUTS: Record<string, { x: number; y: number; width: number; height: number }> = {
  head: { x: 93, y: 16, width: 34, height: 34 },
  neck: { x: 93, y: 58, width: 34, height: 34 },
  overgarment: { x: 48, y: 58, width: 34, height: 34 },
  torso: { x: 93, y: 104, width: 34, height: 34 },
  mainHand: { x: 34, y: 110, width: 34, height: 34 },
  offHand: { x: 152, y: 110, width: 34, height: 34 },
  hands: { x: 20, y: 162, width: 34, height: 34 },
  wrists: { x: 166, y: 162, width: 34, height: 34 },
  fingerLeft: { x: 58, y: 162, width: 34, height: 34 },
  waist: { x: 93, y: 154, width: 34, height: 34 },
  fingerRight: { x: 128, y: 162, width: 34, height: 34 },
  pack: { x: 34, y: 224, width: 34, height: 34 },
  purse: { x: 152, y: 224, width: 34, height: 34 },
  feet: { x: 93, y: 270, width: 34, height: 34 },
};

const EMPTY_SLOT_SPRITES: Partial<Record<string, ItemSpriteKey>> = {
  head: 'helmet',
  torso: 'leather_armor',
  mainHand: 'broadsword',
  offHand: 'wooden_shield',
  waist: 'belt',
  feet: 'boots',
  pack: 'backpack',
  purse: 'purse',
};

export class PaperdollView {
  public atlas?: SpriteAtlas;

  constructor(atlas?: SpriteAtlas) {
    this.atlas = atlas;
  }

  /**
   * Renders the complete anatomical paperdoll equipment diagram:
   * 1. Centered humanoid silhouette vector in background.
   * 2. Equipment slots anchored to data-driven layout coordinates.
   * 3. 50% opacity silhouette icons for empty slots.
   * 4. Equipped items with sprites, enchantment glows, and cursed badges.
   * 5. Hover and selection highlights.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    doll: Paperdoll,
    x: number,
    y: number,
    w: number,
    h: number,
    theme: Required<ThemeTokens>,
    options: PaperdollRenderOptions = {}
  ): void {
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    // Panel card background and border
    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = options.focused ? theme.hudAccent : theme.cardBorder;
    ctx.lineWidth = options.focused ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    // Header bar
    ctx.fillStyle = theme.modalTitlebar;
    ctx.fillRect(x, y, w, 24);
    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 24.5);
    ctx.lineTo(x + w, y + 24.5);
    ctx.stroke();

    ctx.font = `bold 11px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('CHARACTER PAPERDOLL', x + 8, y + 12);

    // Content origin (inside panel below header)
    const contentX = x;
    const contentY = y + 26;

    // 1. Draw stylized retro humanoid silhouette centered in panel
    this.drawHumanoidSilhouette(ctx, contentX, contentY, w, h - 26, theme);

    // 2. Render each equipment slot
    const slotDefs = doll.getSlotDefinitions();

    for (let i = 0; i < slotDefs.length; i++) {
      const def = slotDefs[i];
      const slotItem = doll.getItem(def.id);
      const isBlocked = doll.isSlotBlocked(def.id);

      const layout = def.layout ?? FALLBACK_SLOT_LAYOUTS[def.id] ?? {
        x: 10 + (i % 3) * 65,
        y: 20 + Math.floor(i / 3) * 45,
        width: 34,
        height: 34,
      };

      const slotW = layout.width ?? 34;
      const slotH = layout.height ?? 34;
      const slotX = contentX + layout.x;
      const slotY = contentY + layout.y;

      const isSelected = options.selectedSlot === def.id;
      const isHovered = options.hoveredSlot === def.id;
      const isFocused = options.focused && options.focusedSlotIndex === i;

      // Slot background
      ctx.fillStyle = isSelected
        ? 'rgba(56, 189, 248, 0.25)'
        : isHovered
        ? 'rgba(56, 189, 248, 0.15)'
        : theme.modalBg;
      ctx.fillRect(slotX, slotY, slotW, slotH);

      // Slot border
      let borderColor = theme.cardBorder;
      let borderWidth = 1;
      if (isSelected || isFocused) {
        borderColor = theme.hudAccent;
        borderWidth = 2;
      } else if (isHovered) {
        borderColor = theme.accent;
        borderWidth = 1.5;
      } else if (slotItem?.isCursed()) {
        borderColor = '#ef4444';
      } else if (slotItem && slotItem.enchantmentLevel > 0) {
        borderColor = '#a855f7';
      }

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(slotX + 0.5, slotY + 0.5, slotW - 1, slotH - 1);

      // Slot label abbreviation in corner
      ctx.font = `8px ${font}`;
      ctx.fillStyle = theme.textMuted;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const shortName = this.getShortSlotName(def.id);
      ctx.fillText(shortName, slotX + 2, slotY + 2);

      if (slotItem) {
        // Equipped item rendering
        const spriteKey = getItemSpriteKey(slotItem);
        const spriteSize = Math.min(slotW - 10, slotH - 10);
        const spriteOffset = Math.floor((slotW - spriteSize) / 2);

        if (this.atlas) {
          this.atlas.drawSprite(ctx, spriteKey, slotX + spriteOffset, slotY + spriteOffset + 2, spriteSize);
        } else {
          // Fallback initial
          ctx.font = `bold 12px ${font}`;
          ctx.fillStyle = theme.hudText;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(slotItem.name.charAt(0), slotX + slotW / 2, slotY + slotH / 2 + 2);
        }

        // Enchantment badge (+X)
        if (slotItem.enchantmentLevel > 0) {
          ctx.font = `bold 8px ${font}`;
          ctx.fillStyle = '#a855f7';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`+${slotItem.enchantmentLevel}`, slotX + slotW - 2, slotY + slotH - 1);
        }

        // Cursed badge [C]
        if (slotItem.isCursed()) {
          ctx.font = `bold 8px ${font}`;
          ctx.fillStyle = '#ef4444';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText('C', slotX + 2, slotY + slotH - 1);
        }
      } else if (isBlocked) {
        // Two-handed blocked slot indicator
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(slotX + 4, slotY + 4);
        ctx.lineTo(slotX + slotW - 4, slotY + slotH - 4);
        ctx.moveTo(slotX + slotW - 4, slotY + 4);
        ctx.lineTo(slotX + 4, slotY + slotH - 4);
        ctx.stroke();
      } else {
        // Empty slot faint silhouette icon (50% opacity)
        this.renderEmptySlotIcon(ctx, def.id, slotX, slotY, slotW, slotH, theme);
      }

      // Register click zone
      if (options.registerClickZone) {
        options.registerClickZone(
          slotX,
          slotY,
          slotW,
          slotH,
          () => {
            if (options.onSlotClick) {
              options.onSlotClick(def.id, slotItem);
            }
          },
          def.id,
          slotItem
        );
      }
    }
  }

  /**
   * Draws a stylized humanoid body silhouette centered in the equipment area.
   */
  private drawHumanoidSilhouette(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    width: number,
    _height: number,
    theme: Required<ThemeTokens>
  ): void {
    ctx.save();
    const centerX = originX + Math.floor(width / 2);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
    ctx.strokeStyle = theme.borderDark ?? 'rgba(56, 189, 248, 0.16)';
    ctx.lineWidth = 1;

    // 1. Head (Circle at center X, y: originY + 33)
    ctx.beginPath();
    ctx.arc(centerX, originY + 33, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 2. Neck
    ctx.beginPath();
    ctx.rect(centerX - 4, originY + 47, 8, 12);
    ctx.fill();
    ctx.stroke();

    // 3. Torso & Shoulders
    ctx.beginPath();
    ctx.moveTo(centerX - 38, originY + 70); // left shoulder
    ctx.lineTo(centerX + 38, originY + 70); // right shoulder
    ctx.lineTo(centerX + 26, originY + 120); // right ribs
    ctx.lineTo(centerX + 18, originY + 160); // right waist
    ctx.lineTo(centerX - 18, originY + 160); // left waist
    ctx.lineTo(centerX - 26, originY + 120); // left ribs
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4. Arms
    // Left arm
    ctx.beginPath();
    ctx.moveTo(centerX - 38, originY + 70);
    ctx.lineTo(centerX - 58, originY + 115);
    ctx.lineTo(centerX - 68, originY + 165);
    ctx.lineTo(centerX - 58, originY + 168);
    ctx.lineTo(centerX - 48, originY + 118);
    ctx.lineTo(centerX - 30, originY + 74);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right arm
    ctx.beginPath();
    ctx.moveTo(centerX + 38, originY + 70);
    ctx.lineTo(centerX + 58, originY + 115);
    ctx.lineTo(centerX + 68, originY + 165);
    ctx.lineTo(centerX + 58, originY + 168);
    ctx.lineTo(centerX + 48, originY + 118);
    ctx.lineTo(centerX + 30, originY + 74);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 5. Pelvis
    ctx.beginPath();
    ctx.moveTo(centerX - 18, originY + 160);
    ctx.lineTo(centerX + 18, originY + 160);
    ctx.lineTo(centerX + 22, originY + 195);
    ctx.lineTo(centerX, originY + 205); // crotch
    ctx.lineTo(centerX - 22, originY + 195);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 6. Legs
    // Left leg
    ctx.beginPath();
    ctx.moveTo(centerX - 22, originY + 195);
    ctx.lineTo(centerX, originY + 205);
    ctx.lineTo(centerX - 8, originY + 250);
    ctx.lineTo(centerX - 6, originY + 290);
    ctx.lineTo(centerX - 20, originY + 290);
    ctx.lineTo(centerX - 22, originY + 250);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right leg
    ctx.beginPath();
    ctx.moveTo(centerX + 22, originY + 195);
    ctx.lineTo(centerX, originY + 205);
    ctx.lineTo(centerX + 8, originY + 250);
    ctx.lineTo(centerX + 6, originY + 290);
    ctx.lineTo(centerX + 20, originY + 290);
    ctx.lineTo(centerX + 22, originY + 250);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Renders a faint 50% opacity silhouette icon corresponding to the accepted slot item type.
   */
  private renderEmptySlotIcon(
    ctx: CanvasRenderingContext2D,
    slotId: string,
    slotX: number,
    slotY: number,
    slotW: number,
    slotH: number,
    theme: Required<ThemeTokens>
  ): void {
    const spriteKey = EMPTY_SLOT_SPRITES[slotId];
    if (spriteKey && this.atlas) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      const size = Math.min(slotW - 12, slotH - 12);
      const offset = Math.floor((slotW - size) / 2);
      this.atlas.drawSprite(ctx, spriteKey, slotX + offset, slotY + offset + 2, size);
      ctx.restore();
      return;
    }

    // Vector silhouette fallback for jewelry / cloaks / bracers
    ctx.save();
    ctx.strokeStyle = theme.textMuted ?? 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 1;

    const midX = slotX + slotW / 2;
    const midY = slotY + slotH / 2 + 2;

    if (slotId === 'neck') {
      // Amulet / Pendant outline
      ctx.beginPath();
      ctx.arc(midX, midY - 2, 7, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(midX, midY + 5, 3, 0, Math.PI * 2);
      ctx.stroke();
    } else if (slotId === 'overgarment') {
      // Cloak silhouette
      ctx.beginPath();
      ctx.moveTo(midX - 7, midY - 8);
      ctx.lineTo(midX + 7, midY - 8);
      ctx.lineTo(midX + 10, midY + 8);
      ctx.lineTo(midX - 10, midY + 8);
      ctx.closePath();
      ctx.stroke();
    } else if (slotId === 'fingerLeft' || slotId === 'fingerRight') {
      // Ring circle
      ctx.beginPath();
      ctx.arc(midX, midY, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(midX, midY - 6, 2, 0, Math.PI * 2); // gem on ring
      ctx.stroke();
    } else if (slotId === 'hands') {
      // Gauntlet outline
      ctx.strokeRect(midX - 6, midY - 7, 12, 14);
    } else if (slotId === 'wrists') {
      // Bracer band
      ctx.beginPath();
      ctx.ellipse(midX, midY, 7, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Helper to get slot abbreviation for UI rendering.
   */
  private getShortSlotName(slotId: string): string {
    switch (slotId) {
      case 'head': return 'HD';
      case 'neck': return 'NK';
      case 'overgarment': return 'CK';
      case 'torso': return 'TR';
      case 'mainHand': return 'MH';
      case 'offHand': return 'OH';
      case 'hands': return 'HN';
      case 'wrists': return 'WR';
      case 'fingerLeft': return 'L.RG';
      case 'waist': return 'BLT';
      case 'fingerRight': return 'R.RG';
      case 'pack': return 'PCK';
      case 'purse': return 'PRS';
      case 'feet': return 'FT';
      default: return slotId.slice(0, 3).toUpperCase();
    }
  }

  /**
   * Hit-tests whether a mouse coordinate falls inside any slot.
   */
  public getSlotAtPosition(
    px: number,
    py: number,
    originX: number,
    originY: number,
    doll: Paperdoll
  ): { slotId: string; item: Item | null } | null {
    const slotDefs = doll.getSlotDefinitions();
    const contentX = originX;
    const contentY = originY + 26;

    for (let i = 0; i < slotDefs.length; i++) {
      const def = slotDefs[i];
      const layout = def.layout ?? FALLBACK_SLOT_LAYOUTS[def.id] ?? {
        x: 10 + (i % 3) * 65,
        y: 20 + Math.floor(i / 3) * 45,
        width: 34,
        height: 34,
      };

      const slotW = layout.width ?? 34;
      const slotH = layout.height ?? 34;
      const slotX = contentX + layout.x;
      const slotY = contentY + layout.y;

      if (px >= slotX && px <= slotX + slotW && py >= slotY && py <= slotY + slotH) {
        return {
          slotId: def.id,
          item: doll.getItem(def.id),
        };
      }
    }
    return null;
  }
}
