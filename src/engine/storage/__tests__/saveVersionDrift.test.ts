import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { Player } from '../../entities/player';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { serializeGame } from '../serializer';
import { defaultMigrator, CURRENT_SCHEMA_VERSION } from '../migrator';

/**
 * ARCHITECTURE.md registry-contract audit: `SAVE_VERSION` in serializer.ts was a dead,
 * write-only constant (hardcoded at 5) baked into every `SaveData.version` field, while
 * `CURRENT_SCHEMA_VERSION` in migrator.ts (the actually-consulted version, §5) had moved
 * on to 9 with nothing keeping the two in sync. Nothing ever read `SaveData.version` back.
 * Fix: the field is removed outright rather than derived, so there is no longer a second
 * "version" number that can silently drift from the schema envelope's `schemaVersion`.
 */
describe('SaveData no longer carries a dead, driftable version field', () => {
  function buildEngine(): GameEngine {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
    return new GameEngine({ map, player });
  }

  it('serializeGame() output carries no "version" key', () => {
    const saveData = serializeGame(buildEngine());
    expect(Object.prototype.hasOwnProperty.call(saveData, 'version')).toBe(false);
  });

  it('a freshly-serialized save still round-trips through the migrator to CURRENT_SCHEMA_VERSION', () => {
    const saveData = serializeGame(buildEngine());
    const envelope = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      contentManifestId: 'cotw',
      timestamp: Date.now(),
      data: saveData,
    };
    const result = defaultMigrator.migrate(envelope);
    expect(result.envelope.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.migrated).toBe(false);
  });
});
