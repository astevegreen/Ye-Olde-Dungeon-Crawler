import type { GameEngine } from '../../engine';
import type { ShopPanelBounds, ShopPanelContext } from './types';

/** Callbacks renderSageServices needs from the owning ShopOverlay. */
export interface SageServicesActions {
  identify(): void;
  runAdvisory(): void;
  close(): void;
  openCompendium?(): void;
}

export function renderSageServices(
  ctx: CanvasRenderingContext2D,
  engine: GameEngine,
  bounds: ShopPanelBounds,
  panel: ShopPanelContext,
  actions: SageServicesActions
): void {
  const { modalX, modalW, startY } = bounds;
    const boxW = modalW - 24;
    const boxX = modalX + 12;
    const theme = panel.theme;
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    const unIdItems = [
      ...engine.player.inventory.primaryPack.getItems().filter((i) => !i.identified),
      ...engine.player.inventory.paperdoll.getAllEquipped().map((e) => e.item).filter((i) => !i.identified),
    ];

    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(boxX, startY, boxW, 170);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(boxX + 0.5, startY + 0.5, boxW - 1, 169);

    ctx.font = `bold 13px ${font}`;
    ctx.fillStyle = '#c084fc';
    ctx.textAlign = 'left';
    ctx.fillText("DECIPHER RUNES & RUNIC ENCHANTMENTS (Cost: 20 GP)", boxX + 14, startY + 22);

    ctx.font = `11px ${font}`;
    ctx.fillStyle = theme.hudText;
    const sageName = engine.manifest?.town?.services?.sageName ?? 'The Sage';
    ctx.fillText(`${sageName} consults ancient texts to reveal unknown potions, scrolls,`, boxX + 14, startY + 40);
    ctx.fillText("weapons, and armor found within the depths.", boxX + 14, startY + 56);

    ctx.font = `bold 11px ${font}`;
    ctx.fillStyle = '#facc15';
    ctx.fillText(`Unidentified Items In Possession: ${unIdItems.length}`, boxX + 14, startY + 84);

    let listY = startY + 102;
    for (let i = 0; i < Math.min(unIdItems.length, 3); i++) {
      ctx.font = `italic 11px ${font}`;
      ctx.fillStyle = theme.textMuted;
      ctx.fillText(`• ${unIdItems[i].displayName} (${unIdItems[i].category})`, boxX + 24, listY);
      listY += 16;
    }

    const btnW = 190;
    const btnH = 30;
    const btnX = boxX + boxW - btnW - 14;
    const btnY = startY + 75;
    ctx.fillStyle = theme.accent;
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = theme.text;
    ctx.font = `bold 11px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('[I] IDENTIFY AN ITEM', btnX + btnW / 2, btnY + 18);

    panel.addClickZone({
      x: btnX,
      y: btnY,
      width: btnW,
      height: btnH,
      action: () => actions.identify(),
    });

    // Section 2: Strategic Advisory & Bestiary
    const s2Y = startY + 135;
    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(boxX, s2Y, boxW, 140);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(boxX + 0.5, s2Y + 0.5, boxW - 1, 139);

    ctx.font = `bold 13px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.textAlign = 'left';
    ctx.fillText("STRATEGIC PREPARATION & SLAYER'S BESTIARY", boxX + 14, s2Y + 22);

    ctx.font = `11px ${font}`;
    ctx.fillStyle = theme.hudText;
    ctx.fillText("Consult ancient wisdom to review encumbrance risks, cursed afflictions,", boxX + 14, s2Y + 40);
    ctx.fillText("and elemental threats before entering the dungeon abyss.", boxX + 14, s2Y + 56);

    // Advisory Button
    const btnAdvW = 190;
    const btnAdvX = boxX + 14;
    const btnAdvY = s2Y + 75;
    ctx.fillStyle = theme.manaBar;
    ctx.fillRect(btnAdvX, btnAdvY, btnAdvW, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 11px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('[A] SEEK RUN ADVISORY', btnAdvX + btnAdvW / 2, btnAdvY + 19);

    panel.addClickZone({
      x: btnAdvX,
      y: btnAdvY,
      width: btnAdvW,
      height: 32,
      action: () => actions.runAdvisory(),
    });

    // Bestiary Button
    const btnBesW = 190;
    const btnBesX = btnAdvX + btnAdvW + 16;
    const btnBesY = s2Y + 75;
    ctx.fillStyle = theme.accent;
    ctx.fillRect(btnBesX, btnBesY, btnBesW, 32);
    ctx.fillStyle = theme.text;
    ctx.font = `bold 11px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText("[B] SLAYER'S CODEX", btnBesX + btnBesW / 2, btnBesY + 19);

    panel.addClickZone({
      x: btnBesX,
      y: btnBesY,
      width: btnBesW,
      height: 32,
      action: () => {
        if (actions.openCompendium) {
          actions.close();
          actions.openCompendium();
        }
      },
    });
}
