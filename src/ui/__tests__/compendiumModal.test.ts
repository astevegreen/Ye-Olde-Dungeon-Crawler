import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CompendiumModal } from '../help/compendiumModal';
import { GameEngine, GameMap, Player, MonsterRegistry } from '../../engine';

class MockElement {
  public id: string = '';
  public className: string = '';
  public style: Record<string, string> = {};
  public innerHTML: string = '';
  public attributes: Record<string, string> = {};
  public eventListeners: Map<string, Set<(e?: any) => void>> = new Map();

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  appendChild(el: MockElement): MockElement {
    if (el.id) {
      (globalThis as any).document?.elements?.set(el.id, el);
    }
    return el;
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
    const listeners = this.eventListeners.get('click');
    if (listeners) {
      listeners.forEach((fn) => fn({ currentTarget: this }));
    }
  }

  querySelector(selector: string): MockElement | null {
    const list = this.querySelectorAll(selector);
    return list.length > 0 ? list[0] : null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const matches: MockElement[] = [];
    if (selector.startsWith('#')) {
      const targetId = selector.slice(1);
      const regex = new RegExp(`<[^>]+id="${targetId}"[^>]*>`, 'g');
      let m;
      while ((m = regex.exec(this.innerHTML)) !== null) {
        matches.push(MockElement.fromTag(m[0]));
      }
    } else if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      const regex = new RegExp(`<[^>]+class="[^"]*${cls}[^"]*"[^>]*>`, 'g');
      let m;
      while ((m = regex.exec(this.innerHTML)) !== null) {
        matches.push(MockElement.fromTag(m[0]));
      }
    }
    return matches;
  }

  static fromTag(tagStr: string): MockElement {
    const el = new MockElement();
    const idMatch = tagStr.match(/id="([^"]+)"/);
    if (idMatch) el.id = idMatch[1];
    const classMatch = tagStr.match(/class="([^"]+)"/);
    if (classMatch) el.className = classMatch[1];
    const attrRegex = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
    let attr;
    while ((attr = attrRegex.exec(tagStr)) !== null) {
      el.setAttribute(attr[1], attr[2]);
    }
    return el;
  }
}

class MockDocument {
  public elements: Map<string, MockElement> = new Map();
  public body: MockElement = new MockElement();

  constructor() {
    const app = new MockElement();
    app.id = 'app';
    this.elements.set('app', app);
  }

  getElementById(id: string): MockElement | null {
    return this.elements.get(id) ?? null;
  }

  createElement(_tag: string): MockElement {
    return new MockElement();
  }
}

describe('CompendiumModal UI & Mastery Specializations', () => {
  let originalDocument: any;
  let mockDoc: MockDocument;

  beforeEach(() => {
    originalDocument = (globalThis as any).document;
    mockDoc = new MockDocument();
    (globalThis as any).document = mockDoc;
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  it('renders progress toward mastery for unmastered monster', () => {
    const map = new GameMap(10, 10);
    const player = new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 } });
    const engine = new GameEngine({ map, player });

    MonsterRegistry.register({
      id: 'kobold',
      name: 'Kobold Slinker',
      stats: { hp: 10, maxHp: 10, attack: 4, defense: 1 },
      speed: 100,
      aiType: 'melee',
      fleeHealthPercent: 0,
      xpValue: 10,
      lootTable: [],
    });

    engine.compendium.recordKill('kobold', 'Kobold Slinker');
    engine.compendium.recordKill('kobold', 'Kobold Slinker');

    const modal = new CompendiumModal();
    modal.open(engine);

    const overlay = mockDoc.getElementById('compendium-modal');
    expect(overlay).toBeDefined();
    expect(overlay?.innerHTML).toContain('2/5 Kills');
    expect(overlay?.innerHTML).toContain('SLAYER MASTERY PROGRESS');
    expect(overlay?.innerHTML).toContain('Anatomist');
    expect(overlay?.innerHTML).toContain('Survivor');
    expect(overlay?.innerHTML).toContain('Trophy Hunter');
    expect(overlay?.innerHTML).toContain('Essence Siphon');
    expect(overlay?.innerHTML).toContain('Plunderer');
  });

  it('renders all 5 specializations and allows selection in town', () => {
    const map = new GameMap(10, 10);
    const player = new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 } });
    // Floor 0 = Town
    const engine = new GameEngine({ map, player, floor: 0 });

    MonsterRegistry.register({
      id: 'giant_rat',
      name: 'Giant Rat',
      stats: { hp: 10, maxHp: 10, attack: 3, defense: 0 },
      speed: 100,
      aiType: 'melee',
      fleeHealthPercent: 0,
      xpValue: 5,
      lootTable: [],
    });

    for (let i = 0; i < 5; i++) {
      engine.compendium.recordKill('giant_rat', 'Giant Rat');
    }

    const modal = new CompendiumModal();
    modal.open(engine);

    const overlay = mockDoc.getElementById('compendium-modal');
    expect(overlay?.innerHTML).toContain('SLAYER MASTERY SPECIALIZATION');
    expect(overlay?.innerHTML).toContain('In Town: Study with Guild scholars');
    expect(overlay?.innerHTML).toContain('Anatomist');
    expect(overlay?.innerHTML).toContain('Survivor');
    expect(overlay?.innerHTML).toContain('Trophy Hunter');
    expect(overlay?.innerHTML).toContain('Essence Siphon');
    expect(overlay?.innerHTML).toContain('Plunderer');

    // Select Anatomist
    const selectRes = engine.compendium.selectPerk('giant_rat', 'anatomist', true);
    expect(selectRes.success).toBe(true);
    expect(engine.compendium.getPerk('giant_rat')).toBe('anatomist');

    modal.render();
    expect(overlay?.innerHTML).toContain('ACTIVE');

    // Respec in town to Essence Siphon
    const respecRes = engine.compendium.selectPerk('giant_rat', 'essence_siphon', true);
    expect(respecRes.success).toBe(true);
    expect(engine.compendium.getPerk('giant_rat')).toBe('essence_siphon');

    modal.render();
    expect(engine.compendium.getPerk('giant_rat')).toBe('essence_siphon');
  });

  it('locks respec while in dungeon after perk is chosen', () => {
    const map = new GameMap(10, 10);
    const player = new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 } });
    // Floor 1 = Dungeon
    const engine = new GameEngine({ map, player, floor: 1 });

    MonsterRegistry.register({
      id: 'giant_rat',
      name: 'Giant Rat',
      stats: { hp: 15, maxHp: 15, attack: 5, defense: 2 },
      speed: 100,
      aiType: 'melee',
      fleeHealthPercent: 0,
      xpValue: 15,
      lootTable: [],
    });

    for (let i = 0; i < 5; i++) {
      engine.compendium.recordKill('giant_rat', 'Giant Rat');
    }

    // In dungeon, initial perk selection is allowed
    const initialPick = engine.compendium.selectPerk('giant_rat', 'survivor', false);
    expect(initialPick.success).toBe(true);
    expect(engine.compendium.getPerk('giant_rat')).toBe('survivor');

    const modal = new CompendiumModal();
    modal.open(engine);

    const overlay = mockDoc.getElementById('compendium-modal');
    // Once survivor is chosen, switching in dungeon is locked
    expect(overlay?.innerHTML).toContain('Return to Town to respec');
    expect(overlay?.innerHTML).toContain('🔒 In Dungeon');

    // Trying to respec in dungeon fails
    const invalidRespec = engine.compendium.selectPerk('giant_rat', 'anatomist', false);
    expect(invalidRespec.success).toBe(false);
    expect(invalidRespec.reason).toContain('Town');
    expect(engine.compendium.getPerk('giant_rat')).toBe('survivor');
  });
});
