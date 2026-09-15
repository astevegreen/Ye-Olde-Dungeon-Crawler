import { describe, it, expect, vi } from 'vitest';
import { SchemaMigrator, CURRENT_SCHEMA_VERSION } from '../migrator';
import { ProfileManager, MemoryStorage } from '../profile-manager';
import { deserializeMapObject } from '../serializer';
import { flightRecorder } from '../../debug/flightRecorder';

const NEXT = CURRENT_SCHEMA_VERSION + 1;
const currentEnvelope = () => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  contentManifestId: 'cotw',
  timestamp: 1,
  data: {},
});

describe('Schema migration failure paths', () => {
  it('throws a descriptive error when a migration step is missing', () => {
    expect(() => new SchemaMigrator().migrate(currentEnvelope(), NEXT)).toThrow(
      `Missing migration function for upgrade ${CURRENT_SCHEMA_VERSION}->${NEXT}`
    );
  });

  it('wraps an exception thrown inside a migration step with the failing step', () => {
    const migrator = new SchemaMigrator();
    migrator.registerMigration(CURRENT_SCHEMA_VERSION, NEXT, () => {
      throw new Error('STEP_FAULT');
    });
    expect(() => migrator.migrate(currentEnvelope(), NEXT)).toThrow(
      `Schema migration ${CURRENT_SCHEMA_VERSION}->${NEXT} failed: STEP_FAULT. Save may be partially or fully unrecoverable.`
    );
  });

  it('rejects an envelope-shaped save whose schemaVersion is missing', () => {
    expect(() => new SchemaMigrator().migrate({ contentManifestId: 'cotw', timestamp: 1, data: {} })).toThrow(
      'Save corrupted: envelope structure detected but schemaVersion is missing or non-numeric.'
    );
  });

  it('rejects unparseable JSON and non-object payloads', () => {
    const migrator = new SchemaMigrator();
    expect(() => migrator.migrate('{not json')).toThrow(/^Failed to parse save JSON:/);
    expect(() => migrator.migrate(42 as unknown)).toThrow('Invalid save payload: expected object or JSON string.');
  });
});

describe('ProfileManager.loadCharacter failure paths', () => {
  function setupTwoProfiles() {
    const storage = new MemoryStorage();
    const manager = new ProfileManager(storage);
    const alpha = manager.createCharacter('Alpha');
    manager.saveCharacter(alpha.engine, alpha.profile);
    const beta = manager.createCharacter('Beta');
    manager.saveCharacter(beta.engine, beta.profile);
    return { storage, manager, alpha, beta };
  }

  it('returns null for a save that is not valid JSON, without changing the active profile', () => {
    const { storage, manager, alpha, beta } = setupTwoProfiles();
    const activeBefore = manager.getManifest().activeProfileId;
    expect(activeBefore).not.toBe(alpha.profile.id);

    storage.setItem(`${manager.saveKeyPrefix}${alpha.profile.id}`, '{not json');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(manager.loadCharacter(alpha.profile.id)).toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }

    expect(manager.getManifest().activeProfileId).toBe(activeBefore);
    expect(manager.loadCharacter(beta.profile.id)).not.toBeNull();
  });

  it('returns null for a save that migrates but whose data cannot be deserialized', () => {
    const { storage, manager, alpha } = setupTwoProfiles();
    storage.setItem(`${manager.saveKeyPrefix}${alpha.profile.id}`, JSON.stringify(currentEnvelope()));

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(manager.loadCharacter(alpha.profile.id)).toBeNull();
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe('Map deserialization of unknown tile types', () => {
  it('loads an unknown tile type as impassable wall and records a flight-recorder warning', () => {
    const map = deserializeMapObject({
      width: 3,
      height: 1,
      tiles: [['floor', 'retired_tile_type', 'wall']] as any,
      groundItems: [],
      monsters: [],
    });

    expect(map.getTile(0, 0)?.type).toBe('floor');
    expect(map.getTile(1, 0)?.type).toBe('wall');
    expect(map.getTile(1, 0)?.passable).toBe(false);

    const warning = flightRecorder
      .getEvents()
      .find((e) => e.type === 'warning' && (e.details as any)?.tileType === 'retired_tile_type');
    expect(warning).toBeDefined();
  });
});
