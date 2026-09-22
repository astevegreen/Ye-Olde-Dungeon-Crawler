import type { GameEngine } from '../../engine';
import type { ShopPanelBounds, ShopPanelContext } from './types';

/** Callbacks renderTempleServices needs from the owning ShopOverlay. */
export interface TempleServicesActions {
  cleanseCurses(): void;
  healRestore(): void;
}

export function renderTempleServices(
  ctx: CanvasRenderingContext2D,
  engine: GameEngine,
  bounds: ShopPanelBounds,
  panel: ShopPanelContext,
  actions: TempleServicesActions
): void {
  const { modalX, modalW, startY } = bounds;
    const boxW = modalW - 24;
    const boxX = modalX + 12;
    const theme = panel.theme;
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    // Service 1: Cleanse Curses
    const s1Y = startY;
    const sH = 75;
    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(boxX, s1Y, boxW, sH);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(boxX + 0.5, s1Y + 0.5, boxW - 1, sH - 1);

    ctx.font = `bold 13px ${font}`;
    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'left';
    const templeName = engine.manifest?.town?.services?.templeName?.toUpperCase() ?? 'CLEANSING RITUAL';
    ctx.fillText(`${templeName} (Cost: 50 GP)`, boxX + 14, s1Y + 20);

    ctx.font = `11px ${font}`;
    ctx.fillStyle = theme.textMuted;
    ctx.fillText("Divine energy shatters all curses bound to your equipped gear.", boxX + 14, s1Y + 38);
    ctx.fillText("Items are normalized and safely returned to your pack.", boxX + 14, s1Y + 54);

    const btn1W = 180;
    const btn1H = 30;
    const btn1X = boxX + boxW - btn1W - 14;
    const btn1Y = s1Y + 22;
    ctx.fillStyle = theme.accent;
    ctx.fillRect(btn1X, btn1Y, btn1W, btn1H);
    ctx.fillStyle = theme.text;
    ctx.font = `bold 11px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('[C] CLEANSE CURSES', btn1X + btn1W / 2, btn1Y + 16);

    panel.addClickZone({
      x: btn1X,
      y: btn1Y,
      width: btn1W,
      height: btn1H,
      action: () => actions.cleanseCurses(),
    });

    // Service 2: Heal & Restore
    const s2Y = s1Y + sH + 12;
    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(boxX, s2Y, boxW, sH);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(boxX + 0.5, s2Y + 0.5, boxW - 1, sH - 1);

    ctx.font = `bold 13px ${font}`;
    ctx.fillStyle = theme.healthBar;
    ctx.textAlign = 'left';
    ctx.fillText("DIVINE RESTORATION & VITALITY (Cost: 25 GP)", boxX + 14, s2Y + 20);

    ctx.font = `11px ${font}`;
    ctx.fillStyle = theme.textMuted;
    ctx.fillText("Purges poison, paralysis, and sluggishness. Restores all Hit Points", boxX + 14, s2Y + 38);
    ctx.fillText("and refills your arcane Mana pool to maximum.", boxX + 14, s2Y + 54);

    const btn2X = boxX + boxW - btn1W - 14;
    const btn2Y = s2Y + 22;
    ctx.fillStyle = theme.healthBar;
    ctx.fillRect(btn2X, btn2Y, btn1W, btn1H);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 11px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('[H] HEAL & RESTORE', btn2X + btn1W / 2, btn2Y + 16);

    panel.addClickZone({
      x: btn2X,
      y: btn2Y,
      width: btn1W,
      height: btn1H,
      action: () => actions.healRestore(),
    });
}
