import { GameEngine } from '../src/engine/engine';

console.log('Initializing headless simulation test...');
const engine = new GameEngine({ headless: true });

for (let turn = 1; turn <= 500; turn++) {
  engine.tick();
}

console.log('✅ 500 headless turns completed successfully with no runtime exceptions.');
process.exit(0);
