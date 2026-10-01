import type { GameEngine, TileDefinition } from '../engine';
import { Monster, Container } from '../engine';
import type { Camera } from './camera';
import type { ThemeTokens } from '../engine';
import { resolveThemeTokens, uiFont } from './theme';

export class TacticalTargetOverlay {
  private hoveredWorldX: number | null = null;
  private hoveredWorldY: number | null = null;

  public setHoveredTile(x: number | null, y: number | null): void {
    this.hoveredWorldX = x;
    this.hoveredWorldY = y;
  }

  public clearHover(): void {
    this.hoveredWorldX = null;
    this.hoveredWorldY = null;
  }

  public get hoveredTile(): { x: number; y: number } | null {
    if (this.hoveredWorldX === null || this.hoveredWorldY === null) return null;
    return { x: this.hoveredWorldX, y: this.hoveredWorldY };
  }

  public render(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    virtualWidth: number,
    _virtualHeight: number,
    themeTokens?: ThemeTokens
  ): void {
    if (this.hoveredWorldX === null || this.hoveredWorldY === null) return;
    const hx = this.hoveredWorldX;
    const hy = this.hoveredWorldY;

    if (!engine.map.inBounds(hx, hy)) return;
    if (!engine.fov.isVisible(hx, hy)) return;

    const theme = resolveThemeTokens(themeTokens);
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    // 1. Check if hovering an active monster
    const entity = engine.map.getEntityAt(hx, hy);
    if (entity instanceof Monster && entity.isAlive()) {
      this.renderTargetBrackets(ctx, camera, hx, hy, cellSize, offsetX, offsetY, theme);
      this.renderTargetCard(ctx, entity, virtualWidth, theme, font);
      return;
    }

    // 2. Check if hovering ground items or containers
    const items = engine.map.getItemsAt(hx, hy);
    if (items && items.length > 0) {
      this.renderGroundPill(ctx, camera, hx, hy, items, cellSize, offsetX, offsetY, theme, font);
      return;
    }

    // 3. Check if hovering stairs or doors
    const tile = engine.map.getTile(hx, hy);
    if (tile && (tile.type.startsWith('stairs') || tile.type.startsWith('door'))) {
      this.renderFixturePill(ctx, camera, hx, hy, tile, cellSize, offsetX, offsetY, theme, font);
    }
  }

  /** Draws targeting brackets around the hovered monster's tile */
  private renderTargetBrackets(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    worldX: number,
    worldY: number,
    cs: number,
    offsetX: number,
    offsetY: number,
    theme: Required<ThemeTokens>
  ): void {
    const screenPos = camera.worldToScreen(worldX, worldY, cs, offsetX, offsetY);
    if (!screenPos) return;

    ctx.save();
    const px = screenPos.x;
    const py = screenPos.y;
    const bLen = Math.floor(cs * 0.28);

    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(px, py + bLen);
    ctx.lineTo(px, py);
    ctx.lineTo(px + bLen, py);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(px + cs - bLen, py);
    ctx.lineTo(px + cs, py);
    ctx.lineTo(px + cs, py + bLen);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(px, py + cs - bLen);
    ctx.lineTo(px, py + cs);
    ctx.lineTo(px + bLen, py + cs);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(px + cs - bLen, py + cs);
    ctx.lineTo(px + cs, py + cs);
    ctx.lineTo(px + cs, py + cs - bLen);
    ctx.stroke();

    ctx.restore();
  }

  /** Renders the Active Target Card in the top-right viewport HUD corner */
  private renderTargetCard(
    ctx: CanvasRenderingContext2D,
    monster: Monster,
    virtualWidth: number,
    theme: Required<ThemeTokens>,
    font: string
  ): void {
    ctx.save();
    const cardW = 210;
    const cardH = 62;
    const cardX = virtualWidth - cardW - 14;
    const cardY = 54; // Pinned directly beneath the top canvas bar

    // Background panel with dark slate & gold/amber border
    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(cardX, cardY, cardW, cardH);

    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cardX + 0.5, cardY + 0.5, cardW - 1, cardH - 1);

    // Subtle header accent line
    ctx.fillStyle = theme.accent;
    ctx.fillRect(cardX, cardY, 3, cardH);

    // Target Monster Name
    ctx.font = uiFont('sm', font, 'bold');
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const displayName = monster.name.length > 20 ? monster.name.slice(0, 19) + '…' : monster.name;
    ctx.fillText(`⚔️ ${displayName}`, cardX + 8, cardY + 7);

    // HP Bar
    const barX = cardX + 8;
    const barY = cardY + 24;
    const barW = cardW - 16;
    const barH = 10;
    const ratio = Math.max(0, Math.min(1, monster.hp / monster.maxHp));

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX, barY, barW, barH);

    ctx.fillStyle = ratio > 0.5 ? '#10b981' : ratio > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(barX, barY, Math.floor(barW * ratio), barH);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);

    // Numerical HP
    ctx.font = uiFont('xs', font, 'bold');
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${monster.hp} / ${monster.maxHp} HP`, barX + barW / 2, barY + barH / 2 + 0.5);

    // Bottom info line: Threat windup or status effects
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const infoY = cardY + 40;

    if (monster.intent?.type === 'windup') {
      ctx.font = uiFont('xs', font, 'bold');
      ctx.fillStyle = '#f87171';
      ctx.fillText('⚠️ Intent: Attack Winding Up!', barX, infoY);
    } else {
      const statuses = monster.statusManager?.getAll() ?? [];
      if (statuses.length > 0) {
        ctx.font = uiFont('xs', font, 'bold');
        ctx.fillStyle = '#38bdf8';
        const labels = statuses.map((s) => `[${s.type}]`).join(' ');
        ctx.fillText(labels.length > 26 ? labels.slice(0, 25) + '…' : labels, barX, infoY);
      } else {
        ctx.font = uiFont('xs', font, 'italic');
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Active Combat Target', barX, infoY);
      }
    }

    ctx.restore();
  }

  /** Renders a floating tooltip pill above ground items */
  private renderGroundPill(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    worldX: number,
    worldY: number,
    items: readonly import('../engine').Item[],
    cs: number,
    offsetX: number,
    offsetY: number,
    theme: Required<ThemeTokens>,
    font: string
  ): void {
    const screenPos = camera.worldToScreen(worldX, worldY, cs, offsetX, offsetY);
    if (!screenPos) return;

    ctx.save();
    let label = '';
    const firstItem = items[0];
    if (firstItem instanceof Container) {
      label = firstItem.wasOpened ? `🧰 ${firstItem.displayName}` : `★ ${firstItem.displayName} (Unopened)`;
    } else {
      const count = items.length;
      label = count > 1 ? `📦 ${firstItem.displayName} (+${count - 1} more)` : `📦 ${firstItem.displayName}`;
    }

    ctx.font = uiFont('xs', font, 'bold');
    const textW = ctx.measureText(label).width;
    const pillW = textW + 14;
    const pillH = 18;
    const pillX = screenPos.x + cs / 2 - pillW / 2;
    const pillY = screenPos.y - pillH - 4;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(pillX, pillY, pillW, pillH);

    ctx.strokeStyle = theme.hudAccent;
    ctx.lineWidth = 1;
    ctx.strokeRect(pillX + 0.5, pillY + 0.5, pillW - 1, pillH - 1);

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, pillX + pillW / 2, pillY + pillH / 2 + 0.5);

    ctx.restore();
  }

  /** Renders a tooltip pill above interactive fixtures (stairs/doors) */
  private renderFixturePill(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    worldX: number,
    worldY: number,
    tile: TileDefinition,
    cs: number,
    offsetX: number,
    offsetY: number,
    theme: Required<ThemeTokens>,
    font: string
  ): void {
    const screenPos = camera.worldToScreen(worldX, worldY, cs, offsetX, offsetY);
    if (!screenPos) return;

    let text = '';
    if (tile.type === 'stairs_down') text = '🪜 Stairs Down';
    else if (tile.type === 'stairs_up') text = '🪜 Stairs Up';
    else if (tile.type === 'door_closed') text = '🚪 Closed Door';
    else if (tile.type === 'door_open') text = '🚪 Open Doorway';
    if (!text) return;

    ctx.save();
    ctx.font = uiFont('xs', font, 'bold');
    const textW = ctx.measureText(text).width;
    const pillW = textW + 12;
    const pillH = 17;
    const pillX = screenPos.x + cs / 2 - pillW / 2;
    const pillY = screenPos.y - pillH - 4;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(pillX, pillY, pillW, pillH);

    ctx.strokeStyle = theme.borderLight;
    ctx.lineWidth = 1;
    ctx.strokeRect(pillX + 0.5, pillY + 0.5, pillW - 1, pillH - 1);

    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pillX + pillW / 2, pillY + pillH / 2 + 0.5);

    ctx.restore();
  }
}
