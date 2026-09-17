import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BottomStatusBar, formatGroundStatus } from '../bottomStatusBar';
import { GameEngine, GameMap, TILES, Player } from '../../engine';

// This project runs vitest under `environment: 'node'` (see vite.config.ts) with no
// jsdom dependency installed, so DOM-touching UI tests stub just enough of the DOM
// themselves — the same pattern already used by keybindModal.test.ts, pactModal.test.ts,
// choice-modal.test.ts, and diagnosticModal.test.ts (each with their own local mock).
class FakeElement {
  public id = '';
  public className = '';
  public textContent = '';
  public style: Record<string, string> = {};
  public children: FakeElement[] = [];
  public parentElement: FakeElement | null = null;
  private attributes: Record<string, string> = {};

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  appendChild(child: FakeElement): void {
    child.parentElement = this;
    this.children.push(child);
  }

  insertBefore(child: FakeElement, ref: FakeElement | null): void {
    child.parentElement = this;
    const idx = ref ? this.children.indexOf(ref) : -1;
    if (idx === -1) {
      this.children.push(child);
    } else {
      this.children.splice(idx, 0, child);
    }
  }

  removeChild(child: FakeElement): void {
    this.children = this.children.filter((c) => c !== child);
    child.parentElement = null;
  }

  contains(node: FakeElement): boolean {
    if (node === (this as unknown as FakeElement)) return true;
    return this.children.some((c) => c === node || c.contains(node));
  }

  querySelector(selector: string): FakeElement | null {
    const matches = (el: FakeElement): boolean =>
      selector.startsWith('#') ? el.id === selector.slice(1) : el.className.split(' ').includes(selector.slice(1));
    for (const child of this.children) {
      if (matches(child)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
}

function buildEngine() {
  const map = new GameMap(10, 10, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 3, y: 3 },
    stats: { hp: 10, maxHp: 10, attack: 1, defense: 1 },
  });
  return new GameEngine({ map, player });
}

describe('BottomStatusBar — turn counter (HUD overhaul)', () => {
  beforeEach(() => {
    (globalThis as any).document = {
      createElement: () => new FakeElement(),
    };
  });

  afterEach(() => {
    delete (globalThis as any).document;
  });

  it('shows the current turn count, and only there — the DOM header and canvas HUD no longer duplicate it', () => {
    const bar = new BottomStatusBar();
    const parent = new FakeElement();
    bar.mount(parent as unknown as HTMLElement);

    const engine = buildEngine();
    engine.turnCount = 0;
    bar.update(engine);
    expect(parent.querySelector('.ground-status-turn')?.textContent).toBe('Turn 0');

    engine.turnCount = 42;
    bar.update(engine);
    expect(parent.querySelector('.ground-status-turn')?.textContent).toBe('Turn 42');
  });

  it('mounts the turn readout in the status bar\'s right column alongside the tile prompt', () => {
    const bar = new BottomStatusBar();
    const parent = new FakeElement();
    bar.mount(parent as unknown as HTMLElement);

    const rightCol = parent.querySelector('.ground-status-right');
    expect(rightCol?.querySelector('.ground-status-turn')).not.toBeNull();
    expect(rightCol?.querySelector('.ground-status-prompt')).not.toBeNull();
  });
});

describe('formatGroundStatus (pre-existing, exercised for regression safety)', () => {
  it('reports an unknown-void status outside map bounds', () => {
    const engine = buildEngine();
    const status = formatGroundStatus(engine, -1, -1);
    expect(status.standingText).toBe('Standing on: Unknown Void');
  });

  it('prompts to descend on a stairs-down tile', () => {
    const engine = buildEngine();
    engine.map.setTile(5, 5, TILES.STAIRS_DOWN);
    const status = formatGroundStatus(engine, 5, 5);
    expect(status.promptText).toContain('Stairs Down');
  });
});
