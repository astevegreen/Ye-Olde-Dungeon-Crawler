import { defaultMigrator, CURRENT_SCHEMA_VERSION } from '../src/engine/storage/migrator';

const mockLegacySave = {
  schemaVersion: 1,
  contentManifestId: 'cotw',
  timestamp: Date.now(),
  data: {
    player: { hp: 20, maxHp: 20, position: { x: 5, y: 5 } },
    map: { width: 20, height: 20, tiles: [] }
  }
};

try {
  const result = defaultMigrator.migrate(mockLegacySave);
  if (result.envelope.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Expected schema version ${CURRENT_SCHEMA_VERSION}, got ${result.envelope.schemaVersion}`);
  }
  console.log(`✅ Schema migration validation passed: v1 -> v${CURRENT_SCHEMA_VERSION} verified.`);
  process.exit(0);
} catch (err) {
  console.error('❌ Schema migration failed:', err);
  process.exit(1);
}
