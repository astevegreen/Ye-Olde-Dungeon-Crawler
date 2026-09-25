/**
 * Replays a bug report headlessly: loads its checkpoint, replays its action trail, and
 * prints where the game ends up. Takes a copied Markdown report (including a GitHub
 * issue body with a ```replay-gz block), a diagnostic .json, or a save.
 *
 *   npm run replay:report -- <report.md|report.json> [--no-replay]
 *
 * Exits non-zero if nothing loads or the replay stops early.
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { loadReplayState, replayActionTrail } from '../src/engine';
import { cotwManifest } from '../src/content/cotw';
import { warcraftManifest } from '../src/content/warcraft';

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error('usage: npm run replay:report -- <report.md|report.json> [--no-replay]');
  process.exit(2);
}

let text = readFileSync(file, 'utf-8');
text = text.replace(/```replay-gz\s*\n([\s\S]*?)\n```/g, (_m, b64: string) => {
  const json = gunzipSync(Buffer.from(b64.replace(/\s+/g, ''), 'base64')).toString('utf-8');
  return '```json\n' + json + '\n```';
});

const manifest = /warcraft/.test(text.match(/"manifestId":\s*"([^"]+)"|\*\*Manifest\*\*: `([^`]+)`/)?.[0] ?? '')
  ? warcraftManifest
  : cotwManifest;

const loaded = loadReplayState(text, manifest);
if (!loaded.ok) {
  console.error(`✗ ${loaded.message}${loaded.detail ? ` (${loaded.detail})` : ''}`);
  process.exit(1);
}

const { engine, source, trail } = loaded.value;
console.log(`Loaded ${source} (manifest ${manifest.id}) at floor ${engine.currentFloor}, turn ${engine.turnCount}.`);

let stopped = false;
if (source === 'replay-checkpoint' && !flags.includes('--no-replay')) {
  const result = replayActionTrail(engine, trail);
  console.log(`Replayed ${result.replayed}/${result.total} action(s).`);
  if (result.stoppedAt) {
    stopped = true;
    console.log(`✗ Stopped at #${result.stoppedAt.seq} ${result.stoppedAt.action}: ${result.stoppedAt.reason}`);
  }
}

const p = engine.player;
console.log(
  `Now: floor ${engine.currentFloor}, turn ${engine.turnCount}, hero at (${p.x}, ${p.y}), ` +
    `HP ${p.hp}/${p.maxHp}, PRNG ${engine.prng.getState()}`
);
console.log('Last messages:');
for (const m of engine.messages.slice(-8)) console.log(`  ${m}`);
process.exit(stopped ? 1 : 0);
