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

  const start = performance.now();
  for (let turn = 1; turn <= DORMANT_TURNS; turn++) {
    const res = engine.handlePlayerAction(new MovementAction(engine.player, turn % 2 === 1 ? 1 : -1, 0));
    if (!res.success) {
      failures.push(`dormant(${count}): move rejected on turn ${turn}: ${res.message ?? ''}`);
      break;
    }
  }
  const ms = performance.now() - start;
  recordEngine(engine, `dormant(${count})`);
  return { ms: ms / DORMANT_TURNS, finalMonsters: livingMonsters(engine) };
}

function runAwakeFloor(count: number): RunResult {
  const map = buildArena(50, 35);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 2, y: 17 },
    stats: { hp: 1000, maxHp: 1000, attack: 1, defense: 5 },
  });
  const engine = new GameEngine({ map, player });
  engine.diagnostics.toggleGodMode();

  let spawned = 0;
  for (let y = 2; y < 33 && spawned < count; y += 2) {
    for (let x = 20; x < 48 && spawned < count; x += 2) {
      engine.addEntity(makeMonster(`awake_${spawned++}`, x, y, 'hunting'));
    }
  }
  if (spawned < count) failures.push(`awake(${count}): arena holds only ${spawned} monsters`);

  const start = performance.now();
  for (let turn = 1; turn <= AWAKE_TURNS; turn++) {
    const res = engine.handlePlayerAction(new WaitAction(player));
    if (!res.success) {
      failures.push(`awake(${count}): wait rejected on turn ${turn}: ${res.message ?? ''}`);
      break;
    }
  }
  const ms = performance.now() - start;
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
  const ms = performance.now() - start;
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
console.log('(monster placement uses Math.random, ARCHITECTURE.md P-10, so counts are sampled, not seeded)');
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
console.log('======================================================');

if (failures.length > 0) {
  console.error(`\n❌ Headless simulation failed (${failures.length}):`);
  for (const f of [...new Set(failures)].slice(0, 20)) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ Headless simulation passed.');
process.exit(0);
