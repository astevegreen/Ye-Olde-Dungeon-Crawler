import type { ActionHook, EngineContext } from '../../engine';
import { NPC, getCounter, getFlag } from '../../engine';
import { COTW_TILES } from './tiles';
import { HOSTAGE_VILLAGERS } from './hostageRitual';
import { COTW_DEEPEST_FLOOR_COUNTER } from './spellTablets';
import { HEARTH_TEAR_RETURNED_FLAG } from './relic';
import { OATH_BROKEN_FLAG, OATH_HONORED_FLAG } from './oath';

/**
 * Bjarnarhaven changes to look at as Act 2 goes on (owner, 17 Oct: looks only). Each patch
 * below is due from a story flag or counter, and the town is laid as the due patches say,
 * in order, a later patch winning a cell an earlier one set: so a hero who stays away gets
 * every change due at once, and a save from before any of this gets them on its next turn
 * in town. A cell someone stands on, or with an item on it, waits for the next turn.
 *
 * - The Thaw, once the Hearth-Tear is home: the fountain runs, the market stall opens, and a
 *   carter comes over the pass with a second stall.
 * - The Roots, from floor 34 (as the townsfolk's talk, homecoming.ts): tremors crack the
 *   ground and overturn the hay cart, black sap wells up, roots break through the plaza, and
 *   the fountain runs dark.
 * - The Herald, once Víðnir falls: the carter packs up and goes, carts stand loaded by the
 *   east road, and the homecomers gather at the temple (homecoming.ts); a hero who heeded
 *   Víðnir finds Torvald's ward-stones round the plaza, one who defied him weapon racks.
 * - The altar and the oath: a memorial stone by the temple for each captive sacrificed, and
 *   a Sól brazier (oath broken) or a frost shrine to Thrym (oath honored) on the plaza.
 *
 * Every prop stands off the lanes' through-ways (townStages.test.ts walks them).
 */

interface Cell {
  x: number;
  y: number;
  type: string;
}

interface TownPatch {
  id: string;
  due: (engine: EngineContext) => boolean;
  cells: readonly Cell[];
}

const thawed = (e: EngineContext) => getFlag(e.worldState, HEARTH_TEAR_RETURNED_FLAG);
const rooted = (e: EngineContext) => getCounter(e.worldState, COTW_DEEPEST_FLOOR_COUNTER) >= 34;
const heraldSlain = (e: EngineContext) => getFlag(e.worldState, 'vidnir_slain');

const FOUNTAIN = [
  { x: 28, y: 18 },
  { x: 29, y: 18 },
  { x: 28, y: 19 },
  { x: 29, y: 19 },
];
const fountainAs = (type: string): Cell[] => FOUNTAIN.map((c) => ({ ...c, type }));

/** Round the plaza: Torvald's ward-stones for a hero who heeded Víðnir, weapon racks for one who defied him. */
const PLAZA_WATCH = [
  { x: 23, y: 15 },
  { x: 35, y: 15 },
  { x: 23, y: 21 },
  { x: 34, y: 21 },
];

/** West of the temple, one stone per captive in roster order. */
const MEMORIAL_STONES = [
  { x: 21, y: 27 },
  { x: 21, y: 28 },
  { x: 21, y: 29 },
  { x: 21, y: 30 },
];

/** North of the fountain, on the way to the cellar. */
const OATH_PLACE = { x: 29, y: 13 };

/** Where the carter keeps his stall, on the plaza's east side. */
const CARTER_STALL = { x: 35, y: 19 };
const CARTER_CART = { x: 37, y: 18 };
export const CARTER_POSITION = { x: 36, y: 19 };
export const CARTER_ID = 'npc-ketil';

export const TOWN_PATCHES: readonly TownPatch[] = [
  {
    id: 'thaw',
    due: thawed,
    cells: [
      ...fountainAs('town_fountain_thawed'),
      { x: 22, y: 19, type: 'town_stall_open' },
      { ...CARTER_STALL, type: 'town_stall_open' },
      { ...CARTER_CART, type: 'town_goods_cart' },
      { x: 36, y: 20, type: 'town_barrels' },
    ],
  },
  {
    id: 'roots',
    due: rooted,
    cells: [
      { x: 36, y: 13, type: 'town_toppled_cart' },
      { x: 20, y: 18, type: 'town_tremor_crack' },
      { x: 24, y: 22, type: 'town_tremor_crack' },
      { x: 33, y: 22, type: 'town_tremor_crack' },
      { x: 27, y: 25, type: 'town_black_sap' },
      { x: 29, y: 25, type: 'town_black_sap' },
      { x: 29, y: 7, type: 'town_black_sap' },
      { x: 27, y: 20, type: 'town_world_roots' },
      { x: 30, y: 17, type: 'town_world_roots' },
    ],
  },
  // The fountain only runs dark once it runs at all.
  { id: 'roots-fountain', due: (e) => thawed(e) && rooted(e), cells: fountainAs('town_fountain_sapped') },
  {
    id: 'herald',
    due: heraldSlain,
    cells: [
      { ...CARTER_STALL, type: 'town_market_stall' },
      { ...CARTER_CART, type: 'town_laden_cart' },
      { x: 48, y: 14, type: 'town_laden_cart' },
      { x: 50, y: 14, type: 'town_laden_cart' },
      { x: 48, y: 18, type: 'town_laden_cart' },
    ],
  },
  {
    id: 'herald-heeded',
    due: (e) => heraldSlain(e) && getFlag(e.worldState, 'vidnir_warning_heeded'),
    cells: PLAZA_WATCH.map((c) => ({ ...c, type: 'town_ward_stone' })),
  },
  {
    id: 'herald-defied',
    due: (e) => heraldSlain(e) && getFlag(e.worldState, 'vidnir_warning_defied'),
    cells: PLAZA_WATCH.map((c) => ({ ...c, type: 'town_weapon_rack' })),
  },
  ...HOSTAGE_VILLAGERS.map((captive, i) => ({
    id: `memorial-${i + 1}`,
    due: (e: EngineContext) => getFlag(e.worldState, `${captive.id}_sacrificed`),
    cells: [{ ...MEMORIAL_STONES[i], type: 'town_memorial_stone' }],
  })),
  { id: 'oath-broken', due: (e) => getFlag(e.worldState, OATH_BROKEN_FLAG), cells: [{ ...OATH_PLACE, type: 'town_sol_brazier' }] },
  { id: 'oath-honored', due: (e) => getFlag(e.worldState, OATH_HONORED_FLAG), cells: [{ ...OATH_PLACE, type: 'town_thrym_shrine' }] },
];

/** Each cell as the due patches leave it: the last due patch to name a cell wins it. */
function townStageCells(engine: EngineContext): Map<string, Cell> {
  const out = new Map<string, Cell>();
  for (const patch of TOWN_PATCHES) {
    if (!patch.due(engine)) continue;
    for (const cell of patch.cells) out.set(`${cell.x},${cell.y}`, cell);
  }
  return out;
}

const CARTER_LINES = {
  thaw: {
    greeting: 'First cart over the pass since the cold came!',
    says: 'Salt fish and fjord-wool for Olaf, and I go home with his tar and candles. The pass was ice to the axle a month ago. Whatever you did down there, the whole valley owes you.',
  },
  roots: {
    greeting: 'The ground threw your hay cart over last night.',
    says: 'Mine nearly went with it. The ponies will not settle, and there is black muck in the ruts that eats the axle-grease. One more load, and then I am done with this valley till it stops shaking.',
  },
};

/** The carter is in town from the Thaw until the Herald falls, and says what the ground is doing. */
function placeCarter(engine: EngineContext): void {
  const here = engine.map.getEntityById(CARTER_ID) as NPC | null;
  const due = thawed(engine) && !heraldSlain(engine);
  if (!due) {
    if (here) {
      engine.removeEntity(here);
      engine.log('Ketil the Carter has packed his cart and gone back over the pass.');
    }
    return;
  }
  const line = rooted(engine) ? CARTER_LINES.roots : CARTER_LINES.thaw;
  if (here) {
    if (here.greeting !== line.greeting) here.setDialogue(line.greeting, line.says);
    return;
  }
  if (engine.map.getEntityAt(CARTER_POSITION.x, CARTER_POSITION.y)) return;
  engine.map.addEntity(
    new NPC({
      id: CARTER_ID,
      name: 'Ketil the Carter',
      role: 'villager',
      position: CARTER_POSITION,
      spriteKey: CARTER_ID,
      greeting: line.greeting,
      dialogText: line.says,
    })
  );
  engine.log('A carter has come over the pass with the thaw, and set up a stall on the plaza.');
}

/** Lays the town as the story stands, a cell at a time, and seats or sends off the carter. */
export function applyTownStages(engine: EngineContext): void {
  if (engine.currentFloor !== 0) return;
  const map = engine.map;
  for (const cell of townStageCells(engine).values()) {
    const here = map.getTile(cell.x, cell.y);
    if (!here || here.type === cell.type) continue;
    if (map.getEntityAt(cell.x, cell.y) || map.getItemsAt(cell.x, cell.y).length > 0) continue;
    const tile = COTW_TILES.find((t) => t.type === cell.type);
    if (tile) map.setTile(cell.x, cell.y, tile);
  }
  placeCarter(engine);
}

export const COTW_TOWN_STAGES_HOOK: ActionHook = {
  id: 'cotw-town-stages',
  phase: 'post',
  actionType: '*',
  execute: ({ actor, engine }) => {
    if (actor !== engine.player) return;
    applyTownStages(engine);
  },
};
