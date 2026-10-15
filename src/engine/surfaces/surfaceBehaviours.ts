import type { GameEngine } from '../engine';
import type { ElementType } from '../magic/elements';

/**
 * A hurt dealt by what covers a tile, through the victim's affinity (`Entity.takeElementalDamage`).
 * `line` is the log line, `{name}` the victim and `{n}` what it took; `cause` names it on the
 * death screen ("Slain by searing fire").
 */
export interface SurfaceHarm {
  amount: number;
  element: ElementType;
  cause: string;
  line: string;
}

/** One moment of a surface or gas: a hurt, a status, a log line (`{name}` the creature), in that order. */
export interface SurfaceMoment {
  harm?: SurfaceHarm;
  status?: { type: string; duration: number; potency?: number };
  line?: string;
}

/** What a ground surface or a gas does to the creatures in it (P-32). */
export interface SurfaceBehaviour {
  /** On stepping in: the moment, extra energy spent (`moveCost`), then a slide of `slide` tiles along the step. */
  enter?: SurfaceMoment & { moveCost?: number; slide?: number };
  /** Each turn spent inside, the last one included. */
  standing?: SurfaceMoment;
  /** A gas that hides what is inside and behind it. Stamped on the gas when laid (`SurfaceGrid.layGas`). */
  blocksSight?: boolean;
}

/** Behaviours by type; a pack's entry (`manifest.surfaceBehaviours`) replaces the built-in one of its name. */
export interface SurfaceBehaviourTable {
  surfaces?: Record<string, SurfaceBehaviour>;
  gases?: Record<string, SurfaceBehaviour>;
}

const BUILTIN_SURFACES: Record<string, SurfaceBehaviour> = {
  water: {},
  oil_slick: { enter: { line: '{name} treads carefully across the flammable oil slick.' } },
  acid_pool: {
    enter: { harm: { amount: 4, element: 'acid', cause: 'acid', line: '{name} wades into caustic acid for {n} acid damage!' } },
    standing: { harm: { amount: 3, element: 'acid', cause: 'acid', line: '{name} suffers {n} acid burn from the caustic pool.' } },
  },
  ice_sheet: { enter: { moveCost: 50, line: '{name} slips on the slick ice sheet!', slide: 2 } },
  mud: { enter: { moveCost: 50, line: '{name} struggles through thick, clinging mud!' } },
  fire: {
    enter: { harm: { amount: 4, element: 'fire', cause: 'searing fire', line: '{name} steps into searing fire for {n} fire damage!' } },
    standing: { harm: { amount: 3, element: 'fire', cause: 'lingering fire', line: '{name} is scorched by lingering fire for {n} damage.' } },
  },
};

const BUILTIN_GASES: Record<string, SurfaceBehaviour> = {
  fire_storm: {
    standing: { harm: { amount: 5, element: 'fire', cause: 'a firestorm', line: '{name} burns inside the raging FireStorm for {n} damage!' } },
  },
  poison_cloud: {
    standing: { status: { type: 'poison', duration: 3, potency: 2 }, line: '{name} chokes on noxious poison fumes!' },
  },
  dense_steam: { blocksSight: true },
};

/** The behaviour of a surface or gas type: the pack's, else the built-in one, else none. */
export function surfaceBehaviourOf(engine: GameEngine, layer: 'surface' | 'gas', type: string): SurfaceBehaviour | undefined {
  const table = engine.manifest?.surfaceBehaviours;
  if (layer === 'surface') return table?.surfaces?.[type] ?? BUILTIN_SURFACES[type];
  return table?.gases?.[type] ?? BUILTIN_GASES[type];
}

/** Whether a gas with no stamp of its own (`GasInstance.blocksSight`) blocks sight: the built-in rule. */
export function builtinGasBlocksSight(type: string): boolean {
  return BUILTIN_GASES[type]?.blocksSight === true;
}
