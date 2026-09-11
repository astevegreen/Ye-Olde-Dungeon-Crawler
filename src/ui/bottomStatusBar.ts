import { type GameEngine, getTileDefinition } from '../engine';

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
  let locationModifier = '';

  // 1. Check if standing in a named town building (when on Floor 0 / Town)
  if (engine.currentFloor === 0 && engine.manifest?.town?.buildings) {
    for (const b of engine.manifest.town.buildings) {
      if (x >= b.bounds.x1 && x <= b.bounds.x2 && y >= b.bounds.y1 && y <= b.bounds.y2) {
        locationModifier = ` (${b.name})`;
        break;
      }
    }
  }

  const standingText = `Standing on: ${tileDef.name}${locationModifier}`;
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
  } else if (tile.type === 'runic_conduit') {
    promptText = '⚡ Runic Conduit — Siphon ley energy to restore mana';
  } else if (tile.type === 'valkyrie_sprint') {
    promptText = '⚡ Valkyrie Conduit — Step onto conduit for burst of haste';
  } else if (tile.type === 'dwarven_winch') {
    promptText = '⚙️ Dwarven Winch — Activate to lower drawbridge';
  } else if (tile.type === 'town_portal') {
    promptText = '🌀 Town Portal — Press [Enter] to teleport to town';
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

  return { standingText, detailText, promptText };
}

export class BottomStatusBar {
  private container: HTMLElement;
  private standingEl: HTMLElement;
  private detailsEl: HTMLElement;
  private promptEl: HTMLElement;

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

    const leftCol = document.createElement('div');
    leftCol.className = 'ground-status-left';
    leftCol.appendChild(this.standingEl);
    leftCol.appendChild(this.detailsEl);

    const rightCol = document.createElement('div');
    rightCol.className = 'ground-status-right';
    rightCol.appendChild(this.promptEl);

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

    this.standingEl.textContent = status.standingText;
    this.detailsEl.textContent = status.detailText ? ` | ${status.detailText}` : '';
    this.promptEl.textContent = status.promptText;

    if (status.promptText.includes('🪜') || status.promptText.includes('🌀')) {
      this.promptEl.style.color = '#fde047';
      this.promptEl.style.fontWeight = 'bold';
    } else if (status.promptText.includes('⚠️')) {
      this.promptEl.style.color = '#f87171';
      this.promptEl.style.fontWeight = 'bold';
    } else {
      this.promptEl.style.color = '#94a3b8';
      this.promptEl.style.fontWeight = 'normal';
    }
  }
}
