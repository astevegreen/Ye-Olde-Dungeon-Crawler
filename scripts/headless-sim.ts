import { GameEngine } from '../src/engine/engine';
import { GameMap } from '../src/engine/grid/map';
import { TILES } from '../src/engine/grid/tile';
import { Player } from '../src/engine/entities/player';
import { MovementAction } from '../src/engine/actions/movement';

console.log('Initializing headless simulation test...');

// 1. Initialize map fixture with perimeter walls
const map = new GameMap(20, 15, TILES.FLOOR);
for (let x = 0; x < 20; x++) {
  map.setTile(x, 0, TILES.WALL);
  map.setTile(x, 14, TILES.WALL);
}
for (let y = 0; y < 15; y++) {
  map.setTile(0, y, TILES.WALL);
  map.setTile(19, y, TILES.WALL);
}

// 2. Spawn player and instantiate engine
const player = new Player({ id: 'hero', name: 'Hero', position: { x: 3, y: 7 } });
const engine = new GameEngine({ map, player });

// 3. Execute 500 deterministic turns oscillating between open floor tiles
for (let turn = 1; turn <= 500; turn++) {
  const dx = turn % 2 === 1 ? 1 : -1;
  const action = new MovementAction(engine.player, dx, 0);
  const result = engine.handlePlayerAction(action);

  if (!result.success) {
    throw new Error(`Simulation failed on turn ${turn}: action rejected`);
  }
}

console.log(`✅ 500 headless turns completed successfully. Final engine turn count: ${engine.turnCount}`);
process.exit(0);
