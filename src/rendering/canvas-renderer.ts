import { GameEngine } from '../engine';
import { Visibility } from '../engine';
import { Camera } from './camera';
import type { Entity } from '../engine';
import type { TileDefinition } from '../engine';
import type { Item } from '../engine';
import { Container } from '../engine';
import { InventoryOverlay } from './inventory-overlay';
import { TargetingOverlay } from './targeting-overlay';
import { ShopDialog } from '../ui/shop/shopDialog';
import { InspectOverlay } from './inspect-overlay';
import { MapOverlay } from './map-overlay';
import { IntentOverlay } from './intentOverlay';
import { Monster } from '../engine';
import { SpriteAtlas } from './atlas/sprite-atlas';
import { getTerrainSpriteKey, getEntitySpriteKey, getItemSpriteKey } from './atlas/sprite-mapper';
import { terrainLayers, contactShadowSides, zoneForFloor, type TerrainView } from './atlas/terrain-layers';
import { ViewportManager } from './viewport';
import { resolveThemeTokens, type ThemeTokens, uiFont } from './theme';
import { CanvasFXRunner } from './fxRunner';
import type { NavigationController } from '../ui/navigation';
import { CloseDoorAction } from '../engine';
import { MouseVectorOverlay } from './mouseVectorOverlay';
import { RadialMenuOverlay } from './radialMenu';
import { FloatingTextRunner } from './floatingTextRunner';
import { TacticalTargetOverlay } from './tacticalTargetOverlay';
import type { RadialMenuSlotConfig } from '../ui/settings/settingsManager';
import { getAudibleEntitiesInRadius, getAudibleTilesInRadius, ECHOLOCATION_HEARING_RADIUS } from '../engine';

function defaultRadialLabel(slot: RadialMenuSlotConfig): string {
  switch (slot.type) {
    case 'spell': return slot.spellId;
    case 'command': return slot.commandId;
    case 'item': return slot.itemId;
  }
}

/** Optional pack art for a multi-item tile; without it the renderer draws a generic heap. */
const LOOT_PILE_SPRITE_KEY = 'loot_pile';

export interface ModeHint {
  text: string;
  /** `aim` is the one mode where a key press spends a turn, so it reads louder. */
  tone: 'mode' | 'aim';
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: GameEngine;
  private camera: Camera;
  public readonly atlas: SpriteAtlas;
  public readonly viewport: ViewportManager;
  public readonly fxRunner: CanvasFXRunner;
  public readonly inventoryOverlay: InventoryOverlay;
  public readonly targetingOverlay: TargetingOverlay;
  public readonly shopOverlay: ShopDialog;
  public readonly inspectOverlay: InspectOverlay;
  public readonly mapOverlay: MapOverlay;
  public readonly intentOverlay: IntentOverlay;
  public readonly mouseVectorOverlay: MouseVectorOverlay;
  public readonly radialMenuOverlay: RadialMenuOverlay;
  public readonly floatingTextRunner: FloatingTextRunner;
  public readonly tacticalTargetOverlay: TacticalTargetOverlay;
  /** Resolves a display label for a radial-menu slot; wired from main.ts (spell/command/item lookups live there). */
  public onResolveRadialLabel?: (slot: RadialMenuSlotConfig) => string;
  public mouseVectoringEnabled = true;
  /** Player setting: the pack's torchlight pass (`atlas.terrain.torch`). */
  public torchlightEnabled = true;
  public navigationController?: NavigationController;
  private cellSize = 32;
  private topBarHeight = 0;
  private lastFocusEntityId: string | null = null;
  /**
   * Fires when the monster under the mouse (or under the look reticle) changes, so
   * the sidebar can highlight its row. Null when no monster is focused.
   */
  public onFocusEntityChanged?: (entityId: string | null) => void;
  private offsetX = 0;
  private offsetY = 0;
  private boundClickHandler?: (e: MouseEvent) => void;
  private boundDoubleClickHandler?: (e: MouseEvent) => void;
  private boundMouseMoveHandler?: (e: MouseEvent) => void;
  private boundMouseDownHandler?: (e: MouseEvent) => void;
  private boundMouseUpHandler?: (e: MouseEvent) => void;
  private boundContextMenuHandler?: (e: MouseEvent) => void;
  private boundMouseLeaveHandler?: () => void;
  private boundWheelHandler?: (e: WheelEvent) => void;
  private static readonly DASH_PATTERN = Object.freeze([4, 2]);
  private cachedChasmGradVisible?: CanvasGradient;
  private cachedChasmGradDim?: CanvasGradient;
  private cachedChasmCs = 0;
  private contactShadowCells?: { n: HTMLCanvasElement; w: HTMLCanvasElement; e: HTMLCanvasElement };
  private readonly terrainView: TerrainView = (() => {
    const map = () => this.engine.map;
    return {
      get width() {
        return map().width;
      },
      get height() {
        return map().height;
      },
      typeAt: (x: number, y: number) => (map().inBounds(x, y) ? map().getTile(x, y)?.type : undefined),
    };
  })();
  public onPactModalRequested?: () => void;
  /** A double-click on a container on or beside the hero's tile: open it in the inventory. */
  public onOpenContainer?: (container: Container) => void;

  public get canvasElement(): HTMLCanvasElement {
    return this.canvas;
  }

  public get theme(): Required<ThemeTokens> {
    return resolveThemeTokens(this.engine?.manifest?.theme);
  }

  constructor(canvas: HTMLCanvasElement, engine: GameEngine) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to obtain 2D rendering context');
    }
    this.ctx = ctx;
    this.engine = engine;
    this.camera = new Camera(26, 18);
    this.atlas = new SpriteAtlas(this.engine.manifest?.spriteRecipes, { memory: this.engine.manifest?.atlas?.terrain?.memory });
    this.viewport = new ViewportManager(this.canvas, this.ctx, {
      virtualWidth: 960,
      virtualHeight: 600,
    });
    this.fxRunner = new CanvasFXRunner({ onFrame: () => this.render() });
    this.inventoryOverlay = new InventoryOverlay(() => this.render(), this.atlas);
    this.targetingOverlay = new TargetingOverlay(() => this.render());
    this.shopOverlay = new ShopDialog({
      drawItemIcon: (canvas, item) => this.drawItemIcon(canvas, item),
      drawEntityIcon: (canvas, entity) => this.drawEntityIcon(canvas, entity),
      onStateChanged: () => this.render(),
    });
    this.inspectOverlay = new InspectOverlay(() => this.render());
    this.mapOverlay = new MapOverlay(() => this.render());
    this.intentOverlay = new IntentOverlay();
    this.mouseVectorOverlay = new MouseVectorOverlay();
    this.radialMenuOverlay = new RadialMenuOverlay();
    this.floatingTextRunner = new FloatingTextRunner({ onFrame: () => this.render() });
    this.tacticalTargetOverlay = new TacticalTargetOverlay();
    this.hookEngineEvents();

    // Register click event on canvas using ViewportManager coordinate transform
    this.boundClickHandler = (e: MouseEvent) => {
      const { x: clickX, y: clickY } = this.viewport.clientToVirtual(e.clientX, e.clientY);

      if (this.mapOverlay.isOpen) {
        this.mapOverlay.handleClick(clickX, clickY, this.engine);
        return;
      }

      if (this.inventoryOverlay.isOpen) {
        this.inventoryOverlay.handleClick(clickX, clickY, e.shiftKey || e.ctrlKey || e.metaKey);
        return;
      }



      // Direct Canvas Mouse Vectoring or Click-to-Move Pathfinding on dungeon floor
      if (
        clickY >= this.topBarHeight &&
        clickY < this.viewport.virtualHeight &&
        !this.inspectOverlay.isOpen &&
        !this.targetingOverlay.isOpen
      ) {
        const worldCoords = this.camera.screenToWorld(
          clickX,
          clickY,
          this.cellSize,
          this.offsetX,
          this.offsetY
        );
        if (worldCoords) {
          const p = this.engine.player;
          const isAdjacent =
            Math.abs(worldCoords.x - p.x) <= 1 &&
            Math.abs(worldCoords.y - p.y) <= 1 &&
            (worldCoords.x !== p.x || worldCoords.y !== p.y);

          // If adjacent open door, smart-close it
          if (isAdjacent) {
            const clickedTile = this.engine.map.getTile(worldCoords.x, worldCoords.y);
            if (clickedTile && (clickedTile.isOpenDoor || clickedTile.type === 'door_open')) {
              this.engine.handlePlayerAction(new CloseDoorAction(p, worldCoords.x, worldCoords.y));
              this.render();
              return;
            }
          }

          // Direct Canvas Mouse Vectoring: immediate single step or melee strike
          const vectorResult = this.mouseVectorOverlay.handleClick(
            clickX,
            clickY,
            this.engine,
            this.camera,
            this.cellSize,
            this.offsetX,
            this.offsetY,
            this.mouseVectoringEnabled
          );
          if (vectorResult.handled && vectorResult.action) {
            this.engine.handlePlayerAction(vectorResult.action);
            this.render();
            return;
          }

          // Distant Click Navigation: automated pathfinding
          if (this.navigationController) {
            this.navigationController.navigatePlayerTo(worldCoords.x, worldCoords.y, {
              onStep: () => this.render(),
              onComplete: () => this.render(),
              onCancel: () => this.render(),
            });
            return;
          }
        }
      }
    };
    this.canvas.addEventListener('click', this.boundClickHandler);

    // Register mousemove event on canvas for tooltips and hover ring
    this.boundMouseMoveHandler = (e: MouseEvent) => {
      const { x: mouseX, y: mouseY } = this.viewport.clientToVirtual(e.clientX, e.clientY);

      if (this.inventoryOverlay.isOpen) {
        this.inventoryOverlay.handleMouseMove(mouseX, mouseY);
        this.render();
      }

      const worldCoords = this.camera.screenToWorld(
        mouseX,
        mouseY,
        this.cellSize,
        this.offsetX,
        this.offsetY
      );

      if (
        !this.inventoryOverlay.isOpen &&
        !this.shopOverlay.isOpen &&
        !this.inspectOverlay.isOpen &&
        !this.targetingOverlay.isOpen &&
        !this.mapOverlay.isOpen &&
        mouseY >= this.topBarHeight &&
        mouseY < this.viewport.virtualHeight &&
        worldCoords
      ) {
        this.tacticalTargetOverlay.setHoveredTile(worldCoords.x, worldCoords.y);
      } else {
        this.tacticalTargetOverlay.clearHover();
      }

      if (
        this.mouseVectoringEnabled &&
        !this.inventoryOverlay.isOpen &&
        !this.shopOverlay.isOpen &&
        !this.inspectOverlay.isOpen &&
        !this.targetingOverlay.isOpen &&
        mouseY >= this.topBarHeight &&
        mouseY < this.viewport.virtualHeight
      ) {
        this.mouseVectorOverlay.handleMouseMove(
          mouseX,
          mouseY,
          this.engine,
          this.camera,
          this.cellSize,
          this.offsetX,
          this.offsetY
        );
        this.render();
      } else {
        this.mouseVectorOverlay.handleMouseLeave();
      }
    };
    this.canvas.addEventListener('mousemove', this.boundMouseMoveHandler);

    this.boundMouseLeaveHandler = () => {
      this.mouseVectorOverlay.handleMouseLeave();
      this.tacticalTargetOverlay.clearHover();
      this.render();
    };
    this.canvas.addEventListener('mouseleave', this.boundMouseLeaveHandler);

    this.boundMouseDownHandler = (e: MouseEvent) => {
      if (this.inventoryOverlay.isOpen && e.button === 0) {
        const { x, y } = this.viewport.clientToVirtual(e.clientX, e.clientY);
        this.inventoryOverlay.handleMouseDown(x, y);
      }
    };
    this.canvas.addEventListener('mousedown', this.boundMouseDownHandler);

    this.boundMouseUpHandler = (e: MouseEvent) => {
      if (this.inventoryOverlay.isOpen && e.button === 0) {
        const { x, y } = this.viewport.clientToVirtual(e.clientX, e.clientY);
        if (this.inventoryOverlay.handleMouseUp(x, y)) {
          this.render();
        }
      }
    };
    this.canvas.addEventListener('mouseup', this.boundMouseUpHandler);

    this.boundContextMenuHandler = (e: MouseEvent) => {
      if (this.inventoryOverlay.isOpen) {
        e.preventDefault();
        const { x: clickX, y: clickY } = this.viewport.clientToVirtual(e.clientX, e.clientY);
        if (this.inventoryOverlay.handleRightClick(clickX, clickY, this.engine)) {
          this.render();
        }
      }
    };
    this.canvas.addEventListener('contextmenu', this.boundContextMenuHandler);

    this.boundWheelHandler = (e: WheelEvent) => {
      if (this.inventoryOverlay.isOpen) {
        const { x, y } = this.viewport.clientToVirtual(e.clientX, e.clientY);
        if (this.inventoryOverlay.handleWheel(x, y, e.deltaY)) {
          e.preventDefault();
          this.render();
        }
      }
    };
    this.canvas.addEventListener('wheel', this.boundWheelHandler, { passive: false });

    this.boundDoubleClickHandler = (e: MouseEvent) => {
      const { x: clickX, y: clickY } = this.viewport.clientToVirtual(e.clientX, e.clientY);

      if (this.inventoryOverlay.isOpen) {
        if (this.inventoryOverlay.handleDoubleClick(clickX, clickY, this.engine)) {
          this.render();
          return;
        }
      }

      // Universal double-click on canvas floor: ground loot pick-up
      if (
        clickY >= this.topBarHeight &&
        clickY < this.viewport.virtualHeight &&
        !this.inspectOverlay.isOpen &&
        !this.targetingOverlay.isOpen
      ) {
        const worldCoords = this.camera.screenToWorld(
          clickX,
          clickY,
          this.cellSize,
          this.offsetX,
          this.offsetY
        );
        if (worldCoords) {
          const p = this.engine.player;
          const isCurrent = worldCoords.x === p.x && worldCoords.y === p.y;
          const isAdjacent = Math.abs(worldCoords.x - p.x) <= 1 && Math.abs(worldCoords.y - p.y) <= 1;

          // Double-clicking an adjacent or current tile with a container opens it directly
          if (isAdjacent || isCurrent) {
            const tileItems = this.engine.map.getItemsAt(worldCoords.x, worldCoords.y);
            const container = tileItems.find((it) => it instanceof Container) as Container | undefined;
            if (container && this.onOpenContainer) {
              this.onOpenContainer(container);
              this.render();
              return;
            }
          }

          if (isCurrent) {
            const groundItems = this.engine.map.getItemsAt(p.x, p.y);
            if (groundItems.length > 0) {
              const itemToPick = groundItems[groundItems.length - 1];
              const res = this.engine.commandBus.dispatch({ type: 'pickup_item', payload: { itemId: itemToPick.id } });
              if (res.success) {
                this.render();
                return;
              }
            }
          }
        }
      }
    };
    this.canvas.addEventListener('dblclick', this.boundDoubleClickHandler);

    this.viewport.attachResizeListener(() => this.resize());
    this.resize();
  }

  private hookEngineEvents(): void {
    this.engine.onNpcInteract = (npc) => {
      const merchant = npc.shopId ? this.engine.merchants.get(npc.shopId) : undefined;
      this.shopOverlay.open(npc, merchant, this.engine);
      this.render();
    };
    this.engine.onFloorChanged = () => {
      this.render();
    };
  }

  public setEngine(engine: GameEngine): void {
    this.engine = engine;
    this.hookEngineEvents();
    this.render();
  }

  public destroy(): void {
    if (this.canvas && this.boundClickHandler) {
      this.canvas.removeEventListener('click', this.boundClickHandler);
    }
    if (this.canvas && this.boundDoubleClickHandler) {
      this.canvas.removeEventListener('dblclick', this.boundDoubleClickHandler);
    }
    if (this.canvas && this.boundMouseMoveHandler) {
      this.canvas.removeEventListener('mousemove', this.boundMouseMoveHandler);
    }
    if (this.canvas && this.boundMouseDownHandler) {
      this.canvas.removeEventListener('mousedown', this.boundMouseDownHandler);
    }
    if (this.canvas && this.boundMouseUpHandler) {
      this.canvas.removeEventListener('mouseup', this.boundMouseUpHandler);
    }
    if (this.canvas && this.boundMouseLeaveHandler) {
      this.canvas.removeEventListener('mouseleave', this.boundMouseLeaveHandler);
    }
    if (this.canvas && this.boundContextMenuHandler) {
      this.canvas.removeEventListener('contextmenu', this.boundContextMenuHandler);
    }
    if (this.canvas && this.boundWheelHandler) {
      this.canvas.removeEventListener('wheel', this.boundWheelHandler);
    }
    this.viewport.destroy();
    if (this.engine) {
      this.engine.onNpcInteract = undefined;
      this.engine.onFloorChanged = undefined;
    }
    this.inventoryOverlay.close();
    this.targetingOverlay.close();
    this.shopOverlay.close();
    this.inspectOverlay.close();
    this.mapOverlay.close();
    this.fxRunner.destroy();
    this.floatingTextRunner.destroy();
  }

  public cleanup(): void {
    this.destroy();
  }

  public resize(): void {
    this.viewport.recalculate();

    const availW = this.viewport.virtualWidth;
    const availH = this.viewport.virtualHeight - this.topBarHeight;

    // Fixed tile grid inside 960x600 virtual resolution
    const targetCols = Math.min(this.engine.map.width, 30);
    const targetRows = Math.min(this.engine.map.height, 18);

    this.camera.viewWidthTiles = targetCols;
    this.camera.viewHeightTiles = targetRows;
    this.cellSize = 32;

    const boardWidth = targetCols * this.cellSize;
    const boardHeight = targetRows * this.cellSize;

    this.offsetX = Math.floor((availW - boardWidth) / 2);
    this.offsetY = this.topBarHeight + Math.floor((availH - boardHeight) / 2);

    this.render();
  }

  public render(): void {
    // Re-apply viewport context transform so High-DPI scaling is active
    this.viewport.applyContextTransform();

    // 1. Update camera tracking on player
    if (this.engine.player && typeof this.engine.player.x === 'number' && typeof this.engine.player.y === 'number') {
      this.camera.update(
        { x: this.engine.player.x, y: this.engine.player.y },
        this.engine.map.width,
        this.engine.map.height
      );
    }

    const ctx = this.ctx;
    const virtualW = this.viewport.virtualWidth;
    const virtualH = this.viewport.virtualHeight;
    const theme = this.theme;

    // Background
    ctx.fillStyle = theme.canvasBg;
    ctx.fillRect(0, 0, virtualW, virtualH);

    // Sensory Masking & Echolocation (docs/architecture/simulation-and-input.md): while active, replace the
    // normal FOV-based tile/entity pass with an audible-only view instead of drawing
    // what the (heavily reduced) visual FOV alone would show.
    const isSensoryMasked = this.engine.player.statusManager.hasStatus('sensory_masked');

    if (isSensoryMasked) {
      this.renderEcholocationView();
    } else {
      // Tiles & Fog of War
      this.renderTiles();

      // Emergent Surfaces (water, oil, acid, ice) & Atmospheric Gasses
      this.intentOverlay.renderSurfaces(
        ctx,
        this.engine,
        this.camera,
        this.cellSize,
        this.offsetX,
        this.offsetY
      );

      // Ground Items in line of sight
      this.renderGroundItems();
    }

    // Enemy Intent Telegraph Reticles & Danger Zones
    this.intentOverlay.render(
      ctx,
      this.engine,
      this.camera,
      this.cellSize,
      this.offsetX,
      this.offsetY
    );

    // A* Pathfinding Click-to-Move Breadcrumb Trail
    this.renderNavigationPath();

    // Entities in line of sight
    if (!isSensoryMasked) {
      this.renderEntities();
    }

    // Direct Canvas Mouse Vectoring & 8-Way Hover Ring
    this.mouseVectorOverlay.render(
      ctx,
      this.engine,
      this.camera,
      this.cellSize,
      this.offsetX,
      this.offsetY,
      this.mouseVectoringEnabled
    );

    // Active Visual Spell Animations & Effects
    this.fxRunner.render(
      ctx,
      this.camera,
      this.cellSize,
      this.offsetX,
      this.offsetY,
      this.atlas
    );

    // Active Floating Combat Numbers & Status Splashes
    this.floatingTextRunner.render(
      ctx,
      this.camera,
      this.cellSize,
      this.offsetX,
      this.offsetY,
      theme
    );

    // Live On-Grid Tactical Target Card & Ground Item Tooltip (Zero-Click Inspect)
    if (
      !this.inspectOverlay.isOpen &&
      !this.inventoryOverlay.isOpen &&
      !this.targetingOverlay.isOpen &&
      !this.shopOverlay.isOpen &&
      !this.mapOverlay.isOpen
    ) {
      this.tacticalTargetOverlay.render(
        ctx,
        this.engine,
        this.camera,
        this.cellSize,
        this.offsetX,
        this.offsetY,
        virtualW,
        virtualH,
        theme
      );
    }

    // Inventory / Paperdoll Overlay (if open)
    this.inventoryOverlay.render(ctx, this.engine, virtualW, virtualH);

    // Targeting / Spellbook Overlay
    this.targetingOverlay.render(
      ctx,
      virtualW,
      virtualH,
      this.engine,
      this.camera,
      this.cellSize,
      this.offsetX,
      this.offsetY
    );

    // Look / Inspect Reticle & HUD Card Overlay
    this.inspectOverlay.render(
      ctx,
      virtualW,
      virtualH,
      this.engine,
      this.camera,
      this.cellSize,
      this.offsetX,
      this.offsetY
    );

    // Explored Dungeon Map Overlay
    this.mapOverlay.render(ctx, this.engine, virtualW, virtualH);

    // Configurable Radial Action Menu
    this.radialMenuOverlay.render(
      ctx,
      this.engine,
      virtualW,
      virtualH,
      this.onResolveRadialLabel ?? defaultRadialLabel,
      (c, x, y, size) => {
        const player = this.engine.player;
        const spriteKey = player ? getEntitySpriteKey(player, this.atlas.hasSprite.bind(this.atlas)) : 'player';
        this.atlas.drawSprite(c, spriteKey, x - size / 2, y - size / 2, size, Visibility.Visible);
      }
    );

    this.renderModeHintPill(virtualW, virtualH);
    this.notifyFocusEntity();
  }

  private renderTiles(): void {
    const cs = this.cellSize;
    const startX = this.camera.startX;
    const startY = this.camera.startY;
    const cols = this.camera.viewWidthTiles;
    const rows = this.camera.viewHeightTiles;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const worldX = startX + c;
        const worldY = startY + r;

        if (!this.engine.map.inBounds(worldX, worldY)) {
          continue;
        }

        const screenX = this.offsetX + c * cs;
        const screenY = this.offsetY + r * cs;
        const visibility = this.engine.fov.getVisibility(worldX, worldY);
        const tile = this.engine.map.getTile(worldX, worldY);

        if (!tile) continue;

        this.drawTileWithFov(screenX, screenY, cs, tile, visibility, worldX, worldY);
      }
    }

    this.renderContactShadows(startX, startY, cols, rows);
    this.renderTorchlight(startX, startY, cols, rows);


    // Threatened Target Tiles Hazard Highlight (Telegraphed Wind-Up)
    for (const entity of this.engine.map.getAllEntities()) {
      if (
        entity instanceof Monster &&
        entity.isAlive() &&
        entity.intent?.type === 'windup' &&
        entity.intent.targetTile &&
        typeof entity.intent.targetTile.x === 'number' &&
        typeof entity.intent.targetTile.y === 'number'
      ) {
        const tt = entity.intent.targetTile;
        if (this.engine.fov.isVisible(tt.x, tt.y)) {
          const screenPos = this.camera.worldToScreen(tt.x, tt.y, cs, this.offsetX, this.offsetY);
          if (screenPos) {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
            this.ctx.fillRect(screenPos.x, screenPos.y, cs, cs);
            this.ctx.strokeStyle = '#ef4444';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash(CanvasRenderer.DASH_PATTERN as unknown as number[]);
            this.ctx.strokeRect(screenPos.x + 1, screenPos.y + 1, cs - 2, cs - 2);
            this.ctx.restore();
          }
        }
      }
    }
  }

  private drawTileWithFov(
    px: number,
    py: number,
    cs: number,
    tile: TileDefinition,
    visibility: Visibility,
    worldX?: number,
    worldY?: number
  ): void {
    // State 1: Unexplored (pitch black)
    if (visibility === Visibility.Unexplored) {
      this.ctx.fillStyle = this.theme.canvasBg;
      this.ctx.fillRect(px, py, cs, cs);
      return;
    }

    const currentFloor = this.engine.currentFloor;
    const tileZoneBands = this.engine.manifest?.atlas?.tileZoneBands;

    let buildingType: string | undefined;
    if (currentFloor === 0 && worldX !== undefined && worldY !== undefined) {
      const buildings = this.engine.manifest?.town?.buildings;
      if (buildings) {
        for (let i = 0; i < buildings.length; i++) {
          const b = buildings[i];
          if (worldX >= b.bounds.x1 && worldX <= b.bounds.x2 && worldY >= b.bounds.y1 && worldY <= b.bounds.y2) {
            buildingType = b.buildingType ?? 'generic';
            break;
          }
        }
      }
    }

    // Neighbour-aware terrain the pack opts into (atlas.terrain); cells it doesn't draw fall through.
    const art = this.engine.manifest?.atlas?.terrain;
    if (art && worldX !== undefined && worldY !== undefined) {
      const layers = terrainLayers(this.terrainView, worldX, worldY, this.terrainSuffixAt, art, (k) => this.atlas.hasRecipe(k));
      if (layers) {
        for (const key of layers) this.atlas.drawSprite(this.ctx, key, px, py, cs, visibility);
        if (tile.visual === 'portal' || tile.visual === 'altar') this.drawFixtureOverlay(px, py, cs, tile.visual, visibility, tile.glyph);
        return;
      }
    }

    // State 2 & 3: Explored vs Visible via Sprite Atlas
    const spriteKey = getTerrainSpriteKey(tile.type, currentFloor, tileZoneBands, buildingType, (k) => this.atlas.hasRecipe(k));
    this.atlas.drawSprite(this.ctx, spriteKey, px, py, cs, visibility);

    if (tile.visual === 'portal' || tile.visual === 'altar') {
      this.drawFixtureOverlay(px, py, cs, tile.visual, visibility, tile.glyph);
    } else if (
      tile.type === 'shallow_water' ||
      tile.type === 'chasm' ||
      tile.type === 'iron_bars' ||
      tile.type === 'pillar'
    ) {
      this.drawTacticalTerrain(px, py, cs, tile.type, visibility);
    }
  }

  /** Recipe-key suffix at a cell: the zone band's key, or on floor 0 the town building's. */
  private readonly terrainSuffixAt = (x: number, y: number): string | undefined => {
    const floor = this.engine.currentFloor;
    if (floor === 0) {
      for (const b of this.engine.manifest?.town?.buildings ?? []) {
        if (x >= b.bounds.x1 && x <= b.bounds.x2 && y >= b.bounds.y1 && y <= b.bounds.y2) return `town_${b.buildingType ?? 'generic'}`;
      }
      return 'town';
    }
    return zoneForFloor(floor, this.engine.manifest?.atlas?.tileZoneBands);
  };

  private getContactShadowCells(): { n: HTMLCanvasElement; w: HTMLCanvasElement; e: HTMLCanvasElement } {
    if (this.contactShadowCells) return this.contactShadowCells;
    const make = (paint: (g: CanvasRenderingContext2D) => CanvasGradient) => {
      const c = document.createElement('canvas');
      c.width = 32;
      c.height = 32;
      const g = c.getContext('2d');
      if (g) {
        g.fillStyle = paint(g);
        g.fillRect(0, 0, 32, 32);
      }
      return c;
    };
    this.contactShadowCells = {
      n: make((g) => {
        const gr = g.createLinearGradient(0, 0, 0, 11);
        gr.addColorStop(0, 'rgba(0,0,0,0.46)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        return gr;
      }),
      w: make((g) => {
        const gr = g.createLinearGradient(0, 0, 6, 0);
        gr.addColorStop(0, 'rgba(0,0,0,0.26)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        return gr;
      }),
      e: make((g) => {
        const gr = g.createLinearGradient(32, 0, 27, 0);
        gr.addColorStop(0, 'rgba(0,0,0,0.16)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        return gr;
      }),
    };
    return this.contactShadowCells;
  }

  /** Soft shadow on floor under and beside rock (atlas.terrain.contactShadows). */
  private renderContactShadows(startX: number, startY: number, cols: number, rows: number): void {
    if (!this.engine.manifest?.atlas?.terrain?.contactShadows) return;
    const cs = this.cellSize;
    const cells = this.getContactShadowCells();
    const ctx = this.ctx;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c;
        const y = startY + r;
        if (!this.engine.map.inBounds(x, y)) continue;
        const vis = this.engine.fov.getVisibility(x, y);
        if (vis === Visibility.Unexplored) continue;
        const sides = contactShadowSides(this.terrainView, x, y);
        if (!sides) continue;
        const px = this.offsetX + c * cs;
        const py = this.offsetY + r * cs;
        ctx.globalAlpha = vis === Visibility.Visible ? 1 : 0.55;
        if (sides.n) ctx.drawImage(cells.n, px, py, cs, cs);
        if (sides.w) ctx.drawImage(cells.w, px, py, cs, cs);
        if (sides.e) ctx.drawImage(cells.e, px, py, cs, cs);
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Torchlight (atlas.terrain.torch): visible cells darken toward the edge of sight, a warm
   * soft-light pool sits on the player, and emissive tiles add their own glow. Remembered
   * cells get no light.
   */
  private renderTorchlight(startX: number, startY: number, cols: number, rows: number): void {
    const art = this.engine.manifest?.atlas?.terrain;
    const torch = art?.torch;
    if (!torch || !this.torchlightEnabled) return;
    const cs = this.cellSize;
    const ctx = this.ctx;
    const player = this.engine.player;
    const visible: Array<{ px: number; py: number; x: number; y: number }> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c;
        const y = startY + r;
        if (!this.engine.map.inBounds(x, y) || !this.engine.fov.isVisible(x, y)) continue;
        visible.push({ px: this.offsetX + c * cs, py: this.offsetY + r * cs, x, y });
      }
    }
    if (visible.length === 0) return;
    for (const v of visible) {
      const t = Math.min(1, Math.hypot(v.x - player.x, v.y - player.y) / torch.radius);
      const a = torch.falloff * Math.pow(t, 1.35);
      if (a > 0.005) {
        ctx.fillStyle = `rgba(4,6,10,${a.toFixed(3)})`;
        ctx.fillRect(v.px, v.py, cs, cs);
      }
    }
    const playerPos = this.camera.worldToScreen(player.x, player.y, cs, this.offsetX, this.offsetY);
    ctx.save();
    ctx.beginPath();
    for (const v of visible) ctx.rect(v.px, v.py, cs, cs);
    ctx.clip();
    if (playerPos) {
      const cx = playerPos.x + cs / 2;
      const cy = playerPos.y + cs / 2;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, cs * torch.radius * 0.65);
      glow.addColorStop(0, hexToRgba(torch.color, torch.warmth));
      glow.addColorStop(1, hexToRgba(torch.color, 0));
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = glow;
      ctx.fillRect(cx - cs * torch.radius, cy - cs * torch.radius, cs * torch.radius * 2, cs * torch.radius * 2);
    }
    const zone = this.terrainSuffixAt(player.x, player.y);
    const lights = (zone && art?.emissive?.[zone]) || undefined;
    if (lights) {
      ctx.globalCompositeOperation = 'lighter';
      for (const v of visible) {
        const type = this.engine.map.getTile(v.x, v.y)?.type;
        const light = type ? lights[type] : undefined;
        if (!light) continue;
        const cx = v.px + cs / 2;
        const cy = v.py + cs / 2;
        const rad = cs * light.radius;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, hexToRgba(light.color, light.strength));
        g.addColorStop(1, hexToRgba(light.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      }
    }
    ctx.restore();
  }

  private drawFixtureOverlay(
    px: number,
    py: number,
    cs: number,
    type: string,
    visibility: Visibility,
    glyph?: string
  ): void {
    const isVisible = visibility === Visibility.Visible;
    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    const cx = px + cs / 2;
    const cy = py + cs / 2;

    switch (type) {
      case 'portal': {
        this.ctx.fillStyle = isVisible ? 'rgba(234, 179, 8, 0.35)' : 'rgba(161, 98, 7, 0.2)';
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, cs * 0.44, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = isVisible ? '#facc15' : '#854d0e';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.font = `bold ${(cs * 0.65).toFixed(1)}px sans-serif`;
        this.ctx.fillStyle = isVisible ? '#ffffff' : '#ca8a04';
        this.ctx.fillText('▲', cx, cy + 1);
        break;
      }
      case 'altar': {
        // An interactive altar: a violet ring around the tile's own glyph
        this.ctx.fillStyle = isVisible ? 'rgba(139, 92, 246, 0.3)' : 'rgba(76, 29, 149, 0.2)';
        this.ctx.fillRect(px + cs * 0.12, py + cs * 0.12, cs * 0.76, cs * 0.76);
        this.ctx.strokeStyle = isVisible ? '#a78bfa' : '#4c1d95';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(px + cs * 0.12, py + cs * 0.12, cs * 0.76, cs * 0.76);
        this.ctx.font = `bold ${(cs * 0.55).toFixed(1)}px serif`;
        this.ctx.fillStyle = isVisible ? '#ede9fe' : '#7c3aed';
        this.ctx.fillText(glyph ?? '✦', cx, cy + 1);
        break;
      }
    }
    this.ctx.restore();
  }

  private drawTacticalTerrain(
    px: number,
    py: number,
    cs: number,
    type: string,
    visibility: Visibility
  ): void {
    const isVisible = visibility === Visibility.Visible;
    const prevFillStyle = this.ctx.fillStyle;
    const prevStrokeStyle = this.ctx.strokeStyle;
    const prevLineWidth = this.ctx.lineWidth;

    switch (type) {
      case 'shallow_water': {
        // Translucent azure water wash over stone floor
        this.ctx.fillStyle = isVisible ? 'rgba(14, 116, 144, 0.55)' : 'rgba(15, 23, 42, 0.6)';
        this.ctx.fillRect(px, py, cs, cs);

        // Water ripples
        this.ctx.strokeStyle = isVisible ? '#38bdf8' : '#1e3a5f';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        // Top ripple
        this.ctx.moveTo(px + cs * 0.2, py + cs * 0.35);
        this.ctx.quadraticCurveTo(px + cs * 0.35, py + cs * 0.25, px + cs * 0.5, py + cs * 0.35);
        this.ctx.quadraticCurveTo(px + cs * 0.65, py + cs * 0.45, px + cs * 0.8, py + cs * 0.35);
        // Bottom ripple
        this.ctx.moveTo(px + cs * 0.25, py + cs * 0.65);
        this.ctx.quadraticCurveTo(px + cs * 0.4, py + cs * 0.55, px + cs * 0.55, py + cs * 0.65);
        this.ctx.quadraticCurveTo(px + cs * 0.7, py + cs * 0.75, px + cs * 0.85, py + cs * 0.65);
        this.ctx.stroke();
        break;
      }


      case 'chasm': {
        // Pitch abyssal void
        this.ctx.fillStyle = '#030712';
        this.ctx.fillRect(px, py, cs, cs);

        // Rocky precipice edge shading
        this.ctx.strokeStyle = isVisible ? '#1f2937' : '#111827';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);

        // Craggy fissure gradient (cached for zero-allocation frames)
        if (this.cachedChasmCs !== cs || !this.cachedChasmGradVisible || !this.cachedChasmGradDim) {
          this.cachedChasmCs = cs;
          this.cachedChasmGradVisible = this.ctx.createLinearGradient(0, 0, 0, cs);
          this.cachedChasmGradVisible.addColorStop(0, 'rgba(30, 41, 59, 0.5)');
          this.cachedChasmGradVisible.addColorStop(1, 'rgba(3, 7, 18, 0.95)');

          this.cachedChasmGradDim = this.ctx.createLinearGradient(0, 0, 0, cs);
          this.cachedChasmGradDim.addColorStop(0, 'rgba(15, 23, 42, 0.3)');
          this.cachedChasmGradDim.addColorStop(1, 'rgba(3, 7, 18, 0.95)');
        }

        this.ctx.translate(px, py);
        this.ctx.fillStyle = isVisible ? this.cachedChasmGradVisible : this.cachedChasmGradDim;
        this.ctx.fillRect(2, 2, cs - 4, cs - 4);
        this.ctx.translate(-px, -py);
        break;
      }

      case 'iron_bars': {
        // Dark background aperture
        this.ctx.fillStyle = isVisible ? '#090d16' : '#04070d';
        this.ctx.fillRect(px, py, cs, cs);

        // Stone frame border
        this.ctx.strokeStyle = isVisible ? '#334155' : '#1e293b';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);

        // Vertical steel bars
        const barColor = isVisible ? '#94a3b8' : '#475569';
        const barShade = isVisible ? '#334155' : '#1e293b';
        const barCount = 4;
        const spacing = cs / (barCount + 1);

        for (let i = 1; i <= barCount; i++) {
          const bx = px + i * spacing;
          this.ctx.fillStyle = barColor;
          this.ctx.fillRect(bx - 1.5, py + 2, 2.5, cs - 4);
          this.ctx.fillStyle = barShade;
          this.ctx.fillRect(bx + 1, py + 2, 1, cs - 4);
        }

        // Horizontal crossbars
        this.ctx.fillStyle = isVisible ? '#64748b' : '#334155';
        this.ctx.fillRect(px + 2, py + cs * 0.3, cs - 4, 2);
        this.ctx.fillRect(px + 2, py + cs * 0.7, cs - 4, 2);
        break;
      }

      case 'pillar': {
        const pad = Math.floor(cs * 0.12);
        const colW = cs - pad * 2;
        const cx = px + cs / 2;
        const cy = py + cs / 2;

        // Base shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.fillRect(px + pad + 2, py + pad + 2, colW, colW);

        // Default stone pillar
        this.ctx.fillStyle = isVisible ? '#334155' : '#1e293b';
        this.ctx.fillRect(px + pad, py + pad, colW, colW);

        this.ctx.strokeStyle = isVisible ? '#64748b' : '#334155';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(px + pad + 1, py + pad + 1, colW - 2, colW - 2);

        this.ctx.fillStyle = isVisible ? '#475569' : '#0f172a';
        this.ctx.fillRect(px + pad + 3, py + pad + 3, colW - 6, colW - 6);

        // Center diamond motif
        const dSize = Math.floor(cs * 0.16);
        this.ctx.fillStyle = isVisible ? '#94a3b8' : '#334155';
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy - dSize);
        this.ctx.lineTo(cx + dSize, cy);
        this.ctx.lineTo(cx, cy + dSize);
        this.ctx.lineTo(cx - dSize, cy);
        this.ctx.closePath();
        this.ctx.fill();
        break;
      }
    }

    this.ctx.fillStyle = prevFillStyle;
    this.ctx.strokeStyle = prevStrokeStyle;
    this.ctx.lineWidth = prevLineWidth;
  }

  /**
   * Sensory Masking & Echolocation (docs/architecture/simulation-and-input.md): replaces the normal tile/
   * entity pass while `sensory_masked` is active. Draws a blank board, the player's
   * own icon, and only audible actors/terrain — reusing the existing ESP-detected
   * pulsing-indicator style for actors rather than their normal sprites, since they
   * are heard, not seen.
   */
  private renderEcholocationView(): void {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const cols = this.camera.viewWidthTiles;
    const rows = this.camera.viewHeightTiles;
    const player = this.engine.player;
    const center = { x: player.x, y: player.y };

    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(this.offsetX, this.offsetY, cols * cs, rows * cs);
    ctx.restore();

    for (const pos of getAudibleTilesInRadius(this.engine, center, ECHOLOCATION_HEARING_RADIUS)) {
      const screenPos = this.camera.worldToScreen(pos.x, pos.y, cs, this.offsetX, this.offsetY);
      if (!screenPos) continue;
      ctx.save();
      const pulse = (Math.sin(Date.now() / 220) + 1) / 2;
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.35 + 0.3 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenPos.x + cs / 2, screenPos.y + cs / 2, cs * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const entity of getAudibleEntitiesInRadius(this.engine, center, ECHOLOCATION_HEARING_RADIUS)) {
      const screenPos = this.camera.worldToScreen(entity.x, entity.y, cs, this.offsetX, this.offsetY);
      if (!screenPos) continue;
      this.renderEspMonster(screenPos.x, screenPos.y, cs, entity);
    }

    const playerScreenPos = this.camera.worldToScreen(player.x, player.y, cs, this.offsetX, this.offsetY);
    if (playerScreenPos) {
      this.renderPlayer(playerScreenPos.x, playerScreenPos.y, cs, player);
    }
  }

  private renderEntities(): void {
    const cs = this.cellSize;
    const entities = this.engine.map.getAllEntities();

    for (const entity of entities) {
      if (!entity || typeof entity.x !== 'number' || typeof entity.y !== 'number') {
        continue;
      }
      const isVisible = this.engine.fov.isVisible(entity.x, entity.y);
      const isEspDetected = !isVisible && this.engine.detectMonstersTurns > 0 && entity.type !== 'player';

      // In Fog of War, entities are ONLY rendered if directly in line of sight or detected via ESP!
      if (!isVisible && !isEspDetected) {
        continue;
      }

      const screenPos = this.camera.worldToScreen(
        entity.x,
        entity.y,
        cs,
        this.offsetX,
        this.offsetY
      );

      if (!screenPos) {
        continue;
      }

      if (isEspDetected) {
        this.renderEspMonster(screenPos.x, screenPos.y, cs, entity);
      } else if (entity.type === 'player') {
        this.renderPlayer(screenPos.x, screenPos.y, cs, entity);
      } else {
        this.renderMonster(screenPos.x, screenPos.y, cs, entity);
      }
    }
  }

  private renderEspMonster(px: number, py: number, cs: number, _monster: Entity): void {
    const ctx = this.ctx;
    const cx = px + cs / 2;
    const cy = py + cs / 2;

    ctx.save();
    const pulse = (Math.sin(Date.now() / 180) + 1) / 2;
    ctx.fillStyle = `rgba(239, 68, 68, ${0.45 + 0.3 * pulse})`;
    ctx.beginPath();
    ctx.arc(cx, cy, cs * 0.32, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Radar ping center
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderNavigationPath(): void {
    const path = this.navigationController?.currentPath;
    if (!path || path.length === 0) return;

    const ctx = this.ctx;
    const cs = this.cellSize;
    ctx.save();

    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') continue;
      const screenPos = this.camera.worldToScreen(p.x, p.y, cs, this.offsetX, this.offsetY);
      if (!screenPos) continue;

      const cx = screenPos.x + cs / 2;
      const cy = screenPos.y + cs / 2;
      const isTarget = i === path.length - 1;

      // Glow dot
      ctx.fillStyle = isTarget ? 'rgba(56, 189, 248, 0.9)' : 'rgba(56, 189, 248, 0.45)';
      ctx.beginPath();
      ctx.arc(cx, cy, isTarget ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();

      if (isTarget) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** A ground shadow under an entity (atlas.terrain.entityShadows). */
  private drawEntityShadow(px: number, py: number, cs: number): void {
    if (!this.engine.manifest?.atlas?.terrain?.entityShadows) return;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(px + cs / 2, py + cs * 0.88, cs * 0.3, cs * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderPlayer(px: number, py: number, cs: number, player?: Entity): void {
    const ctx = this.ctx;
    this.drawEntityShadow(px, py, cs);

    // Torchlight already pools warm light on the player; the aura is its stand-in.
    if (this.engine.manifest?.atlas?.terrain?.torch && this.torchlightEnabled) {
      const spriteKey = player ? getEntitySpriteKey(player, this.atlas.hasSprite.bind(this.atlas)) : 'player';
      this.atlas.drawSprite(ctx, spriteKey, px, py, cs, Visibility.Visible);
      return;
    }

    // Glowing aura
    const gradient = ctx.createRadialGradient(
      px + cs / 2,
      py + cs / 2,
      cs * 0.1,
      px + cs / 2,
      py + cs / 2,
      cs * 0.75
    );
    gradient.addColorStop(0, 'rgba(245, 158, 11, 0.45)');
    gradient.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(px + cs / 2, py + cs / 2, cs * 0.75, 0, Math.PI * 2);
    ctx.fill();

    // Sprite
    const spriteKey = player ? getEntitySpriteKey(player, this.atlas.hasSprite.bind(this.atlas)) : 'player';
    this.atlas.drawSprite(ctx, spriteKey, px, py, cs, Visibility.Visible);
  }

  private renderMonster(px: number, py: number, cs: number, monster: Entity): void {
    const ctx = this.ctx;
    this.drawEntityShadow(px, py, cs);

    const spriteKey = getEntitySpriteKey(
      monster,
      this.atlas.hasSprite.bind(this.atlas),
      this.engine.manifest?.atlas?.spriteTagRules
    );
    this.atlas.drawSprite(ctx, spriteKey, px, py, cs, Visibility.Visible);

    // Monster mini HP bar if damaged
    if (monster.hp < monster.maxHp && monster.hp > 0) {
      const barW = Math.floor(cs * 0.8);
      const barH = 3;
      const barX = px + Math.floor((cs - barW) / 2);
      const barY = py + 2;
      const ratio = Math.max(0, monster.hp / monster.maxHp);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(barX, barY, barW, barH);

      ctx.fillStyle = '#ef4444';
      ctx.fillRect(barX, barY, Math.floor(barW * ratio), barH);
    }

    // Alert exclamation badge for telegraphed wind-up
    if (monster instanceof Monster && monster.intent?.type === 'windup') {
      const glyphX = px + cs / 2;
      const glyphY = py - 3;

      ctx.save();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(glyphX, glyphY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = uiFont('xs', '"Courier New", Courier, monospace', 'bold');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', glyphX, glyphY + 0.5);
      ctx.restore();
    }
  }

  /**
   * The controls for whichever map-side mode is open (map viewer, look, aiming,
   * grimoire), or null in normal play. Shown in the DOM ground-status bar through
   * `onModeHintChanged` rather than in a strip of canvas that sat empty most turns.
   */
  /** Paints an item's atlas sprite to fill a small DOM canvas (the potion row's icons). */
  public drawItemIcon(canvas: HTMLCanvasElement, item: Item): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    const spriteKey = getItemSpriteKey(item, this.atlas.hasSprite.bind(this.atlas));
    this.atlas.drawSprite(ctx, spriteKey, 0, 0, Math.min(canvas.width, canvas.height));
  }

  public getModeHint(): ModeHint | null {
    if (this.mapOverlay.isOpen) {
      return { text: 'Map: [< > PgUp PgDn] change floor · [M / Esc] close', tone: 'mode' };
    }
    if (this.inspectOverlay.isOpen) {
      return { text: 'Look: [arrows] move the reticle · [L / Esc] exit', tone: 'mode' };
    }
    if (this.targetingOverlay.mode === 'reticle') {
      return { text: 'Aim: [arrows] move · [Enter / Space] fire · [Esc] cancel', tone: 'aim' };
    }
    return null;
  }

  /**
   * The open mode's controls as a pill along the bottom of the map. It reserves no
   * space: in normal play nothing is drawn.
   */
  private renderModeHintPill(width: number, height: number): void {
    const hint = this.getModeHint();
    if (!hint) return;
    const ctx = this.ctx;
    const font = this.theme.fontFamily ?? '"Courier New", Courier, monospace';
    ctx.save();
    ctx.font = uiFont('sm', font, 'bold');
    const padX = 12;
    const w = Math.min(width - 24, ctx.measureText(hint.text).width + padX * 2);
    const h = 22;
    const x = Math.round((width - w) / 2);
    const y = height - h - 8;
    ctx.fillStyle = 'rgba(10, 14, 23, 0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = hint.tone === 'aim' ? '#fde047' : this.theme.hudAccent;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = hint.tone === 'aim' ? '#fde047' : this.theme.hudAccent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hint.text, width / 2, y + h / 2 + 1);
    ctx.restore();
  }

  /** The monster the player is pointing at: the look reticle's tile, else the mouse's. */
  private notifyFocusEntity(): void {
    let tile: { x: number; y: number } | null = null;
    if (this.inspectOverlay.isOpen) tile = { x: this.inspectOverlay.cursorX, y: this.inspectOverlay.cursorY };
    else tile = this.tacticalTargetOverlay.hoveredTile;
    let id: string | null = null;
    if (tile && this.engine.map.inBounds(tile.x, tile.y) && this.engine.fov.isVisible(tile.x, tile.y)) {
      const entity = this.engine.map.getEntityAt(tile.x, tile.y);
      if (entity instanceof Monster && entity.isAlive()) id = entity.id;
    }
    if (id === this.lastFocusEntityId) return;
    this.lastFocusEntityId = id;
    this.onFocusEntityChanged?.(id);
  }

  /**
   * Points at a tile from outside the canvas (a sidebar row), exactly as hovering it
   * with the mouse would: the monster gets its brackets and card, an item pile its pill.
   */
  public pointAtTile(x: number | null, y: number | null): void {
    if (x === null || y === null) this.tacticalTargetOverlay.clearHover();
    else this.tacticalTargetOverlay.setHoveredTile(x, y);
    this.render();
  }

  /** Paints an entity's atlas sprite to fill a small DOM canvas (sidebar rows). */
  public drawEntityIcon(canvas: HTMLCanvasElement, entity: Entity): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    const key = getEntitySpriteKey(entity, this.atlas.hasSprite.bind(this.atlas));
    this.atlas.drawSprite(ctx, key, 0, 0, Math.min(canvas.width, canvas.height));
  }

  /**
   * Draws the explored floor into a small DOM canvas: known floor and walls, doors,
   * stairs, visible monsters, and the hero. Sized to the map, one block per tile.
   */
  public drawMinimap(canvas: HTMLCanvasElement): void {
    const map = this.engine.map;
    const fov = this.engine.fov;
    const cell = Math.max(1, Math.floor(Math.min(canvas.width / map.width, canvas.height / map.height)));
    const ox = Math.floor((canvas.width - map.width * cell) / 2);
    const oy = Math.floor((canvas.height - map.height * cell) / 2);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!fov.isExplored(x, y)) continue;
        const tile = map.getTile(x, y);
        if (!tile) continue;
        const visible = fov.isVisible(x, y);
        let color: string;
        if (tile.type === 'stairs_down' || tile.type === 'stairs_up') color = '#facc15';
        else if (tile.type.startsWith('door')) color = '#b45309';
        else if (tile.passable) color = visible ? '#56627a' : '#323b4d';
        else color = visible ? '#1c2230' : '#141925';
        ctx.fillStyle = color;
        ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    }
    for (const entity of map.getAllEntities()) {
      if (!(entity instanceof Monster) || !entity.isAlive() || !fov.isVisible(entity.x, entity.y)) continue;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(ox + entity.x * cell - 1, oy + entity.y * cell - 1, cell + 2, cell + 2);
    }
    const p = this.engine.player;
    ctx.fillStyle = this.theme.hudAccent;
    ctx.fillRect(ox + p.x * cell - 2, oy + p.y * cell - 2, cell + 4, cell + 4);
  }

  private renderGroundItems(): void {
    const cs = this.cellSize;
    const groundPiles = this.engine.map.getAllGroundItems();

    for (const pile of groundPiles) {
      if (!pile || typeof pile.x !== 'number' || typeof pile.y !== 'number') {
        continue;
      }
      const isVisible = this.engine.fov.isVisible(pile.x, pile.y);
      const isObjectSensed = !isVisible && this.engine.detectObjectsTurns > 0;

      if (!isVisible && !isObjectSensed) {
        continue;
      }
      if (pile.items.length === 0) continue;

      const screenPos = this.camera.worldToScreen(
        pile.x,
        pile.y,
        cs,
        this.offsetX,
        this.offsetY
      );
      if (!screenPos) continue;

      if (isObjectSensed) {
        this.drawEspItem(screenPos.x, screenPos.y, cs);
      } else {
        if (pile.items.length > 1) {
          this.drawLootPile(screenPos.x, screenPos.y, cs, pile.items);
        } else {
          this.drawGroundItem(screenPos.x, screenPos.y, cs, pile.items[0]);
        }
      }
    }
  }

  private drawEspItem(px: number, py: number, cs: number): void {
    const ctx = this.ctx;
    const cx = px + cs / 2;
    const cy = py + cs / 2;
    const pulse = (Math.sin(Date.now() / 200) + 1) / 2;

    ctx.save();
    ctx.fillStyle = `rgba(251, 191, 36, ${0.5 + 0.35 * pulse})`;
    const size = cs * 0.28;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size, cy);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - size, cy);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  private drawGroundHighlight(px: number, py: number, cs: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = this.theme.accent;
    ctx.fillRect(px + 2, py + 2, cs - 4, cs - 4);
    ctx.restore();
  }

  private drawGroundItem(px: number, py: number, cs: number, item: Item): void {
    this.drawGroundHighlight(px, py, cs);
    const spriteKey = getItemSpriteKey(item, this.atlas.hasSprite.bind(this.atlas));
    this.atlas.drawSprite(this.ctx, spriteKey, px + 2, py + 2, cs - 4, Visibility.Visible);
    if (item instanceof Container) {
      const state =
        item.getItems().length === 0
          ? 'empty'
          : !item.wasOpened
          ? 'unopened'
          : 'has_items';
      this.drawContainerBadge(px, py, cs, state);
    }
  }

  /** Several items on one tile: a heap icon and a count, rather than whichever item
   * happens to be on top. A pack may supply its own art under the `loot_pile` key. */
  private drawLootPile(px: number, py: number, cs: number, items: readonly Item[]): void {
    const ctx = this.ctx;
    this.drawGroundHighlight(px, py, cs);

    if (this.atlas.hasSprite(LOOT_PILE_SPRITE_KEY)) {
      this.atlas.drawSprite(ctx, LOOT_PILE_SPRITE_KEY, px + 2, py + 2, cs - 4, Visibility.Visible);
    } else {
      const cx = px + cs / 2;
      const baseY = py + cs * 0.78;
      ctx.save();
      // Mound
      ctx.fillStyle = '#6b4423';
      ctx.beginPath();
      ctx.ellipse(cx, baseY, cs * 0.36, cs * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      // Heaped goods: a sack, a blade-grey lump, and coins on top
      ctx.fillStyle = '#a16207';
      ctx.beginPath();
      ctx.arc(cx - cs * 0.12, baseY - cs * 0.12, cs * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(cx + cs * 0.13, baseY - cs * 0.1, cs * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      for (const [dx, dy] of [[-0.02, -0.3], [0.1, -0.26], [-0.14, -0.24]] as const) {
        ctx.beginPath();
        ctx.ellipse(cx + cs * dx, baseY + cs * dy, cs * 0.07, cs * 0.04, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // Count badge (bottom-right)
    const label = items.length > 9 ? '9+' : `${items.length}`;
    const fontPx = Math.max(8, Math.floor(cs * 0.3));
    ctx.save();
    ctx.font = `bold ${fontPx}px ${this.theme.fontFamily ?? 'monospace'}`;
    const w = ctx.measureText(label).width + 4;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(px + cs - w - 1, py + cs - fontPx - 2, w, fontPx + 1);
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, px + cs - 3, py + cs - 1);
    ctx.restore();

    const containers = items.filter((i): i is Container => i instanceof Container);
    if (containers.length > 0) {
      let state: 'unopened' | 'has_items' | 'empty';
      if (containers.some((c) => !c.wasOpened && c.getItems().length > 0)) {
        state = 'unopened';
      } else if (containers.some((c) => c.getItems().length > 0)) {
        state = 'has_items';
      } else {
        state = 'empty';
      }
      this.drawContainerBadge(px, py, cs, state);
    }
  }

  /** Top-right corner flag on containers: a gold star while unopened, an amber dot once
   * opened while items remain, and a grey check once completely empty. */
  private drawContainerBadge(
    px: number,
    py: number,
    cs: number,
    state: 'unopened' | 'has_items' | 'empty'
  ): void {
    const ctx = this.ctx;
    const r = Math.max(3, cs * 0.14);
    const cx = px + cs - r - 1;
    const cy = py + r + 1;
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `bold ${Math.max(7, Math.floor(r * 1.6))}px ${this.theme.fontFamily ?? 'monospace'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (state === 'unopened') {
      ctx.fillStyle = '#facc15';
      ctx.fillText('★', cx, cy + 0.5);
    } else if (state === 'has_items') {
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('•', cx, cy + 0.5);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('✓', cx, cy + 0.5);
    }
    ctx.restore();
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
