import { GameEngine } from '../engine';
import { releaseIconAtlas, setIconAtlas } from './canvasIcons';
import { Visibility } from '../engine';
import { sensesThroughWalls } from '../engine';
import { Camera } from './camera';
import type { Entity } from '../engine';
import type { TileDefinition } from '../engine';
import type { Item, MonsterDefinition } from '../engine';
import { Container } from '../engine';
import { TargetingOverlay } from './targeting-overlay';
import { ShopDialog } from '../ui/shop/shopDialog';
import { InspectOverlay } from './inspect-overlay';
import { MapOverlay } from './map-overlay';
import { drawFloorMap } from './floorMap';
import { IntentOverlay } from './intentOverlay';
import { Monster } from '../engine';
import { Player } from '../engine';
import { ATLAS_TILE_SIZE, SpriteAtlas } from './atlas/sprite-atlas';
import { PortraitStore } from './atlas/portraits';
import { getTerrainSpriteKey, getEntitySpriteKey, getItemSpriteKey, getMonsterDefinitionSpriteKey } from './atlas/sprite-mapper';
import { heroSpriteKey } from './atlas/hero-sprite';
import { IdleIcons, IdleTicker, idleFrame, idlePhase } from './atlas/idle-frames';
import { containerStateKey, fixtureFigures, fixtureTileKey, lootPileKey, type ContainerState } from './atlas/fixture-art';
import { contactShadowSides, zoneForFloor, type TerrainView } from './atlas/terrain-layers';
import { TerrainLayerCache } from './atlas/terrain-cache';
import { ViewportManager } from './viewport';
import { elementColor, resolveThemeTokens, type ThemeTokens, uiFont, uiFontPx, withAlpha } from './theme';
import { itemFrameColor } from './itemFrame';
import { itemFrameTone } from '../ui/inventory/itemTone';
import { CanvasFXRunner } from './fxRunner';
import type { NavigationController } from '../ui/navigation';
import { CloseDoorAction } from '../engine';
import { MouseVectorOverlay } from './mouseVectorOverlay';
import { RadialMenuOverlay } from './radialMenu';
import { FloatingTextRunner } from './floatingTextRunner';
import { TacticalTargetOverlay, isAlly } from './tacticalTargetOverlay';
import { MapCardLayer, type MapCardSpec } from '../ui/mapCards/mapCardLayer';
import { escapeHtml, keyChip } from '../ui/html';
import { getAudibleEntitiesInRadius, getAudibleTilesInRadius, ECHOLOCATION_HEARING_RADIUS } from '../engine';
import { drawAllyRing, drawHpBar, drawPath, drawSensedCreature, drawSensedItem, drawWindupWarning } from './markers/markers';
import { drawChestBadge } from './markers/containerBadge';

/** What the map shows of a container: empty once nothing is inside, else whether it was opened. */
function containerState(container: Container): ContainerState {
  if (container.getItems().length === 0) return 'empty';
  return container.wasOpened ? 'opened' : 'unopened';
}

export interface ModeHint {
  /** The mode's name, e.g. "Look". */
  mode: string;
  hints: Array<{ keys: string[]; label: string }>;
  /** `aim` is the one mode where a key press spends a turn, so it reads louder. */
  tone: 'mode' | 'aim';
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: GameEngine;
  private camera: Camera;
  public readonly atlas: SpriteAtlas;
  /** The pack's portraits (`manifest.portraits`), for the shop greeting, bestiary and companion panel. */
  private readonly portraits: PortraitStore;
  public readonly viewport: ViewportManager;
  public readonly fxRunner: CanvasFXRunner;
  public readonly targetingOverlay: TargetingOverlay;
  public readonly shopOverlay: ShopDialog;
  public readonly inspectOverlay: InspectOverlay;
  public readonly mapOverlay: MapOverlay;
  public readonly intentOverlay: IntentOverlay;
  public readonly mouseVectorOverlay: MouseVectorOverlay;
  public readonly radialMenuOverlay: RadialMenuOverlay;
  public readonly floatingTextRunner: FloatingTextRunner;
  public readonly tacticalTargetOverlay: TacticalTargetOverlay;
  /** The DOM cards over the map (Look, target, banners); null without a page (tests). */
  private readonly cards: MapCardLayer | null;
  public mouseVectoringEnabled = false;
  /** Player setting (N23, tracker 4.4): while aiming, the reticle follows the mouse and a click fires. */
  public mouseAimEnabled = true;
  /** Fires the open aim the way its Enter key does (wired in main.ts: the modal stack, input lock, effects). */
  public onAimFire?: () => void;
  /** Player setting: the pack's torchlight pass (`atlas.terrain.torch`). */
  public torchlightEnabled = true;
  /** Player setting (Reduce motion off): sprites with idle frames cycle them; off holds frame 0. */
  public idleMotion = true;
  /** This draw's clock, shared by every idle sprite in it. */
  private drawNow = 0;
  /** Whether this draw showed a sprite that idles, so the next frame needs a redraw. */
  private idleShown = false;
  private readonly idleTicker = new IdleTicker(() => this.render());
  /** Item icons in menus that idle (an aura, a flicker), repainted while they are on the page. */
  private readonly idleIcons = new IdleIcons<Item>((canvas, item) => this.drawItemIcon(canvas, item));
  /** Portraits in windows, idling while they are on the page; the subject is the sprite key. */
  private readonly idlePortraits = new IdleIcons<string>((canvas, key) => this.paintPortrait(canvas, key));
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
  private boundMouseLeaveHandler?: () => void;
  private cachedChasmGradVisible?: CanvasGradient;
  private cachedChasmGradDim?: CanvasGradient;
  private cachedChasmCs = 0;
  private cachedChasmTheme?: Required<ThemeTokens>;
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
  /** Each on-screen cell's terrain layers, kept between frames until a tile near it changes. */
  private readonly terrainCache = new TerrainLayerCache();
  private readonly hasRecipe = (key: string): boolean => this.atlas.hasRecipe(key);
  public onPactModalRequested?: () => void;
  /** A double-click on a container on or beside the hero's tile: open it in the inventory. */
  public onOpenContainer?: (container: Container) => void;
  /**
   * Runs after a mouse-issued action (a click step, strike, door close, travel step, a
   * double-click pickup) as after a key: auto-pickup, the log, HUD and effects. Without
   * it the map only redraws.
   */
  public onActionProcessed?: () => void;
  /** Whether the hero may act now, the keys' own gate (no dialog up, input unlocked). */
  public canAct?: () => boolean;

  private afterAction(): void {
    if (this.onActionProcessed) this.onActionProcessed();
    else this.render();
  }

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
    this.atlas = new SpriteAtlas(this.engine.manifest?.spriteRecipes, {
      memory: this.engine.manifest?.atlas?.terrain?.memory,
      pixelSprites: { ...this.engine.manifest?.pixelSprites, ...fixtureFigures(this.engine.manifest?.fixtureArt) },
      itemAuras: this.engine.manifest?.itemAuras,
    });
    this.portraits = new PortraitStore(this.engine.manifest?.portraits);
    setIconAtlas(this.atlas);
    // 30x18¾ tiles at the least; a wider or taller window shows up to 48 columns or 30 rows.
    this.viewport = new ViewportManager(this.canvas, this.ctx, {
      virtualWidth: 960,
      virtualHeight: 600,
      maxVirtualWidth: 48 * 32,
      maxVirtualHeight: 30 * 32,
    });
    this.fxRunner = new CanvasFXRunner({ onFrame: () => this.render(), art: () => this.engine.manifest?.spellFx });
    this.targetingOverlay = new TargetingOverlay(() => this.render());
    this.shopOverlay = new ShopDialog({
      drawItemIcon: (canvas, item) => this.drawItemIcon(canvas, item),
      drawPortrait: (canvas, entity) => this.drawEntityPortrait(canvas, entity),
      portraitPx: () => (this.portraits.any ? 96 : 40),
      onStateChanged: () => this.render(),
    });
    this.inspectOverlay = new InspectOverlay(() => this.render());
    this.mapOverlay = new MapOverlay(() => this.render());
    this.intentOverlay = new IntentOverlay();
    this.mouseVectorOverlay = new MouseVectorOverlay();
    this.radialMenuOverlay = new RadialMenuOverlay();
    this.floatingTextRunner = new FloatingTextRunner({ onFrame: () => this.render() });
    this.tacticalTargetOverlay = new TacticalTargetOverlay();
    this.cards = typeof document !== 'undefined' && canvas.parentElement ? new MapCardLayer(canvas) : null;
    this.hookEngineEvents();

    // Register click event on canvas using ViewportManager coordinate transform
    this.boundClickHandler = (e: MouseEvent) => {
      const { x: clickX, y: clickY } = this.viewport.clientToVirtual(e.clientX, e.clientY);

      // Mouse aiming: a click on the map fires at the tile clicked.
      if (this.targetingOverlay.mode === 'reticle') {
        const aimed = this.mouseAimEnabled ? this.mapTileAt(clickX, clickY) : null;
        if (aimed) {
          this.targetingOverlay.aimAt(aimed.x, aimed.y, this.engine);
          this.onAimFire?.();
        }
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
          if (this.canAct && !this.canAct()) return;
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
              this.afterAction();
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
            this.afterAction();
            return;
          }

          // Distant Click Navigation: automated pathfinding
          if (this.navigationController) {
            this.navigationController.navigatePlayerTo(worldCoords.x, worldCoords.y, {
              onStep: () => this.afterAction(),
              onComplete: () => this.afterAction(),
              onCancel: () => this.afterAction(),
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

      // Mouse aiming: the reticle follows the pointer over the map.
      if (this.targetingOverlay.mode === 'reticle' && this.mouseAimEnabled) {
        const aimed = this.mapTileAt(mouseX, mouseY);
        if (aimed && this.targetingOverlay.aimAt(aimed.x, aimed.y, this.engine)) this.render();
      }

      const worldCoords = this.camera.screenToWorld(
        mouseX,
        mouseY,
        this.cellSize,
        this.offsetX,
        this.offsetY
      );

      const hoverBefore = this.tacticalTargetOverlay.hoveredTile;
      if (
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
      // The hover card, brackets and sidebar highlight are drawn by `render()`: redraw when
      // the pointer reaches another tile, whether or not vectoring is on (R-rend-6).
      const hoverAfter = this.tacticalTargetOverlay.hoveredTile;
      const hoverMoved = hoverBefore?.x !== hoverAfter?.x || hoverBefore?.y !== hoverAfter?.y;

      if (
        this.mouseVectoringEnabled &&
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
        if (hoverMoved) this.render();
      }
    };
    this.canvas.addEventListener('mousemove', this.boundMouseMoveHandler);

    this.boundMouseLeaveHandler = () => {
      this.mouseVectorOverlay.handleMouseLeave();
      this.tacticalTargetOverlay.clearHover();
      this.render();
    };
    this.canvas.addEventListener('mouseleave', this.boundMouseLeaveHandler);

    this.boundDoubleClickHandler = (e: MouseEvent) => {
      const { x: clickX, y: clickY } = this.viewport.clientToVirtual(e.clientX, e.clientY);

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

          if (isCurrent && (!this.canAct || this.canAct())) {
            const groundItems = this.engine.map.getItemsAt(p.x, p.y);
            if (groundItems.length > 0) {
              const itemToPick = groundItems[groundItems.length - 1];
              const res = this.engine.commandBus.dispatch({ type: 'pickup_item', payload: { itemId: itemToPick.id } });
              if (res.success) {
                this.afterAction();
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
    if (this.canvas && this.boundMouseLeaveHandler) {
      this.canvas.removeEventListener('mouseleave', this.boundMouseLeaveHandler);
    }
    this.viewport.destroy();
    if (this.engine) {
      this.engine.onNpcInteract = undefined;
      this.engine.onFloorChanged = undefined;
    }
    this.targetingOverlay.close();
    this.shopOverlay.close();
    this.inspectOverlay.close();
    this.mapOverlay.close();
    this.fxRunner.destroy();
    this.floatingTextRunner.destroy();
    this.idleTicker.stop();
    this.idleIcons.stop();
    this.idlePortraits.stop();
    this.cards?.remove();
    releaseIconAtlas(this.atlas);
  }

  public cleanup(): void {
    this.destroy();
  }

  public resize(): void {
    this.viewport.recalculate();
    this.render();
  }

  /**
   * Lays the tile grid over the virtual canvas, whose size follows the window: as many
   * tiles as cover it, the edge ones cut by the canvas edge, in an odd count so the
   * hero's tile sits at the centre; never more than the floor has, so a small floor is
   * centred whole. Run each frame, so a floor change re-lays it too.
   */
  private layoutGrid(): void {
    const availW = this.viewport.virtualWidth;
    const availH = this.viewport.virtualHeight - this.topBarHeight;
    const cover = (px: number) => 2 * Math.ceil((px / this.cellSize - 1) / 2) + 1;
    const cols = Math.min(this.engine.map.width, cover(availW));
    const rows = Math.min(this.engine.map.height, cover(availH));

    this.camera.viewWidthTiles = cols;
    this.camera.viewHeightTiles = rows;
    this.offsetX = Math.floor((availW - cols * this.cellSize) / 2);
    this.offsetY = this.topBarHeight + Math.floor((availH - rows * this.cellSize) / 2);
  }

  public render(): void {
    // Re-apply viewport context transform so High-DPI scaling is active
    this.viewport.applyContextTransform();
    this.layoutGrid();
    this.drawNow = Date.now();
    this.idleShown = false;

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

    // Enemy Intent Telegraph Danger Zones
    if (this.intentOverlay.render(ctx, this.engine, this.camera, this.cellSize, this.offsetX, this.offsetY, this.markerNow)) {
      this.markerMoved();
    }

    // Entities in line of sight, allies standing in their rings
    if (!isSensoryMasked) {
      this.renderAllyRings();
      this.renderEntities();
    }

    // A* Pathfinding Click-to-Move Breadcrumb Trail, over the sprites it walks past
    this.renderNavigationPath();

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
      theme,
      (element) => elementColor(this.engine.manifest, element)
    );

    // Live On-Grid Tactical Target Card & Ground Item Tooltip (Zero-Click Inspect)
    if (
      !this.inspectOverlay.isOpen &&
      !this.targetingOverlay.isOpen &&
      !this.shopOverlay.isOpen &&
      !this.mapOverlay.isOpen
    ) {
      const moved = this.tacticalTargetOverlay.render(
        ctx,
        this.engine,
        this.camera,
        this.cellSize,
        this.offsetX,
        this.offsetY,
        virtualW,
        virtualH,
        theme,
        this.markerNow
      );
      if (moved) this.markerMoved();
    }

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
    if (this.inspectOverlay.render(ctx, virtualW, virtualH, this.engine, this.camera, this.cellSize, this.offsetX, this.offsetY, this.markerNow)) {
      this.markerMoved();
    }

    // The companion wheel, with the companion at its hub (the hero while it is away)
    this.radialMenuOverlay.render(ctx, this.engine, virtualW, virtualH, (c, x, y, size) => {
      const centre = this.engine.companion?.isAlive() ? this.engine.companion : this.engine.player;
      const spriteKey = centre ? this.entitySpriteKey(centre) : 'player';
      this.atlas.drawSprite(c, spriteKey, x - size / 2, y - size / 2, size, Visibility.Visible);
    });

    this.notifyFocusEntity();
    this.syncCards(virtualW);
    if (this.idleShown) this.idleTicker.request(this.drawNow);
  }

  /** The idle frame a sprite of `frames` frames shows in this draw: 0 unless it idles and motion is on. */
  private idleFrameOf(frames: number, phase: number): number {
    if (frames <= 1 || !this.idleMotion) return 0;
    this.idleShown = true;
    return idleFrame(this.drawNow, frames, phase);
  }

  /** The clock this draw's map markers move on: 0, their still pose, under Reduce motion. */
  private get markerNow(): number {
    return this.idleMotion ? this.drawNow : 0;
  }

  /** A marker that moves was drawn: redraw at the next idle frame, as for an idling sprite. */
  private markerMoved(): void {
    if (this.idleMotion) this.idleShown = true;
  }

  /** Puts each overlay's DOM card over the map, matching this frame. */
  private syncCards(virtualW: number): void {
    const cards = this.cards;
    if (!cards) return;
    cards.sync(this.viewport.displayWidth / virtualW);
    cards.set('look', this.inspectOverlay.card(this.engine, this.camera, this.cellSize, this.offsetX, this.offsetY, virtualW));
    const hoverShown = !this.inspectOverlay.isOpen && !this.targetingOverlay.isOpen && !this.shopOverlay.isOpen && !this.mapOverlay.isOpen;
    cards.set('mode', this.modeHintCard());
    cards.set('aim', this.targetingOverlay.card(this.engine, this.camera, this.cellSize, this.offsetX, this.offsetY, virtualW));
    cards.setGroup('windup', this.intentOverlay.cards(this.engine, this.camera, this.cellSize, this.offsetX, this.offsetY));
    cards.setGroup('portal', this.portalCards());
    cards.set('hover', hoverShown ? this.tacticalTargetOverlay.card(this.engine, this.camera, this.cellSize, this.offsetX, this.offsetY) : null);
  }

  private renderTiles(): void {
    const cs = this.cellSize;
    const startX = this.camera.startX;
    const startY = this.camera.startY;
    const cols = this.camera.viewWidthTiles;
    const rows = this.camera.viewHeightTiles;
    const theme = this.theme;
    const manifest = this.engine.manifest;
    const art = manifest?.atlas?.terrain;
    if (art) this.terrainCache.begin([this.engine.map, this.engine.currentFloor, art, manifest], this.terrainView, startX, startY, cols, rows);

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

        this.drawTileWithFov(screenX, screenY, cs, tile, visibility, worldX, worldY, theme);
      }
    }

    this.renderContactShadows(startX, startY, cols, rows);
    this.renderTorchlight(startX, startY, cols, rows);
    // A wind-up's struck tiles are the intent overlay's danger zone, drawn over the ground items.
  }

  private drawTileWithFov(
    px: number,
    py: number,
    cs: number,
    tile: TileDefinition,
    visibility: Visibility,
    worldX: number,
    worldY: number,
    theme: Required<ThemeTokens>
  ): void {
    // State 1: Unexplored (pitch black)
    if (visibility === Visibility.Unexplored) {
      this.ctx.fillStyle = theme.canvasBg;
      this.ctx.fillRect(px, py, cs, cs);
      return;
    }

    // Neighbour-aware terrain the pack opts into (atlas.terrain); cells it doesn't draw fall through.
    const art = this.engine.manifest?.atlas?.terrain;
    if (art) {
      const layers = this.terrainCache.get(this.terrainView, worldX, worldY, this.terrainSuffixAt, art, this.hasRecipe);
      if (layers) {
        for (const key of layers) this.atlas.drawSprite(this.ctx, key, px, py, cs, visibility);
        this.drawFixture(px, py, cs, tile, visibility, worldX, worldY, theme);
        return;
      }
    }

    const currentFloor = this.engine.currentFloor;
    const tileZoneBands = this.engine.manifest?.atlas?.tileZoneBands;

    let buildingType: string | undefined;
    if (currentFloor === 0) {
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

    // State 2 & 3: Explored vs Visible via Sprite Atlas
    const spriteKey = getTerrainSpriteKey(tile.type, currentFloor, tileZoneBands, buildingType, this.hasRecipe);
    this.atlas.drawSprite(this.ctx, spriteKey, px, py, cs, visibility);

    if (this.drawFixture(px, py, cs, tile, visibility, worldX, worldY, theme)) return;
    if (
      tile.type === 'shallow_water' ||
      tile.type === 'chasm' ||
      tile.type === 'iron_bars' ||
      tile.type === 'pillar'
    ) {
      this.drawTacticalTerrain(px, py, cs, tile.type, visibility, theme);
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
   * cells get no light. A lit floor (a town by day, `GameMap.lit`) keeps only the emissive
   * glow.
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
    const lit = this.engine.map.lit;
    const dark = this.theme.canvasBg;
    for (const v of lit ? [] : visible) {
      const t = Math.min(1, Math.hypot(v.x - player.x, v.y - player.y) / torch.radius);
      const a = torch.falloff * Math.pow(t, 1.35);
      if (a > 0.005) {
        ctx.fillStyle = withAlpha(dark, +a.toFixed(3));
        ctx.fillRect(v.px, v.py, cs, cs);
      }
    }
    const playerPos = this.camera.worldToScreen(player.x, player.y, cs, this.offsetX, this.offsetY);
    ctx.save();
    ctx.beginPath();
    for (const v of visible) ctx.rect(v.px, v.py, cs, cs);
    ctx.clip();
    if (playerPos && !lit) {
      const cx = playerPos.x + cs / 2;
      const cy = playerPos.y + cs / 2;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, cs * torch.radius * 0.65);
      glow.addColorStop(0, withAlpha(torch.color, torch.warmth));
      glow.addColorStop(1, withAlpha(torch.color, 0));
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
        g.addColorStop(0, withAlpha(light.color, light.strength));
        g.addColorStop(1, withAlpha(light.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      }
    }
    ctx.restore();
  }

  /**
   * A tile's fixture over its floor: the pack's drawing (`FixtureArt.tiles`), idling while in
   * view, else the generic portal or altar mark. False when the tile has neither.
   */
  private drawFixture(
    px: number,
    py: number,
    cs: number,
    tile: TileDefinition,
    visibility: Visibility,
    worldX: number,
    worldY: number,
    theme: Required<ThemeTokens>
  ): boolean {
    const key = fixtureTileKey(tile.type);
    if (this.atlas.hasFigure(key)) {
      const frame =
        visibility === Visibility.Visible ? this.idleFrameOf(this.atlas.frameCount(key), idlePhase(`${worldX},${worldY}`)) : 0;
      this.atlas.drawSprite(this.ctx, key, px, py, cs, visibility, frame);
      return true;
    }
    if (tile.visual !== 'portal' && tile.visual !== 'altar') return false;
    this.drawFixtureOverlay(px, py, cs, tile.visual, visibility, theme, tile.glyph);
    return true;
  }

  /** A portal's or an altar's mark over its tile; the glyph is a map-tile glyph, sized by the cell, in the theme's display face. */
  private drawFixtureOverlay(
    px: number,
    py: number,
    cs: number,
    type: string,
    visibility: Visibility,
    theme: Required<ThemeTokens>,
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
        this.ctx.font = `bold ${(cs * 0.65).toFixed(1)}px ${theme.fontDisplay}`;
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
        this.ctx.font = `bold ${(cs * 0.55).toFixed(1)}px ${theme.fontDisplay}`;
        this.ctx.fillStyle = isVisible ? '#ede9fe' : '#7c3aed';
        this.ctx.fillText(glyph ?? '✦', cx, cy + 1);
        break;
      }
    }
    this.ctx.restore();
  }

  /**
   * Water, chasms, bars and pillars where the pack's terrain art doesn't draw them (a pack
   * without `atlas.terrain`, or a cell its recipes miss): the one-recipe path paints them as
   * floor, so they get a neutral mark in the theme's role colors to stay readable.
   */
  private drawTacticalTerrain(
    px: number,
    py: number,
    cs: number,
    type: string,
    visibility: Visibility,
    theme: Required<ThemeTokens>
  ): void {
    const ctx = this.ctx;
    const isVisible = visibility === Visibility.Visible;
    ctx.save();

    switch (type) {
      case 'shallow_water': {
        // A wash of the info role over the floor, and two ripples
        ctx.fillStyle = isVisible ? theme.info : theme.surface0;
        ctx.globalAlpha = isVisible ? 0.35 : 0.6;
        ctx.fillRect(px, py, cs, cs);

        ctx.strokeStyle = theme.info;
        ctx.globalAlpha = isVisible ? 1 : 0.35;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px + cs * 0.2, py + cs * 0.35);
        ctx.quadraticCurveTo(px + cs * 0.35, py + cs * 0.25, px + cs * 0.5, py + cs * 0.35);
        ctx.quadraticCurveTo(px + cs * 0.65, py + cs * 0.45, px + cs * 0.8, py + cs * 0.35);
        ctx.moveTo(px + cs * 0.25, py + cs * 0.65);
        ctx.quadraticCurveTo(px + cs * 0.4, py + cs * 0.55, px + cs * 0.55, py + cs * 0.65);
        ctx.quadraticCurveTo(px + cs * 0.7, py + cs * 0.75, px + cs * 0.85, py + cs * 0.65);
        ctx.stroke();
        break;
      }

      case 'chasm': {
        // The deepest surface, a rim, and a fall into darkness (gradients kept between frames)
        ctx.fillStyle = theme.surface3;
        ctx.fillRect(px, py, cs, cs);

        ctx.strokeStyle = isVisible ? theme.line : theme.surface1;
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);

        if (this.cachedChasmCs !== cs || this.cachedChasmTheme !== theme || !this.cachedChasmGradVisible || !this.cachedChasmGradDim) {
          this.cachedChasmCs = cs;
          this.cachedChasmTheme = theme;
          this.cachedChasmGradVisible = ctx.createLinearGradient(0, 0, 0, cs);
          this.cachedChasmGradVisible.addColorStop(0, withAlpha(theme.surface2, 0.5));
          this.cachedChasmGradVisible.addColorStop(1, withAlpha(theme.surface3, 0.95));

          this.cachedChasmGradDim = ctx.createLinearGradient(0, 0, 0, cs);
          this.cachedChasmGradDim.addColorStop(0, withAlpha(theme.surface1, 0.3));
          this.cachedChasmGradDim.addColorStop(1, withAlpha(theme.surface3, 0.95));
        }

        ctx.translate(px, py);
        ctx.fillStyle = isVisible ? this.cachedChasmGradVisible : this.cachedChasmGradDim;
        ctx.fillRect(2, 2, cs - 4, cs - 4);
        break;
      }

      case 'iron_bars': {
        // A dark aperture in a frame, four bars and two crossbars
        ctx.fillStyle = isVisible ? theme.surface0 : theme.surface3;
        ctx.fillRect(px, py, cs, cs);

        ctx.strokeStyle = isVisible ? theme.lineStrong : theme.line;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);

        const barColor = isVisible ? theme.textMuted : theme.textFaint;
        const barShade = isVisible ? theme.lineStrong : theme.line;
        const barCount = 4;
        const spacing = cs / (barCount + 1);
        for (let i = 1; i <= barCount; i++) {
          const bx = px + i * spacing;
          ctx.fillStyle = barColor;
          ctx.fillRect(bx - 1.5, py + 2, 2.5, cs - 4);
          ctx.fillStyle = barShade;
          ctx.fillRect(bx + 1, py + 2, 1, cs - 4);
        }

        ctx.fillStyle = isVisible ? theme.textFaint : theme.lineStrong;
        ctx.fillRect(px + 2, py + cs * 0.3, cs - 4, 2);
        ctx.fillRect(px + 2, py + cs * 0.7, cs - 4, 2);
        break;
      }

      case 'pillar': {
        // A square column on its shadow, with a diamond on its face
        const pad = Math.floor(cs * 0.12);
        const colW = cs - pad * 2;
        const cx = px + cs / 2;
        const cy = py + cs / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(px + pad + 2, py + pad + 2, colW, colW);

        ctx.fillStyle = isVisible ? theme.lineStrong : theme.line;
        ctx.fillRect(px + pad, py + pad, colW, colW);

        ctx.strokeStyle = isVisible ? theme.textFaint : theme.lineStrong;
        ctx.lineWidth = 2;
        ctx.strokeRect(px + pad + 1, py + pad + 1, colW - 2, colW - 2);

        ctx.fillStyle = isVisible ? theme.textFaint : theme.surface1;
        ctx.globalAlpha = isVisible ? 0.5 : 1;
        ctx.fillRect(px + pad + 3, py + pad + 3, colW - 6, colW - 6);
        ctx.globalAlpha = 1;

        const dSize = Math.floor(cs * 0.16);
        ctx.fillStyle = isVisible ? theme.textMuted : theme.lineStrong;
        ctx.beginPath();
        ctx.moveTo(cx, cy - dSize);
        ctx.lineTo(cx + dSize, cy);
        ctx.lineTo(cx, cy + dSize);
        ctx.lineTo(cx - dSize, cy);
        ctx.closePath();
        ctx.fill();
        break;
      }
    }

    ctx.restore();
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
      ctx.strokeStyle = withAlpha(this.theme.info, 0.35 + 0.3 * pulse);
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
      const isEspDetected = !isVisible && entity.type !== 'player' && sensesThroughWalls(this.engine, entity);

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

  /** A ring under each ally in sight, drawn before the sprites so its feet stand in it. */
  private renderAllyRings(): void {
    const cs = this.cellSize;
    for (const entity of this.engine.map.getAllEntities()) {
      if (!(entity instanceof Monster) || !entity.isAlive() || !isAlly(entity)) continue;
      if (!this.engine.fov.isVisible(entity.x, entity.y)) continue;
      const screenPos = this.camera.worldToScreen(entity.x, entity.y, cs, this.offsetX, this.offsetY);
      if (!screenPos) continue;
      drawAllyRing(this.ctx, screenPos.x, screenPos.y, cs, this.markerNow, this.theme);
      this.markerMoved();
    }
  }

  /** A creature sensed but not seen (ESP, echolocation): a ping closing on its tile. */
  private renderEspMonster(px: number, py: number, cs: number, _monster: Entity): void {
    drawSensedCreature(this.ctx, px, py, cs, this.markerNow, this.theme);
    this.markerMoved();
  }

  /**
   * The click-to-move path, from the next step to the goal. Steps off the view still aim the
   * arrows at their neighbours; the map's edge clips them.
   */
  private renderNavigationPath(): void {
    const path = this.navigationController?.currentPath;
    if (!path || path.length === 0) return;

    const cs = this.cellSize;
    const { startX, startY, viewWidthTiles, viewHeightTiles } = this.camera;
    const pts = path
      .filter((p) => p && typeof p.x === 'number' && typeof p.y === 'number')
      .map((p) => ({ x: this.offsetX + (p.x - startX) * cs + cs / 2, y: this.offsetY + (p.y - startY) * cs + cs / 2 }));
    if (pts.length === 0) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.offsetX, this.offsetY, viewWidthTiles * cs, viewHeightTiles * cs);
    ctx.clip();
    drawPath(ctx, pts, cs, this.markerNow, this.theme);
    ctx.restore();
    this.markerMoved();
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

    // Torchlight already pools warm light on the player; the aura is its stand-in.
    if (this.engine.manifest?.atlas?.terrain?.torch && this.torchlightEnabled) {
      this.drawEntitySprite(player, px, py, cs);
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
    const glow = this.theme.accent;
    gradient.addColorStop(0, withAlpha(glow, 0.45));
    gradient.addColorStop(1, withAlpha(glow, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(px + cs / 2, py + cs / 2, cs * 0.75, 0, Math.PI * 2);
    ctx.fill();

    this.drawEntitySprite(player, px, py, cs);
  }

  private renderMonster(px: number, py: number, cs: number, monster: Entity): void {
    this.drawEntitySprite(monster, px, py, cs);

    // A hazard sign over a telegraphed wind-up.
    if (monster instanceof Monster && monster.intent?.type === 'windup') {
      drawWindupWarning(this.ctx, px, py, cs, this.markerNow, this.theme);
      this.markerMoved();
    }

    // Its health while hurt: a slanted bar for an enemy, a pill for an ally.
    if (monster.hp > 0 && monster.hp < monster.maxHp) {
      drawHpBar(this.ctx, px, py, cs, monster.hp / monster.maxHp, isAlly(monster) ? 'ally' : 'enemy', this.theme);
    }
  }

  /**
   * Paints an item's sprite, in its family's aura once it is known, to fill a small DOM canvas
   * (the menus' and the potion row's icons). One that idles turns over while it is on the page.
   */
  public drawItemIcon(canvas: HTMLCanvasElement, item: Item): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    const spriteKey = getItemSpriteKey(item, this.atlas.hasSprite.bind(this.atlas));
    const tone = itemFrameTone(item);
    const frames = this.atlas.itemFrameCount(spriteKey, tone);
    const idles = frames > 1 && this.idleMotion;
    const now = Date.now();
    const frame = idles ? idleFrame(now, frames, idlePhase(item.id)) : 0;
    this.atlas.drawItem(ctx, spriteKey, tone, 0, 0, Math.min(canvas.width, canvas.height), frame);
    if (idles) this.idleIcons.watch(canvas, item, now);
  }

  public getModeHint(): ModeHint | null {
    if (this.inspectOverlay.isOpen) {
      return { mode: 'Look', tone: 'mode', hints: [{ keys: ['Arrows'], label: 'move' }, { keys: ['L', 'Esc'], label: 'close' }] };
    }
    if (this.targetingOverlay.mode === 'reticle') {
      return {
        mode: 'Aim',
        tone: 'aim',
        hints: [
          { keys: ['Arrows'], label: 'move' },
          { keys: ['Enter', 'Space'], label: 'fire' },
          ...(this.mouseAimEnabled ? [{ keys: ['Click'], label: 'fire there' }] : []),
          { keys: ['Esc'], label: 'cancel' },
        ],
      };
    }
    return null;
  }

  /** The open mode's keys as a pill along the bottom of the map; nothing in normal play. */
  /** A standing label over every portal in sight, so a way out of the run is never missed. */
  private portalCards(): Record<string, MapCardSpec> {
    const cards: Record<string, MapCardSpec> = {};
    const { startX, startY, viewWidthTiles, viewHeightTiles } = this.camera;
    for (let y = startY; y < startY + viewHeightTiles; y++) {
      for (let x = startX; x < startX + viewWidthTiles; x++) {
        const tile = this.engine.map.inBounds(x, y) ? this.engine.map.getTile(x, y) : null;
        if (tile?.visual !== 'portal' || !this.engine.fov.isVisible(x, y)) continue;
        const screen = this.camera.worldToScreen(x, y, this.cellSize, this.offsetX, this.offsetY);
        if (!screen) continue;
        cards[`${x},${y}`] = {
          className: 'mc-pill is-portal',
          place: { tile: { x: screen.x, y: screen.y, size: this.cellSize } },
          html: `${escapeHtml(tile.name)} <span>· step in</span>`,
        };
      }
    }
    return cards;
  }

  private modeHintCard(): MapCardSpec | null {
    const hint = this.getModeHint();
    if (!hint) return null;
    const keys = hint.hints.map((h) => `<span>${h.keys.map(keyChip).join('')} ${escapeHtml(h.label)}</span>`).join('');
    return { className: `mc-pill mc-mode${hint.tone === 'aim' ? ' is-aim' : ''}`, place: { dock: 'bottom' }, html: `<b>${escapeHtml(hint.mode)}</b>${keys}` };
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

  /** The map tile under a virtual-canvas point, or null off the map. */
  private mapTileAt(vx: number, vy: number): { x: number; y: number } | null {
    if (vy < this.topBarHeight || vy >= this.viewport.virtualHeight) return null;
    const world = this.camera.screenToWorld(vx, vy, this.cellSize, this.offsetX, this.offsetY);
    return world && this.engine.map.inBounds(world.x, world.y) ? world : null;
  }

  /** Paints an entity's atlas sprite to fill a small DOM canvas (sidebar rows). */
  public drawEntityIcon(canvas: HTMLCanvasElement, entity: Entity): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    this.atlas.drawSprite(ctx, this.entitySpriteKey(entity), 0, 0, Math.min(canvas.width, canvas.height));
  }

  /** Whether the pack paints portraits: the shop greeting and the bestiary's picture then draw large. */
  public get hasPortraits(): boolean {
    return this.portraits.any;
  }

  /** Whether the pack paints `entity` a portrait (the companion panel shows one only then). */
  public hasEntityPortrait(entity: Entity): boolean {
    return this.portraits.frameCount(this.entitySpriteKey(entity)) > 0;
  }

  /** An entity's portrait filling a DOM canvas (shop greeting, companion panel), else its map sprite. */
  public drawEntityPortrait(canvas: HTMLCanvasElement, entity: Entity): void {
    const key = this.entitySpriteKey(entity);
    if (!this.paintPortrait(canvas, key)) this.drawPicture(canvas, key);
  }

  /** Paints a monster definition's portrait, else its sprite, to fill a DOM canvas (the bestiary's
   *  picture, tracker 4.2): the art its spawned monster has on the map. */
  public drawMonsterPicture(canvas: HTMLCanvasElement, def: MonsterDefinition): void {
    const key = getMonsterDefinitionSpriteKey(def, this.atlas.hasSprite.bind(this.atlas), this.engine.manifest?.atlas?.spriteTagRules);
    if (!this.paintPortrait(canvas, key)) this.drawPicture(canvas, key);
  }

  /** `key`'s map sprite in a picture's canvas: at a whole multiple of its cell, centred, so it stays
   *  crisp; a canvas smaller than one cell is filled. */
  private drawPicture(canvas: HTMLCanvasElement, key: string): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    const box = Math.min(canvas.width, canvas.height);
    const size = box >= ATLAS_TILE_SIZE ? Math.floor(box / ATLAS_TILE_SIZE) * ATLAS_TILE_SIZE : box;
    const at = Math.floor((box - size) / 2);
    this.atlas.drawSprite(ctx, key, at, at, size);
  }

  /** Paints `key`'s portrait at this idle frame and keeps it idling; false when the pack has none. */
  private paintPortrait(canvas: HTMLCanvasElement, key: string): boolean {
    const frames = this.portraits.frameCount(key);
    if (!frames) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    const size = Math.min(canvas.width, canvas.height);
    const idles = frames > 1 && this.idleMotion;
    const now = Date.now();
    const pixels = this.portraits.pixels(key, size, idles ? idleFrame(now, frames, idlePhase(key)) : 0);
    if (!pixels) return false;
    const img = ctx.createImageData(size, size);
    img.data.set(pixels.subarray(0, img.data.length));
    ctx.putImageData(img, 0, 0);
    if (idles) {
      this.portraits.warm(key, size);
      this.idlePortraits.watch(canvas, key, now);
    }
    return true;
  }

  /** An entity's sprite, the same on the map and in every DOM icon: the pack's tag
   *  rules apply to both (the icons once skipped them and drew 9 monsters differently),
   *  and the hero wears their gear when the pack draws it (`manifest.heroSprite`). */
  private entitySpriteKey(entity: Entity): string {
    if (entity instanceof Player) {
      const hero = heroSpriteKey(entity, this.atlas, this.engine.manifest?.heroSprite);
      if (hero) return hero;
    }
    return getEntitySpriteKey(entity, this.atlas.hasSprite.bind(this.atlas), this.engine.manifest?.atlas?.spriteTagRules);
  }

  /** An entity's map sprite at this draw's idle frame, over its own shadow or the generic one. */
  private drawEntitySprite(entity: Entity | undefined, px: number, py: number, cs: number): void {
    const key = entity ? this.entitySpriteKey(entity) : 'player';
    if (!this.atlas.hasFigure(key)) this.drawEntityShadow(px, py, cs);
    const frame = this.idleFrameOf(this.atlas.frameCount(key), entity ? idlePhase(entity.id) : 0);
    this.atlas.drawSprite(this.ctx, key, px, py, cs, Visibility.Visible, frame);
  }

  /**
   * Draws the explored floor into a small DOM canvas: known floor and walls, doors,
   * stairs, visible monsters, and the hero. Sized to the map, one block per tile.
   */
  public drawMinimap(canvas: HTMLCanvasElement): void {
    const { map, fov, player } = this.engine;
    drawFloorMap(canvas, map, fov, this.theme, { live: true, hero: { x: player.x, y: player.y } });
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

  /** An object sensed but not seen: a diamond and a dot, breathing. */
  private drawEspItem(px: number, py: number, cs: number): void {
    drawSensedItem(this.ctx, px, py, cs, this.markerNow, this.theme);
    this.markerMoved();
  }

  /** The square under ground loot; a known item of a family is framed in its color (N29). */
  private drawGroundHighlight(px: number, py: number, cs: number, frame: string | null = null): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = frame ?? this.theme.accent;
    ctx.fillRect(px + 2, py + 2, cs - 4, cs - 4);
    if (frame) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = frame;
      ctx.lineWidth = Math.max(1.5, cs / 20);
      ctx.strokeRect(px + 2.5, py + 2.5, cs - 5, cs - 5);
    }
    ctx.restore();
  }

  private drawGroundItem(px: number, py: number, cs: number, item: Item): void {
    this.drawGroundHighlight(px, py, cs, itemFrameColor(this.theme, item));
    const spriteKey = getItemSpriteKey(item, this.atlas.hasSprite.bind(this.atlas));
    const state = item instanceof Container ? containerState(item) : null;
    // A container the pack draws by state shows the state on itself, so it has no badge.
    const stateKey = state ? containerStateKey(spriteKey, state) : null;
    if (stateKey && this.atlas.hasFigure(stateKey)) {
      const frame = this.idleFrameOf(this.atlas.frameCount(stateKey), idlePhase(item.id));
      this.atlas.drawSprite(this.ctx, stateKey, px + 2, py + 2, cs - 4, Visibility.Visible, frame);
      return;
    }
    const tone = itemFrameTone(item);
    const frame = this.idleFrameOf(this.atlas.itemFrameCount(spriteKey, tone), idlePhase(item.id));
    this.atlas.drawItem(this.ctx, spriteKey, tone, px + 2, py + 2, cs - 4, frame);
    if (state) this.drawContainerBadge(px, py, cs, state);
  }

  /** Several items on one tile: a heap icon and a count, rather than whichever item
   * happens to be on top. A pack may supply its own art under the `loot_pile` key. */
  private drawLootPile(px: number, py: number, cs: number, items: readonly Item[]): void {
    const ctx = this.ctx;
    this.drawGroundHighlight(px, py, cs);

    const pileKey = lootPileKey(items.length, (key) => this.atlas.hasSprite(key));
    if (this.atlas.hasSprite(pileKey)) {
      const frame = this.idleFrameOf(this.atlas.frameCount(pileKey), idlePhase(items[0].id));
      this.atlas.drawSprite(ctx, pileKey, px + 2, py + 2, cs - 4, Visibility.Visible, frame);
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
    // Text on the map holds the 11px floor like the DOM (uiFont), whatever the zoom.
    const fontPx = uiFontPx('xs');
    ctx.save();
    ctx.font = uiFont('xs', this.theme.fontNum, 'bold');
    const w = ctx.measureText(label).width + 4;
    ctx.fillStyle = withAlpha(this.theme.surface0, 0.85);
    ctx.fillRect(px + cs - w - 1, py + cs - fontPx - 2, w, fontPx + 1);
    ctx.fillStyle = this.theme.text;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, px + cs - 3, py + cs - 1);
    ctx.restore();

    const containers = items.filter((i): i is Container => i instanceof Container);
    if (containers.length > 0) {
      let state: ContainerState;
      if (containers.some((c) => !c.wasOpened && c.getItems().length > 0)) {
        state = 'unopened';
      } else if (containers.some((c) => c.getItems().length > 0)) {
        state = 'opened';
      } else {
        state = 'empty';
      }
      this.drawContainerBadge(px, py, cs, state);
    }
  }

  /** Top-right corner flag on containers: a tiny chest, shut with a gold glint while unopened,
   * lid up with gold inside once opened while items remain, and grey and empty once emptied. */
  private drawContainerBadge(px: number, py: number, cs: number, state: ContainerState): void {
    drawChestBadge(this.ctx, px, py, cs, state, this.theme);
  }
}

