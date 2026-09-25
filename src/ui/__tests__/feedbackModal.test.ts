import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GameEngine,
  GameMap,
  Player,
  TILES,
  WaitAction,
  ItemFactory,
  flightRecorder,
  loadReplayState,
  type CharacterProfile,
} from '../../engine';
import { FeedbackModal } from '../feedbackModal';
import { ModalStackManager } from '../modalStack';
import { cotwManifest } from '../../content/cotw';
import * as platform from '../platform';
import { expandCompressedReplay } from '../replayCodec';

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

  it('copies AI-ready markdown report to clipboard on copyReport, and JSON on copyReport("json")', async () => {
    const copySpy = vi.spyOn(platform, 'copyTextToClipboard').mockResolvedValue(true);
    modal.open({ subject: 'Combat glitch' });

    flightRecorder.recordInput('ArrowUp', 'Move');
    await modal.copyReport();

    expect(copySpy).toHaveBeenCalledTimes(1);
    const copiedText = copySpy.mock.calls[0][0];
    expect(copiedText).toContain('cotw');
    expect(copiedText).toContain('Ragnar');
    expect(copiedText).toContain('Combat glitch');
    expect(copiedText).toContain('Reproduction Context');

    // JSON format copy
    await modal.copyReport('json');
    expect(copySpy).toHaveBeenCalledTimes(2);
    const jsonText = copySpy.mock.calls[1][0];
    const parsed = JSON.parse(jsonText);
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.manifestId).toBe('cotw');
    expect(parsed.summary).toContain('Ragnar');
    expect(parsed.reproduction).toBeDefined();
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

  it('puts the reproduction essentials and a paste prompt in the issue body itself', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(platform, 'copyTextToClipboard').mockResolvedValue(true);
    engine.handlePlayerAction(new WaitAction(engine.player));

    modal.open({ category: 'Crash / Freeze', subject: 'Froze', error: new Error('boom at turn 1') });
    modal.submitToGitHub();

    const url = new URL(openSpy.mock.calls[0][0] as string);
    const body = url.searchParams.get('body') ?? '';
    expect(body).toContain('**Build**');
    expect(body).toContain('paste the copied report below this line');
    expect(body).toContain('boom at turn 1');
    expect(body).toContain('### Where');
    expect(body).toContain('WaitAction');
    expect(encodeURIComponent(body).length).toBeLessThanOrEqual(6000);
  });

  it('keeps the issue body and the pasted report inside GitHub limits for a huge description', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const copySpy = vi.spyOn(platform, 'copyTextToClipboard').mockResolvedValue(true);

    modal.open({ category: 'Other', subject: 'Long story', description: 'x'.repeat(70000) });
    modal.submitToGitHub();

    const body = new URL(openSpy.mock.calls[0][0] as string).searchParams.get('body') ?? '';
    expect(encodeURIComponent(body).length).toBeLessThanOrEqual(6000);
    expect((copySpy.mock.calls[0][0] as string).length).toBeLessThanOrEqual(55000);
  });

  it('leaves the log out when the log box is unticked (Visual & UI default)', async () => {
    const copySpy = vi.spyOn(platform, 'copyTextToClipboard').mockResolvedValue(true);
    flightRecorder.recordWarning('something visual');

    modal.open({ category: 'Visual & UI', subject: 'Overlap' });
    await modal.copyReport();

    const copied = copySpy.mock.calls[0][0] as string;
    expect(copied).toContain('Flight log not included');
    expect(copied).not.toContain('something visual');
  });

  it('compresses replay data into the pasted report when the readable version would not fit', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const copySpy = vi.spyOn(platform, 'copyTextToClipboard').mockResolvedValue(true);
    // Bloat the checkpoint past the paste budget with ground loot.
    for (let i = 0; i < 400; i++) engine.map.addItemAt(1 + (i % 8), 1 + Math.floor(i / 50), ItemFactory.createTorch(`bulk-torch-${i}`));
    engine.handlePlayerAction(new WaitAction(engine.player));
    engine.handlePlayerAction(new WaitAction(engine.player));

    modal.open({ category: 'Crash / Freeze', subject: 'Big world' });
    await modal.whenReplayCompressed();
    modal.submitToGitHub();

    expect(openSpy).toHaveBeenCalledOnce();
    const pasted = copySpy.mock.calls[0][0] as string;
    expect(pasted.length).toBeLessThanOrEqual(55000);
    expect(pasted).toContain('```replay-gz');

    const loaded = loadReplayState(await expandCompressedReplay(pasted), cotwManifest);
    expect(loaded.ok && loaded.value.source).toBe('replay-checkpoint');
    expect(loaded.ok && loaded.value.trail).toHaveLength(2);
  });

  it('offers the game-view screenshot taken when the window opened, and asks for one on visual bugs', () => {
    const shot = 'data:image/png;base64,AAAA';
    const withShot = new FeedbackModal({
      getEngine: () => engine,
      getProfile: () => profile,
      modalStack,
      captureScreenshot: () => shot,
    });
    const dl = vi.spyOn(platform, 'downloadDataUrl').mockImplementation(() => {});
    withShot.open({ category: 'Visual & UI', subject: 'Overlap' });
    withShot.saveScreenshot();
    expect(dl).toHaveBeenCalledWith(expect.stringMatching(/^yodc-screenshot-\d+\.png$/), shot);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(platform, 'copyTextToClipboard').mockResolvedValue(true);
    withShot.submitToGitHub();
    const body = new URL(openSpy.mock.calls[0][0] as string).searchParams.get('body') ?? '';
    expect(body).toContain('A screenshot matters most');
  });

  it('reports the build of a recovered session, not the running one', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(platform, 'copyTextToClipboard').mockResolvedValue(true);
    modal.open({ category: 'Crash / Freeze', subject: 'Froze', buildId: 'old1234', appVersion: '0.0.9' });
    modal.submitToGitHub();
    const body = new URL(openSpy.mock.calls[0][0] as string).searchParams.get('body') ?? '';
    expect(body).toContain('commit `old1234`');
  });

  describe('with a report relay', () => {
    function relayModal(): FeedbackModal {
      return new FeedbackModal({
        getEngine: () => engine,
        getProfile: () => profile,
        modalStack,
        relayUrl: 'https://relay.example.workers.dev/',
        captureScreenshot: () => 'data:image/png;base64,AAAA',
      });
    }

    it('sends the full report, screenshot and labels to the relay, with no paste prompt, and never opens GitHub', async () => {
      const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ ok: true, number: 12, url: 'u' }), { status: 201 }));
      vi.stubGlobal('fetch', fetchSpy);
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      engine.handlePlayerAction(new WaitAction(engine.player));

      const m = relayModal();
      m.open({ category: 'Crash / Freeze', subject: 'Froze' });
      m.submitToGitHub();
      await vi.waitFor(() => expect(m.isOpen).toBe(false));

      expect(openSpy).not.toHaveBeenCalled();
      const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe('https://relay.example.workers.dev/report');
      const payload = JSON.parse(String(init.body));
      expect(payload.type).toBe('bug');
      expect(payload.labels).toEqual(['bug', 'crash']);
      expect(payload.title).toBe('[Bug]: Froze');
      expect(payload.body).not.toContain('paste the copied report');
      expect(payload.report).toContain('## 5. Replay Data');
      expect(payload.screenshot).toBe('data:image/png;base64,AAAA');
      vi.unstubAllGlobals();
    });

    it('falls back to GitHub on the next press when the relay is unreachable', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      vi.spyOn(platform, 'copyTextToClipboard').mockResolvedValue(true);

      const m = relayModal();
      m.open({ category: 'Other', subject: 'Odd' });
      m.submitToGitHub();
      await vi.waitFor(() => expect((globalThis as any).document.getElementById('btn-feedback-submit')?.textContent).toContain('GitHub instead'));
      expect(m.isOpen).toBe(true);
      expect(openSpy).not.toHaveBeenCalled();

      m.submitToGitHub();
      expect(openSpy).toHaveBeenCalledOnce();
      vi.unstubAllGlobals();
    });
  });
});
