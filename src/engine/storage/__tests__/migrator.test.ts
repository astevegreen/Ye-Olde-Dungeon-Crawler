import { describe, it, expect } from 'vitest';
import { SchemaMigrator, defaultMigrator, CURRENT_SCHEMA_VERSION } from '../migrator';

/**
 * The pre-v11 step chain was removed before launch (ARCHITECTURE.md §5), so these
 * cover the migration machinery itself and the version floor it now enforces —
 * not any individual historical step.
 */
describe('Schema Migrator & Save State Versioning', () => {
  const currentEnvelope = () => ({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    contentManifestId: 'cotw',
    timestamp: 123456789,
    data: {
      player: { id: 'hero', name: 'Sven' },
      map: { width: 4, height: 4, tilesRle: '16:0;', tileCodes: ['wall'], groundItems: [], monsters: [] },
      archivedFloors: [1, 2],
    },
  });

  it('passes a current-version envelope through untouched', () => {
    const result = defaultMigrator.migrate(currentEnvelope());

    expect(result.migrated).toBe(false);
    expect(result.fromVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.envelope.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.envelope.data.archivedFloors).toEqual([1, 2]);
  });

  it('parses raw JSON string input transparently', () => {
    const result = defaultMigrator.migrate(JSON.stringify(currentEnvelope()));

    expect(result.envelope.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.envelope.data.player.name).toBe('Sven');
  });

  it('rejects a save predating the supported format instead of loading it', () => {
    const v10Envelope = {
      schemaVersion: 10,
      contentManifestId: 'cotw',
      timestamp: 123456789,
      data: { map: { width: 4, height: 4, tilesRle: '16W', groundItems: [], monsters: [] } },
    };

    expect(() => defaultMigrator.migrate(v10Envelope)).toThrowError(
      'Missing migration function for upgrade 10->11'
    );
  });

  it('rejects an unversioned raw payload instead of assuming v0', () => {
    expect(() => defaultMigrator.migrate({ player: { name: 'Sven' } })).toThrowError(
      'Missing migration function for upgrade 0->1'
    );
  });

  it('rejects saves from future schema versions with descriptive error', () => {
    const futureSave = {
      schemaVersion: 99,
      contentManifestId: 'cotw',
      timestamp: Date.now(),
      data: {},
    };

    expect(() => defaultMigrator.migrate(futureSave)).toThrowError(
      `Save payload schema version 99 is newer than engine version ${CURRENT_SCHEMA_VERSION}. Upgrade required.`
    );
  });

  it('still runs a newly registered forward step, so future migrations work', () => {
    const migrator = new SchemaMigrator();
    const next = CURRENT_SCHEMA_VERSION + 1;

    migrator.registerMigration(CURRENT_SCHEMA_VERSION, next, (envelope: any) => ({
      ...envelope,
      schemaVersion: next,
      data: { ...envelope.data, addedByStep: true },
    }));

    const result = migrator.migrate(currentEnvelope(), next);

    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.envelope.schemaVersion).toBe(next);
    expect((result.envelope.data as any).addedByStep).toBe(true);
  });

  it('surfaces a throwing step as an unrecoverable migration error', () => {
    const migrator = new SchemaMigrator();
    const next = CURRENT_SCHEMA_VERSION + 1;

    migrator.registerMigration(CURRENT_SCHEMA_VERSION, next, () => {
      throw new Error('STEP_FAULT');
    });

    expect(() => migrator.migrate(currentEnvelope(), next)).toThrowError(
      `Schema migration ${CURRENT_SCHEMA_VERSION}->${next} failed: STEP_FAULT. Save may be partially or fully unrecoverable.`
    );
  });
});
