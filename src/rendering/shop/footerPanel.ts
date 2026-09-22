import type { GameEngine } from '../../engine';
import type { ShopPanelBounds, ShopPanelContext } from './types';

/** Callbacks renderFooter needs from the owning ShopOverlay. */
export interface FooterActions {
  close(): void;
}

export function renderFooter(
  ctx: CanvasRenderingContext2D,
  engine: GameEngine,
  bounds: ShopPanelBounds,
  data: { coins: { platinum: number; gold: number; silver: number; copper: number }; totalCp: number; coinWeightGrams: number; statusMessage: string; statusColor: string },
  panel: ShopPanelContext,
  actions: FooterActions
): void {
  const { modalX, modalY, modalW, modalH } = bounds;
  const { coins, totalCp, coinWeightGrams } = data;
    const footerY = modalY + modalH - 74;
    const footerH = 64;
    const theme = panel.theme;
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(modalX + 10, footerY, modalW - 20, footerH);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(modalX + 10.5, footerY + 0.5, modalW - 21, footerH - 1);

    // Wealth Breakdown
    ctx.font = `bold 11px ${font}`;
    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'left';
    ctx.fillText(
      `FUNDS: [${coins.platinum} PP, ${coins.gold} GP, ${coins.silver} SP, ${coins.copper} CP] = ${totalCp} CP total`,
      modalX + 16,
      footerY + 16
    );

    // Coin Weight & Encumbrance
    const player = engine.player;
    const pack = player.inventory.primaryPack;
    ctx.font = `10px ${font}`;
    ctx.fillStyle = theme.textMuted;
    ctx.textAlign = 'right';
    ctx.fillText(
      `Coin Weight: ${coinWeightGrams}g | Pack: ${pack.totalWeight()}g/${pack.maxWeightCapacity}g`,
      modalX + modalW - 18,
      footerY + 16
    );

    // Feedback Message or Hint
    ctx.textAlign = 'left';
    if (data.statusMessage) {
      ctx.fillStyle = data.statusColor || theme.hudAccent;
      ctx.font = `bold 11px ${font}`;
      ctx.fillText(data.statusMessage, modalX + 16, footerY + 36);
    } else {
      ctx.fillStyle = theme.textMuted;
      ctx.font = `italic 10px ${font}`;
      ctx.fillText(
        '[Tab] Switch Pane | [1-9] Quick Action | [Enter] Confirm | [Esc] Exit',
        modalX + 16,
        footerY + 36
      );
    }

    // Leave Button [Esc]
    const leaveBtnW = 90;
    const leaveBtnH = 22;
    const leaveBtnX = modalX + modalW - leaveBtnW - 16;
    const leaveBtnY = footerY + 34;

    ctx.fillStyle = theme.modalBg;
    ctx.fillRect(leaveBtnX, leaveBtnY, leaveBtnW, leaveBtnH);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(leaveBtnX + 0.5, leaveBtnY + 0.5, leaveBtnW - 1, leaveBtnH - 1);
    ctx.fillStyle = theme.hudText;
    ctx.font = `bold 10px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('LEAVE [ESC]', leaveBtnX + leaveBtnW / 2, leaveBtnY + 12);

    panel.addClickZone({
      x: leaveBtnX,
      y: leaveBtnY,
      width: leaveBtnW,
      height: leaveBtnH,
      action: () => actions.close(),
    });
}
