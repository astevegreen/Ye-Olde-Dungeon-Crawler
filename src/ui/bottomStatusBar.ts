import { type GameEngine, getTileDefinition } from '../engine';
import type { ModeHint } from '../rendering/canvas-renderer';

export interface GroundStatusInfo {
  standingText: string;
  detailText: string;
  promptText: string;
}

/**
 * Pure helper function to compute human-readable ground status for given coordinates.
 */
export function formatGroundStatus(engine: GameEngine, x: number, y: number): GroundStatusInfo {
  if (!engine || !engine.map || !engine.map.inBounds(x, y)) {
    return {
      standingText: 'Standing on: Unknown Void',
      detailText: '',
      promptText: '',
    };
  }

  const tile = engine.map.getTile(x, y);
  if (!tile) {
    return {
      standingText: 'Standing on: Unknown Void',
      detailText: '',
      promptText: '',
    };
  }
  const tileDef = getTileDefinition(tile.type);
  let buildingName = '';

  // 1. Check if standing in a named town building (when on Floor 0 / Town)
  if (engine.currentFloor === 0 && engine.manifest?.town?.buildings) {
    for (const b of engine.manifest.town.buildings) {
      if (x >= b.bounds.x1 && x <= b.bounds.x2 && y >= b.bounds.y1 && y <= b.bounds.y2) {
        buildingName = b.name;
        break;
      }
    }
  }

  let detailText = '';
  let promptText = '';

  // 2. Fixtures & Stairs prompts
  if (tile.type === 'stairs_down') {
    promptText = '🪜 Stairs Down — Press [>] or [Enter] to descend';
  } else if (tile.type === 'stairs_up') {
    promptText = '🪜 Stairs Up — Press [<] or [Enter] to ascend';
  } else if (tile.type === 'door_closed') {
    promptText = '🚪 Closed Door — Bump or press [C] to open';
  } else if (tile.type === 'door_open') {
    promptText = '🚪 Open Doorway — Press [C] to close';
  }

  // 3. Ground Items
  const groundItems = engine.map.getItemsAt(x, y);
  if (groundItems && groundItems.length > 0) {
    const itemNames = groundItems.map((item) => item.displayName).join(', ');
    detailText = `Floor: ${itemNames}`;
    if (!promptText) {
      promptText = `📦 [G] Pickup | [Shift+G] Quick-Loot | [I] Inventory`;
    }
  }

  // 4. Revealed Traps / Environmental Hazards
  const trap = engine.map.getTrapAt ? engine.map.getTrapAt(x, y) : undefined;
  if (trap && trap.revealed) {
    const hazardMsg = `⚠️ Hazard: ${trap.type.replace('_', ' ').toUpperCase()} TRAP`;
    detailText = detailText ? `${detailText} | ${hazardMsg}` : hazardMsg;
  }

  // Say where you stand only when it tells you something: a building's name, or
  // terrain that isn't plain floor and that no prompt already names.
  let standingText = '';
  if (buildingName) {
    standingText = `📍 ${buildingName}`;
  } else if (tile.type !== 'floor' && !promptText) {
    standingText = `Standing on: ${tileDef.name}`;
  }

  return { standingText, detailText, promptText };
}

export class BottomStatusBar {
  private container: HTMLElement;
  private standingEl: HTMLElement;
  private detailsEl: HTMLElement;
  private promptEl: HTMLElement;
  private turnEl: HTMLElement;
  private modeHint: ModeHint | null = null;
  private tilePrompt = '';

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'ground-status-bar';
    this.container.setAttribute('aria-label', 'Ground Status & Tile Inspection Bar');

    this.standingEl = document.createElement('span');
    this.standingEl.className = 'ground-status-standing';

    this.detailsEl = document.createElement('span');
    this.detailsEl.className = 'ground-status-details';

    this.promptEl = document.createElement('span');
    this.promptEl.className = 'ground-status-prompt';

    // The one place a turn count is shown (HUD overhaul) — previously duplicated
    // between the DOM header bar and the canvas's own internal HUD.
    this.turnEl = document.createElement('span');
    this.turnEl.className = 'ground-status-turn';

    const leftCol = document.createElement('div');
    leftCol.className = 'ground-status-left';
    leftCol.appendChild(this.standingEl);
    leftCol.appendChild(this.detailsEl);

    const rightCol = document.createElement('div');
    rightCol.className = 'ground-status-right';
    rightCol.appendChild(this.promptEl);
    rightCol.appendChild(this.turnEl);

    this.container.appendChild(leftCol);
    this.container.appendChild(rightCol);
  }

  public mount(parent: HTMLElement): void {
    const existing = parent.querySelector('#ground-status-bar');
    if (existing && existing !== this.container) {
      existing.replaceWith(this.container);
      return;
    }
    if (!parent.contains(this.container)) {
      const bottomBar = parent.querySelector('#game-bottom-bar');
      if (bottomBar) {
        parent.insertBefore(this.container, bottomBar);
      } else {
        parent.appendChild(this.container);
      }
    }
  }

  public unmount(): void {
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }

  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'flex' : 'none';
  }

  public update(engine: GameEngine): void {
    if (!engine || !engine.player) return;
    const { x, y } = engine.player;
    const status = formatGroundStatus(engine, x, y);

    let promptText = status.promptText;
    const unspent = engine.player.unspentStatPoints ?? 0;
    if (unspent > 0) {
      const allocBadge = `⭐ [U] Allocate Stats (${unspent})`;
      promptText = promptText ? `${allocBadge} | ${promptText}` : allocBadge;
    }

    this.standingEl.textContent = status.standingText;
    const separator = status.standingText ? ' | ' : '';
    this.detailsEl.textContent = status.detailText ? `${separator}${status.detailText}` : '';
    this.tilePrompt = promptText;
    this.turnEl.textContent = `Turn ${engine.turnCount}`;
    this.renderPrompt();
  }

  /**
   * While the map viewer, look mode, aiming or the grimoire is open, its controls
   * take the prompt slot; the tile prompt comes back when the mode closes.
   */
  public setModeHint(hint: ModeHint | null): void {
    this.modeHint = hint;
    this.renderPrompt();
  }

  private renderPrompt(): void {
    if (this.modeHint) {
      this.promptEl.textContent = this.modeHint.text;
      this.promptEl.style.color = this.modeHint.tone === 'aim' ? '#fde047' : '#fbbf24';
      this.promptEl.style.fontWeight = 'bold';
      return;
    }

    const promptText = this.tilePrompt;
    this.promptEl.textContent = promptText;
    if (promptText.startsWith('⭐')) {
      this.promptEl.style.color = '#facc15';
      this.promptEl.style.fontWeight = 'bold';
    } else if (promptText.includes('🪜') || promptText.includes('🌀')) {
      this.promptEl.style.color = '#fde047';
      this.promptEl.style.fontWeight = 'bold';
    } else if (promptText.includes('⚠️')) {
      this.promptEl.style.color = '#f87171';
      this.promptEl.style.fontWeight = 'bold';
    } else {
      this.promptEl.style.color = '#94a3b8';
      this.promptEl.style.fontWeight = 'normal';
    }
  }
}
