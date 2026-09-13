import { GameEngine } from '../src/engine/engine';
import { GameMap } from '../src/engine/grid/map';
import { TILES } from '../src/engine/grid/tile';
import { Player } from '../src/engine/entities/player';
import { Monster } from '../src/engine/entities/monster';
import { MovementAction } from '../src/engine/actions/movement';

console.log('Initializing headless simulation test with dormant monster population...');

// 1. Initialize map fixture with perimeter walls (100x100 arena)
const MAP_WIDTH = 100;
const MAP_HEIGHT = 100;
const map = new GameMap(MAP_WIDTH, MAP_HEIGHT, TILES.FLOOR);
for (let x = 0; x < MAP_WIDTH; x++) {
  map.setTile(x, 0, TILES.WALL);
  map.setTile(x, MAP_HEIGHT - 1, TILES.WALL);
}
for (let y = 0; y < MAP_HEIGHT; y++) {
  map.setTile(0, y, TILES.WALL);
  map.setTile(MAP_WIDTH - 1, y, TILES.WALL);
}

// 2. Spawn player at (5, 5)
const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });

// 3. Spawn 150 dormant (sleeping) monsters far outside player FOV (x >= 30, y >= 30)
const DORMANT_COUNT = parseInt(process.argv[2] ?? '150', 10);
let spawned = 0;
for (let y = 30; y < MAP_HEIGHT - 1 && spawned < DORMANT_COUNT; y += 2) {
  for (let x = 30; x < MAP_WIDTH - 1 && spawned < DORMANT_COUNT; x += 2) {
    const monster = new Monster({
      id: `dormant_orc_${spawned + 1}`,
      name: `Sleeping Orc ${spawned + 1}`,
      position: { x, y },
      aiState: 'sleeping',
      speed: 100,
      stats: { hp: 20, maxHp: 20, attack: 5, defense: 2 },
    });
    map.addEntity(monster);
    spawned++;
  }
}

const engine = new GameEngine({ map, player });

if (process.argv.includes('--inject-error')) {
  console.log('Injecting throwing hook to test failure isolation...');
  engine.actionPipeline.registerHook({
    phase: 'pre',
    execute() {
      throw new Error('Injected chaos runner pipeline error!');
    }
  });
}

const TOTAL_TURNS = 1000;
console.log(`Starting benchmark: ${TOTAL_TURNS} turns with ${DORMANT_COUNT} dormant monsters on a ${MAP_WIDTH}x${MAP_HEIGHT} map...`);

const startTime = performance.now();

// 4. Execute deterministic turns oscillating between open floor tiles
for (let turn = 1; turn <= TOTAL_TURNS; turn++) {
  const dx = turn % 2 === 1 ? 1 : -1;
  const action = new MovementAction(engine.player, dx, 0);
  const result = engine.handlePlayerAction(action);

  if (!result.success && !result.pipelineError) {
    throw new Error(`Simulation failed on turn ${turn}: action rejected`);
  }
}

const endTime = performance.now();
const durationMs = endTime - startTime;
const turnsPerSec = (TOTAL_TURNS / (durationMs / 1000)).toFixed(2);
const msPerTurn = (durationMs / TOTAL_TURNS).toFixed(3);

// 5. Assert: Zero action pipeline exceptions caught and suppressed during run
const caughtPipelineErrors = engine.actionPipeline.caughtExceptionCount;
if (caughtPipelineErrors > 0) {
  throw new Error(
    `Chaos runner failure: ${caughtPipelineErrors} action pipeline exception(s) caught and suppressed during simulation!`
  );
}

console.log(`======================================================`);
console.log(`HEADLESS SIMULATION BENCHMARK COMPLETE`);
console.log(`Total Turns:            ${TOTAL_TURNS}`);
console.log(`Dormant Monsters:       ${DORMANT_COUNT}`);
console.log(`Duration:               ${durationMs.toFixed(2)} ms`);
console.log(`Latency:                ${msPerTurn} ms/turn`);
console.log(`Throughput:             ${turnsPerSec} turns/sec`);
console.log(`Final Engine Turn:      ${engine.turnCount}`);
console.log(`Pipeline Caught Errors: ${caughtPipelineErrors}`);
console.log(`======================================================`);

process.exit(0);

