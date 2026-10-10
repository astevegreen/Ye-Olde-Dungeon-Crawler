import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScreenBackdrop } from '../screenArt';
import type { ScreenBox, ScreenPainting, ScreenScene } from '../../engine';

// Under node: a stand-in window, document, canvas and host, enough for the backdrop to
// place its canvas, size it, and paint into it.
type Listener = () => void;

class MockCanvas {
  public className = '';
  public width = 0;
  public height = 0;
  public isConnected = true;
  public style: Record<string, string> = {};
  public attrs: Record<string, string> = {};
  public puts = 0;
  setAttribute(k: string, v: string): void {
    this.attrs[k] = v;
  }
  remove(): void {
    this.isConnected = false;
  }
  getContext() {
    return {
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: () => {
        this.puts++;
      },
    };
  }
}

class MockHost {
  public firstChild: unknown = null;
  public classes = new Set<string>();
  public vars: Record<string, string> = {};
  public style = {
    display: '',
    setProperty: (k: string, v: string) => {
      this.vars[k] = v;
    },
  };
  public classList = {
    add: (...c: string[]) => c.forEach((x) => this.classes.add(x)),
    remove: (...c: string[]) => c.forEach((x) => this.classes.delete(x)),
    toggle: (c: string, on: boolean) => (on ? this.classes.add(c) : this.classes.delete(c)),
  };
  prepend(el: unknown): void {
    this.firstChild = el;
  }
}

// A painting a quarter of the window, shown at 2x, whose calm box is `calmW` wide.
function scene(calmW: number) {
  const opened: string[] = [];
  const painted: number[] = [];
  const s: ScreenScene = {
    loopMs: 4000,
    open: (w, h): ScreenPainting => {
      opened.push(`${w}x${h}`);
      const width = Math.ceil(w / 2);
      const height = Math.ceil(h / 2);
      const text: ScreenBox = { x: 40, y: 30, w: 300, h: 90 };
      return {
        width,
        height,
        scale: 2,
        text,
        calm: { x: 80, y: 200, w: calmW, h: 400 },
        paint: (t) => {
          painted.push(t);
          return new Uint8ClampedArray(width * height * 4);
        },
      };
    },
  };
  return { s, opened, painted };
}

describe('ScreenBackdrop', () => {
  const saved: Record<string, unknown> = {};
  let listeners: Record<string, Listener[]>;
  let frames: Array<(now: number) => void>;
  let canvases: MockCanvas[];
  const g = globalThis as Record<string, unknown>;

  beforeEach(() => {
    for (const k of ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame']) saved[k] = g[k];
    listeners = {};
    frames = [];
    canvases = [];
    g.window = {
      innerWidth: 1366,
      innerHeight: 768,
      addEventListener: (t: string, fn: Listener) => (listeners[t] ??= []).push(fn),
      removeEventListener: (t: string, fn: Listener) => (listeners[t] = (listeners[t] ?? []).filter((l) => l !== fn)),
    };
    g.document = { createElement: () => (canvases[canvases.length] = new MockCanvas()) };
    g.requestAnimationFrame = (fn: (now: number) => void) => frames.push(fn);
    g.cancelAnimationFrame = () => {};
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) g[k] = v;
  });

  const make = (motion: boolean, minPanel = 300) => {
    const host = new MockHost();
    const backdrop = new ScreenBackdrop(host as unknown as HTMLElement, { motion: () => motion, minPanel });
    return { host, backdrop };
  };

  it('leaves the host as it was when the pack paints no screen', () => {
    const { host, backdrop } = make(true);
    backdrop.show(undefined);
    backdrop.hide();
    expect(canvases).toHaveLength(0);
    expect(host.classes.size).toBe(0);
  });

  it('puts the painting behind the panel, scaled up whole, and moves the panel into its calm box', () => {
    const { host, backdrop } = make(false);
    const { s, opened } = scene(420);
    backdrop.show(s);
    const canvas = canvases[0];
    expect(host.firstChild).toBe(canvas);
    expect(canvas.className).toBe('screen-art');
    expect(canvas.attrs['aria-hidden']).toBe('true');
    expect(opened).toEqual(['1366x768']);
    expect([canvas.width, canvas.height]).toEqual([683, 384]);
    expect([canvas.style.width, canvas.style.height]).toEqual(['1366px', '768px']);
    expect([...host.classes].sort()).toEqual(['has-screen-art', 'is-calm']);
    expect(host.vars).toMatchObject({ '--calm-x': '80px', '--calm-y': '200px', '--calm-w': '420px', '--calm-h': '400px', '--art-text-bottom': '120px' });
  });

  it('leaves the panel centred when the calm box is narrower than it', () => {
    const { host, backdrop } = make(false, 480);
    backdrop.show(scene(420).s);
    expect(host.classes.has('has-screen-art')).toBe(true);
    expect(host.classes.has('is-calm')).toBe(false);
  });

  it('holds the first frame still under Reduce motion', () => {
    const { backdrop } = make(false);
    const { s, painted } = scene(420);
    backdrop.show(s);
    expect(painted).toEqual([0]);
    expect(canvases[0].puts).toBe(1);
    expect(frames).toHaveLength(0);
  });

  it('plays its loop, and stops once its host hides', () => {
    const { host, backdrop } = make(true);
    const { s, painted } = scene(420);
    backdrop.show(s);
    expect(frames).toHaveLength(1);
    frames.shift()!(1000);
    frames.shift()!(1010);
    frames.shift()!(1050);
    expect(painted).toHaveLength(3);
    host.style.display = 'none';
    frames.shift()!(2000);
    expect(frames).toHaveLength(0);
    expect(painted).toHaveLength(3);
  });

  it('paints again at the new size when the window resizes', () => {
    const { backdrop } = make(false);
    const { s, opened } = scene(420);
    backdrop.show(s);
    (g.window as { innerWidth: number }).innerWidth = 800;
    for (const fn of listeners.resize ?? []) fn();
    expect(opened).toEqual(['1366x768', '800x768']);
    expect(canvases[0].width).toBe(400);
  });

  it('takes the painting away on hide', () => {
    const { host, backdrop } = make(true);
    backdrop.show(scene(420).s);
    backdrop.hide();
    expect(canvases[0].isConnected).toBe(false);
    expect(host.classes.size).toBe(0);
    expect(listeners.resize).toEqual([]);
  });
});
