import type { GameEngine } from '../engine';
import type { GameMap } from '../engine';
import { resolveThemeTokens } from './theme';
import type { ThemeTokens } from '../engine';

export interface ClickZone {
  x: number;
  y: number;
  width: number;
  height: number;
  action: () => void;
}

export class MapOverlay {
  public isOpen = false;
  public viewedFloor = 1;
  private clickZones: ClickZone[] = [];
  private onStateChanged?: () => void;
  private theme?: Required<ThemeTokens>;

  constructor(onStateChanged?: () => void) {
    this.onStateChanged = onStateChanged;
  }

  public open(engine: GameEngine): void {
    this.isOpen = true;
    this.viewedFloor = engine.currentFloor;
    this.notifyStateChanged();
  }

  public close(): void {
    this.isOpen = false;
    this.notifyStateChanged();
  }

  public toggle(engine: GameEngine): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(engine);
    }
  }

  public prevFloor(engine: GameEngine): void {
    const visited = engine.getVisitedFloors();
    const idx = visited.indexOf(this.viewedFloor);
    if (idx > 0) {
      this.viewedFloor = visited[idx - 1];
    } else if (this.viewedFloor > 0) {
      this.viewedFloor -= 1;
    }
    this.notifyStateChanged();
  }

  public nextFloor(engine: GameEngine): void {
    const visited = engine.getVisitedFloors();
    const idx = visited.indexOf(this.viewedFloor);
    if (idx >= 0 && idx < visited.length - 1) {
      this.viewedFloor = visited[idx + 1];
    } else {
      const maxVisited = Math.max(...visited);
      if (this.viewedFloor < maxVisited) {
        this.viewedFloor += 1;
      }
    }
    this.notifyStateChanged();
  }

  public handleKeyDown(e: KeyboardEvent, engine: GameEngine): boolean {
    if (!this.isOpen) return false;

    const code = e.code;
    const key = e.key;

    if (code === 'KeyM' || key === 'Escape' || code === 'Space') {
      this.close();
      return true;
    }

    if (key === 'PageUp' || key === '<' || key === ',' || key === 'ArrowUp') {
      this.prevFloor(engine);
      return true;
    }

    if (key === 'PageDown' || key === '>' || key === '.' || key === 'ArrowDown') {
      this.nextFloor(engine);
      return true;
    }

    // Absorb other keystrokes while map viewer is open
    return true;
  }

  public handleClick(clickX: number, clickY: number, _engine: GameEngine): boolean {
    if (!this.isOpen) return false;

    for (const zone of this.clickZones) {
      if (
        clickX >= zone.x &&
        clickX <= zone.x + zone.width &&
        clickY >= zone.y &&
        clickY <= zone.y + zone.height
      ) {
        zone.action();
        return true;
      }
    }
    return false;
  }

  private notifyStateChanged(): void {
    if (this.onStateChanged) {
      this.onStateChanged();
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    canvasW: number,
    canvasH: number
  ): void {
    if (!this.isOpen) return;

    this.theme = resolveThemeTokens(engine.manifest?.theme);
    const theme = this.theme;
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    this.clickZones = [];

    // 1. Semi-transparent backdrop
    ctx.fillStyle = theme.modalBackdrop;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 2. Modal Dimensions
    const modalW = Math.min(canvasW - 32, 780);
    const modalH = Math.min(canvasH - 36, 520);
    const modalX = Math.floor((canvasW - modalW) / 2);
    const modalY = Math.floor((canvasH - modalH) / 2);

    // Modal Background
    ctx.fillStyle = theme.modalBg;
    ctx.fillRect(modalX, modalY, modalW, modalH);

    // Border
    ctx.strokeStyle = theme.modalBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(modalX + 0.5, modalY + 0.5, modalW - 1, modalH - 1);

    // 3. Titlebar
    ctx.fillStyle = theme.modalTitlebar;
    ctx.fillRect(modalX, modalY, modalW, 30);
    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(modalX, modalY + 30.5);
    ctx.lineTo(modalX + modalW, modalY + 30.5);
    ctx.stroke();

    ctx.font = `bold 12px ${font}`;
    ctx.fillStyle = theme.modalTitlebarText;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🗺️ EXPLORED DUNGEON MAP VIEWER', modalX + 10, modalY + 15);

    // Current viewed floor header badge
    const viewedFloorName = this.viewedFloor === 0 ? 'Town (Floor 0)' : `Floor ${this.viewedFloor}`;
    const activeFloorName = engine.currentFloor === 0 ? 'Town' : `Floor ${engine.currentFloor}`;
    const badgeText = `Viewing: ${viewedFloorName} (Current: ${activeFloorName})`;

    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, modalX + Math.floor(modalW / 2), modalY + 15);

    // Close button [X]
    const closeBtnX = modalX + modalW - 26;
    const closeBtnY = modalY + 5;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(closeBtnX, closeBtnY, 20, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 12px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText('X', closeBtnX + 10, closeBtnY + 10);

    this.clickZones.push({
      x: closeBtnX,
      y: closeBtnY,
      width: 20,
      height: 20,
      action: () => this.close(),
    });

    // 4. Floor Navigation Bar
    const navY = modalY + 36;
    const visitedFloors = engine.getVisitedFloors();
    const canGoUp = visitedFloors.indexOf(this.viewedFloor) > 0 || this.viewedFloor > 0;
    const canGoDown =
      visitedFloors.indexOf(this.viewedFloor) < visitedFloors.length - 1 ||
      this.viewedFloor < Math.max(...visitedFloors);

    // Button [▲ Up Floor]
    const upBtnW = 120;
    const upBtnH = 22;
    const upBtnX = modalX + 14;
    ctx.fillStyle = canGoUp ? theme.cardBg : theme.modalBg;
    ctx.fillRect(upBtnX, navY, upBtnW, upBtnH);
    ctx.strokeStyle = canGoUp ? theme.accent : theme.cardBorder;
    ctx.strokeRect(upBtnX + 0.5, navY + 0.5, upBtnW - 1, upBtnH - 1);
    ctx.font = `bold 11px ${font}`;
    ctx.fillStyle = canGoUp ? theme.hudAccent : theme.textMuted;
    ctx.textAlign = 'center';
    ctx.fillText('[▲ Up Floor (<)]', upBtnX + upBtnW / 2, navY + 11);

    if (canGoUp) {
      this.clickZones.push({
        x: upBtnX,
        y: navY,
        width: upBtnW,
        height: upBtnH,
        action: () => this.prevFloor(engine),
      });
    }

    // Visited floors list chips
    ctx.font = `bold 10px ${font}`;
    ctx.fillStyle = theme.textMuted;
    ctx.textAlign = 'center';
    const chipsText = `Visited Floors: [${visitedFloors.map((f) => (f === this.viewedFloor ? `*${f}*` : `${f}`)).join(', ')}]`;
    ctx.fillText(chipsText, modalX + Math.floor(modalW / 2), navY + 11);

    // Button [▼ Down Floor]
    const downBtnW = 130;
    const downBtnH = 22;
    const downBtnX = modalX + modalW - downBtnW - 14;
    ctx.fillStyle = canGoDown ? theme.cardBg : theme.modalBg;
    ctx.fillRect(downBtnX, navY, downBtnW, downBtnH);
    ctx.strokeStyle = canGoDown ? theme.accent : theme.cardBorder;
    ctx.strokeRect(downBtnX + 0.5, navY + 0.5, downBtnW - 1, downBtnH - 1);
    ctx.fillStyle = canGoDown ? theme.hudAccent : theme.textMuted;
    ctx.fillText('[▼ Down Floor (>)]', downBtnX + downBtnW / 2, navY + 11);

    if (canGoDown) {
      this.clickZones.push({
        x: downBtnX,
        y: navY,
        width: downBtnW,
        height: downBtnH,
        action: () => this.nextFloor(engine),
      });
    }

    // 5. Explored Map Tile Viewport
    const targetMap: GameMap | undefined = engine.getFloorMap(this.viewedFloor);
    const targetFov = engine.getFloorFov(this.viewedFloor);

    const mapAreaX = modalX + 14;
    const mapAreaY = navY + 28;
    const mapAreaW = modalW - 28;
    const mapAreaH = modalH - 100;

    // Map canvas viewport backdrop
    ctx.fillStyle = theme.canvasBg;
    ctx.fillRect(mapAreaX, mapAreaY, mapAreaW, mapAreaH);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(mapAreaX + 0.5, mapAreaY + 0.5, mapAreaW - 1, mapAreaH - 1);

    if (!targetMap) {
      ctx.font = `12px ${font}`;
      ctx.fillStyle = theme.textMuted;
      ctx.textAlign = 'center';
      ctx.fillText('This floor has not been visited yet.', mapAreaX + mapAreaW / 2, mapAreaY + mapAreaH / 2);
    } else {
      const tileSize = Math.max(
        4,
        Math.min(
          18,
          Math.min(
            Math.floor((mapAreaW - 16) / targetMap.width),
            Math.floor((mapAreaH - 16) / targetMap.height)
          )
        )
      );

      const gridPixelW = targetMap.width * tileSize;
      const gridPixelH = targetMap.height * tileSize;
      const gridX = mapAreaX + Math.floor((mapAreaW - gridPixelW) / 2);
      const gridY = mapAreaY + Math.floor((mapAreaH - gridPixelH) / 2);

      // Canvas background base
      ctx.fillStyle = theme.canvasBg;
      ctx.fillRect(gridX, gridY, gridPixelW, gridPixelH);

      // Render explored tiles
      for (let ty = 0; ty < targetMap.height; ty++) {
        for (let tx = 0; tx < targetMap.width; tx++) {
          const isExplored = targetFov ? targetFov.isExplored(tx, ty) : false;
          if (!isExplored) continue;

          const tile = targetMap.getTile(tx, ty);
          if (!tile) continue;

          let color = '#1e293b';
          if (tile.type === 'wall') {
            color = '#475569';
          } else if (tile.type === 'floor') {
            color = '#172033';
          } else if (tile.type === 'door_closed') {
            color = '#b45309';
          } else if (tile.type === 'door_open') {
            color = '#78350f';
          } else if (tile.type === 'stairs_up') {
            color = '#facc15';
          } else if (tile.type === 'stairs_down') {
            color = '#38bdf8';
          }

          const trap = targetMap.getTrapAt(tx, ty);
          if (trap && trap.revealed) {
            color = '#ef4444';
          }

          ctx.fillStyle = color;
          ctx.fillRect(gridX + tx * tileSize, gridY + ty * tileSize, tileSize, tileSize);
        }
      }

      // Player current position indicator (if viewing active floor)
      if (this.viewedFloor === engine.currentFloor) {
        const px = gridX + engine.player.x * tileSize + tileSize / 2;
        const py = gridY + engine.player.y * tileSize + tileSize / 2;
        const radius = Math.max(3, tileSize * 0.75);

        ctx.fillStyle = theme.accent;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.font = `bold ${Math.max(8, tileSize - 2)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('@', px, py + 0.5);
      }
    }

    // 6. Legend & Navigation Instructions Footer
    const footerY = modalY + modalH - 24;
    ctx.font = `10px ${font}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = theme.textMuted;
    ctx.fillText('LEGEND: [■ Wall]  [· Floor]  [▲ Stairs Up]  [▼ Stairs Down]  [🚪 Door]  [@ You]', modalX + 14, footerY + 8);

    ctx.textAlign = 'right';
    ctx.fillStyle = theme.hudAccent;
    ctx.fillText('[< / >] Cycle Floor | [M / Esc / Space] Close', modalX + modalW - 14, footerY + 8);
  }
}
