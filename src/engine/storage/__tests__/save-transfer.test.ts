import { describe, it, expect } from 'vitest';
import {
  generateSaveFilename,
  createSavePackage,
  encodeSaveCode,
  decodeSaveCode,
  validateSavePayload,
  utf8ToBase64,
  base64ToUtf8,
} from '../saveTransfer';
import { CURRENT_SCHEMA_VERSION, type VersionedSaveEnvelope } from '../migrator';
import type { SaveData } from '../types';

function createMockSaveEnvelope(manifestId = 'cotw', heroName = 'Sven'): VersionedSaveEnvelope<SaveData> {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    contentManifestId: manifestId,
    timestamp: 1700000000000,
    data: {
      savedAt: 1700000000000,
      turnCount: 42,
      currentFloor: 1,
      messages: ['Welcome to the dungeon.'],
      profile: {
        id: 'hero-1',
        name: heroName,
        level: 1,
        floor: 1,
        lastSaved: 1700000000000,
        hp: 30,
        maxHp: 30,
        strength: 14,
        manifestId,
      },
      player: {
        id: 'hero-1',
        name: heroName,
        x: 10,
        y: 10,
        hp: 30,
        maxHp: 30,
        baseAttack: 5,
        baseDefense: 3,
        strength: 14,
        speed: 100,
        energy: 100,
        inventory: {
          paperdoll: {} as any,
          primaryPack: {
            id: 'pack-1',
            name: 'Backpack',
            unidentifiedName: 'Pack',
            category: 'container',
            weight: 10,
            bulk: 10,
            quality: 'normal',
            identified: true,
            stats: {},
            description: 'Pack',
            isContainer: true,
            containerType: 'pack',
            maxWeightCapacity: 500,
            maxBulkCapacity: 300,
            items: [],
          },
        },
      },
      map: {
        width: 20,
        height: 20,
        tilesRle: '20,20:0x400',
        groundItems: [],
        monsters: [],
      },
    },
  };
}

describe('Save Transfer & Export (.cotw & Base64)', () => {
  describe('generateSaveFilename', () => {
    it('formats a standard filename with character name, floor, manifest, and timestamp', () => {
      const filename = generateSaveFilename('Sven', 1, 'cotw', 1700000000000);
      expect(filename).toBe('Sven_Floor1_cotw_1700000000000.cotw');
    });

    it('labels Floor 0 as Town', () => {
      const filename = generateSaveFilename('Astrid', 0, 'cotw', 1700000000000);
      expect(filename).toBe('Astrid_Town_cotw_1700000000000.cotw');
    });

    it('sanitizes spaces, punctuation, and special characters from character name', () => {
      const filename = generateSaveFilename('Sir Sven / The Bold!', 3, 'warcraft', 1700000000000);
      expect(filename).toBe('Sir_Sven_The_Bold_Floor3_warcraft_1700000000000.cotw');
    });

    it('defaults empty hero name to Hero', () => {
      const filename = generateSaveFilename('', 2, 'cotw', 1700000000000);
      expect(filename).toBe('Hero_Floor2_cotw_1700000000000.cotw');
    });
  });

  describe('createSavePackage', () => {
    it('creates a formatted .cotw JSON string matching VersionedSaveEnvelope schema', () => {
      const envelope = createMockSaveEnvelope('cotw', 'Thor');
      const json = createSavePackage(envelope);
      const parsed = JSON.parse(json);

      expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(parsed.contentManifestId).toBe('cotw');
      expect(parsed.data.profile.name).toBe('Thor');
      expect(parsed.data.currentFloor).toBe(1);
    });

    it('throws when envelope or data payload is missing', () => {
      expect(() => createSavePackage(null as any)).toThrow();
      expect(() => createSavePackage({ schemaVersion: 2 } as any)).toThrow();
    });
  });

  describe('UTF-8 Base64 Transcoding & Save Code Fidelity', () => {
    it('preserves Unicode characters including Scandinavian runes and symbols', () => {
      const unicodeText = 'Björn Ironside ᚠᚢᚦᚨᚱᚲ (Midgard Champion)';
      const encoded = utf8ToBase64(unicodeText);
      const decoded = base64ToUtf8(encoded);
      expect(decoded).toBe(unicodeText);
    });

    it('successfully round-trips a full save envelope via encodeSaveCode and decodeSaveCode', () => {
      const envelope = createMockSaveEnvelope('cotw', 'Björn ᚠ');
      const code = encodeSaveCode(envelope);
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(50);

      const restored = decodeSaveCode(code);
      expect(restored.contentManifestId).toBe('cotw');
      expect(restored.data.profile.name).toBe('Björn ᚠ');
      expect(restored.data.player.hp).toBe(30);
    });

    it('handles extra whitespace or linebreaks in save code', () => {
      const envelope = createMockSaveEnvelope('cotw', 'Sven');
      const code = encodeSaveCode(envelope);
      const paddedCode = `\n  ${code.slice(0, 20)}\n  ${code.slice(20)}  \n`;

      const restored = decodeSaveCode(paddedCode);
      expect(restored.data.profile.name).toBe('Sven');
    });

    it('throws when decoding malformed or empty save code', () => {
      expect(() => decodeSaveCode('')).toThrow('Save code cannot be empty');
      expect(() => decodeSaveCode('   ')).toThrow('Save code cannot be empty');
      expect(() => decodeSaveCode('NotValidBase64!!###@@')).toThrow();
    });
  });

  describe('validateSavePayload', () => {
    it('validates a correct .cotw JSON string', () => {
      const envelope = createMockSaveEnvelope('cotw', 'Freya');
      const json = JSON.stringify(envelope);

      const result = validateSavePayload(json, { expectedManifestId: 'cotw' });
      expect(result.valid).toBe(true);
      expect(result.manifestMismatch).toBe(false);
      expect(result.detectedManifestId).toBe('cotw');
      expect(result.envelope?.data.profile.name).toBe('Freya');
    });

    it('flags malformed JSON', () => {
      const result = validateSavePayload('{ invalid json ...', 'cotw');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MALFORMED_JSON');
    });

    it('flags empty input', () => {
      const result = validateSavePayload('', 'cotw');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MALFORMED_JSON');
    });

    it('detects missing critical components (corrupted data)', () => {
      const corrupt = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        contentManifestId: 'cotw',
        timestamp: Date.now(),
        data: {
          version: CURRENT_SCHEMA_VERSION,
          savedAt: Date.now(),
          profile: null,
        },
      };

      const result = validateSavePayload(JSON.stringify(corrupt), 'cotw');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('CORRUPTED_DATA');
      expect(result.error).toContain('missing character profile');
    });

    it('detects cross-manifest mismatch gracefully without strict mode', () => {
      const warcraftEnvelope = createMockSaveEnvelope('warcraft', 'Thrall');
      const json = JSON.stringify(warcraftEnvelope);

      const result = validateSavePayload(json, { expectedManifestId: 'cotw' });
      expect(result.valid).toBe(true);
      expect(result.manifestMismatch).toBe(true);
      expect(result.detectedManifestId).toBe('warcraft');
    });

    it('fails validation when strictManifest is enabled and manifests differ', () => {
      const warcraftEnvelope = createMockSaveEnvelope('warcraft', 'Thrall');
      const json = JSON.stringify(warcraftEnvelope);

      const result = validateSavePayload(json, { expectedManifestId: 'cotw', strictManifest: true });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INCOMPATIBLE_MANIFEST');
      expect(result.manifestMismatch).toBe(true);
    });
  });
});
