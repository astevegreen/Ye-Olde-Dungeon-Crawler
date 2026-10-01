import type { GameEngine } from '../engine';
import { fillIconText } from './canvasIcons';
import type { UiIconName } from '../ui/icons';
import type { Camera } from './camera';
import { TileInspector } from '../engine';
import type { TileInspection } from '../engine';
import { canvasUnit, resolveThemeTokens, uiFont } from './theme';
import { formatWeight } from '../ui/units';
import type { ThemeTokens } from '../engine';

export class InspectOverlay {
  public mode: 'closed' | 'inspect' = 'closed';
  public cursorX = 0;
  public cursorY = 0;
  private onStateChanged?: () => void;
  private theme?: Required<ThemeTokens>;

  constructor(onStateChanged?: () => void) {
    this.onStateChanged = onStateChanged;
  }

  public get isOpen(): boolean {
    return this.mode === 'inspect';
  }

  public open(engine: GameEngine): void {
    this.mode = 'inspect';
    this.cursorX = engine.player.x;
    this.cursorY = engine.player.y;
    this.notify();
  }

  public close(): void {
    this.mode = 'closed';
    this.notify();
  }

  public toggle(engine: GameEngine): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(engine);
    }
  }

  public moveCursor(dx: number, dy: number, engine: GameEngine): void {
    const nx = this.cursorX + dx;
    const ny = this.cursorY + dy;

    // Constrain reticle within map bounds and explored/visible tiles
    if (engine.map.inBounds(nx, ny) && engine.fov.isExplored(nx, ny)) {
      this.cursorX = nx;
      this.cursorY = ny;
      this.notify();
    }
  }

  private notify(): void {
    if (this.onStateChanged) {
      this.onStateChanged();
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    engine: GameEngine,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number
  ): void {
    if (!this.isOpen) return;

    this.theme = resolveThemeTokens(engine.manifest?.theme);

    // 1. Draw Reticle on targeted world tile
    const screenPos = camera.worldToScreen(this.cursorX, this.cursorY, cellSize, offsetX, offsetY);
    if (screenPos) {
      this.renderReticle(ctx, screenPos.x, screenPos.y, cellSize);
    }

    // 2. Query Tile Inspection data
    const inspection = TileInspector.inspectTile(engine, this.cursorX, this.cursorY);

    // 3. Render Inspection HUD Card
    this.renderInspectionCard(ctx, canvasW, canvasH, inspection, screenPos?.x ?? 0);
  }

  private renderReticle(ctx: CanvasRenderingContext2D, px: number, py: number, cs: number): void {
    ctx.save();
    const theme = this.theme ?? resolveThemeTokens();

    // Subtle accent tile tint
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(px, py, cs, cs);
    ctx.globalAlpha = 1.0;

    // High-contrast corner brackets
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2.5;
    const cornerLen = Math.floor(cs * 0.28);

    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(px, py + cornerLen);
    ctx.lineTo(px, py);
    ctx.lineTo(px + cornerLen, py);
    ctx.stroke();

    // Top-right corner
    ctx.beginPath();
    ctx.moveTo(px + cs - cornerLen, py);
    ctx.lineTo(px + cs, py);
    ctx.lineTo(px + cs, py + cornerLen);
    ctx.stroke();

    // Bottom-left corner
    ctx.beginPath();
    ctx.moveTo(px, py + cs - cornerLen);
    ctx.lineTo(px, py + cs);
    ctx.lineTo(px + cornerLen, py + cs);
    ctx.stroke();

    // Bottom-right corner
    ctx.beginPath();
    ctx.moveTo(px + cs - cornerLen, py + cs);
    ctx.lineTo(px + cs, py + cs);
    ctx.lineTo(px + cs, py + cs - cornerLen);
    ctx.stroke();

    ctx.restore();
  }

  private renderInspectionCard(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    _canvasH: number,
    data: TileInspection,
    reticleScreenX: number
  ): void {
    ctx.save();
    const theme = this.theme ?? resolveThemeTokens();
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    // Laid out in CSS pixels (canvasUnit) so the card grows with its uiFont() text.
    const u = canvasUnit();
    const cardW = 300 * u;
    // Calculate card height based on contents
    let cardH = 110 * u;
    if (data.entity) cardH += 85 * u;
    if (data.traps && data.traps.length > 0) cardH += 22 * u;
    if (data.items && data.items.length > 0) cardH += (24 + Math.min(data.items.length, 3) * 16) * u;

    // Smart docking: opposite side of reticle
    const cardX = reticleScreenX > canvasW / 2 ? 14 * u : canvasW - cardW - 14 * u;
    const cardY = 54 * u;

    // Card shadow
    ctx.fillStyle = theme.modalBackdrop;
    ctx.fillRect(cardX + 3 * u, cardY + 3 * u, cardW, cardH);

    // Card Body
    ctx.fillStyle = theme.modalBg;
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // Border
    ctx.strokeStyle = theme.modalBorder;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cardX + 0.5 * u, cardY + 0.5 * u, cardW - 1, cardH - 1);

    // Title Bar
    ctx.fillStyle = theme.modalTitlebar;
    ctx.fillRect(cardX, cardY, cardW, 24 * u);
    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX, cardY + 24.5 * u);
    ctx.lineTo(cardX + cardW, cardY + 24.5 * u);
    ctx.stroke();

    ctx.font = uiFont('xs', font, 'bold');
    ctx.fillStyle = theme.modalTitlebarText;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LOOK / INSPECT [${data.x}, ${data.y}]`, cardX + 8 * u, cardY + 12 * u);

    const visLabel = data.visibility.toUpperCase();
    const visColor = data.visibility === 'visible' ? '#10b981' : theme.hudAccent;
    ctx.fillStyle = visColor;
    ctx.textAlign = 'right';
    ctx.fillText(`[${visLabel}]`, cardX + cardW - 8 * u, cardY + 12 * u);

    // Content Lines
    let curY = cardY + 38 * u;
    ctx.textAlign = 'left';

    // 1. Terrain section
    if (data.terrain) {
      ctx.font = uiFont('xs', font, 'bold');
      ctx.fillStyle = theme.hudText;
      ctx.fillText(`Terrain: ${data.terrain.name}`, cardX + 8 * u, curY);

      const passBadge = data.terrain.passable ? '[Passable]' : '[Blocked]';
      const passColor = data.terrain.passable ? '#10b981' : '#ef4444';
      ctx.font = uiFont('xs', font);
      ctx.fillStyle = passColor;
      ctx.fillText(passBadge, cardX + cardW - 74 * u, curY);
      curY += 18 * u;
    }

    // 2. Traps section
    if (data.traps && data.traps.length > 0) {
      for (const trap of data.traps) {
        ctx.font = uiFont('xs', font, 'bold');
        ctx.fillStyle = '#f97316';
        fillIconText(ctx, [{ icon: 'warning' }, ` Trap: ${trap.name}`], cardX + 8 * u, curY);
        curY += 16 * u;
      }
    }

    // 3. Entity section
    if (data.entity) {
      const ent = data.entity;
      ctx.strokeStyle = theme.cardBorder;
      ctx.beginPath();
      ctx.moveTo(cardX + 8 * u, curY);
      ctx.lineTo(cardX + cardW - 8 * u, curY);
      ctx.stroke();
      curY += 10 * u;

      ctx.font = uiFont('xs', font, 'bold');
      ctx.fillStyle = ent.type === 'player' ? theme.hudAccent : '#f87171';
      ctx.fillText(`Entity: ${ent.name}`, cardX + 8 * u, curY);
      curY += 16 * u;

      // HP bar & values
      ctx.font = uiFont('xs', font);
      ctx.fillStyle = theme.textMuted;
      ctx.fillText(`HP: ${ent.hp}/${ent.maxHp}`, cardX + 8 * u, curY);

      ctx.fillText(`Speed: ${ent.speedTier} (${ent.speed})`, cardX + 110 * u, curY);
      curY += 16 * u;

      // Status
      const statusStr = (ent.statusEffects && ent.statusEffects.length > 0) ? ent.statusEffects.join(', ') : 'None';
      ctx.fillStyle = theme.textMuted;
      ctx.fillText(`Afflictions: ${statusStr}`, cardX + 8 * u, curY);
      curY += 16 * u;

      // Declared Intent
      if (ent.intent) {
        let intentLabel = 'None';
        let intentIcon: UiIconName | null = null;
        let intentColor = theme.textMuted;

        if (ent.intent.type === 'windup') {
          intentLabel = `WIND-UP: ${ent.intent.abilityName ?? 'Strike'}`;
          intentIcon = 'warning';
          intentColor = '#f59e0b';
        } else if (ent.intent.type === 'attack') {
          intentLabel = 'Engaging';
          intentIcon = 'attack';
          intentColor = '#ef4444';
        } else if (ent.intent.type === 'fleeing') {
          intentLabel = 'Retreating';
          intentIcon = 'retreat';
          intentColor = '#a855f7';
        } else if (ent.intent.type === 'idle') {
          intentLabel = 'Resting / Idle';
          intentIcon = 'rest';
          intentColor = theme.textMuted;
        }

        ctx.font = uiFont('xs', font, 'bold');
        ctx.fillStyle = intentColor;
        fillIconText(ctx, ['Intent: ', ...(intentIcon ? [{ icon: intentIcon }] : []), intentLabel], cardX + 8 * u, curY);
        curY += 18 * u;
      }
    }

    // 4. Ground Items section
    if (data.items && data.items.length > 0) {
      ctx.strokeStyle = theme.cardBorder;
      ctx.beginPath();
      ctx.moveTo(cardX + 8 * u, curY);
      ctx.lineTo(cardX + cardW - 8 * u, curY);
      ctx.stroke();
      curY += 10 * u;

      ctx.font = uiFont('xs', font, 'bold');
      ctx.fillStyle = theme.accent;
      ctx.fillText(`Ground Items (${data.items.length}):`, cardX + 8 * u, curY);
      curY += 14 * u;

      for (let i = 0; i < Math.min(data.items.length, 3); i++) {
        const it = data.items[i];
        ctx.font = uiFont('xs', font);
        const rawName = (it && it.name) ? it.name : 'Item';

        let statTag = '';
        if (it.stats?.attackBonus) {
          statTag = ` (+${it.stats.attackBonus} ATK${it.elementalAffix ? `, ${it.elementalAffix.element.toUpperCase()}` : ''})`;
        } else if (it.stats?.defenseBonus) {
          statTag = ` (+${it.stats.defenseBonus} DEF)`;
        } else if (it.elementalAffix) {
          statTag = ` (${it.elementalAffix.element.toUpperCase()})`;
        }

        const isEnchanted = (it.enchantmentLevel && it.enchantmentLevel > 0) || !!it.elementalAffix;
        ctx.fillStyle = isEnchanted ? '#c084fc' : theme.hudText;

        const fullName = `${rawName}${statTag}`;
        const maxNameLen = 22;
        const nameCut = fullName.length > maxNameLen ? fullName.slice(0, maxNameLen - 1) + '…' : fullName;
        ctx.fillText(`• ${nameCut}`, cardX + 8 * u, curY);

        ctx.fillStyle = theme.textMuted;
        ctx.textAlign = 'right';
        ctx.fillText(formatWeight(it.weight), cardX + cardW - 8 * u, curY);
        ctx.textAlign = 'left';
        curY += 14 * u;
      }

      if (data.items.length > 3) {
        ctx.fillStyle = theme.textMuted;
        ctx.font = uiFont('xs', font, 'italic');
        ctx.fillText(`(+${data.items.length - 3} more items...)`, cardX + 16 * u, curY);
        curY += 12 * u;
      }
    }

    // Card Footer Hint
    ctx.strokeStyle = theme.cardBorder;
    ctx.beginPath();
    ctx.moveTo(cardX + 8 * u, cardY + cardH - 20 * u);
    ctx.lineTo(cardX + cardW - 8 * u, cardY + cardH - 20 * u);
    ctx.stroke();

    ctx.font = uiFont('xs', font);
    ctx.fillStyle = theme.hudAccent;
    ctx.textAlign = 'center';
    ctx.fillText('[Arrows/Numpad] Move | [X / L / ESC] Exit', cardX + cardW / 2, cardY + cardH - 9 * u);

    ctx.restore();
  }
}
