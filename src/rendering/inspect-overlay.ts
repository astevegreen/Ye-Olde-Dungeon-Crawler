import type { GameEngine } from '../engine/engine';
import type { Camera } from './camera';
import { TileInspector } from '../engine/inspect/inspector';
import type { TileInspection } from '../engine/inspect/types';
import { resolveThemeTokens } from './theme';
import type { ThemeTokens } from '../engine/types/theme';

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

    const cardW = 290;
    // Calculate card height based on contents
    let cardH = 110;
    if (data.entity) cardH += 85;
    if (data.traps && data.traps.length > 0) cardH += 22;
    if (data.items && data.items.length > 0) cardH += 24 + Math.min(data.items.length, 3) * 16;

    // Smart docking: opposite side of reticle
    const cardX = reticleScreenX > canvasW / 2 ? 14 : canvasW - cardW - 14;
    const cardY = 54;

    // Card shadow
    ctx.fillStyle = theme.modalBackdrop;
    ctx.fillRect(cardX + 3, cardY + 3, cardW, cardH);

    // Card Body
    ctx.fillStyle = theme.modalBg;
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // Border
    ctx.strokeStyle = theme.modalBorder;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cardX + 0.5, cardY + 0.5, cardW - 1, cardH - 1);

    // Title Bar
    ctx.fillStyle = theme.modalTitlebar;
    ctx.fillRect(cardX, cardY, cardW, 24);
    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX, cardY + 24.5);
    ctx.lineTo(cardX + cardW, cardY + 24.5);
    ctx.stroke();

    ctx.font = `bold 11px ${font}`;
    ctx.fillStyle = theme.modalTitlebarText;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LOOK / INSPECT [${data.x}, ${data.y}]`, cardX + 8, cardY + 12);

    const visLabel = data.visibility.toUpperCase();
    const visColor = data.visibility === 'visible' ? '#10b981' : theme.hudAccent;
    ctx.fillStyle = visColor;
    ctx.textAlign = 'right';
    ctx.fillText(`[${visLabel}]`, cardX + cardW - 8, cardY + 12);

    // Content Lines
    let curY = cardY + 38;
    ctx.textAlign = 'left';

    // 1. Terrain section
    if (data.terrain) {
      ctx.font = `bold 11px ${font}`;
      ctx.fillStyle = theme.hudText;
      ctx.fillText(`Terrain: ${data.terrain.name}`, cardX + 8, curY);

      const passBadge = data.terrain.passable ? '[Passable]' : '[Blocked]';
      const passColor = data.terrain.passable ? '#10b981' : '#ef4444';
      ctx.font = `10px ${font}`;
      ctx.fillStyle = passColor;
      ctx.fillText(passBadge, cardX + cardW - 74, curY);
      curY += 18;
    }

    // 2. Traps section
    if (data.traps && data.traps.length > 0) {
      for (const trap of data.traps) {
        ctx.font = `bold 10px ${font}`;
        ctx.fillStyle = '#f97316';
        ctx.fillText(`⚠️ Trap: ${trap.name}`, cardX + 8, curY);
        curY += 16;
      }
    }

    // 3. Entity section
    if (data.entity) {
      const ent = data.entity;
      ctx.strokeStyle = theme.cardBorder;
      ctx.beginPath();
      ctx.moveTo(cardX + 8, curY);
      ctx.lineTo(cardX + cardW - 8, curY);
      ctx.stroke();
      curY += 10;

      ctx.font = `bold 11px ${font}`;
      ctx.fillStyle = ent.type === 'player' ? theme.hudAccent : '#f87171';
      ctx.fillText(`Entity: ${ent.name}`, cardX + 8, curY);
      curY += 16;

      // HP bar & values
      ctx.font = `10px ${font}`;
      ctx.fillStyle = theme.textMuted;
      ctx.fillText(`HP: ${ent.hp}/${ent.maxHp}`, cardX + 8, curY);

      ctx.fillText(`Speed: ${ent.speedTier} (${ent.speed})`, cardX + 110, curY);
      curY += 16;

      // Status
      const statusStr = (ent.statusEffects && ent.statusEffects.length > 0) ? ent.statusEffects.join(', ') : 'None';
      ctx.fillStyle = theme.textMuted;
      ctx.fillText(`Afflictions: ${statusStr}`, cardX + 8, curY);
      curY += 16;

      // Declared Intent
      if (ent.intent) {
        let intentLabel = 'None';
        let intentColor = theme.textMuted;

        if (ent.intent.type === 'windup') {
          intentLabel = `⚠️ WIND-UP: ${ent.intent.abilityName ?? 'Strike'}`;
          intentColor = '#f59e0b';
        } else if (ent.intent.type === 'attack') {
          intentLabel = '⚔️ Engaging';
          intentColor = '#ef4444';
        } else if (ent.intent.type === 'fleeing') {
          intentLabel = '💨 Retreating';
          intentColor = '#a855f7';
        } else if (ent.intent.type === 'idle') {
          intentLabel = '💤 Resting / Idle';
          intentColor = theme.textMuted;
        }

        ctx.font = `bold 10px ${font}`;
        ctx.fillStyle = intentColor;
        ctx.fillText(`Intent: ${intentLabel}`, cardX + 8, curY);
        curY += 18;
      }
    }

    // 4. Ground Items section
    if (data.items && data.items.length > 0) {
      ctx.strokeStyle = theme.cardBorder;
      ctx.beginPath();
      ctx.moveTo(cardX + 8, curY);
      ctx.lineTo(cardX + cardW - 8, curY);
      ctx.stroke();
      curY += 10;

      ctx.font = `bold 10px ${font}`;
      ctx.fillStyle = theme.accent;
      ctx.fillText(`Ground Items (${data.items.length}):`, cardX + 8, curY);
      curY += 14;

      for (let i = 0; i < Math.min(data.items.length, 3); i++) {
        const it = data.items[i];
        ctx.font = `10px ${font}`;
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
        ctx.fillText(`• ${nameCut}`, cardX + 8, curY);

        ctx.fillStyle = theme.textMuted;
        ctx.textAlign = 'right';
        ctx.fillText(`${it.weight}g`, cardX + cardW - 8, curY);
        ctx.textAlign = 'left';
        curY += 14;
      }

      if (data.items.length > 3) {
        ctx.fillStyle = theme.textMuted;
        ctx.font = `italic 9px ${font}`;
        ctx.fillText(`(+${data.items.length - 3} more items...)`, cardX + 16, curY);
        curY += 12;
      }
    }

    // Card Footer Hint
    ctx.strokeStyle = theme.cardBorder;
    ctx.beginPath();
    ctx.moveTo(cardX + 8, cardY + cardH - 20);
    ctx.lineTo(cardX + cardW - 8, cardY + cardH - 20);
    ctx.stroke();

    ctx.font = `9px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.textAlign = 'center';
    ctx.fillText('[Arrows/Numpad] Move | [X / L / ESC] Exit', cardX + cardW / 2, cardY + cardH - 9);

    ctx.restore();
  }
}
