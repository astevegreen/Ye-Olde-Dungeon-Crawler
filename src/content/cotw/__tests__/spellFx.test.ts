import { describe, expect, it } from 'vitest';
import type { FxGradient, FxSurface, SpellFxArt } from '../../../engine';
import { COTW_SPELL_FX } from '../fx';

// ------------------------------------------------------------ a recording surface

class RecordedGradient implements FxGradient {
  constructor(
    readonly id: number,
    private readonly log: unknown[][],
    private readonly bad: () => void,
  ) {}
  addColorStop(offset: number, color: string): void {
    if (!Number.isFinite(offset)) this.bad();
    this.log.push(['stop', this.id, offset, color]);
  }
}

/**
 * Stands in for the renderer's shared context: records every call and every property set, keeps
 * the save/restore stack as a real context does, and counts anything the art does that a real
 * context would silently swallow (a non-finite number, a restore with nothing saved).
 */
class RecordingSurface implements FxSurface {
  readonly log: unknown[][] = [];
  depth = 0;
  underflows = 0;
  fillRects = 0;
  nonFinite = 0;
  private fill: string | FxGradient = '#000000';
  private alpha: number;
  private composite: string;
  private readonly stack: Array<{ fill: string | FxGradient; alpha: number; composite: string }> = [];
  private gradients = 0;

  constructor(alpha = 1, composite = 'source-over') {
    this.alpha = alpha;
    this.composite = composite;
  }

  get fillStyle(): string | FxGradient {
    return this.fill;
  }
  set fillStyle(v: string | FxGradient) {
    this.fill = v;
    this.log.push(['fillStyle', v instanceof RecordedGradient ? `gradient ${v.id}` : v]);
  }
  get globalAlpha(): number {
    return this.alpha;
  }
  set globalAlpha(v: number) {
    if (!Number.isFinite(v)) this.nonFinite++;
    this.alpha = v;
    this.log.push(['globalAlpha', v]);
  }
  get globalCompositeOperation(): string {
    return this.composite;
  }
  set globalCompositeOperation(v: string) {
    this.composite = v;
    this.log.push(['globalCompositeOperation', v]);
  }

  private finite(...n: number[]): void {
    for (const v of n) if (!Number.isFinite(v)) this.nonFinite++;
  }

  save(): void {
    this.stack.push({ fill: this.fill, alpha: this.alpha, composite: this.composite });
    this.depth++;
    this.log.push(['save']);
  }
  restore(): void {
    const s = this.stack.pop();
    if (s) {
      this.fill = s.fill;
      this.alpha = s.alpha;
      this.composite = s.composite;
      this.depth--;
    } else this.underflows++;
    this.log.push(['restore']);
  }
  translate(x: number, y: number): void {
    this.finite(x, y);
    this.log.push(['translate', x, y]);
  }
  scale(x: number, y: number): void {
    this.finite(x, y);
    this.log.push(['scale', x, y]);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.finite(x, y, w, h);
    this.fillRects++;
    this.log.push(['fillRect', x, y, w, h]);
  }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): FxGradient {
    this.finite(x0, y0, r0, x1, y1, r1);
    const id = this.gradients++;
    this.log.push(['createRadialGradient', id, x0, y0, r0, x1, y1, r1]);
    return new RecordedGradient(id, this.log, () => this.nonFinite++);
  }
}

// ------------------------------------------------------------ what to draw, and where

const PROGRESS = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
const TILE_SIZES = [32, 48];

/** One placement of an effect: a name for failure messages, and the draw at progress p. */
interface Placement {
  label: string;
  draw(ctx: FxSurface, p: number): void;
}

interface Subject {
  name: string;
  placements(cs: number): Placement[];
}

/** Bolts in tile units, centre to centre: across, both diagonals, up, a hop, and no distance at all. */
const BOLTS: ReadonlyArray<readonly [string, number, number, number, number]> = [
  ['horizontal', 1.5, 1.5, 5.5, 1.5],
  ['diagonal', 1.5, 1.5, 6.5, 4.5],
  ['backwards diagonal', 7.5, 5.5, 2.5, 1.5],
  ['vertical', 3.5, 6.5, 3.5, 1.5],
  ['one tile', 3.5, 3.5, 4.5, 3.5],
  ['zero length', 3.5, 3.5, 3.5, 3.5],
];
/** Impact points in tile units: mid-map, the map's corner, deep in a big map, the origin itself. */
const SPOTS: ReadonlyArray<readonly [string, number, number]> = [
  ['mid-map', 4.5, 3.5],
  ['corner', 0.5, 0.5],
  ['far', 40.5, 25.5],
  ['origin', 0, 0],
];
/** Attacker to target: along an axis, up, down-left, and the zero vector. */
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, -1],
  [-1, 1],
  [0, 0],
];

type BoltDraw = NonNullable<SpellFxArt['bolt']>;
type SpotDraw = NonNullable<SpellFxArt['impact']>;
type MeleeDraw = (ctx: FxSurface, x: number, y: number, p: number, cs: number, dir: readonly [number, number]) => void;

const boltSubject = (name: string, bolt: BoltDraw): Subject => ({
  name,
  placements: (cs) =>
    BOLTS.map(([label, ax, ay, bx, by]) => ({
      label,
      draw: (ctx, p) => bolt(ctx, ax * cs, ay * cs, bx * cs, by * cs, p, cs),
    })),
});
const spotSubject = (name: string, draw: SpotDraw): Subject => ({
  name,
  placements: (cs) => SPOTS.map(([label, x, y]) => ({ label, draw: (ctx, p) => draw(ctx, x * cs, y * cs, p, cs) })),
});
const meleeSubject = (name: string, draw: MeleeDraw): Subject => ({
  name,
  placements: (cs) =>
    SPOTS.flatMap(([label, x, y]) => DIRS.map((dir) => ({ label: `${label}, dir ${dir.join(',')}`, draw: (ctx: FxSurface, p: number) => draw(ctx, x * cs, y * cs, p, cs, dir) }))),
});

/** The distinct arts, each with every key that reaches it. */
const arts = new Map<SpellFxArt, string[]>();
for (const [key, art] of Object.entries(COTW_SPELL_FX.elements)) arts.set(art, [...(arts.get(art) ?? []), key]);

const subjects: Subject[] = [];
for (const [art, keys] of arts) {
  const label = keys.join('/');
  if (art.bolt) subjects.push(boltSubject(`${label} bolt`, art.bolt));
  if (art.impact) subjects.push(spotSubject(`${label} impact`, art.impact));
  if (art.self) subjects.push(spotSubject(`${label} self`, art.self));
}
const melee = COTW_SPELL_FX.melee;
if (melee) {
  subjects.push(meleeSubject('melee hit', melee.hit));
  subjects.push(meleeSubject('melee crit', melee.crit));
  subjects.push(meleeSubject('melee miss', melee.miss));
}

// ------------------------------------------------------------ running a subject

interface Outcome {
  /** Tile size and placement: the unit an effect has to draw something in. */
  group: string;
  where: string;
  error?: unknown;
  log: string;
  surface: RecordingSurface;
}

function* everyCall(subject: Subject, alpha = 1, composite = 'source-over'): Generator<Outcome> {
  for (const cs of TILE_SIZES) {
    for (const placement of subject.placements(cs)) {
      for (const p of PROGRESS) {
        const surface = new RecordingSurface(alpha, composite);
        const group = `cs ${cs}, ${placement.label}`;
        let error: unknown;
        try {
          placement.draw(surface, p);
        } catch (e) {
          error = e;
        }
        yield { group, where: `${group}, p ${p}`, error, log: JSON.stringify(surface.log), surface };
      }
    }
  }
}

// ------------------------------------------------------------ the catalog

describe('the cotw spell effects catalog', () => {
  const e = COTW_SPELL_FX.elements;

  it('answers to the engine’s element names and the art’s own, and has nothing for physical', () => {
    expect(Object.keys(e).sort()).toEqual(
      ['acid', 'arcane', 'blood', 'cold', 'drain', 'fire', 'frost', 'healing', 'holy', 'lightning', 'poison', 'shadow', 'unholy'].sort(),
    );
    expect(e.cold).toBe(e.frost);
    expect(e.acid).toBe(e.poison);
    expect(e.healing).toBe(e.holy);
    expect(e.unholy).toBe(e.shadow);
    expect(e.physical).toBeUndefined();
    // drain flies its own tether and lands as shadow does
    expect(e.drain).not.toBe(e.shadow);
    expect(e.drain.bolt).not.toBe(e.shadow.bolt);
    expect(e.drain.impact).toBe(e.shadow.impact);
    expect(new Set(arts.keys()).size).toBe(9);
  });

  it('keeps the bible’s natural lengths, and gives a self cast to arcane and holy only', () => {
    const lengths: Record<string, [number, number, number | undefined]> = {
      fire: [420, 760, undefined],
      frost: [460, 820, undefined],
      lightning: [340, 460, undefined],
      poison: [540, 900, undefined],
      arcane: [460, 820, 1000],
      holy: [420, 880, 1000],
      shadow: [500, 800, undefined],
      drain: [500, 800, undefined],
      blood: [520, 980, undefined],
    };
    for (const [key, [msBolt, msImpact, msSelf]] of Object.entries(lengths)) {
      expect(e[key].msBolt, key).toBe(msBolt);
      expect(e[key].msImpact, key).toBe(msImpact);
      expect(e[key].msSelf, key).toBe(msSelf);
      expect(e[key].self !== undefined, key).toBe(msSelf !== undefined);
      expect(typeof e[key].bolt, key).toBe('function');
      expect(typeof e[key].impact, key).toBe('function');
    }
  });

  it('has melee art with its three blows and a 300 ms life', () => {
    expect(COTW_SPELL_FX.melee?.ms).toBe(300);
    expect(typeof COTW_SPELL_FX.melee?.hit).toBe('function');
    expect(typeof COTW_SPELL_FX.melee?.crit).toBe('function');
    expect(typeof COTW_SPELL_FX.melee?.miss).toBe('function');
  });
});

// ------------------------------------------------------------ every draw

describe.each(subjects)('$name', (subject) => {
  it('runs at every progress, tile size and position without throwing', () => {
    for (const o of everyCall(subject)) expect(o.error, o.where).toBeUndefined();
  });

  it('draws something in every placement over its life', () => {
    const drawn = new Map<string, number>();
    for (const o of everyCall(subject)) drawn.set(o.group, (drawn.get(o.group) ?? 0) + o.surface.fillRects);
    for (const [group, rects] of drawn) expect(rects, group).toBeGreaterThan(0);
  });

  it('draws only finite numbers', () => {
    for (const o of everyCall(subject)) expect(o.surface.nonFinite, o.where).toBe(0);
  });

  it('is deterministic: the same inputs give the same calls', () => {
    const again = [...everyCall(subject)];
    const first = [...everyCall(subject)];
    expect(again.length).toBe(first.length);
    for (let i = 0; i < first.length; i++) expect(again[i].log, first[i].where).toBe(first[i].log);
  });

  it('balances every save with a restore', () => {
    for (const o of everyCall(subject)) {
      expect(o.surface.depth, o.where).toBe(0);
      expect(o.surface.underflows, o.where).toBe(0);
    }
  });

  it('hands the shared context back with its alpha and blend mode as it found them', () => {
    for (const [alpha, composite] of [
      [1, 'source-over'],
      [0.37, 'multiply'],
    ] as const) {
      for (const o of everyCall(subject, alpha, composite)) {
        expect(o.error, o.where).toBeUndefined();
        expect(o.surface.globalAlpha, `${o.where} (alpha ${alpha})`).toBe(alpha);
        expect(o.surface.globalCompositeOperation, `${o.where} (blend ${composite})`).toBe(composite);
      }
    }
  });
});

describe('melee direction', () => {
  const melee = COTW_SPELL_FX.melee;
  const logOf = (draw: MeleeDraw, dir: readonly [number, number]): string => {
    const surface = new RecordingSurface();
    draw(surface, 150, 120, 0.4, 32, dir);
    return JSON.stringify(surface.log);
  };

  it('reads a zero-length direction as pointing right', () => {
    expect(melee).toBeDefined();
    if (!melee) return;
    for (const draw of [melee.hit, melee.crit, melee.miss]) expect(logOf(draw, [0, 0])).toBe(logOf(draw, [1, 0]));
  });

  it('turns the swing with the direction, and ignores its scale', () => {
    expect(melee).toBeDefined();
    if (!melee) return;
    for (const draw of [melee.hit, melee.crit, melee.miss]) {
      expect(logOf(draw, [0, 1])).not.toBe(logOf(draw, [1, 0]));
      expect(logOf(draw, [0, 3])).toBe(logOf(draw, [0, 1]));
    }
  });
});
