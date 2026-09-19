/**
 * Schema evolution integrity gate (ARCHITECTURE.md §7.2 item 3).
 *
 * 1. Forward migration: a minimal v1 envelope migrates to CURRENT_SCHEMA_VERSION.
 * 2. Round-trip fidelity: state that lives outside the plain player/map fields —
 *    surface grids, substance grids, ground items, and PRNG state — survives
 *    serialize -> JSON -> deserialize unchanged. JSON is in the loop because saves
 *    are persisted as strings, so a value that cannot round-trip through JSON is
 *    just as lost as one the serializer drops.
 */
import { defaultMigrator, CURRENT_SCHEMA_VERSION } from '../src/engine/storage/migrator';
import { serializeGame, deserializeGame } from '../src/engine/storage/serializer';
import { GameEngine } from '../src/engine/engine';
import { GameMap } from '../src/engine/grid/map';
import { TILES } from '../src/engine/grid/tile';
import { Player } from '../src/engine/entities/player';
import { Item } from '../src/engine/items/item';
import { SubstanceBitmask } from '../src/engine/environment/substanceGrid';

const failures: string[] = [];

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = Object.is(actual, expected);
  if (!ok) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok ? '' : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
}

// ---------------------------------------------------------------- 1. migration
console.log('Forward migration:');
const mockLegacySave = {
  schemaVersion: 1,
  contentManifestId: 'cotw',
  timestamp: Date.now(),
  data: {
    player: { hp: 20, maxHp: 20, position: { x: 5, y: 5 } },
    map: { width: 20, height: 20, tiles: [] },
  },
};

try {
  const result = defaultMigrator.migrate(mockLegacySave);
  check(`v1 -> v${CURRENT_SCHEMA_VERSION}`, result.envelope.schemaVersion, CURRENT_SCHEMA_VERSION);
} catch (err) {
  failures.push(`migration threw: ${err instanceof Error ? err.message : String(err)}`);
  console.log(`  ✗ v1 -> v${CURRENT_SCHEMA_VERSION} — threw: ${err instanceof Error ? err.message : String(err)}`);
}

// ------------------------------------------------------------- 2. round-trip
console.log('\nRound-trip fidelity (serialize -> JSON -> deserialize):');

const SURFACE_POS = { x: 2, y: 3 };
const SUBSTANCE_POS = { x: 4, y: 5 };
const GROUND_ITEM_POS = { x: 6, y: 7 };
const SUBSTANCE_MASK = SubstanceBitmask.FLOWING_FLUID | SubstanceBitmask.IGNITED;

const map = new GameMap(20, 20, TILES.FLOOR);
const player = new Player({ id: 'validator', name: 'Validator', position: { x: 1, y: 1 } });
const engine = new GameEngine({ map, player, seed: 4242 });

engine.surfaces.setSurface(SURFACE_POS.x, SURFACE_POS.y, 'water', 9, 2);
engine.substances.addSubstance(SUBSTANCE_POS.x, SUBSTANCE_POS.y, SUBSTANCE_MASK);
map.addItemAt(
  GROUND_ITEM_POS.x,
  GROUND_ITEM_POS.y,
  new Item({
    id: 'ground-item-validator-1',
    name: 'Validator Test Item',
    category: 'quest',
    weight: 100,
    bulk: 50,
  })
);

// Advance the stream so a restored engine must resume mid-sequence, not from the seed.
for (let i = 0; i < 7; i++) engine.prng.next();
const prngStateBefore = engine.prng.getState();
// Peek the next draw, then rewind, so the save captures the pre-draw state and the
// restored engine must produce exactly this value to prove the stream resumed.
const nextDrawBefore = engine.prng.next();
engine.prng.setState(prngStateBefore);

const saved = serializeGame(engine);
const roundTripped = JSON.parse(JSON.stringify(saved));
const { engine: restored } = deserializeGame(roundTripped);

check('surface type', restored.surfaces.getSurface(SURFACE_POS.x, SURFACE_POS.y), 'water');
const cell = restored.surfaces.getCell(SURFACE_POS.x, SURFACE_POS.y);
check('surface duration', cell?.surface?.duration, 9);
check('surface potency', cell?.surface?.potency, 2);
check('substance mask', restored.substances.getSubstances(SUBSTANCE_POS.x, SUBSTANCE_POS.y), SUBSTANCE_MASK);

const groundItems = restored.map.getItemsAt(GROUND_ITEM_POS.x, GROUND_ITEM_POS.y);
const groundItem = groundItems[0];
check('ground item present', groundItems.length, 1);
check('ground item id', groundItem?.id, 'ground-item-validator-1');
check('ground item name', groundItem?.name, 'Validator Test Item');
// PRNG.getState() returns the raw internal state while setState() coerces to int32, so a
// restored generator reports a differently-encoded but equivalent state. Compare normalized
// values, and let the next-draw check below prove the stream itself resumed.
check('prng state (int32-normalized)', restored.prng.getState() | 0, prngStateBefore | 0);
check('prng next draw resumes stream', restored.prng.next(), nextDrawBefore);

// --------------------------------------------------------------- 3. verdict
if (failures.length > 0) {
  console.error(`\n❌ Schema validation failed (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n✅ Schema validation passed: v1 -> v${CURRENT_SCHEMA_VERSION}, plus surface, substance, ground item, and PRNG round-tripping.`);
process.exit(0);
