import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../engine';
import { Player } from '../../engine';
import { TILES, registerTileDefinition } from '../../engine';
import { Item } from '../../engine';
import { formatGroundStatus } from '../sidebar/sidebarModel';
import { SpellbookTab } from '../characterMenu/spellbookTab';
import { TargetingOverlay } from '../../rendering/targeting-overlay';
import { ModalStackManager } from '../modalStack';
import { registerSpells } from '../../engine';
import type { GameContentManifest, SpellDefinition } from '../../engine';

class MockElement {
  public id: string = '';
  public className: string = '';
  public style: Record<string, string> = {};
  public innerHTML: string = '';
  public dataset: Record<string, string> = {};
  public children: MockElement[] = [];
  public parentElement: MockElement | null = null;
  public eventListeners: Map<string, Set<(e?: any) => void>> = new Map();

  appendChild(el: MockElement) {
    this.children.push(el);
    el.parentElement = this;
    if (el.id) {
      (globalThis as any).document?.elements?.set(el.id, el);
    }
  }

  removeChild(el: MockElement) {
    const idx = this.children.indexOf(el);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      el.parentElement = null;
    }
  }

  contains(el: MockElement): boolean {
    return this.children.includes(el);
  }

  setAttribute(name: string, val: string) {
    if (name === 'id') this.id = val;
    if (name === 'class') this.className = val;
  }

  querySelector() { return null; }
  querySelectorAll() { return []; }

  addEventListener(type: string, listener: (e?: any) => void) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (e?: any) => void) {
    this.eventListeners.get(type)?.delete(listener);
  }

  focus() {}
  blur() {}
  replaceWith() {}
}

if (typeof (globalThis as any).KeyboardEvent === 'undefined') {
  (globalThis as any).KeyboardEvent = class {
    public code: string;
    public key: string;
    public prevented = false;
    public stopped = false;
    constructor(_type: string, init?: any) {
      this.code = init?.code ?? '';
      this.key = init?.key ?? '';
    }
    preventDefault() { this.prevented = true; }
    stopPropagation() { this.stopped = true; }
  };
}

describe('Modal Stack Lifecycle & UI Ground Status Polish', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;
  let modalStack: ModalStackManager;
  let origDocument: any;

  const testManifest: GameContentManifest = {
    id: 'test_manifest',
    name: 'Test Realm',
    monsters: [],
    items: [],
    spells: [
      {
        id: 'magic_arrow',
        name: 'Magic Arrow',
        school: 'Combat',
        manaCost: 3,
        element: 'arcane',
        range: 6,
        basePower: 8,
        areaOfEffect: 0,
        reflects: false,
        targetType: 'ray',
        targetingMode: 'ray',
        description: 'Fires an arcane arrow.',
        effects: [{ type: 'damage', amount: 8, element: 'arcane' }],
      },
      {
        id: 'heal_wounds',
        name: 'Heal Wounds',
        school: 'Healing',
        manaCost: 4,
        element: 'holy',
        range: 0,
        basePower: 10,
        areaOfEffect: 0,
        reflects: false,
        targetType: 'self',
        targetingMode: 'self',
        description: 'Restores health to the caster.',
        effects: [{ type: 'heal', amount: 10 }],
      },
    ],
    town: {
      name: 'Bjarnarhaven',
      width: 50,
      height: 30,
      playerSpawn: { x: 10, y: 14 },
      stairsDown: { x: 25, y: 8 },
      buildings: [
        {
          name: "Olaf's General Store",
          bounds: { x1: 3, y1: 2, x2: 16, y2: 9 },
          door: { x: 10, y: 9, isOpen: false },
        },
      ],
      npcs: [],
    },
    quest: {
      bossMonsterId: 'boss',
      dungeonFloors: 5,
    } as any,
    atlas: {
      themeId: 'test_theme',
    } as any,
    starterKit: {
      spellsKnown: ['magic_arrow', 'heal_wounds'],
    } as any,
  };

  beforeEach(() => {
    origDocument = (globalThis as any).document;
    const elements = new Map<string, MockElement>();
    const body = new MockElement();
    const canvas = new MockElement();
    canvas.id = 'game-canvas';
    elements.set('game-canvas', canvas);

    (globalThis as any).document = {
      elements,
      body,
      createElement: () => new MockElement(),
      getElementById: (id: string) => elements.get(id) ?? null,
      activeElement: null,
    };

    map = new GameMap(30, 30, TILES.FLOOR);
    player = new Player({
      id: 'player-1',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
      speed: 100,
    });
    player.spellsKnown = ['magic_arrow', 'heal_wounds'];
    player.quickSpells = Array(10).fill(null);
    player.mana = 20;
    player.maxMana = 20;

    registerSpells(testManifest.spells);

    engine = new GameEngine({ manifest: testManifest, map, player, floor: 1 });
    modalStack = new ModalStackManager();
  });

  afterEach(() => {
    (globalThis as any).document = origDocument;
  });

  describe('formatGroundStatus', () => {
    it('says nothing about plain dungeon floor', () => {
      engine.currentFloor = 1;
      map.setTile(5, 5, TILES.FLOOR);
      const status = formatGroundStatus(engine, 5, 5);
      expect(status.standingText).toBe('');
      expect(status.detailText).toBe('');
      expect(status.promptText).toBe('');
    });

    it('formats town building location when on Floor 0', () => {
      engine.currentFloor = 0;
      const woodenPlanks = {
        type: 'wooden_floor',
        name: 'Wooden Planks',
        passable: true,
        walkable: true,
        transparent: true,
        glyph: '.',
        description: '',
      };
      registerTileDefinition(woodenPlanks);
      map.setTile(5, 5, woodenPlanks);
      // (5, 5) is inside Olaf's General Store (3, 2 to 16, 9)
      const status = formatGroundStatus(engine, 5, 5);
      expect(status.standingText).toBe("📍 Olaf's General Store");
    });

    it('formats actionable stair prompts for stairs down and up', () => {
      engine.currentFloor = 1;
      map.setTile(5, 5, TILES.STAIRS_DOWN);
      let status = formatGroundStatus(engine, 5, 5);
      expect(status.promptText).toContain('Stairs Down — Press [>] or [Enter] to descend');

      map.setTile(5, 5, TILES.STAIRS_UP);
      status = formatGroundStatus(engine, 5, 5);
      expect(status.promptText).toContain('Stairs Up — Press [<] or [Enter] to ascend');
    });

    it('formats door prompts for open and closed doors', () => {
      map.setTile(5, 5, TILES.DOOR_CLOSED);
      let status = formatGroundStatus(engine, 5, 5);
      expect(status.promptText).toContain('Closed Door — Bump or press [C] to open');

      map.setTile(5, 5, TILES.DOOR_OPEN);
      status = formatGroundStatus(engine, 5, 5);
      expect(status.promptText).toContain('Open Doorway — Press [C] to close');
    });

    it('formats ground items standing readout', () => {
      map.setTile(5, 5, TILES.FLOOR);
      const potion = new Item({
        id: 'hp-pot-1',
        name: 'Health Potion',
        category: 'potion',
        weight: 5,
        bulk: 2,
        value: 20,
        quantity: 3,
      });
      map.addItemAt(5, 5, potion);

      const status = formatGroundStatus(engine, 5, 5);
      expect(status.detailText).toContain('Floor: Health Potion (3x)');
      expect(status.promptText).toContain('[G] Pickup');
    });
  });

  describe('Spellbook tab input handling', () => {
    /** The tab on a stub container, as the character menu shows it. */
    const openSpellbook = (options: ConstructorParameters<typeof SpellbookTab>[0] = {}): SpellbookTab => {
      const tab = new SpellbookTab(options);
      tab.mount({ innerHTML: '', querySelector: () => null, querySelectorAll: () => [] } as unknown as HTMLElement);
      tab.onActivate({ engine, worldState: engine.worldState, player, map: engine.map, currentFloor: engine.currentFloor, turnCount: engine.turnCount, manifest: engine.manifest });
      return tab;
    };

    it('leaves Escape, Tab and the menu tab keys to the shell', () => {
      const tab = openSpellbook();
      for (const code of ['Escape', 'Tab', 'KeyI', 'KeyZ', 'KeyB']) {
        expect(tab.handleKeyDown(new KeyboardEvent('keydown', { code }))).toBe(false);
      }
    });

    it('assigns spells to quickbar slots on Digit1-0 without freezing or locking input', () => {
      let quickSpellsChanged = false;
      const tab = openSpellbook({ onQuickSpellsChanged: () => { quickSpellsChanged = true; } });
      expect(player.quickSpells[0]).toBeNull();

      // Press Digit1 to assign selected spell (magic_arrow) to slot 0
      const d1Event = new KeyboardEvent('keydown', { code: 'Digit1', key: '1' });
      expect(tab.handleKeyDown(d1Event)).toBe(true);
      expect(quickSpellsChanged).toBe(true);
      expect(player.quickSpells[0]).toBe('magic_arrow');

      // Toggle off when pressing Digit1 again
      tab.handleKeyDown(d1Event);
      expect(player.quickSpells[0]).toBeNull();
    });

    it('does not intercept directional numpad keys as slots (Numpad1-9)', () => {
      const tab = openSpellbook();
      tab.handleKeyDown(new KeyboardEvent('keydown', { code: 'Numpad8', key: '8' }));
      expect(player.quickSpells.every((s) => s === null)).toBe(true);
    });
  });

  describe('TargetingOverlay integration & reticle movement', () => {
    it('moves reticle on arrow and numpad keys and cancels on Escape', () => {
      let overlayClosed = false;
      const overlay = new TargetingOverlay();
      overlay.onClose = () => {
        overlayClosed = true;
        modalStack.remove('targeting');
      };

      const spellDef = testManifest.spells.find((s) => s.id === 'magic_arrow')!;
      overlay.startTargeting(
        {
          key: '1',
          type: 'spell',
          id: spellDef.id,
          name: spellDef.name,
          spellDef,
        },
        engine
      );

      modalStack.push(overlay);
      expect(overlay.isOpen).toBe(true);
      expect(overlay.mode).toBe('reticle');

      const initialX = overlay.reticleX;
      const initialY = overlay.reticleY;

      // Move reticle right
      const rightEvent = new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight' });
      const handledRight = overlay.handleKeyDown(rightEvent, engine);
      expect(handledRight).toBe(true);
      expect(overlay.reticleX).toBe(initialX + 1);
      expect(overlay.reticleY).toBe(initialY);

      // Move reticle down using Numpad2
      const downEvent = new KeyboardEvent('keydown', { code: 'Numpad2', key: '2' });
      const handledDown = overlay.handleKeyDown(downEvent, engine);
      expect(handledDown).toBe(true);
      expect(overlay.reticleY).toBe(initialY + 1);

      // Cancel with Escape
      const escEvent = new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' });
      const handledEsc = overlay.handleKeyDown(escEvent, engine);
      expect(handledEsc).toBe(true);
      expect(overlay.isOpen).toBe(false);
      expect(overlayClosed).toBe(true);
      expect(modalStack.isEmpty()).toBe(true);
    });

    it('hands off cleanly from the Spellbook tab to the TargetingOverlay', () => {
      const targetingOverlay = new TargetingOverlay();
      const menu = { id: 'character-menu', isOpen: true, handleKeyDown: () => true, close: () => {} };
      modalStack.push(menu);

      const tab = new SpellbookTab({
        onCastSpell: (spell: SpellDefinition) => {
          modalStack.remove('character-menu');
          targetingOverlay.startTargeting({ key: '1', type: 'spell', id: spell.id, name: spell.name, spellDef: spell }, engine);
          modalStack.push(targetingOverlay);
        },
      });
      tab.mount({ innerHTML: '', querySelector: () => null, querySelectorAll: () => [] } as unknown as HTMLElement);
      tab.onActivate({ engine, worldState: engine.worldState, player, map: engine.map, currentFloor: engine.currentFloor, turnCount: engine.turnCount, manifest: engine.manifest });

      // Enter casts
      expect(tab.handleKeyDown(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter' }))).toBe(true);
      expect(targetingOverlay.isOpen).toBe(true);
      expect(modalStack.top()?.id).toBe('targeting');
      expect(modalStack.size).toBe(1);

      // Cancel targeting
      targetingOverlay.handleKeyDown(new KeyboardEvent('keydown', { code: 'Escape' }), engine);
      modalStack.remove('targeting');
      expect(modalStack.isEmpty()).toBe(true);
    });
  });
});
