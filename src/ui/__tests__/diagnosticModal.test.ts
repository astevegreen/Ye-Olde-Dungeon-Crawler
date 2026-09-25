import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GameEngine,
  GameMap,
  Player,
  TILES,
  Monster,
  ItemFactory,
  flightRecorder,
  type CharacterProfile,
  MonsterRegistry
} from '../../engine';
import { DiagnosticModal, type DiagnosticInputContext } from '../diagnostic-modal';
import { ModalStackManager } from '../modalStack';

class MockElement {
  public id = '';
  public className = '';
  public style: Record<string, string> = {};
  public _innerHTML = '';
  public textContent = '';
  public value = '';
  public attributes: Record<string, string> = {};
  public children: MockElement[] = [];
  public parentElement: MockElement | null = null;
  public eventListeners: Map<string, Set<(e?: any) => void>> = new Map();

  get innerHTML(): string {
    return this._innerHTML;
  }

  set innerHTML(val: string) {
    this._innerHTML = val;
    this.textContent = val.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    this.children = [];
    this.parseInnerElements(val);
  }

  private parseInnerElements(html: string): void {
    const tagRegex = /<([a-zA-Z0-9-]+)\s*([^>]*)>([^<]*)(?:<\/\1>)?/g;
    let match;
    while ((match = tagRegex.exec(html)) !== null) {
      const attrString = match[2];
      const el = new MockElement();
      el.parentElement = this;

      if (match[3]) {
        el.textContent = match[3].trim();
      }

      const idMatch = /id="([^"]+)"/.exec(attrString);
      if (idMatch) {
        el.id = idMatch[1];
      }

      const classMatch = /class="([^"]+)"/.exec(attrString);
      if (classMatch) {
        el.className = classMatch[1];
      }

      const valueMatch = /value="([^"]*)"/.exec(attrString);
      if (valueMatch) {
        el.value = valueMatch[1];
      }

      const dataRegex = /data-([a-zA-Z0-9-]+)="([^"]+)"/g;
      let dataMatch;
      while ((dataMatch = dataRegex.exec(attrString)) !== null) {
        el.setAttribute(`data-${dataMatch[1]}`, dataMatch[2]);
      }

      this.children.push(el);
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  classList = {
    add: (cls: string) => {
      if (!this.className.includes(cls)) {
        this.className = (this.className + ' ' + cls).trim();
      }
    },
    remove: (cls: string) => {
      this.className = this.className.replace(cls, '').trim();
    },
    contains: (cls: string) => this.className.includes(cls),
  };

  appendChild(child: MockElement): void {
    this.children.push(child);
    child.parentElement = this;
  }

  addEventListener(type: string, listener: (e?: any) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (e?: any) => void): void {
    this.eventListeners.get(type)?.delete(listener);
  }

  click(): void {
    this.dispatchEvent({ type: 'click' });
  }

  dispatchEvent(event: { type: string; target?: any }): void {
    if (!event.target) {
      event.target = this;
    }
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      const copy = Array.from(listeners);
      copy.forEach((l) => l(event));
    }
  }

  closest(selector: string): MockElement | null {
    const dataMatch = /\[data-([a-zA-Z0-9-]+)\]/.exec(selector);
    if (dataMatch) {
      if (this.getAttribute(`data-${dataMatch[1]}`)) return this;
      return this.parentElement?.closest(selector) ?? null;
    }
    return this;
  }

  querySelector(selector: string): MockElement | null {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];

    if (selector.startsWith('#')) {
      const targetId = selector.slice(1);
      const found = this.findChildById(targetId);
      if (found) return [found];
      return [];
    }

    if (selector.startsWith('.')) {
      const cls = selector.slice(1).split(' ')[0].replace(/\[.*\]/, '');
      this.findChildrenByClass(cls, results);
      return results;
    }

    const dataMatch = /\[data-([a-zA-Z0-9-]+)\]/.exec(selector);
    if (dataMatch) {
      this.findChildrenWithAttr(`data-${dataMatch[1]}`, results);
      return results;
    }

    return results;
  }

  public findChildById(id: string): MockElement | null {
    if (this.id === id) return this;
    for (const c of this.children) {
      const f = c.findChildById(id);
      if (f) return f;
    }
    return null;
  }

  private findChildrenByClass(cls: string, res: MockElement[]): void {
    if (this.className.includes(cls)) res.push(this);
    for (const c of this.children) {
      c.findChildrenByClass(cls, res);
    }
  }

  private findChildrenWithAttr(attr: string, res: MockElement[]): void {
    if (this.getAttribute(attr) !== null) res.push(this);
    for (const c of this.children) {
      c.findChildrenWithAttr(attr, res);
    }
  }
}

class MockDocument {
  public body: MockElement = new MockElement();

  getElementById(id: string): MockElement | null {
    return this.body.findChildById(id);
  }

  createElement(_tag: string): MockElement {
    return new MockElement();
  }

  querySelectorAll(selector: string): MockElement[] {
    return this.body.querySelectorAll(selector);
  }
}

function makeKey(code: string, key?: string, shiftKey = false): KeyboardEvent {
  return {
    code,
    key: key ?? code,
    shiftKey,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('DiagnosticModal - Categorized Sub-Menus & Triage Tool', () => {
  let originalDocument: any;
  let mockDoc: MockDocument;
  let engine: GameEngine;
  let player: Player;
  let map: GameMap;
  let profile: CharacterProfile;
  let modal: DiagnosticModal;
  let modalStack: ModalStackManager;
  let inputLocked = false;
  let inputContext: DiagnosticInputContext;
  let chordStatus = {
    enabled: true,
    bufferMs: 40,
    pressedKeys: ['ArrowUp'],
    isChording: false,
    hasPendingTimer: false,
  };

  beforeEach(() => {
    MonsterRegistry.register({
      id: 'goblin',
      name: 'Goblin',
      stats: { hp: 10, maxHp: 10, attack: 2, defense: 1 },
      speed: 100,
      aiType: 'melee',
      fleeHealthPercent: 0,
      xpValue: 5,
      lootTable: []
    });
    
    originalDocument = (globalThis as any).document;
    mockDoc = new MockDocument();
    (globalThis as any).document = mockDoc;

    // Pre-populate container elements
    const diagModalEl = new MockElement();
    diagModalEl.id = 'diagnostic-modal';
    mockDoc.body.appendChild(diagModalEl);

    const tabStrip = new MockElement();
    tabStrip.id = 'diagnostic-tab-strip';
    diagModalEl.appendChild(tabStrip);

    const btnSim = new MockElement();
    btnSim.id = 'tab-btn-simulation';
    btnSim.setAttribute('data-tab', 'simulation');
    tabStrip.appendChild(btnSim);

    const btnActor = new MockElement();
    btnActor.id = 'tab-btn-actor';
    btnActor.setAttribute('data-tab', 'actor');
    tabStrip.appendChild(btnActor);

    const btnPipe = new MockElement();
    btnPipe.id = 'tab-btn-pipeline';
    btnPipe.setAttribute('data-tab', 'pipeline');
    tabStrip.appendChild(btnPipe);

    const btnTriage = new MockElement();
    btnTriage.id = 'tab-btn-triage';
    btnTriage.setAttribute('data-tab', 'triage');
    tabStrip.appendChild(btnTriage);

    const tabContent = new MockElement();
    tabContent.id = 'diagnostic-tab-content';
    diagModalEl.appendChild(tabContent);

    const closeBtn = new MockElement();
    closeBtn.id = 'btn-diag-close';
    diagModalEl.appendChild(closeBtn);

    const toast = new MockElement();
    toast.id = 'diagnostic-toast';
    diagModalEl.appendChild(toast);

    // Setup pure engine
    map = new GameMap(30, 30, TILES.FLOOR);
    player = new Player({
      id: 'test-hero',
      name: 'Ragnar',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 8 },
      strength: 14,
    });
    map.addEntity(player);

    engine = new GameEngine({
      map,
      player,
      floor: 3,
    });

    profile = {
      id: 'prof-1',
      name: 'Ragnar',
      gender: 'male',
      level: 1,
      floor: 3,
      hp: 50,
      maxHp: 50,
      strength: 14,
      lastSaved: Date.now(),
    };

    inputLocked = false;
    inputContext = {
      getInputLocked: () => inputLocked,
      clearInputLock: () => {
        inputLocked = false;
      },
      getChordStatus: () => chordStatus,
    };

    modalStack = new ModalStackManager();

    modal = new DiagnosticModal(
      () => engine,
      () => profile,
      undefined,
      inputContext,
      modalStack
    );
    modal.enableAutoPolling = false;
  });

  afterEach(() => {
    modal.close();
    flightRecorder.clear();
    (globalThis as any).document = originalDocument;
  });

  describe('Modal Lifecycle & ModalStack Integration', () => {
    it('opens and closes cleanly', () => {
      expect(modal.isOpen).toBe(false);
      modal.open();
      expect(modal.isOpen).toBe(true);
      modal.close();
      expect(modal.isOpen).toBe(false);
    });

    it('toggles open and closed state', () => {
      modal.toggle();
      expect(modal.isOpen).toBe(true);
      modal.toggle();
      expect(modal.isOpen).toBe(false);
    });

    it('removes itself from modalStack when closed', () => {
      modalStack.push(modal);
      expect(modalStack.has(modal.id)).toBe(true);
      expect(modal.isOpen).toBe(true);

      modal.close();
      expect(modalStack.has(modal.id)).toBe(false);
      expect(modal.isOpen).toBe(false);
    });

    it('swallows key events and prevents default browser behavior', () => {
      modal.open();

      const moveEvent = makeKey('KeyW');
      const handled = modal.handleKeyDown(moveEvent);
      expect(handled).toBe(true);
      expect(moveEvent.preventDefault).toHaveBeenCalled();
    });

    it('closes on Escape, F2, Backquote, or Tilde', () => {
      modal.open();
      const escEvent = makeKey('Escape');
      expect(modal.handleKeyDown(escEvent)).toBe(true);
      expect(modal.isOpen).toBe(false);

      modal.open();
      const f2Event = makeKey('F2');
      expect(modal.handleKeyDown(f2Event)).toBe(true);
      expect(modal.isOpen).toBe(false);

      modal.open();
      const tildeEvent = makeKey('Backquote', '`');
      expect(modal.handleKeyDown(tildeEvent)).toBe(true);
      expect(modal.isOpen).toBe(false);
    });
  });

  describe('Categorized Tab Switching', () => {
    beforeEach(() => {
      modal.open();
    });

    it('defaults to the simulation tab on open', () => {
      expect(modal.getActiveTab()).toBe('simulation');
    });

    it('switches tabs directly via number keys 1-4', () => {
      modal.handleKeyDown(makeKey('Digit2', '2'));
      expect(modal.getActiveTab()).toBe('actor');

      modal.handleKeyDown(makeKey('Digit3', '3'));
      expect(modal.getActiveTab()).toBe('pipeline');

      modal.handleKeyDown(makeKey('Digit4', '4'));
      expect(modal.getActiveTab()).toBe('triage');

      modal.handleKeyDown(makeKey('Digit1', '1'));
      expect(modal.getActiveTab()).toBe('simulation');
    });

    it('cycles tabs forward and backward via Tab / Shift+Tab', () => {
      expect(modal.getActiveTab()).toBe('simulation');

      // Forward cycle
      modal.handleKeyDown(makeKey('Tab', 'Tab', false));
      expect(modal.getActiveTab()).toBe('actor');

      modal.handleKeyDown(makeKey('Tab', 'Tab', false));
      expect(modal.getActiveTab()).toBe('pipeline');

      modal.handleKeyDown(makeKey('Tab', 'Tab', false));
      expect(modal.getActiveTab()).toBe('triage');

      modal.handleKeyDown(makeKey('Tab', 'Tab', false));
      expect(modal.getActiveTab()).toBe('simulation');

      // Backward cycle
      modal.handleKeyDown(makeKey('Tab', 'Tab', true));
      expect(modal.getActiveTab()).toBe('triage');
    });
  });

  describe('Inspection Accuracy Across Tabs', () => {
    it('accurately renders Simulation & World tab data', () => {
      // Add a sleeping monster
      const monster = new Monster({
        id: 'orc-1',
        name: 'Sleeping Orc',
        position: { x: 10, y: 10 },
        stats: { hp: 25, maxHp: 25, attack: 6, defense: 4 },
        aiState: 'sleeping',
      });
      map.addEntity(monster);

      modal.open();
      modal.setActiveTab('simulation');

      const content = mockDoc.getElementById('diagnostic-tab-content')?.textContent ?? '';
      expect(content).toContain('FLOOR 3');
      expect(content).toContain('30 × 30');
      expect(content).toContain('Sleeping: 💤 1');
      expect(content).toContain('Monsters: 1');
    });

    it('accurately renders Actor & Combat tab and reflects equipment & status changes', () => {
      modal.open();
      modal.setActiveTab('actor');

      let content = mockDoc.getElementById('diagnostic-tab-content')?.textContent ?? '';
      expect(content).toContain('Ragnar');
      expect(content).toContain('50 / 50');
      expect(content).toContain('Strength (STR): 14');

      // Add a blessed weapon
      const sword = ItemFactory.createBroadsword('hero-blade');
      sword.addModifier({
        id: 'bless-test',
        name: 'Blessed Radiance',
        category: 'blessed',
        alignment: 'positive',
        meleeDamageMultiplier: 1.3,
        statDeltas: { attackBonus: 5 },
        prefix: 'Blessed',
      });
      player.inventory.paperdoll.equip(sword, 'mainHand');

      // Add a status affliction
      player.statusManager.applyStatus('poison', 10, 2);

      modal.renderCurrentTab();
      content = mockDoc.getElementById('diagnostic-tab-content')?.textContent ?? '';

      expect(content).toContain('Heavy Sword');
      expect(content).toContain('Blessed Radiance');
      expect(content).toContain('poison');
      expect(content).toContain('10 ticks left');
    });

    it('accurately renders Pipeline & Input tab and chord telemetry', () => {
      modal.open();
      modal.setActiveTab('pipeline');

      const content = mockDoc.getElementById('diagnostic-tab-content')?.textContent ?? '';
      expect(content).toContain('READY (ACCEPTING INPUTS)');
      expect(content).toContain('ArrowUp');
      expect(content).toContain('40ms');
    });
  });

  describe('Lock Clearing & Triage Overrides', () => {
    it('displays warning when input is locked and restores responsiveness on Force Clear Lock', () => {
      inputLocked = true;
      modal.open();
      modal.setActiveTab('pipeline');

      let content = mockDoc.getElementById('diagnostic-tab-content')?.textContent ?? '';
      expect(content).toContain('LOCKED (ACTIVE ANIMATION / RESOLUTION IN PROGRESS)');

      // Click quick unlock button
      const quickUnlock = mockDoc.getElementById('btn-pipeline-quick-unlock');
      expect(quickUnlock).not.toBeNull();
      quickUnlock?.click();

      expect(inputLocked).toBe(false);
      content = mockDoc.getElementById('diagnostic-tab-content')?.textContent ?? '';
      expect(content).toContain('READY (ACCEPTING INPUTS)');
    });

    it('executes a deterministic wait turn on Step 1 Tick', () => {
      const initialTicks = engine.turnCount;
      modal.open();
      modal.setActiveTab('triage');

      const stepBtn = mockDoc.getElementById('btn-triage-step-tick');
      expect(stepBtn).not.toBeNull();
      stepBtn?.click();

      expect(engine.turnCount).toBe(initialTicks + 1);
      expect(engine.lastActionName).toBe('WaitAction');
      expect(engine.lastActionResult?.success).toBe(true);
    });

    it('toggles player invulnerability (God Mode)', () => {
      expect(player.isInvulnerable).toBe(false);

      modal.open();
      modal.setActiveTab('triage');

      const godBtn = mockDoc.getElementById('btn-triage-toggle-god');
      expect(godBtn).not.toBeNull();

      godBtn?.click();
      expect(player.isInvulnerable).toBe(true);

      // Verify player takes zero damage when invulnerable
      const dmgRes = player.takeDamage(40);
      expect(dmgRes.damageDealt).toBe(0);
      expect(dmgRes.killed).toBe(false);
      expect(player.hp).toBe(50);

      godBtn?.click();
      expect(player.isInvulnerable).toBe(false);
    });

    it('reveals all tiles on current floor map', () => {
      expect(engine.fov.isExplored(15, 15)).toBe(false);

      modal.open();
      modal.setActiveTab('triage');

      const revealBtn = mockDoc.getElementById('btn-triage-reveal-map');
      expect(revealBtn).not.toBeNull();
      revealBtn?.click();

      expect(engine.fov.isExplored(15, 15)).toBe(true);
    });

    it('spawns test items into player inventory or on ground', () => {
      modal.open();
      modal.setActiveTab('triage');

      const spawnBtns = mockDoc.querySelectorAll('.btn-spawn-item');
      expect(spawnBtns.length).toBeGreaterThan(0);

      // Spawn healing potion
      spawnBtns[0].click();
      const items = player.inventory.primaryPack.getItems();
      expect(items.length).toBeGreaterThan(0);
    });

    it('spawns test monster onto adjacent passable tile', () => {
      modal.open();
      modal.setActiveTab('triage');

      const initialCount = map.getAllEntities().length;
      const spawnMobBtns = mockDoc.querySelectorAll('.btn-spawn-monster');
      expect(spawnMobBtns.length).toBeGreaterThan(0);

      spawnMobBtns[0].click();
      const newCount = map.getAllEntities().length;
      expect(newCount).toBe(initialCount + 1);
    });

    it('advances turns via Step 10, Step 50, and custom turn stepper', () => {
      modal.open();
      modal.setActiveTab('triage');

      const initialTurns = engine.turnCount;

      const step10Btn = mockDoc.getElementById('btn-triage-step-10');
      expect(step10Btn).not.toBeNull();
      step10Btn?.click();
      expect(engine.turnCount).toBe(initialTurns + 10);

      const step50Btn = mockDoc.getElementById('btn-triage-step-50');
      expect(step50Btn).not.toBeNull();
      step50Btn?.click();
      expect(engine.turnCount).toBe(initialTurns + 60);

      const stepInput = mockDoc.getElementById('input-triage-step-turns');
      if (stepInput) stepInput.value = '7';
      const stepCustomBtn = mockDoc.getElementById('btn-triage-step-custom');
      expect(stepCustomBtn).not.toBeNull();
      stepCustomBtn?.click();
      expect(engine.turnCount).toBe(initialTurns + 67);
    });

    it('handles floor navigation (prev, next, jump) and stair teleportation', () => {
      modal.open();
      modal.setActiveTab('triage');

      expect(engine.currentFloor).toBe(3);

      // Next floor
      const nextBtn = mockDoc.getElementById('btn-triage-next-floor');
      expect(nextBtn).not.toBeNull();
      nextBtn?.click();
      expect(engine.currentFloor).toBe(4);

      // Prev floor
      const prevBtn = mockDoc.getElementById('btn-triage-prev-floor');
      expect(prevBtn).not.toBeNull();
      prevBtn?.click();
      expect(engine.currentFloor).toBe(3);

      // Jump to floor 4
      const jumpInput = mockDoc.getElementById('input-triage-jump-floor');
      if (jumpInput) jumpInput.value = '4';
      const jumpBtn = mockDoc.getElementById('btn-triage-jump-floor');
      expect(jumpBtn).not.toBeNull();
      jumpBtn?.click();
      expect(engine.currentFloor).toBe(4);

      // Find generated stairs down on floor 4 and teleport
      let stairDownPos: { x: number; y: number } | null = null;
      for (let y = 0; y < engine.map.height; y++) {
        for (let x = 0; x < engine.map.width; x++) {
          if (engine.map.getTile(x, y)?.type === 'stairs_down') {
            stairDownPos = { x, y };
            break;
          }
        }
        if (stairDownPos) break;
      }
      expect(stairDownPos).not.toBeNull();
      const stairsDownBtn = mockDoc.getElementById('btn-triage-stairs-down');
      expect(stairsDownBtn).not.toBeNull();
      stairsDownBtn?.click();
      expect(player.x).toBe(stairDownPos!.x);
      expect(player.y).toBe(stairDownPos!.y);

      // Find generated stairs up on floor 6 and teleport
      let stairUpPos: { x: number; y: number } | null = null;
      for (let y = 0; y < engine.map.height; y++) {
        for (let x = 0; x < engine.map.width; x++) {
          if (engine.map.getTile(x, y)?.type === 'stairs_up') {
            stairUpPos = { x, y };
            break;
          }
        }
        if (stairUpPos) break;
      }
      expect(stairUpPos).not.toBeNull();
      const stairsUpBtn = mockDoc.getElementById('btn-triage-stairs-up');
      expect(stairsUpBtn).not.toBeNull();
      stairsUpBtn?.click();
      expect(player.x).toBe(stairUpPos!.x);
      expect(player.y).toBe(stairUpPos!.y);
    });

    it('heals and restores hero mana to full vitality', () => {
      player.hp = 10;
      player.mana = 2;
      expect(player.hp).toBeLessThan(player.maxHp);
      expect(player.mana).toBeLessThan(player.maxMana);

      modal.open();
      modal.setActiveTab('triage');

      const healBtn = mockDoc.getElementById('btn-triage-heal-mana');
      expect(healBtn).not.toBeNull();
      healBtn?.click();

      expect(player.hp).toBe(player.maxHp);
      expect(player.mana).toBe(player.maxMana);
    });

    it('clears active status afflictions', () => {
      player.statusManager.applyStatus('poison', 10, 2);
      expect(player.statusManager.hasStatus('poison')).toBe(true);

      modal.open();
      modal.setActiveTab('triage');

      const clearStatusBtn = mockDoc.getElementById('btn-triage-clear-status');
      expect(clearStatusBtn).not.toBeNull();
      clearStatusBtn?.click();

      expect(player.statusManager.hasStatus('poison')).toBe(false);
      expect(player.statusManager.getAll().length).toBe(0);
    });

    it('kills visible hostile monsters through engine.diagnostics', () => {
      const orc = new Monster({ id: 'orc-1', name: 'Orc', position: { x: 6, y: 5 }, stats: { hp: 20, maxHp: 20, attack: 5, defense: 2 } });
      engine.addEntity(orc);
      engine.updateFov();

      modal.open();
      modal.setActiveTab('triage');
      mockDoc.getElementById('btn-triage-kill-visible')?.click();

      expect(orc.isAlive()).toBe(false);
    });

    it('grants exactly one level', () => {
      const before = player.level;
      modal.open();
      modal.setActiveTab('triage');
      mockDoc.getElementById('btn-triage-grant-level')?.click();
      expect(player.level).toBe(before + 1);
    });

    it('identifies everything the hero carries', () => {
      const ring = ItemFactory.createCursedRing('ring-unid');
      ring.identified = false;
      player.addItem(ring);
      expect(engine.identification.isIdentified(ring)).toBe(false);

      modal.open();
      modal.setActiveTab('triage');
      mockDoc.getElementById('btn-triage-identify-all')?.click();

      expect(engine.identification.isIdentified(ring)).toBe(true);
    });

    it('sets the PRNG state', () => {
      modal.open();
      modal.setActiveTab('triage');
      const input = mockDoc.getElementById('input-triage-prng');
      if (input) input.value = '12345';
      mockDoc.getElementById('btn-triage-set-prng')?.click();
      expect(engine.prng.getState()).toBe(12345);
    });

    it('hands a pasted report to the load-state handler with the replay choice', () => {
      const handler = vi.fn(async () => 'Loaded.');
      modal.setLoadReportStateHandler(handler);
      modal.open();
      modal.setActiveTab('triage');
      const input = mockDoc.getElementById('input-triage-report');
      if (input) input.value = '{"stateSnapshot":{}}';
      mockDoc.getElementById('btn-triage-load-report')?.click();
      expect(handler).toHaveBeenCalledWith('{"stateSnapshot":{}}', true);
    });

    it('reveals hidden secret doors and traps across the floor', () => {
      engine.map.setTile(15, 15, TILES.SECRET_DOOR);
      expect(engine.map.getTile(15, 15)?.type).toBe('secret_door');

      modal.open();
      modal.setActiveTab('triage');

      const revealSecretsBtn = mockDoc.getElementById('btn-triage-reveal-secrets');
      expect(revealSecretsBtn).not.toBeNull();
      revealSecretsBtn?.click();

      const tileAfter = engine.map.getTile(15, 15);
      expect(tileAfter?.isSecret).toBeFalsy();
      expect(tileAfter?.type).toBe('door_closed');
    });

    it('filters item catalog by search text and category pills', () => {
      modal.open();
      modal.setActiveTab('triage');

      const itemSearch = mockDoc.getElementById('input-item-search');
      expect(itemSearch).not.toBeNull();

      if (itemSearch) {
        itemSearch.value = 'Dagger';
        itemSearch.dispatchEvent({ type: 'input' });
      }

      const itemContainer = mockDoc.getElementById('container-item-list');
      const itemButtons = itemContainer?.querySelectorAll('.btn-spawn-item') ?? [];
      expect(itemButtons.length).toBeGreaterThan(0);
      for (const btn of itemButtons) {
        expect(btn.textContent).toContain('Dagger');
      }

      // Filter by category pill 'armor'
      const armorPills = mockDoc.querySelectorAll('.btn-item-filter-pill');
      const armorBtn = armorPills.find((p) => p.getAttribute('data-cat') === 'armor');
      expect(armorBtn).toBeDefined();
      armorBtn?.click();

      if (itemSearch) {
        itemSearch.value = '';
        itemSearch.dispatchEvent({ type: 'input' });
      }

      const armorButtons = itemContainer?.querySelectorAll('.btn-spawn-item') ?? [];
      expect(armorButtons.length).toBeGreaterThan(0);
    });

    it('filters monster catalog by search text', () => {
      modal.open();
      modal.setActiveTab('triage');

      const monsterSearch = mockDoc.getElementById('input-monster-search');
      expect(monsterSearch).not.toBeNull();

      if (monsterSearch) {
        monsterSearch.value = 'goblin';
        monsterSearch.dispatchEvent({ type: 'input' });
      }

      const mobContainer = mockDoc.getElementById('container-monster-list');
      const mobButtons = mobContainer?.querySelectorAll('.btn-spawn-monster') ?? [];
      expect(mobButtons.length).toBeGreaterThan(0);
      for (const btn of mobButtons) {
        expect(btn.textContent.toLowerCase()).toContain('goblin');
      }
    });
  });
});

