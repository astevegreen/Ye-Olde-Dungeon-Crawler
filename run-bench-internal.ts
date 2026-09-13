import { GameEngine } from './src/engine/engine';
import { GameMap } from './src/engine/grid/map';
import { TILES } from './src/engine/grid/tile';
import { Player } from './src/engine/entities/player';
import { Monster } from './src/engine/entities/monster';
import { MovementAction } from './src/engine/actions/movement';

function runSim(DORMANT_COUNT) {
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

  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
  
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
  const TOTAL_TURNS = 1000;
  
  // Warmup
  for (let turn = 1; turn <= 100; turn++) {
    const dx = turn % 2 === 1 ? 1 : -1;
    engine.handlePlayerAction(new MovementAction(engine.player, dx, 0));
  }

  const startTime = performance.now();
  for (let turn = 1; turn <= TOTAL_TURNS; turn++) {
    const dx = turn % 2 === 1 ? 1 : -1;
    engine.handlePlayerAction(new MovementAction(engine.player, dx, 0));
  }
  const endTime = performance.now();
  
  const durationMs = endTime - startTime;
  const turnsPerSec = (TOTAL_TURNS / (durationMs / 1000)).toFixed(2);
  const msPerTurn = (durationMs / TOTAL_TURNS).toFixed(3);

  console.log(`Dormant: ${DORMANT_COUNT.toString().padEnd(4)} | Latency: ${msPerTurn} ms/turn | Throughput: ${turnsPerSec} turns/sec`);
}

// Warm up V8
runSim(10);

console.log('--- Real Benchmark ---');
runSim(0);
runSim(30);
runSim(150);
runSim(500);
