const { execSync } = require('child_process');

function run(count) {
  console.log(`Running with ${count}...`);
  const out = execSync(`npx tsx scripts/headless-sim.ts ${count}`).toString();
  const matchLatency = out.match(/Latency:\s+([0-9.]+) ms\/turn/);
  const matchThroughput = out.match(/Throughput:\s+([0-9.]+) turns\/sec/);
  console.log(`Dormant: ${count} | Latency: ${matchLatency[1]} ms/turn | Throughput: ${matchThroughput[1]} turns/sec`);
}

run(10);
run(0);
run(30);
run(150);
run(500);
