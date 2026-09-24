import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GameEngine,
  GameMap,
  Player,
  TILES,
  flightRecorder,
  type CharacterProfile,
} from '../../engine';
import { FeedbackModal } from '../feedbackModal';
import { ModalStackManager } from '../modalStack';
import { cotwManifest } from '../../content/cotw';
import * as platform from '../platform';

class MockElement {
  public id = '';
  public className = '';
  public style: Record<string, string> = {};
  public _innerHTML = '';
  public textContent = '';
  public value = '';
  public checked = true;
  public placeholder = '';
  public attributes: Record<string, string> = {};
  public children: MockElement[] = [];
  public parentElement: MockElement | null = null;
  public eventListeners: Map<string, Set<(e?: any) => void>> = new Map();

  get innerHTML(): string {
    return this._innerHTML;
  }

  set innerHTML(val: string) {
    this._innerHTML = val;
    this.children = [];
    this.parseInnerElements(val);
  }

  private parseInnerElements(html: string): void {
    const tagRegex = /<([a-zA-Z0-9-]+)\s*([^>]*)>/g;
    let match;
    while ((match = tagRegex.exec(html)) !== null) {
      const attrString = match[2];
      const el = new MockElement();
      el.parentElement = this;

      const idMatch = /id="([^"]+)"/.exec(attrString);
      if (idMatch) {
        el.id = idMatch[1];
      }

      const classMatch = /class="([^"]+)"/.exec(attrString);
      if (classMatch) {
        el.className = classMatch[1];
      }

      this.children.push(el);
    }
  }

  focus(): void {}

  classList = {
    add: (...classes: string[]) => {
      for (const cls of classes) {
        if (!this.className.includes(cls)) {
          this.className = (this.className + ' ' + cls).trim();
        }
      }
    },
    remove: (...classes: string[]) => {
      for (const cls of classes) {
        this.className = this.className.replace(new RegExp(`\\b${cls}\\b`, 'g'), '').trim();
      }
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

  dispatchEvent(event: { type: string }): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      Array.from(listeners).forEach((l) => l(event));
    }
  }

  click(): void {
    this.dispatchEvent({ type: 'click' });
  }

  querySelector(selector: string): MockElement | null {
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return this.findChildById(id);
    }
    return this.children[0] ?? null;
  }

  public findChildById(id: string): MockElement | null {
    if (this.id === id) return this;
    for (const c of this.children) {
      const f = c.findChildById(id);
      if (f) return f;
    }
    return null;
  }
}

describe('FeedbackModal (Headless)', () => {
  let modal: FeedbackModal;
  let engine: GameEngine;
  let profile: CharacterProfile;
  let modalStack: ModalStackManager;
  let originalDocument: any;
  let elementMap: Map<string, MockElement>;

  let originalWindow: any;

  beforeEach(() => {
    flightRecorder.clear();

    elementMap = new Map();
    originalDocument = (globalThis as any).document;
    originalWindow = (globalThis as any).window;

    (globalThis as any).window = {
      open: vi.fn(),
      setTimeout: (fn: () => void) => fn(),
    };

    const mockDoc = {
      elements: elementMap,
      getElementById: (id: string) => {
        if (elementMap.has(id)) return elementMap.get(id);
        for (const root of elementMap.values()) {
          const found = root.findChildById(id);
          if (found) return found;
        }
        return null;
      },
      createElement: (_tag: string) => {
        return new MockElement();
      },
      body: {
        contains: () => true,
        appendChild: (el: MockElement) => {
          if (el.id) elementMap.set(el.id, el);
          const indexChildren = (node: MockElement) => {
            if (node.id) elementMap.set(node.id, node);
            node.children.forEach(indexChildren);
          };
          indexChildren(el);
        },
      },
    };

    (globalThis as any).document = mockDoc;

    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({
      id: 'p1',
      name: 'Ragnar',
      position: { x: 2, y: 2 },
      stats: { hp: 40, maxHp: 50, attack: 12, defense: 5 },
    });
    engine = new GameEngine({ map, player, manifest: cotwManifest });

    profile = {
      id: 'ragnar_save',
      name: 'Ragnar',
      gender: 'male',
      level: 1,
      floor: 1,
      lastSaved: Date.now(),
      hp: 40,
      maxHp: 50,
      strength: 14,
    };

    modalStack = new ModalStackManager();

    modal = new FeedbackModal({
      getEngine: () => engine,
      getProfile: () => profile,
      modalStack,
      repoUrl: 'https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler',
    });
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
    vi.restoreAllMocks();
  });

  it('initializes and renders retro modal markup', () => {
    const el = (globalThis as any).document.getElementById('feedback-modal');
    expect(el).not.toBeNull();
    expect(el?.querySelector('#btn-feedback-tab-bug')).not.toBeNull();
    expect(el?.querySelector('#btn-feedback-tab-feature')).not.toBeNull();
    expect(el?.querySelector('#btn-feedback-submit')).not.toBeNull();
  });

  it('opens and registers with modal stack', () => {
    modal.open({ subject: 'Test Bug', description: 'Testing something broke' });
    expect(modal.isOpen).toBe(true);
    expect(modalStack.top()?.id).toBe('feedback-modal');

    const titleInput = (globalThis as any).document.getElementById('feedback-input-title') as MockElement;
    const descTextarea = (globalThis as any).document.getElementById('feedback-textarea-desc') as MockElement;

    expect(titleInput.value).toBe('Test Bug');
    expect(descTextarea.value).toBe('Testing something broke');
  });

  it('switches between bug and feature modes, toggling telemetry display', () => {
    modal.open();
    const telemetryPanel = (globalThis as any).document.getElementById('feedback-telemetry-panel') as MockElement;
    expect(telemetryPanel.style.display).toBe('block');

    modal.switchType('feature');
    expect(telemetryPanel.style.display).toBe('none');

    const descLabel = (globalThis as any).document.getElementById('feedback-desc-label');
    expect(descLabel?.textContent).toContain('Feature Proposal');

    modal.switchType('bug');
    expect(telemetryPanel.style.display).toBe('block');
  });

  it('handles Escape key to close modal and pop modal stack', () => {
    modal.open();
    expect(modal.isOpen).toBe(true);

    const escapeEvent = { key: 'Escape', preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
    const handled = modal.handleKeyDown(escapeEvent);

    expect(handled).toBe(true);
    expect(modal.isOpen).toBe(false);
    expect(modalStack.isEmpty()).toBe(true);
  });

  it('holds exactly one modal-stack entry while open', () => {
    modal.open();
    modal.open();
    expect(modalStack.getStackIds()).toEqual(['feedback-modal']);
    modal.close();
    expect(modalStack.isEmpty()).toBe(true);
  });

  // One input path: its own element's keydown listener, never a second window listener
  // alongside InputHandler's (which also routes to the stack top) — that pair delivered
  // every key to handleKeyDown twice.
  it('takes keys through its own element, once, without a window listener', () => {
    const addWindowListener = vi.fn();
    (globalThis as any).window.addEventListener = addWindowListener;
    const handleSpy = vi.spyOn(modal, 'handleKeyDown');
    modal.open();

    const el = (globalThis as any).document.getElementById('feedback-modal') as MockElement;
    const esc = { type: 'keydown', key: 'Escape', preventDefault: vi.fn(), stopPropagation: vi.fn() };
    el.dispatchEvent(esc);

    expect(addWindowListener).not.toHaveBeenCalledWith('keydown', expect.anything());
    expect(handleSpy).toHaveBeenCalledTimes(1);
    expect(esc.stopPropagation).toHaveBeenCalled();
    expect(modal.isOpen).toBe(false);
    expect(modalStack.isEmpty()).toBe(true);
  });

  it('submits once on Ctrl+Enter through its own element', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    modal.open();
    const el = (globalThis as any).document.getElementById('feedback-modal') as MockElement;
    el.dispatchEvent({ type: 'keydown', key: 'Enter', ctrlKey: true, preventDefault: vi.fn(), stopPropagation: vi.fn() } as any);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(modal.isOpen).toBe(false);
  });

  // The stack clears isOpen before it calls close(); the window must still hide.
  it('hides its window when the modal stack closes it', () => {
    const closed = vi.fn();
    modal = new FeedbackModal({ getEngine: () => engine, modalStack, onClosed: closed });
    modal.open();
    modalStack.closeAll();

    const el = (globalThis as any).document.getElementById('feedback-modal') as MockElement;
    expect(el.style.display).toBe('none');
    expect(modal.isOpen).toBe(false);
    expect(closed).toHaveBeenCalledTimes(1);

    modal.open();
    expect(el.style.display).toBe('flex');
    expect(modalStack.getStackIds()).toEqual(['feedback-modal']);
  });

  it('swallows typing keystrokes so game inputs do not bleed', () => {
    modal.open();
    const wKey = { key: 'w', preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
    const handled = modal.handleKeyDown(wKey);
    expect(handled).toBe(true);
    expect(wKey.stopPropagation).toHaveBeenCalled();
  });

  it('copies diagnostic bundle to clipboard on copyReport', async () => {
    const copySpy = vi.spyOn(platform, 'copyTextToClipboard').mockResolvedValue(true);
    modal.open({ subject: 'Combat glitch' });

    flightRecorder.recordInput('ArrowUp', 'Move');
    await modal.copyReport();

    expect(copySpy).toHaveBeenCalledOnce();
    const copiedText = copySpy.mock.calls[0][0];
    const parsed = JSON.parse(copiedText);

    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.manifestId).toBe('cotw');
    expect(parsed.summary).toContain('Ragnar');
  });

  it('triggers file download on downloadReport', () => {
    const downloadSpy = vi.spyOn(platform.defaultPlatformAdapter, 'triggerFileDownload').mockImplementation(() => {});
    modal.open({ subject: 'Inventory overflow' });

    modal.downloadReport();
    expect(downloadSpy).toHaveBeenCalledOnce();
    expect(downloadSpy.mock.calls[0][0]).toMatch(/^yodc-bug-\d+\.json$/);
  });

  it('builds GitHub issue URL and opens window on submitToGitHub with category labels and path sanitization', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const copySpy = vi.spyOn(platform, 'copyTextToClipboard').mockResolvedValue(true);

    modal.open({
      subject: 'Critical freeze on stairs',
      category: 'Crash / Freeze',
      description: 'Crashed in file:///C:/Users/Alice/secret/project/main.ts on floor 1',
    });
    modal.submitToGitHub();

    expect(copySpy).toHaveBeenCalledOnce();
    expect(openSpy).toHaveBeenCalledOnce();

    const openedUrl = openSpy.mock.calls[0][0] as string;
    expect(openedUrl).toContain('https://github.com/astevegreen/Ye-Olde-Dungeon-Crawler/issues/new');
    expect(openedUrl).toContain('Critical+freeze+on+stairs');
    expect(openedUrl).toContain('labels=bug%2Ccrash');
    expect(openedUrl).toContain('%3Cuser-dir%3E');
    expect(openedUrl).not.toContain('Alice/secret');

    // Modal closes upon submit
    expect(modal.isOpen).toBe(false);
  });

  it('maps categories to appropriate GitHub labels for bug and feature modes', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(platform, 'copyTextToClipboard').mockResolvedValue(true);

    // Combat & Spells bug
    modal.open({ category: 'Combat & Spells', subject: 'Spell misfire' });
    modal.submitToGitHub();
    let url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain('labels=bug%2Carea%3Acombat%2Carea%3Amagic');

    // Feature request Quality of Life
    openSpy.mockClear();
    modal.open({ type: 'feature', category: 'Quality of Life', subject: 'Better mini-map' });
    modal.submitToGitHub();
    url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain('labels=enhancement%2Cquality-of-life');
  });
});
