import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { serializeGame } from '../serializer';
import { validateSavePayload } from '../saveTransfer';
import { CURRENT_SCHEMA_VERSION } from '../migrator';

/**
 * Whole-codebase review, 2026-10-06, area 11 (R-tool-1). `validateSavePayload` checks only
 * that `profile.name` is truthy, so an imported save whose name is a number passes and the
 * roster renderers then throw on `.replace`. Marked `it.fails` until the types are checked.
 */

describe('R-tool-1 · an imported save with a non-string hero name passes validation', () => {
  it('a payload whose profile.name is the number 5 is rejected', () => {
    const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player: new Player({ id: 'h', name: 'H', position: { x: 2, y: 2 } }) });
    const data = serializeGame(engine) as unknown as { profile: { name: unknown } };
    data.profile.name = 5;
    const envelope = JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, contentManifestId: 'x', timestamp: 1, data });

    const result = validateSavePayload(envelope);

    expect(result.valid).toBe(false);
  });
});

describe('R-tool-1 · the other malformed profile fields', () => {
  const envelopeWith = (patch: Record<string, unknown>) => {
    const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player: new Player({ id: 'h', name: 'H', position: { x: 2, y: 2 } }) });
    const data = serializeGame(engine) as unknown as { profile: Record<string, unknown> };
    Object.assign(data.profile, patch);
    return JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, contentManifestId: 'x', timestamp: 1, data });
  };

  it.each([
    ['an object name', { name: { a: 1 } }],
    ['a blank name', { name: '   ' }],
    ['a missing id', { id: undefined }],
    ['a numeric id', { id: 7 }],
    ['a numeric manifest id', { manifestId: 3 }],
  ])('a payload with %s is rejected', (_label, patch) => {
    expect(validateSavePayload(envelopeWith(patch)).valid).toBe(false);
  });

  it('a well-formed payload still validates', () => {
    expect(validateSavePayload(envelopeWith({})).valid).toBe(true);
  });
});
