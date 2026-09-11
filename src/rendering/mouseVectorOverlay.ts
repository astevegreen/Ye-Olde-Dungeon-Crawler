import type { GameEngine, Action } from '../engine';
import { MovementAction, OpenDoorAction } from '../engine';
import type { Camera } from './camera';

export interface MouseVectorState {
  virtualX: number;
  virtualY: number;
  hoveredWorldX: number | null;
  hoveredWorldY: number | null;
  isAdjacent: boolean;
  dx: number;
  dy: number;
  hasMonster: boolean;
}

export class MouseVectorOverlay {
  private static readonly DIRECTIONS = Object.freeze([
    { dx: 0, dy: -1, symbol: '▲' },
    { dx: 1, dy: -1, symbol: '↗' },
    { dx: 1, dy: 0, symbol: '►' },
    { dx: 1, dy: 1, symbol: '↘' },
    { dx: 0, dy: 1, symbol: '▼' },
    { dx: -1, dy: 1, symbol: '↙' },
    { dx: -1, dy: 0, symbol: '◄' },
    { dx: -1, dy: -1, symbol: '↖' },
  ]);

  private hoverState: MouseVectorState = {
    virtualX: -1,
    virtualY: -1,
    hoveredWorldX: null,
    hoveredWorldY: null,
    isAdjacent: false,
    dx: 0,
    dy: 0,
    hasMonster: false,
  };

  public handleMouseMove(
    virtualX: number,
    virtualY: number,
    engine: GameEngine,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number
  ): void {
    this.hoverState.virtualX = virtualX;
    this.hoverState.virtualY = virtualY;

    if (!engine.player || !engine.player.isAlive()) {
      this.resetHover();
      return;
    }

    const world = camera.screenToWorld(virtualX, virtualY, cellSize, offsetX, offsetY);
    if (!world) {
      this.resetHover();
      return;
    }

    this.hoverState.hoveredWorldX = world.x;
    this.hoverState.hoveredWorldY = world.y;

    const p = engine.player;
    const dx = world.x - p.x;
    const dy = world.y - p.y;

    const isAdjacent = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0);
    this.hoverState.isAdjacent = isAdjacent;
    this.hoverState.dx = dx;
    this.hoverState.dy = dy;

    if (isAdjacent) {
      const entity = engine.map.getEntityAt(world.x, world.y);
      this.hoverState.hasMonster = !!entity && entity.type !== 'player' && entity.isAlive() && engine.fov.isVisible(world.x, world.y);
    } else {
      this.hoverState.hasMonster = false;
    }
  }

  public handleMouseLeave(): void {
    this.resetHover();
  }

  public handleClick(
    virtualX: number,
    virtualY: number,
    engine: GameEngine,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    enabled: boolean
  ): { handled: boolean; action?: Action; targetCoords?: { x: number; y: number } } {
    if (!enabled || !engine.player || !engine.player.isAlive()) {
      const world = camera.screenToWorld(virtualX, virtualY, cellSize, offsetX, offsetY);
      return { handled: false, targetCoords: world ? { x: world.x, y: world.y } : undefined };
    }

    const world = camera.screenToWorld(virtualX, virtualY, cellSize, offsetX, offsetY);
    if (!world) {
      return { handled: false };
    }

    const p = engine.player;
    const dx = world.x - p.x;
    const dy = world.y - p.y;
    const isAdjacent = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0);

    if (isAdjacent) {
      // If clicking an adjacent closed door, dispatch OpenDoorAction directly
      const targetTile = engine.map.getTile(world.x, world.y);
      if (targetTile && (targetTile.isClosedDoor || targetTile.type === 'door_closed')) {
        return { handled: true, action: new OpenDoorAction(p, world.x, world.y) };
      }
      // Execute immediate single-step MoveAction or melee attack
      const action = new MovementAction(p, dx, dy);
      return { handled: true, action };
    }

    return { handled: false, targetCoords: { x: world.x, y: world.y } };
  }

  public render(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    enabled: boolean
  ): void {
    if (!enabled || !engine.player || !engine.player.isAlive()) {
      return;
    }

    ctx.save();

    const p = engine.player;
    for (const dir of MouseVectorOverlay.DIRECTIONS) {
      const wx = p.x + dir.dx;
      const wy = p.y + dir.dy;

      // Ensure tile is in bounds and explored
      if (!engine.map.inBounds(wx, wy) || !engine.fov.isExplored(wx, wy)) {
        continue;
      }

      const screenPos = camera.worldToScreen(wx, wy, cellSize, offsetX, offsetY);
      if (!screenPos) {
        continue;
      }
      const screenX = screenPos.x;
      const screenY = screenPos.y;

      const isHovered =
        this.hoverState.isAdjacent &&
        this.hoverState.dx === dir.dx &&
        this.hoverState.dy === dir.dy;

      const entity = engine.map.getEntityAt(wx, wy);
      const isTargetMonster = isHovered && !!entity && entity.type !== 'player' && entity.isAlive() && engine.fov.isVisible(wx, wy);

      if (isHovered) {
        // Active Hover Ring Highlight on adjacent tile
        ctx.lineWidth = 2;
        if (isTargetMonster) {
          ctx.strokeStyle = '#ef4444';
          ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        } else {
          ctx.strokeStyle = '#38bdf8';
          ctx.fillStyle = 'rgba(56, 189, 248, 0.20)';
        }

        ctx.fillRect(screenX + 2, screenY + 2, cellSize - 4, cellSize - 4);
        ctx.strokeRect(screenX + 2.5, screenY + 2.5, cellSize - 5, cellSize - 5);

        // Directional Chevron
        ctx.font = 'bold 12px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isTargetMonster ? '#fca5a5' : '#bae6fd';
        ctx.fillText(isTargetMonster ? '⚔' : dir.symbol, screenX + cellSize / 2, screenY + cellSize / 2);
      } else {
        // Subtle ambient hover ring indicator (translucent corner pips)
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(147, 197, 253, 0.22)';
        ctx.strokeRect(screenX + 3.5, screenY + 3.5, cellSize - 7, cellSize - 7);

        ctx.font = '10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(147, 197, 253, 0.35)';
        ctx.fillText(dir.symbol, screenX + cellSize / 2, screenY + cellSize / 2);
      }
    }

    ctx.restore();
  }

  private resetHover(): void {
    this.hoverState.hoveredWorldX = null;
    this.hoverState.hoveredWorldY = null;
    this.hoverState.isAdjacent = false;
    this.hoverState.dx = 0;
    this.hoverState.dy = 0;
    this.hoverState.hasMonster = false;
  }
}
