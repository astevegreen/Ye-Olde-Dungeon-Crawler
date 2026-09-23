import type { GameEngine } from '../engine';
import { resolveThemeTokens } from './theme';

export interface HUDConfig {
  maxLines?: number;
  lineHeight?: number;
}

export class HUDMessageLogRenderer {
  private maxLines: number;
  private lineHeight: number;

  constructor(config: HUDConfig = {}) {
    this.maxLines = config.maxLines ?? 5;
    this.lineHeight = config.lineHeight ?? 13;
  }

  /**
   * Renders the multi-line HUD message feed inside the bottom bar area.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const rawMessages = engine.messages;
    const count = Math.min(rawMessages.length, this.maxLines);
    const messages = rawMessages.slice(-count);

    if (messages.length === 0) {
      messages.push('Explore the dungeon.');
    }

    const theme = resolveThemeTokens(engine?.manifest?.theme);
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    ctx.save();

    // 1. Semi-transparent dark backdrop
    ctx.fillStyle = theme.modalBackdrop;
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = theme.hudBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

    // Subtle left border accent
    ctx.fillStyle = theme.accent;
    ctx.fillRect(x, y, 3, height);

    // 2. High-contrast typography with turn recency fade gradient
    ctx.font = `bold 11px ${font}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const textX = x + 8;
    const startY = y + Math.max(3, Math.floor((height - messages.length * this.lineHeight) / 2));

    const total = messages.length;
    for (let i = 0; i < total; i++) {
      const msg = messages[i];
      const isNewest = i === total - 1;
      const isSecondNewest = i === total - 2;

      // Color and alpha based on recency
      if (isNewest) {
        ctx.fillStyle = theme.hudText; // Brightest for current action
      } else if (isSecondNewest) {
        ctx.fillStyle = theme.hudText; // Clean slate
      } else if (i === total - 3) {
        ctx.fillStyle = theme.textMuted; // Muted slate
      } else {
        ctx.fillStyle = theme.borderDark; // Faded older history
      }

      // Check if message is a highlight / warning / level up
      if (msg.includes('***') || msg.includes('slain') || msg.includes('FALLEN')) {
        ctx.fillStyle = isNewest ? '#fde047' : '#eab308'; // Amber gold for kills/events
      } else if (msg.includes('damage') && !msg.includes('strikes')) {
        ctx.fillStyle = isNewest ? '#f87171' : '#ef4444'; // Red for hurt
      }

      // Render line text
      ctx.fillText(msg, textX, startY + i * this.lineHeight);
    }

    ctx.restore();
  }
}
