import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TownReturnModal } from '../townReturnModal';
import { GameEngine } from '../../engine';
import { Player } from '../../engine';
import { GameMap } from '../../engine';
import { TILES } from '../../engine';

class MockElement {
  public id: string = '';
  public style: Record<string, string> = {};
  public innerHTML: string = '';
  public eventListeners: Map<string, Set<() => void>> = new Map();

  addEventListener(type: string, listener: () => void) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: () => void) {
    this.eventListeners.get(type)?.delete(listener);
  }

  click() {
    const listeners = this.eventListeners.get('click');
    if (listeners) {
      for (const listener of Array.from(listeners)) {
        listener();
      }
    }
  }
}

class MockDocument {
  public elements: Map<string, MockElement> = new Map();
  public body = {
    appendChild: (el: MockElement) => {
      if (el.id) this.elements.set(el.id, el);
    },
  };

  getElementById(id: string): MockElement | null {
    if (this.elements.has(id)) {
      return this.elements.get(id)!;
    }
    // Check if element is referenced inside an innerHTML string of an existing element
    for (const el of this.elements.values()) {
      if (el.innerHTML.includes(`id="${id}"`)) {
        const child = new MockElement();
        child.id = id;
        this.elements.set(id, child);
        return child;
      }
    }
    return null;
  }

  createElement(_tag: string): MockElement {
    return new MockElement();
  }
}

describe('TownReturnModal First-Encounter Tutorial & Confirmation', () => {
  let mockDoc: MockDocument;
  let originalDocument: any;
  let engine: GameEngine;
  let player: Player;

  beforeEach(() => {
    mockDoc = new MockDocument();
    originalDocument = (globalThis as any).document;
    (globalThis as any).document = mockDoc;

    const map = new GameMap(20, 20, TILES.FLOOR);
    player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 6, defense: 2 },
    });
    engine = new GameEngine({ map, player, floor: 5 });
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  it('renders rich tutorial modal on first encounter and sets flag on confirm', () => {
    const modal = new TownReturnModal();
    expect(player.tutorialFlags.conduitSeen).toBeFalsy();

    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    modal.open('runic_conduit', engine, onConfirm, onCancel);

    expect(modal.isOpen).toBe(true);
    const overlay = mockDoc.getElementById('town-return-modal-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.style.display).toBe('flex');
    expect(overlay?.innerHTML).toContain('Runic Leyline Conduit — Extraction Ritual');
    expect(overlay?.innerHTML).toContain('Shortcut Discovery & Advisory');
    expect(overlay?.innerHTML).toContain('3 charges accumulated');
    expect(overlay?.innerHTML).toContain('Destabilizes with violent magical backlash');

    // Confirm button click
    const confirmBtn = mockDoc.getElementById('btn-trmodal-confirm');
    expect(confirmBtn).not.toBeNull();
    confirmBtn?.click();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(player.tutorialFlags.conduitSeen).toBe(true);
    expect(modal.isOpen).toBe(false);
  });

  it('renders concise confirmation modal on subsequent encounters', () => {
    player.tutorialFlags.conduitSeen = true;

    const modal = new TownReturnModal();
    const onConfirm = vi.fn();

    modal.open('runic_conduit', engine, onConfirm);

    expect(modal.isOpen).toBe(true);
    const overlay = mockDoc.getElementById('town-return-modal-overlay');
    expect(overlay?.innerHTML).toContain('Confirmation');
    expect(overlay?.innerHTML).toContain('Activate Runic Leyline Conduit — Extraction Ritual?');
    // Does not re-render the lengthy advisory explanation
    expect(overlay?.innerHTML).not.toContain('Shortcut Discovery & Advisory');

    const confirmBtn = mockDoc.getElementById('btn-trmodal-confirm');
    confirmBtn?.click();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(modal.isOpen).toBe(false);
  });

  it('handles cancellation and sets seen flag to avoid nagging on re-inspection', () => {
    const modal = new TownReturnModal();
    expect(player.tutorialFlags.sprintSeen).toBeFalsy();

    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    modal.open('valkyrie_sprint', engine, onConfirm, onCancel);
    expect(modal.isOpen).toBe(true);

    const cancelBtn = mockDoc.getElementById('btn-trmodal-cancel');
    cancelBtn?.click();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(player.tutorialFlags.sprintSeen).toBe(true);
    expect(modal.isOpen).toBe(false);
  });

  it('supports all 4 fixture types (conduit, sprint, winch, portal)', () => {
    const fixtures: Array<'runic_conduit' | 'valkyrie_sprint' | 'dwarven_winch' | 'town_portal'> = [
      'runic_conduit',
      'valkyrie_sprint',
      'dwarven_winch',
      'town_portal',
    ];

    for (const fixture of fixtures) {
      const modal = new TownReturnModal();
      modal.open(fixture, engine, () => {});
      const overlay = mockDoc.getElementById('town-return-modal-overlay');
      expect(overlay?.innerHTML.length).toBeGreaterThan(50);
      modal.close();
    }
  });
});
