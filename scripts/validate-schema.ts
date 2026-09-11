import { migrateSavePayload } from '../src/engine/storage/migrator';

const mockLegacySave = {
  version: 1,
  data: { player: { hp: 20, maxHp: 20, position: { x: 5, y: 5 } } }
};

try {
  const result = migrateSavePayload(mockLegacySave);
  if (result.version !== 3) {
    throw new Error(`Expected schema version 3, got ${result.version}`);
  }
  console.log('✅ Schema migration validation passed: v1 -> v3 verified.');
  process.exit(0);
} catch (err) {
  console.error('❌ Schema migration failed:', err);
  process.exit(1);
}
