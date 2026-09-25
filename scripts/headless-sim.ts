import { GameEngine } from '../src/engine/engine';
import { GameMap } from '../src/engine/grid/map';
import { TILES } from '../src/engine/grid/tile';
import { Player } from '../src/engine/entities/player';
import { Monster } from '../src/engine/entities/monster';
import { MovementAction } from '../src/engine/actions/movement';
import { WaitAction } from '../src/engine/actions/wait';
import { CastSpellAction } from '../src/engine/actions/spell-actions';
import { DungeonArc } from '../src/engine/quest/dungeonArc';
import { cotwManifest } from '../src/content/cotw';
import { registerSpells } from '../src/engine/magic/spellRegistry';

// The spell workload casts CotW spells on a manifest-less engine, so register them up front.
registerSpells(cotwManifest.spells ?? []);

/**
 * Headless simulation gate & benchmark (`npm run sim`).
 *
 * 1. Anchors population sizes to real generated floors (not a hard-coded count).
 * 2. Benchmarks a dormant floor and an awake floor across those populations, with
 *    warmup and repeated samples, reporting median and max.
 * 3. Enforces wall-clock budgets on medians at realistic populations (budgets live here,
 *    not in `npm test`).
 * 4. Fails on any rejected action or any caught pipeline exception, including isolated
 *    monster-turn failures.
 *
 * `--inject-error` registers a throwing pre-hook to demonstrate that the gate fails.
 */

const SAMPLES = 5;
const DORMANT_TURNS = 1000;
const AWAKE_TURNS = 400;
const TURN_BUDGET_MS = 25;
const SPELL_CASTS = 1000;
const SPELL_BUDGET_MS = 200;
const ANCHOR_FLOORS = [1, 2, 3, 4, 5, 6];
const ANCHOR_SAMPLES_PER_FLOOR = 25;
const DENSITIES = [1.0, 1.5];
/** The awake arena is a real floor's size, so the stress population fits and pathing covers a real floor's area. */
const FLOOR = cotwManifest.floorSize ?? { width: 50, height: 35 };
const STRESS_MULTIPLIER = 5;
const INJECT_ERROR = process.argv.includes('--inject-error');

const failures: string[] = [];
let caughtPipelineErrors = 0;

const median = (values: number[]): number => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const quantile = (values: number[], q: number): number => {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
};
const livingMonsters = (engine: GameEngine): number =>
  engine.map.getAllEntities().filter((e) => e instanceof Monster && e.isAlive()).length;

function buildArena(width: number, height: number): GameMap {
  const map = new GameMap(width, height, TILES.FLOOR);
  for (let x = 0; x < width; x++) {
    map.setTile(x, 0, TILES.WALL);
    map.setTile(x, height - 1, TILES.WALL);
  }
  for (let y = 0; y < height; y++) {
    map.setTile(0, y, TILES.WALL);
    map.setTile(width - 1, y, TILES.WALL);
  }
  return map;
}

function makeMonster(id: string, x: number, y: number, aiState: 'sleeping' | 'hunting'): Monster {
  return new Monster({
    id,
    name: id,
    position: { x, y },
    aiState,
    speed: 100,
    stats: { hp: 20, maxHp: 20, attack: 5, defense: 2 },
  });
}

function recordEngine(engine: GameEngine, label: string): void {
  if (engine.actionPipeline.caughtExceptionCount > 0) {
    caughtPipelineErrors += engine.actionPipeline.caughtExceptionCount;
    failures.push(`${label}: ${engine.actionPipeline.caughtExceptionCount} caught pipeline exception(s)`);
  }
}

const CHECK_INTERVAL = 100;
let invariantChecks = 0;

/**
 * Invariant, NaN, and deadlock assertions (ARCHITECTURE.md §7.2 item 4).
 *
 * Checks run at CHECK_INTERVAL-turn checkpoints and once more at scenario end.
 * Each call is timed by the caller and subtracted from the scenario's elapsed
 * time, so adding assertions never inflates the wall-clock budgets measured here.
 */
function assertInvariants(engine: GameEngine, label: string, turn: number): void {
  invariantChecks++;
  const where = `${label} @turn ${turn}`;
  const p = engine.player;
  const bad = (what: string) => failures.push(`${where}: ${what}`);

  // NaN: any non-finite scalar on the simulation's hot path.
  const scalars: Array<[string, number]> = [
    ['player.hp', p.hp], ['player.maxHp', p.maxHp], ['player.mana', p.mana], ['player.maxMana', p.maxMana],
    ['player.x', p.x], ['player.y', p.y], ['player.energy', p.energy], ['player.speed', p.speed],
    ['player.inventory.totalWeight()', p.inventory.totalWeight()], ['engine.turnCount', engine.turnCount],
  ];
  for (const [name, value] of scalars) {
    if (!Number.isFinite(value)) bad(`${name} is ${value}`);
  }

  // Invariants: positive speeds (division by zero in the scheduler), in-bounds
  // positions, unique entity ids, and a living player with positive HP.
  if (p.isAlive() && p.hp <= 0) bad(`player alive with hp ${p.hp}`);
  if (p.speed <= 0) bad(`player.speed is ${p.speed}`);
  const seen = new Set<string>();
  for (const ent of engine.map.getAllEntities()) {
    if (!Number.isFinite(ent.energy)) bad(`${ent.id}.energy is ${ent.energy}`);
    if (!Number.isFinite(ent.x) || !Number.isFinite(ent.y)) bad(`${ent.id} position is (${ent.x}, ${ent.y})`);
    if (ent.speed <= 0) bad(`${ent.id}.speed is ${ent.speed}`);
    if (!engine.map.inBounds(ent.x, ent.y)) bad(`${ent.id} out of bounds at (${ent.x}, ${ent.y})`);
    if (seen.has(ent.id)) bad(`duplicate entity id ${ent.id}`);
    seen.add(ent.id);
  }
}

/**
 * Deadlock detection: a successful player action must advance the world clock.
 * A turn that resolves without turnCount moving means the scheduler never handed
 * the turn back, which is how a stuck simulation presents.
 */
/** Runs assertInvariants off the clock, returning the milliseconds to subtract. */
function timeCheck(engine: GameEngine, label: string, turn: number): number {
  const t0 = performance.now();
  assertInvariants(engine, label, turn);
  return performance.now() - t0;
}

function makeDeadlockWatch(engine: GameEngine, label: string) {
  let lastTurnCount = engine.turnCount;
  let stalled = 0;
  let reported = false;
  return (turn: number): void => {
    if (engine.turnCount > lastTurnCount) {
      lastTurnCount = engine.turnCount;
      stalled = 0;
      return;
    }
    stalled++;
    if (stalled > 5 && !reported) {
      reported = true;
      failures.push(`${label}: deadlock — turnCount stuck at ${lastTurnCount} across ${stalled} successful actions (turn ${turn})`);
    }
  };
}

// ── 1. Population anchor ──────────────────────────────────────────────────────
interface AnchorRow {
  density: number;
  samples: number;
  min: number;
  median: number;
  p90: number;
  max: number;
}

function measureFloorPopulations(): AnchorRow[] {
  return DENSITIES.map((density) => {
    const counts: number[] = [];
    for (const floor of ANCHOR_FLOORS) {
      for (let i = 1; i <= ANCHOR_SAMPLES_PER_FLOOR; i++) {
        const floorResult = DungeonArc.generateFloor(floor, floor * 1000 + i, undefined, cotwManifest, density);
        counts.push(floorResult.map.getAllEntities().filter((e) => e instanceof Monster).length);
      }
    }
    return {
      density,
      samples: counts.length,
      min: Math.min(...counts),
      median: median(counts),
      p90: quantile(counts, 0.9),
      max: Math.max(...counts),
    };
  });
}

// ── 2. Scenarios ──────────────────────────────────────────────────────────────
interface RunResult {
  ms: number;
  finalMonsters: number;
}

function runDormantFloor(count: number): RunResult {
  const map = buildArena(100, 100);
  let spawned = 0;
  for (let y = 30; y < 99 && spawned < count; y += 2) {
    for (let x = 30; x < 99 && spawned < count; x += 2) {
      map.addEntity(makeMonster(`dormant_${spawned++}`, x, y, 'sleeping'));
    }
  }
  const engine = new GameEngine({ map, player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }) });
  if (INJECT_ERROR) {
    engine.actionPipeline.registerHook({
      phase: 'pre',
      execute() {
        throw new Error('Injected headless-sim pipeline error');
      },
    });
  }

  const label = `dormant(${count})`;
  const watchDeadlock = makeDeadlockWatch(engine, label);
  let checkOverhead = 0;
  const start = performance.now();
  for (let turn = 1; turn <= DORMANT_TURNS; turn++) {
    const res = engine.handlePlayerAction(new MovementAction(engine.player, turn % 2 === 1 ? 1 : -1, 0));
    if (!res.success) {
      failures.push(`${label}: move rejected on turn ${turn}: ${res.message ?? ''}`);
      break;
    }
    watchDeadlock(turn);
    if (turn % CHECK_INTERVAL === 0) checkOverhead += timeCheck(engine, label, turn);
  }
  const ms = performance.now() - start - checkOverhead - timeCheck(engine, label, DORMANT_TURNS);
  recordEngine(engine, `dormant(${count})`);
  return { ms: ms / DORMANT_TURNS, finalMonsters: livingMonsters(engine) };
}

function runAwakeFloor(count: number): RunResult {
  const map = buildArena(FLOOR.width, FLOOR.height);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 2, y: Math.floor(FLOOR.height / 2) },
    stats: { hp: 1000, maxHp: 1000, attack: 1, defense: 5 },
  });
  const engine = new GameEngine({ map, player });
  engine.diagnostics.toggleGodMode();

  let spawned = 0;
  for (let y = 2; y < FLOOR.height - 2 && spawned < count; y += 2) {
    for (let x = 20; x < FLOOR.width - 2 && spawned < count; x += 2) {
      engine.addEntity(makeMonster(`awake_${spawned++}`, x, y, 'hunting'));
    }
  }
  if (spawned < count) failures.push(`awake(${count}): arena holds only ${spawned} monsters`);

  const label = `awake(${count})`;
  const watchDeadlock = makeDeadlockWatch(engine, label);
  let checkOverhead = 0;
  const start = performance.now();
  for (let turn = 1; turn <= AWAKE_TURNS; turn++) {
    const res = engine.handlePlayerAction(new WaitAction(player));
    if (!res.success) {
      failures.push(`${label}: wait rejected on turn ${turn}: ${res.message ?? ''}`);
      break;
    }
    watchDeadlock(turn);
    if (turn % CHECK_INTERVAL === 0) checkOverhead += timeCheck(engine, label, turn);
  }
  const ms = performance.now() - start - checkOverhead - timeCheck(engine, label, AWAKE_TURNS);
  recordEngine(engine, `awake(${count})`);
  return { ms: ms / AWAKE_TURNS, finalMonsters: livingMonsters(engine) };
}

function runSpellCasts(): RunResult {
  const map = new GameMap(15, 7, TILES.WALL);
  for (let x = 1; x <= 13; x++) map.setTile(x, 3, TILES.FLOOR);
  const player = new Player({
    id: 'mage',
    name: 'Mage',
    position: { x: 2, y: 3 },
    stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 },
  });
  player.maxMana = 100;
  const engine = new GameEngine({ map, player });

  const start = performance.now();
  for (let i = 0; i < SPELL_CASTS; i++) {
    player.mana = 100;
    const res = new CastSpellAction(player, 'magic_arrow', 8, 3).perform(engine);
    if (!res.success || res.effects?.length !== 1) {
      failures.push(`spells: cast ${i} failed or produced ${res.effects?.length ?? 0} effects: ${res.message ?? ''}`);
      break;
    }
  }
  const ms = performance.now() - start - timeCheck(engine, 'spells', SPELL_CASTS);
  recordEngine(engine, 'spells');
  return { ms, finalMonsters: 0 };
}

interface Measurement {
  label: string;
  population: number;
  medianMs: number;
  maxMs: number;
  finalMonsters: number;
}

function measure(label: string, population: number, run: () => RunResult): Measurement {
  run(); // warmup, discarded
  const samples: number[] = [];
  let finalMonsters = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const r = run();
    samples.push(r.ms);
    finalMonsters = r.finalMonsters;
  }
  return { label, population, medianMs: median(samples), maxMs: Math.max(...samples), finalMonsters };
}

// ── 3. Run ────────────────────────────────────────────────────────────────────
console.log('Anchoring populations to generated CotW floors...');
const anchor = measureFloorPopulations();
const realistic = Math.round(anchor[0].median);
const realisticHigh = anchor[anchor.length - 1].max;
const stress = realisticHigh * STRESS_MULTIPLIER;

// Global warmup so no measured data point absorbs one-time JIT compilation cost.
for (let i = 0; i < 3; i++) {
  runDormantFloor(realistic);
  runAwakeFloor(realistic);
  runSpellCasts();
}

const dormant = [0, realistic, realisticHigh, stress].map((n) => measure('dormant', n, () => runDormantFloor(n)));
const awake = [realistic, realisticHigh, stress].map((n) => measure('awake', n, () => runAwakeFloor(n)));
const spells = measure('spells', 0, runSpellCasts);

for (const m of awake) {
  if (m.population <= realisticHigh && m.medianMs > TURN_BUDGET_MS) {
    failures.push(`awake(${m.population}): median ${m.medianMs.toFixed(3)} ms/turn exceeds ${TURN_BUDGET_MS} ms budget`);
  }
}
if (spells.medianMs > SPELL_BUDGET_MS) {
  failures.push(`spells: median ${spells.medianMs.toFixed(1)} ms for ${SPELL_CASTS} casts exceeds ${SPELL_BUDGET_MS} ms budget`);
}

// ── 4. Report ─────────────────────────────────────────────────────────────────
const pad = (v: string | number, n: number) => String(v).padStart(n);
console.log('======================================================');
console.log('HEADLESS SIMULATION');
console.log('------------------------------------------------------');
console.log(`Population anchor: ${ANCHOR_FLOORS.length} floors x ${ANCHOR_SAMPLES_PER_FLOOR} generations per density`);
console.log('(placement is seeded per floor; the anchor varies the seed per generation to sample a spread)');
console.log('  density  samples  min  median  p90  max');
for (const r of anchor) {
  console.log(`  ${pad(r.density.toFixed(1), 7)}  ${pad(r.samples, 7)}  ${pad(r.min, 3)}  ${pad(r.median, 6)}  ${pad(r.p90, 3)}  ${pad(r.max, 3)}`);
}
console.log(`Data points: realistic=${realistic} (median @1.0x), realistic-high=${realisticHigh} (max @${DENSITIES[DENSITIES.length - 1]}x), stress=${stress} (${STRESS_MULTIPLIER}x, not realistic)`);
console.log('------------------------------------------------------');
console.log(`Scenario  population  median ms/turn  max ms/turn  monsters at end   (warmup + ${SAMPLES} samples)`);
for (const m of [...dormant, ...awake]) {
  const tag = m.population === stress ? ' [stress]' : '';
  console.log(`${m.label.padEnd(8)}  ${pad(m.population, 10)}  ${pad(m.medianMs.toFixed(3), 14)}  ${pad(m.maxMs.toFixed(3), 11)}  ${pad(m.finalMonsters, 15)}${tag}`);
}
console.log(`spells    ${SPELL_CASTS} casts: median ${spells.medianMs.toFixed(1)} ms total, max ${spells.maxMs.toFixed(1)} ms`);
console.log('------------------------------------------------------');
console.log(`Budgets (medians): awake <= ${TURN_BUDGET_MS} ms/turn up to realistic-high; ${SPELL_CASTS} casts <= ${SPELL_BUDGET_MS} ms`);
console.log(`Pipeline Caught Errors: ${caughtPipelineErrors}`);
console.log(`Invariant/NaN checkpoints: ${invariantChecks} (deadlock watch on every turn)`);
console.log('======================================================');

if (failures.length > 0) {
  console.error(`\n❌ Headless simulation failed (${failures.length}):`);
  for (const f of [...new Set(failures)].slice(0, 20)) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ Headless simulation passed.');
process.exit(0);
