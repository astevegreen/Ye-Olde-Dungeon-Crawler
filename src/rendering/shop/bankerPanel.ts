import type { GameEngine } from '../../engine';
import type { Item } from '../../engine';
import type { ShopPanelBounds, ShopPanelContext } from './types';

/** Callbacks renderBankerServices needs from the owning ShopOverlay. */
export interface BankerServicesActions {
  compactCoins(): void;
}

export function renderBankerServices(
  ctx: CanvasRenderingContext2D,
  _engine: GameEngine,
  bounds: ShopPanelBounds,
  data: { coinItems: Array<{ item: Item }>; coinWeightGrams: number },
  panel: ShopPanelContext,
  actions: BankerServicesActions
): void {
  const { modalX, modalW, startY } = bounds;
  const { coinItems, coinWeightGrams } = data;
    const boxW = modalW - 24;
    const boxX = modalX + 12;
    const theme = panel.theme;
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(boxX, startY, boxW, 160);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(boxX + 0.5, startY + 0.5, boxW - 1, 159);

    ctx.font = `bold 13px ${font}`;
    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'left';
    ctx.fillText("DENOMINATION COMPACTION & BULLION EXCHANGE (No Fee)", boxX + 14, startY + 22);

    ctx.font = `11px ${font}`;
    ctx.fillStyle = theme.hudText;
    ctx.fillText("Exchange loose Copper and Silver for compact, light Gold and Platinum pieces.", boxX + 14, startY + 40);
    ctx.fillText("Greatly reduces carrying weight and prevents encumbrance fatigue!", boxX + 14, startY + 56);

    ctx.font = `bold 11px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.fillText(`Current Coin Item Stacks: ${coinItems.length}   |   Current Total Coin Weight: ${(coinWeightGrams / 1000).toFixed(2)} kg (${coinWeightGrams} g)`, boxX + 14, startY + 84);

    const btnW = 220;
    const btnH = 34;
    const btnX = boxX + boxW - btnW - 14;
    const btnY = startY + 105;
    ctx.fillStyle = theme.accent;
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = theme.text;
    ctx.font = `bold 12px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('[E] COMPACT COINS', btnX + btnW / 2, btnY + 21);

    panel.addClickZone({
      x: btnX,
      y: btnY,
      width: btnW,
      height: btnH,
      action: () => actions.compactCoins(),
    });
}
