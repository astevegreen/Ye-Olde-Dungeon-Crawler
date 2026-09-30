import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FlankManager } from '../flankManager';
import { WorldLedgerModule, getReputationTier } from '../worldLedgerModule';
import { JournalModule } from '../journalModule';
import type { FlankModule, GameState } from '../types';
import { GameEngine } from '../../../engine';
import { GameMap } from '../../../engine';
import { TILES } from '../../../engine';
import { Player } from '../../../engine';
import { createWorldState } from '../../../engine';
import { PactManager } from '../../../engine';
import type { GameContentManifest } from '../../../engine';

class MockElement {
  public id: string = '';
  public className: string = '';
  public style: Record<string, string> = {};
  public _innerHTML: string = '';
  public parent: MockElement | null = null;
  public children: MockElement[] = [];
  public childNodesById: Map<string, MockElement> = new Map();
  public childNodesByClass: Map<string, MockElement[]> = new Map();
  public scrollTop: number = 0;
  public scrollHeight: number = 100;
  public clientWidth: number = 300;
  public clientHeight: number = 600;

  get innerHTML(): string {
    return this._innerHTML;
  }

  set innerHTML(val: string) {
    this._innerHTML = val;
    this.reindex();
    if (this.parent && this.id) {
      this.parent.syncChildHtml(this.id, val);
    }
  }

  get textContent(): string {
    return this._innerHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  set textContent(val: string) {
    this.innerHTML = val;
  }

  appendChild(child: MockElement): MockElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  remove(): void {
    if (this.parent) {
      const idx = this.parent.children.indexOf(this);
      if (idx !== -1) {
        this.parent.children.splice(idx, 1);
      }
      this.parent = null;
    }
  }

  public syncChildHtml(childId: string, childHtml: string): void {
    const startPattern = new RegExp(`(<([a-zA-Z0-9]+)[^>]*id=["']${childId}["'][^>]*>)`, 'i');
    const match = startPattern.exec(this._innerHTML);
    if (match) {
      const openTag = match[1];
      const tagName = match[2];
      const startIndex = match.index + openTag.length;
      let depth = 1;
      const tagRegex = new RegExp(`(<${tagName}\\b[^>]*>)|(<\\/${tagName}>)`, 'gi');
      tagRegex.lastIndex = startIndex;
      let m;
      let endIndex = -1;
      while ((m = tagRegex.exec(this._innerHTML)) !== null) {
        if (m[1]) {
          depth++;
        } else if (m[2]) {
          depth--;
          if (depth === 0) {
            endIndex = m.index;
            break;
          }
        }
      }
      if (endIndex !== -1) {
        this._innerHTML = this._innerHTML.slice(0, startIndex) + childHtml + this._innerHTML.slice(endIndex);
      } else {
        this._innerHTML = this._innerHTML.slice(0, startIndex) + childHtml;
      }
    } else {
      this._innerHTML += childHtml;
    }
    this.reindex();
    if (this.parent && this.id) {
      this.parent.syncChildHtml(this.id, this._innerHTML);
    }
  }

  public extractChildHtml(childId: string): string | null {
    const startPattern = new RegExp(`(<([a-zA-Z0-9]+)[^>]*id=["']${childId}["'][^>]*>)`, 'i');
    const match = startPattern.exec(this._innerHTML);
    if (!match) return null;
    const openTag = match[1];
    const tagName = match[2];
    const startIndex = match.index + openTag.length;
    let depth = 1;
    const tagRegex = new RegExp(`(<${tagName}\\b[^>]*>)|(<\\/${tagName}>)`, 'gi');
    tagRegex.lastIndex = startIndex;
    let m;
    while ((m = tagRegex.exec(this._innerHTML)) !== null) {
      if (m[1]) {
        depth++;
      } else if (m[2]) {
        depth--;
        if (depth === 0) {
          return this._innerHTML.slice(startIndex, m.index);
        }
      }
    }
    return null;
  }

  public reindex(): void {
    const existingById = new Map(this.childNodesById);
    this.childNodesById.clear();
    this.childNodesByClass.clear();

    const idRegex = /id=["']([^"']+)["']/g;
    let match;
    while ((match = idRegex.exec(this._innerHTML)) !== null) {
      const id = match[1];
      if (!this.childNodesById.has(id)) {
        const child = existingById.get(id) ?? new MockElement();
        child.id = id;
        child.parent = this;
        const inner = this.extractChildHtml(id);
        if (inner !== null) {
          child._innerHTML = inner;
        }
        this.childNodesById.set(id, child);
      }
    }

    const classRegex = /class=["']([^"']+)["']/g;
    while ((match = classRegex.exec(this._innerHTML)) !== null) {
      const classes = match[1].split(/\s+/);
      for (const cls of classes) {
        if (!cls) continue;
        let list = this.childNodesByClass.get(cls);
        if (!list) {
          list = [];
          this.childNodesByClass.set(cls, list);
        }
        const el = new MockElement();
        el.className = cls;
        el.parent = this;
        list.push(el);
      }
    }
  }

  querySelector(selector: string): MockElement | null {
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      const found = this.childNodesById.get(id);
      if (found) return found;
    }
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      const list = this.childNodesByClass.get(cls);
      if (list && list.length > 0) return list[0];
    }
    for (const child of this.children) {
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      const list = this.childNodesByClass.get(cls) ?? [];
      results.push(...list);
    }
    for (const child of this.children) {
      results.push(...child.querySelectorAll(selector));
    }
    return results;
  }
}

class MockDocument {
  public body = new MockElement();
  public elements = new Map<string, MockElement>();

  createElement(_tag: string): MockElement {
    return new MockElement();
  }

  getElementById(id: string): MockElement | null {
    return this.elements.get(id) ?? null;
  }
}

describe('Widescreen Flank Containers Framework', () => {
  let leftContainer: MockElement;
  let rightContainer: MockElement;

  beforeEach(() => {
    (globalThis as any).document = new MockDocument();
    (globalThis as any).window = globalThis;
    (globalThis as any).requestAnimationFrame = (cb: () => void) => cb();

    leftContainer = (globalThis as any).document.createElement('div');
    rightContainer = (globalThis as any).document.createElement('div');
    (globalThis as any).document.body.appendChild(leftContainer);
    (globalThis as any).document.body.appendChild(rightContainer);
  });

  afterEach(() => {
    delete (globalThis as any).document;
    delete (globalThis as any).window;
    delete (globalThis as any).requestAnimationFrame;
    vi.restoreAllMocks();
  });

  function createMockGameState(overrides?: Partial<GameState>): GameState {
    const map = new GameMap(20, 20, TILES.FLOOR);
    const player = new Player({
      id: 'test-player',
      name: 'Test Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
      mana: 20,
      maxMana: 20,
    });
    const worldState = createWorldState({
      factions: { townsfolk: 25, temple_standing: -20, iron_clans: 60 },
      flags: { relic_recovered: true },
    });
    const manifest: GameContentManifest = {
      id: 'test-cotw',
      name: 'Test Realm',
      monsters: [],
      items: [],
      spells: [],
      town: {} as any,
      quest: {} as any,
      atlas: {} as any,
      starterKit: {} as any,
      flankLayout: {
        left: ['world_ledger'],
        right: ['auto_journal'],
        theme: 'parchment',
      },
      trackedMilestones: [
        { flag: 'relic_recovered', label: 'Sun-Stone Claimed', icon: '☀️' },
        { flag: 'winch_repaired', label: 'Mine Lift Restored', icon: '⚙️' },
      ],
    };
    const engine = new GameEngine({ map, player, manifest });
    engine.worldState = worldState;

    return {
      engine,
      worldState,
      player,
      map,
      currentFloor: 1,
      turnCount: 42,
      manifest,
      pacts: engine.pacts,
      ...overrides,
    };
  }

  describe('FlankManager Lifecycle & Coordination', () => {
    it('registers and retrieves modules by ID', () => {
      const manager = new FlankManager();
      const ledger = new WorldLedgerModule();
      manager.registerModule(ledger);

      expect(manager.getModule('world_ledger')).toBe(ledger);
      expect(manager.getModule('unknown_module')).toBeUndefined();
    });

    it('mounts configured flank modules into left and right containers based on manifest', () => {
      const manager = new FlankManager();
      const ledger = new WorldLedgerModule();
      const journal = new JournalModule();
      manager.registerModule(ledger);
      manager.registerModule(journal);

      const manifest: GameContentManifest = {
        id: 'test',
        name: 'Test',
        monsters: [],
        items: [],
        spells: [],
        town: {} as any,
        quest: {} as any,
        atlas: {} as any,
        starterKit: {} as any,
        flankLayout: {
          left: ['world_ledger'],
          right: ['auto_journal'],
          theme: 'parchment',
        },
      };

      manager.mount(leftContainer as any, rightContainer as any, manifest);

      expect(manager.getMountedModules()).toHaveLength(2);
      expect(leftContainer.className).toContain('flank-theme-parchment');
      expect(rightContainer.className).toContain('flank-theme-parchment');
      expect(leftContainer.children[0].className).toContain('flank-module-world_ledger');
      expect(rightContainer.children[0].className).toContain('flank-module-auto_journal');
    });

    it('falls back to default module assignments if manifest omits flankLayout', () => {
      const manager = new FlankManager();
      manager.registerModule(new WorldLedgerModule());
      manager.registerModule(new JournalModule());

      manager.mount(leftContainer as any, rightContainer as any, undefined);

      expect(manager.getMountedModules()).toHaveLength(2);
      expect(leftContainer.children[0].className).toContain('flank-module-world_ledger');
      expect(rightContainer.children[0].className).toContain('flank-module-auto_journal');
    });

    it('invokes render on all mounted modules and catches errors gracefully', () => {
      const manager = new FlankManager();
      const dummyModule: FlankModule = {
        id: 'error_prone',
        title: 'Error Prone',
        mount: vi.fn(),
        render: vi.fn().mockImplementation(() => {
          throw new Error('Simulated module crash');
        }),
      };
      manager.registerModule(dummyModule);

      manager.mount(leftContainer as any, null, {
        id: 't',
        name: 'T',
        monsters: [],
        items: [],
        spells: [],
        town: {} as any,
        quest: {} as any,
        atlas: {} as any,
        starterKit: {} as any,
        flankLayout: { left: ['error_prone'] },
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const state = createMockGameState();

      // Should not throw, preserving main simulation loop immunity
      expect(() => manager.render(state)).not.toThrow();
      expect(dummyModule.render).toHaveBeenCalledWith(state);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('cleans up mounted modules on destroy', () => {
      const manager = new FlankManager();
      const mockDestroy = vi.fn();
      const customModule: FlankModule = {
        id: 'test_mod',
        title: 'Test',
        mount: vi.fn(),
        render: vi.fn(),
        destroy: mockDestroy,
      };
      manager.registerModule(customModule);
      manager.mount(leftContainer as any, null, {
        id: 't',
        name: 'T',
        monsters: [],
        items: [],
        spells: [],
        town: {} as any,
        quest: {} as any,
        atlas: {} as any,
        starterKit: {} as any,
        flankLayout: { left: ['test_mod'] },
      });

      manager.destroy();

      expect(mockDestroy).toHaveBeenCalled();
      expect(manager.getMountedModules()).toHaveLength(0);
      expect(leftContainer.innerHTML).toBe('');
    });
  });

  describe('WorldLedgerModule (Left Flank Pilot)', () => {
    it('calculates reputation tiers accurately across threshold boundaries', () => {
      expect(getReputationTier(-75).label).toBe('Hostile');
      expect(getReputationTier(-50).label).toBe('Hostile');
      expect(getReputationTier(-49).label).toBe('Unfriendly');
      expect(getReputationTier(-10).label).toBe('Unfriendly');
      expect(getReputationTier(-9).label).toBe('Neutral');
      expect(getReputationTier(0).label).toBe('Neutral');
      expect(getReputationTier(9).label).toBe('Neutral');
      expect(getReputationTier(10).label).toBe('Friendly');
      expect(getReputationTier(49).label).toBe('Friendly');
      expect(getReputationTier(50).label).toBe('Honored');
      expect(getReputationTier(100).label).toBe('Honored');
    });

    it('renders reputation meters with names, tags, and progress fills', () => {
      const ledger = new WorldLedgerModule();
      ledger.mount(leftContainer as any);

      const state = createMockGameState();
      ledger.render(state);

      expect(leftContainer.innerHTML).toContain('Townsfolk');
      expect(leftContainer.innerHTML).toContain('Friendly (+25)');
      expect(leftContainer.innerHTML).toContain('Iron Clans');
      expect(leftContainer.innerHTML).toContain('Honored (+60)');
    });

    it('renders sealed pact chips and aggregated reward badges', () => {
      const ledger = new WorldLedgerModule();
      ledger.mount(leftContainer as any);

      const state = createMockGameState();
      const pacts = new PactManager(state.engine, [
        {
          id: 'blood_tithe',
          name: 'Blood Tithe',
          description: 'Sacrifice vitality for wealth.',
          curseDescription: '-25% Max HP',
          rewardDescription: '+100% Gold',
          mutators: { playerMaxHpPercent: -0.25 },
          rewards: { goldMultiplier: 2.0, xpMultiplier: 1.25 },
        },
      ]);
      (state.engine as any).pacts = pacts;
      state.pacts = pacts;
      pacts.activatePact('blood_tithe');

      ledger.render(state);

      expect(leftContainer.innerHTML).toContain('Blood Tithe');
      expect(leftContainer.innerHTML).toContain('Gold: +100%');
      expect(leftContainer.innerHTML).toContain('XP: +25%');
    });

    it('renders wax seal milestone badges and displays completed status for true flags', () => {
      const ledger = new WorldLedgerModule();
      ledger.mount(leftContainer as any);

      const state = createMockGameState();
      ledger.render(state);

      expect(leftContainer.innerHTML).toContain('Sun-Stone Claimed');
      expect(leftContainer.innerHTML).toContain('Achieved');
      expect(leftContainer.innerHTML).toContain('Mine Lift Restored');
      expect(leftContainer.innerHTML).toContain('Locked');
    });

    it('renders safely when state or worldState is uninitialized', () => {
      const ledger = new WorldLedgerModule();
      ledger.mount(leftContainer as any);

      const partialState = {
        engine: {} as any,
        worldState: { flags: {}, counters: {}, factions: {} },
        player: {} as any,
        map: {} as any,
        currentFloor: 1,
        turnCount: 0,
      };

      expect(() => ledger.render(partialState)).not.toThrow();
      expect(leftContainer.innerHTML).toContain('No faction standings');
      expect(leftContainer.innerHTML).toContain('No active pacts sealed');
    });
  });

  describe('JournalModule (Right Flank Pilot)', () => {
    it('mounts initial UI with feathered quill header and survey cards', () => {
      const journal = new JournalModule();
      journal.mount(rightContainer as any);

      expect(rightContainer.innerHTML).toContain('feather-quill-svg');
      expect(rightContainer.innerHTML).toContain('Auto-Inking Journal');
      expect(rightContainer.innerHTML).toContain("Cartographer's Survey");
      expect(rightContainer.innerHTML).toContain('journal-chronicle-feed');
    });

    it('calculates map exploration percentage accurately', () => {
      const journal = new JournalModule();
      journal.mount(rightContainer as any);

      const state = createMockGameState();
      journal.render(state);

      // Initial exploration from spawn vision radius
      expect(rightContainer.innerHTML).toContain('40%');

      // Reveal unvisited quadrant (x: 10..19, y: 10..19)
      const fov = state.engine.fov;
      for (let x = 12; x < 20; x++) {
        for (let y = 12; y < 20; y++) {
          fov.setVisibility(x, y, 2 /* Explored */);
        }
      }

      journal.render(state);
      expect(rightContainer.innerHTML).toContain('56%');
    });

    it('surveys landmarks such as stairs and altars when discovered', () => {
      const journal = new JournalModule();
      journal.mount(rightContainer as any);

      const state = createMockGameState();
      state.map.setTile(2, 2, TILES.STAIRS_DOWN);
      state.map.setTile(3, 3, {
        type: 'altar_tyr',
        name: 'Ancient Altar of Tyr',
        passable: true,
        walkable: true,
        transparent: true,
        glyph: '⛩',
        interactionHandlerId: 'altar_tyr',
        landmarkLabel: 'Altar of Tyr ⚖️',
      });
      state.engine.fov.setVisibility(2, 2, 2);
      state.engine.fov.setVisibility(3, 3, 2);

      journal.render(state);

      expect(rightContainer.innerHTML).toContain('Stairs Down 🪜');
      expect(rightContainer.innerHTML).toContain('Altar of Tyr ⚖️');
    });

    it('streams discovery chronicle events published by the engine', () => {
      const journal = new JournalModule();
      journal.mount(rightContainer as any);

      const state = createMockGameState();
      state.engine.emitDiscovery({
        type: 'floor_transition',
        text: 'Descended stone steps into Floor 2.',
        icon: '🪜',
      });
      state.engine.emitDiscovery({
        type: 'secret_door',
        text: 'Detected hidden runic seam in the granite wall.',
        icon: '🔍',
      });

      journal.render(state);

      expect(rightContainer.innerHTML).toContain('Descended stone steps into Floor 2.');
      expect(rightContainer.innerHTML).toContain('Detected hidden runic seam in the granite wall.');
    });

    it('does not re-render or re-trigger entry-fresh animation on subsequent turns without new discoveries', () => {
      const journal = new JournalModule();
      journal.mount(rightContainer as any);

      const state = createMockGameState();
      state.engine.emitDiscovery({
        type: 'floor_transition',
        text: 'Descended stone steps into Floor 2.',
        icon: '🪜',
      });

      journal.render(state);
      const feedEl = rightContainer.querySelector('#journal-chronicle-feed')!;
      const initialHtml = feedEl.innerHTML;

      // Spy on feedEl.innerHTML setter to verify DOM is not rebuilt on subsequent actions
      const setSpy = vi.spyOn(feedEl, 'innerHTML', 'set');

      // Next action without new discoveries:
      journal.render(state);

      // DOM must NOT be rewritten on turns without new discoveries:
      expect(setSpy).not.toHaveBeenCalled();
      expect(feedEl.innerHTML).toBe(initialHtml);

      // When a second discovery arrives, only the new entry is fresh, not older entries:
      state.engine.emitDiscovery({
        type: 'secret_door',
        text: 'Found hidden door.',
        icon: '🔍',
      });
      journal.render(state);
      const updatedFeed = rightContainer.querySelector('#journal-chronicle-feed')!;
      expect(updatedFeed.innerHTML).toContain('Found hidden door.');
      const entries = updatedFeed.innerHTML.split('</article>');
      expect(entries[0]).not.toContain('entry-fresh');
      expect(entries[1]).toContain('entry-fresh');
    });

    it('caps chronicle log entries to prevent DOM bloat', () => {
      const journal = new JournalModule();
      journal.mount(rightContainer as any);

      const state = createMockGameState();
      for (let i = 1; i <= 40; i++) {
        state.engine.emitDiscovery({
          type: 'general',
          text: `Discovery #${i}`,
        });
      }

      journal.render(state);

      // Latest item #40 is present
      expect(rightContainer.innerHTML).toContain('Discovery #40');
      // Earliest items should have been trimmed beyond the 25 cap
      expect(rightContainer.innerHTML).not.toContain('Discovery #5<');
    });

    it('handles empty state and clears gracefully on destroy', () => {
      const journal = new JournalModule();
      journal.mount(rightContainer as any);

      const state = createMockGameState();
      (state.engine as any).discoveryEvents = [];

      expect(() => journal.render(state)).not.toThrow();
      expect(rightContainer.innerHTML).toContain('The ink is fresh');

      journal.destroy();
      expect(rightContainer.innerHTML).toBe('');
    });
  });
});
