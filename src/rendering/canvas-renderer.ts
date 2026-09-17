import { GameEngine } from '../engine';
import { Visibility } from '../engine';
import { Camera } from './camera';
import type { Entity } from '../engine';
import type { TileDefinition } from '../engine';
import type { Item } from '../engine';
import { InventoryOverlay } from './inventory-overlay';
import { TargetingOverlay } from './targeting-overlay';
import { ShopOverlay } from './shop-overlay';
import { InspectOverlay } from './inspect-overlay';
import { MapOverlay } from './map-overlay';
import { HUDMessageLogRenderer } from './hud';
import { IntentOverlay } from './intentOverlay';
import { Monster } from '../engine';
import { SpriteAtlas } from './atlas/sprite-atlas';
import { getTerrainSpriteKey, getEntitySpriteKey, getItemSpriteKey } from './atlas/sprite-mapper';
import { ViewportManager } from './viewport';
import { resolveThemeTokens, type ThemeTokens } from './theme';
import { CanvasFXRunner } from './fxRunner';
import type { NavigationController } from '../ui/navigation';
import { CloseDoorAction } from '../engine';
import { MouseVectorOverlay } from './mouseVectorOverlay';
import { RadialMenuOverlay } from './radialMenu';
import type { RadialMenuSlotConfig } from '../ui/settings/settingsManager';
import { getAudibleEntitiesInRadius, getAudibleTilesInRadius, ECHOLOCATION_HEARING_RADIUS } from '../engine';

function defaultRadialLabel(slot: RadialMenuSlotConfig): string {
  switch (slot.type) {
    case 'spell': return slot.spellId;
    case 'command': return slot.commandId;
    case 'item': return slot.itemId;
  }
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
  public readonly shopOverlay: ShopOverlay;
  public readonly inspectOverlay: InspectOverlay;
  public readonly mapOverlay: MapOverlay;
  public readonly intentOverlay: IntentOverlay;
  public readonly mouseVectorOverlay: MouseVectorOverlay;
  public readonly radialMenuOverlay: RadialMenuOverlay;
  /** Resolves a display label for a radial-menu slot; wired from main.ts (spell/command/item lookups live there). */
  public onResolveRadialLabel?: (slot: RadialMenuSlotConfig) => string;
  public mouseVectoringEnabled = true;
  public navigationController?: NavigationController;
  private hud: HUDMessageLogRenderer;
  private cellSize = 32;
  private topBarHeight = 46;
  private bottomBarHeight = 88;
  private offsetX = 0;
  private offsetY = 0;
  private boundClickHandler?: (e: MouseEvent) => void;
  private boundDoubleClickHandler?: (e: MouseEvent) => void;
  private boundMouseMoveHandler?: (e: MouseEvent) => void;
  private boundContextMenuHandler?: (e: MouseEvent) => void;
  private boundMouseLeaveHandler?: () => void;
  private static readonly DASH_PATTERN = Object.freeze([4, 2]);
  private cachedChasmGradVisible?: CanvasGradient;
  private cachedChasmGradDim?: CanvasGradient;
  private cachedChasmCs = 0;
  private cachedHudTitle = '';
  private cachedHudTitleKey = '';
  public onPactModalRequested?: () => void;
  private pactBadgeBounds?: { x: number; y: number; width: number; height: number };

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
    this.atlas = new SpriteAtlas(this.engine.manifest?.spriteRecipes);
    this.viewport = new ViewportManager(this.canvas, this.ctx, {
      virtualWidth: 960,
      virtualHeight: 600,
    });
    this.fxRunner = new CanvasFXRunner({ onFrame: () => this.render() });
    this.inventoryOverlay = new InventoryOverlay(() => this.render(), this.atlas);
    this.targetingOverlay = new TargetingOverlay(() => this.render());
    this.shopOverlay = new ShopOverlay(() => this.render(), this.atlas);
    this.inspectOverlay = new InspectOverlay(() => this.render());
    this.mapOverlay = new MapOverlay(() => this.render());
    this.intentOverlay = new IntentOverlay();
    this.mouseVectorOverlay = new MouseVectorOverlay();
    this.radialMenuOverlay = new RadialMenuOverlay();
    this.hud = new HUDMessageLogRenderer({ maxLines: 4, lineHeight: 13 });
    this.hookEngineEvents();

    // Register click event on canvas using ViewportManager coordinate transform
    this.boundClickHandler = (e: MouseEvent) => {
      const { x: clickX, y: clickY } = this.viewport.clientToVirtual(e.clientX, e.clientY);

      if (this.mapOverlay.isOpen) {
        this.mapOverlay.handleClick(clickX, clickY, this.engine);
        return;
      }

      if (this.shopOverlay.isOpen) {
        this.shopOverlay.handleClick(clickX, clickY, this.engine);
        return;
      }

      if (this.inventoryOverlay.isOpen) {
        this.inventoryOverlay.handleClick(clickX, clickY, e.shiftKey || e.ctrlKey || e.metaKey);
        return;
      }

      if (this.pactBadgeBounds && this.onPactModalRequested) {
        const { x, y, width, height } = this.pactBadgeBounds;
        if (clickX >= x && clickX <= x + width && clickY >= y && clickY <= y + height) {
          this.onPactModalRequested();
          return;
        }
      }

      // Direct Canvas Mouse Vectoring or Click-to-Move Pathfinding on dungeon floor
      if (
        clickY >= this.topBarHeight &&
        clickY < this.viewport.virtualHeight - this.bottomBarHeight &&
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
      }

      if (
        this.mouseVectoringEnabled &&
        !this.inventoryOverlay.isOpen &&
        !this.shopOverlay.isOpen &&
        !this.inspectOverlay.isOpen &&
        !this.targetingOverlay.isOpen &&
        mouseY >= this.topBarHeight &&
        mouseY < this.viewport.virtualHeight - this.bottomBarHeight
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
      this.render();
    };
    this.canvas.addEventListener('mouseleave', this.boundMouseLeaveHandler);

    this.boundContextMenuHandler = (e: MouseEvent) => {
      if (this.inventoryOverlay.isOpen) {
        e.preventDefault();
        const { x: clickX, y: clickY } = this.viewport.clientToVirtual(e.clientX, e.clientY);
        this.inventoryOverlay.handleRightClick(clickX, clickY, this.engine);
      }
    };
    this.canvas.addEventListener('contextmenu', this.boundContextMenuHandler);

    this.boundDoubleClickHandler = (e: MouseEvent) => {
      const { x: clickX, y: clickY } = this.viewport.clientToVirtual(e.clientX, e.clientY);

      if (this.shopOverlay.isOpen) {
        if (this.shopOverlay.handleDoubleClick(clickX, clickY, this.engine)) {
          this.render();
          return;
        }
      }

      if (this.inventoryOverlay.isOpen) {
        if (this.inventoryOverlay.handleDoubleClick(clickX, clickY, this.engine)) {
          this.render();
          return;
        }
      }

      // Universal double-click on canvas floor: ground loot pick-up
      if (
        clickY >= this.topBarHeight &&
        clickY < this.viewport.virtualHeight - this.bottomBarHeight &&
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
          if (worldCoords.x === p.x && worldCoords.y === p.y) {
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
      this.shopOverlay.open(npc, merchant);
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
    if (this.canvas && this.boundContextMenuHandler) {
      this.canvas.removeEventListener('contextmenu', this.boundContextMenuHandler);
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
  }

  public cleanup(): void {
    this.destroy();
  }

  public resize(): void {
    this.viewport.recalculate();

    const availW = this.viewport.virtualWidth;
    const availH = this.viewport.virtualHeight - (this.topBarHeight + this.bottomBarHeight);

    // Fixed tile grid inside 960x600 virtual resolution
    const targetCols = Math.min(this.engine.map.width, 28);
    const targetRows = Math.min(this.engine.map.height, 14);

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

    // Top Bar (HUD)
    this.renderTopBar(virtualW);

    // Sensory Masking & Echolocation (ARCHITECTURE.md P-26): while active, replace the
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

    // Bottom Bar (Action log)
    this.renderBottomBar(virtualW, virtualH);

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

    // Shopkeeper & Town Services Modal Overlay
    this.shopOverlay.render(ctx, this.engine, virtualW, virtualH);

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
      this.onResolveRadialLabel ?? defaultRadialLabel
    );
  }

  private renderTopBar(width: number): void {
    const ctx = this.ctx;
    ctx.save();
    const p = this.engine.player;
    const theme = this.theme;
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    ctx.fillStyle = theme.hudBg;
    ctx.fillRect(0, 0, width, this.topBarHeight);

    ctx.strokeStyle = theme.hudBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, this.topBarHeight - 0.5);
    ctx.lineTo(width, this.topBarHeight - 0.5);
    ctx.stroke();

    // Title, Dungeon Depth / Town Hub, Level & XP (cached for zero-allocation frames)
    const townName = this.engine.manifest?.town?.name?.toUpperCase() ?? 'TOWN';
    const gameTitle = this.engine.manifest?.name?.toUpperCase() ?? 'ADVENTURE';
    const locationLabel = this.engine.currentFloor === 0 ? `TOWN: ${townName}` : `DEPTH ${this.engine.currentFloor}`;
    const hudKey = `${gameTitle}|${locationLabel}|${p.level}|${p.xp}|${p.xpToNextLevel}`;
    if (this.cachedHudTitleKey !== hudKey) {
      this.cachedHudTitleKey = hudKey;
      this.cachedHudTitle = `${gameTitle} [${locationLabel}]  LVL:${p.level} (XP:${p.xp}/${p.xpToNextLevel})`;
    }
    ctx.font = `bold 12px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.cachedHudTitle, 14, 15);

    // 1. Health Bar
    const hpBarX = 14;
    const hpBarY = 28;
    const hpBarWidth = 80;
    const hpBarHeight = 9;
    const hpRatio = Math.max(0, Math.min(1, p.hp / p.maxHp));

    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

    ctx.fillStyle = hpRatio > 0.5 ? theme.healthBar : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(hpBarX, hpBarY, Math.floor(hpBarWidth * hpRatio), hpBarHeight);

    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(hpBarX + 0.5, hpBarY + 0.5, hpBarWidth - 1, hpBarHeight - 1);

    ctx.font = `bold 10px ${font}`;
    ctx.fillStyle = theme.hudText;
    ctx.textAlign = 'left';
    ctx.fillText(`HP:${p.hp}/${p.maxHp}`, hpBarX + hpBarWidth + 6, hpBarY + 5);

    // 2. Mana Bar
    const mpBarX = hpBarX + hpBarWidth + 72;
    const mpBarY = 28;
    const mpBarWidth = 80;
    const mpBarHeight = 9;
    const mpRatio = p.maxMana > 0 ? Math.max(0, Math.min(1, p.mana / p.maxMana)) : 0;

    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(mpBarX, mpBarY, mpBarWidth, mpBarHeight);

    ctx.fillStyle = theme.manaBar;
    ctx.fillRect(mpBarX, mpBarY, Math.floor(mpBarWidth * mpRatio), hpBarHeight);

    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(mpBarX + 0.5, mpBarY + 0.5, mpBarWidth - 1, hpBarHeight - 1);

    ctx.font = `bold 10px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.textAlign = 'left';
    ctx.fillText(`MP:${p.mana}/${p.maxMana}`, mpBarX + mpBarWidth + 6, mpBarY + 5);

    // 3. Dynamic Attack / Defense Stats
    ctx.font = `bold 11px ${font}`;
    ctx.fillStyle = theme.textMuted;
    ctx.fillText(`ATK:${p.attack} | DEF:${p.defense}`, mpBarX + mpBarWidth + 78, mpBarY + 5);

    // 4. Encumbrance Badge
    const enc = p.inventory.getEncumbrance(p.strength);
    let encColor = '#10b981';
    if (enc === 'Burdened') encColor = '#f59e0b';
    else if (enc === 'Overburdened') encColor = '#f97316';
    else if (enc === 'Immobilized') encColor = '#ef4444';

    ctx.fillStyle = encColor;
    ctx.fillText(`[${enc.toUpperCase()}]`, mpBarX + mpBarWidth + 185, mpBarY + 5);

    // 5. Active Status Affliction Badges
    let statusX = mpBarX + mpBarWidth + 285;
    for (const eff of p.statusManager.getAll()) {
      let color = theme.hudAccent;
      let label = eff.type.toUpperCase();
      if (eff.type === 'poison') color = '#22c55e';
      else if (eff.type === 'paralysis') color = '#eab308';
      else if (eff.type === 'slow') color = '#0ea5e9';
      else if (eff.type === 'haste') color = '#f97316';
      else if (eff.type === 'blindness') color = '#a855f7';

      const text = `[${label} ${eff.duration}t]`;
      ctx.fillStyle = color;
      ctx.fillText(text, statusX, mpBarY + 5);
      statusX += ctx.measureText(text).width + 8;
    }

    if (this.engine.detectMonstersTurns > 0) {
      const text = `[ESP ${this.engine.detectMonstersTurns}t]`;
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(text, statusX, mpBarY + 5);
      statusX += ctx.measureText(text).width + 8;
    }

    if (this.engine.detectObjectsTurns > 0) {
      const text = `[SENSE ${this.engine.detectObjectsTurns}t]`;
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(text, statusX, mpBarY + 5);
      statusX += ctx.measureText(text).width + 8;
    }

    // 7. Active Run Pacts HUD Badge
    const activePacts = this.engine.pacts?.getActivePacts() ?? [];
    if (activePacts.length > 0) {
      const pactText = `📜 [Pacts: ${activePacts.length} active]`;
      ctx.font = `bold 11px ${font}`;
      const badgeW = ctx.measureText(pactText).width + 14;
      const badgeH = 18;
      // Right-aligned with a small margin now that the duplicate POS/TURN text
      // (removed — it was also shown in the DOM header bar) no longer reserves
      // space here.
      const badgeX = width - badgeW - 14;
      const badgeY = 24;

      this.pactBadgeBounds = { x: badgeX, y: badgeY, width: badgeW, height: badgeH };

      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(badgeX - 1, badgeY - 1, badgeW + 2, badgeH + 2);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(badgeX, badgeY, badgeW, badgeH);

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.strokeRect(badgeX + 0.5, badgeY + 0.5, badgeW - 1, badgeH - 1);

      ctx.fillStyle = '#991b1b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pactText, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);
    } else {
      this.pactBadgeBounds = undefined;
    }

    ctx.restore();
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

        this.drawTileWithFov(screenX, screenY, cs, tile, visibility);
      }
    }

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
    visibility: Visibility
  ): void {
    // State 1: Unexplored (pitch black)
    if (visibility === Visibility.Unexplored) {
      this.ctx.fillStyle = this.theme.canvasBg;
      this.ctx.fillRect(px, py, cs, cs);
      return;
    }

    // State 2 & 3: Explored vs Visible via Sprite Atlas
    const spriteKey = getTerrainSpriteKey(tile.type);
    this.atlas.drawSprite(this.ctx, spriteKey, px, py, cs, visibility);

    if (tile.type === 'gateway_valhalla') {
      this.drawFixtureOverlay(px, py, cs, tile.type, visibility);
    } else if (
      tile.type === 'shallow_water' ||
      tile.type === 'chasm' ||
      tile.type === 'iron_bars' ||
      tile.type === 'pillar'
    ) {
      this.drawTacticalTerrain(px, py, cs, tile.type, visibility);
    }
  }

  private drawFixtureOverlay(
    px: number,
    py: number,
    cs: number,
    type: string,
    visibility: Visibility
  ): void {
    const isVisible = visibility === Visibility.Visible;
    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    const cx = px + cs / 2;
    const cy = py + cs / 2;

    switch (type) {
      case 'gateway_valhalla': {
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
        // 3D beveled stone column
        const pad = Math.floor(cs * 0.12);
        const colW = cs - pad * 2;

        // Base shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.fillRect(px + pad + 2, py + pad + 2, colW, colW);

        // Outer plinth
        this.ctx.fillStyle = isVisible ? '#334155' : '#1e293b';
        this.ctx.fillRect(px + pad, py + pad, colW, colW);

        // Bevel highlight
        this.ctx.strokeStyle = isVisible ? '#64748b' : '#334155';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(px + pad + 1, py + pad + 1, colW - 2, colW - 2);

        // Capital detail
        this.ctx.fillStyle = isVisible ? '#475569' : '#0f172a';
        this.ctx.fillRect(px + pad + 3, py + pad + 3, colW - 6, colW - 6);

        // Center diamond motif
        const cx = px + cs / 2;
        const cy = py + cs / 2;
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
   * Sensory Masking & Echolocation (ARCHITECTURE.md P-26): replaces the normal tile/
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

  private renderPlayer(px: number, py: number, cs: number, player?: Entity): void {
    const ctx = this.ctx;

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
    const spriteKey = player ? getEntitySpriteKey(player) : 'player';
    this.atlas.drawSprite(ctx, spriteKey, px, py, cs, Visibility.Visible);
  }

  private renderMonster(px: number, py: number, cs: number, monster: Entity): void {
    const ctx = this.ctx;

    const spriteKey = getEntitySpriteKey(monster);
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
      ctx.font = 'bold 10px "Courier New", Courier, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', glyphX, glyphY + 0.5);
      ctx.restore();
    }
  }

  private renderBottomBar(width: number, totalHeight: number): void {
    const ctx = this.ctx;
    const footerY = totalHeight - this.bottomBarHeight;
    const theme = this.theme;
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    ctx.fillStyle = theme.hudBg;
    ctx.fillRect(0, footerY, width, this.bottomBarHeight);

    ctx.strokeStyle = theme.hudBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, footerY + 0.5);
    ctx.lineTo(width, footerY + 0.5);
    ctx.stroke();

    // 1. Expanded HUD Message Feed (4-5 lines with recency gradient)
    const logX = 14;
    const logY = footerY + 5;
    const logW = width - 28;
    const logH = 58;
    this.hud.render(ctx, this.engine, logX, logY, logW, logH);

    let controlsText = '';
    let textColor = theme.textMuted;

    if (this.mapOverlay.isOpen) {
      controlsText = 'MAP VIEWER: [< / > / PgUp / PgDn] Cycle Floors | [M / Esc / Space] Close Map';
      textColor = theme.hudAccent;
    } else if (this.inspectOverlay.isOpen) {
      controlsText = 'LOOK / INSPECT: [Arrows/WASD/Numpad] Move Reticle | [X / L / ESC] Exit Look Mode';
      textColor = theme.hudAccent;
    } else if (this.targetingOverlay.mode === 'reticle') {
      controlsText = 'AIMING RETICLE: [Arrows/Numpad] Move Reticle | [Enter/Space] Fire | [Esc] Cancel';
      textColor = '#fde047';
    } else if (this.targetingOverlay.mode === 'spellbook') {
      controlsText = 'GRIMOIRE: Press [1-9] to Select Spell/Wand to Aim | [Esc] Close';
      textColor = theme.hudAccent;
    }

    if (controlsText) {
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `11px ${font}`;
      ctx.fillStyle = textColor;
      ctx.fillText(controlsText, 14, footerY + 76);
      ctx.restore();
    }
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
        const topItem = pile.items[pile.items.length - 1];
        this.drawGroundItem(screenPos.x, screenPos.y, cs, topItem, pile.items.length);
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

  private drawGroundItem(px: number, py: number, cs: number, item: Item, count: number): void {
    const ctx = this.ctx;

    // Ground loot subtle highlight
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = this.theme.accent;
    ctx.fillRect(px + 2, py + 2, cs - 4, cs - 4);
    ctx.restore();

    // Draw item sprite
    const spriteKey = getItemSpriteKey(item);
    this.atlas.drawSprite(ctx, spriteKey, px + 2, py + 2, cs - 4, Visibility.Visible);

    // Multi-item indicator dot
    if (count > 1) {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(px + cs - 4, py + 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
