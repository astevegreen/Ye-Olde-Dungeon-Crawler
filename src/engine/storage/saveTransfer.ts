import { defaultMigrator, type VersionedSaveEnvelope } from './migrator';
import type { SaveData } from './types';

export type SaveValidationErrorCode =
  | 'MALFORMED_JSON'
  | 'INVALID_ENVELOPE'
  | 'INCOMPATIBLE_MANIFEST'
  | 'CORRUPTED_DATA';

export interface SaveValidationResult {
  valid: boolean;
  envelope?: VersionedSaveEnvelope<SaveData>;
  error?: string;
  errorCode?: SaveValidationErrorCode;
  manifestMismatch?: boolean;
  detectedManifestId?: string;
}

export interface SaveValidationOptions {
  expectedManifestId?: string;
  strictManifest?: boolean;
}

/**
 * Cross-platform UTF-8 to Base64 string encoding.
 * Safe in Node.js, Vitest, and browser environments.
 */
export function utf8ToBase64(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64');
  }
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

/**
 * Cross-platform Base64 string to UTF-8 decoding.
 * Safe in Node.js, Vitest, and browser environments.
 */
export function base64ToUtf8(base64: string): string {
  const cleanBase64 = base64.trim().replace(/\s+/g, '');
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(cleanBase64, 'base64').toString('utf-8');
  }
  const bin = atob(cleanBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/** The exported save file's extension, the same for every pack. Presentation names it
 *  from here rather than spelling it out (§3). */
export const SAVE_FILE_EXTENSION = '.cotw';

/**
 * Generates a standardized, sanitized file name for exported saves.
 * Format: `${characterName}_Floor${currentFloor}_${manifestId}_${timestamp}.cotw`
 */
export function generateSaveFilename(
  characterName: string,
  floor: number,
  manifestId: string,
  timestamp: number = Date.now()
): string {
  const safeName =
    (characterName || 'Hero')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Hero';
  const safeManifest =
    (manifestId || 'cotw')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/^_+|_+$/g, '') || 'cotw';
  const floorTag = floor === 0 ? 'Town' : `Floor${floor}`;
  return `${safeName}_${floorTag}_${safeManifest}_${timestamp}${SAVE_FILE_EXTENSION}`;
}

/**
 * Serializes a VersionedSaveEnvelope to pretty-printed JSON for discrete .cotw file export.
 */
export function createSavePackage(envelope: VersionedSaveEnvelope<SaveData>): string {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Invalid save envelope: expected an object.');
  }
  if (!envelope.data) {
    throw new Error('Invalid save envelope: missing envelope.data payload.');
  }

  // Ensure contentManifestId is synced
  const manifestId =
    envelope.contentManifestId ||
    envelope.data.contentManifestId ||
    envelope.data.profile?.manifestId ||
    'cotw';

  const normalizedEnvelope: VersionedSaveEnvelope<SaveData> = {
    ...envelope,
    contentManifestId: manifestId,
    timestamp: envelope.timestamp || Date.now(),
  };

  return JSON.stringify(normalizedEnvelope, null, 2);
}

/** The id a save code gives its hero in place of the sharer's profile id. */
const SHARED_HERO_ID = 'shared-hero';

/**
 * A copy of `value` in which every string (key or value) that is `id`, or an id made from it
 * (`<id>-pack`, `<id>-dagger`), names `neutral` instead.
 */
function renameId(value: unknown, id: string, neutral: string): unknown {
  if (typeof value === 'string') {
    if (value === id) return neutral;
    return value.startsWith(`${id}-`) ? `${neutral}${value.slice(id.length)}` : value;
  }
  if (Array.isArray(value)) return value.map((v) => renameId(v, id, neutral));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) out[renameId(key, id, neutral) as string] = renameId(v, id, neutral);
    return out;
  }
  return value;
}

/**
 * Transcodes a VersionedSaveEnvelope into an ASCII Base64 "Save Code" string.
 *
 * A code is handed to other people, and a hero's profile id (`hero_<creation time>_<random>`)
 * says when its maker made the hero, so the code names the hero `shared-hero` instead,
 * the same way everywhere the save names it (the hero and the ids made from its id), and
 * still loads as one hero. Import is unchanged: an id the roster already has is replaced.
 */
export function encodeSaveCode(envelope: VersionedSaveEnvelope<SaveData>): string {
  let shared: unknown = envelope;
  for (const id of new Set([envelope?.data?.profile?.id, envelope?.data?.player?.id])) {
    if (typeof id === 'string' && id && id !== SHARED_HERO_ID) shared = renameId(shared, id, SHARED_HERO_ID);
  }
  return utf8ToBase64(JSON.stringify(shared));
}

/**
 * Decodes an ASCII Base64 "Save Code" string into a validated, migrated VersionedSaveEnvelope.
 */
export function decodeSaveCode(
  saveCode: string,
  options?: SaveValidationOptions
): VersionedSaveEnvelope<SaveData> {
  if (!saveCode || typeof saveCode !== 'string' || !saveCode.trim()) {
    throw new Error('Save code cannot be empty.');
  }

  let json: string;
  try {
    json = base64ToUtf8(saveCode);
  } catch (err) {
    throw new Error(`Failed to decode Base64 save code: ${(err as Error).message}`);
  }

  const validation = validateSavePayload(json, options);
  if (!validation.valid || !validation.envelope) {
    throw new Error(validation.error || 'Save code contains invalid save data.');
  }

  return validation.envelope;
}

/**
 * Validates any raw save payload (JSON string, object, or migrated envelope).
 * Handles malformed JSON, envelope shape verification, and manifest compatibility check.
 */
export function validateSavePayload(
  rawInput: string | unknown,
  options?: SaveValidationOptions | string
): SaveValidationResult {
  const opts: SaveValidationOptions =
    typeof options === 'string' ? { expectedManifestId: options } : options || {};

  if (rawInput === null || rawInput === undefined) {
    return {
      valid: false,
      error: 'Save payload is null or undefined.',
      errorCode: 'INVALID_ENVELOPE',
    };
  }

  let currentObj: unknown;
  if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return {
        valid: false,
        error: 'Save payload string is empty.',
        errorCode: 'MALFORMED_JSON',
      };
    }
    try {
      currentObj = JSON.parse(trimmed);
    } catch (err) {
      return {
        valid: false,
        error: `Malformed JSON save file: ${(err as Error).message}`,
        errorCode: 'MALFORMED_JSON',
      };
    }
  } else if (typeof rawInput === 'object') {
    currentObj = rawInput;
  } else {
    return {
      valid: false,
      error: 'Invalid save payload type: expected object or JSON string.',
      errorCode: 'INVALID_ENVELOPE',
    };
  }

  // Migrate schema through default migrator
  let envelope: VersionedSaveEnvelope<SaveData>;
  try {
    const migration = defaultMigrator.migrate(currentObj);
    envelope = migration.envelope as VersionedSaveEnvelope<SaveData>;
  } catch (err) {
    return {
      valid: false,
      error: `Schema migration failed: ${(err as Error).message}`,
      errorCode: 'CORRUPTED_DATA',
    };
  }

  const data = envelope?.data;
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: 'Invalid save envelope: data property is missing or not an object.',
      errorCode: 'INVALID_ENVELOPE',
    };
  }

  // Verify critical fields
  if (!data.profile || typeof data.profile !== 'object' || !data.profile.name) {
    return {
      valid: false,
      error: 'Incomplete save data: missing character profile.',
      errorCode: 'CORRUPTED_DATA',
    };
  }

  // The roster keys and lists heroes by these: a number or object here imports as a
  // ghost entry no menu can load or delete.
  const { id, name, manifestId } = data.profile as { id: unknown; name: unknown; manifestId?: unknown };
  if (typeof id !== 'string' || !id.trim() || typeof name !== 'string' || !name.trim() || (manifestId !== undefined && typeof manifestId !== 'string')) {
    return {
      valid: false,
      error: 'Damaged save data: the character profile has a malformed id or name.',
      errorCode: 'CORRUPTED_DATA',
    };
  }

  if (!data.player || typeof data.player !== 'object') {
    return {
      valid: false,
      error: 'Incomplete save data: missing player entity state.',
      errorCode: 'CORRUPTED_DATA',
    };
  }

  if (!data.map || typeof data.map !== 'object') {
    return {
      valid: false,
      error: 'Incomplete save data: missing map geometry state.',
      errorCode: 'CORRUPTED_DATA',
    };
  }

  // Detect manifest ID
  const detectedManifestId =
    envelope.contentManifestId ||
    data.contentManifestId ||
    data.profile.manifestId ||
    'cotw';

  const manifestMismatch =
    !!opts.expectedManifestId && detectedManifestId !== opts.expectedManifestId;

  if (manifestMismatch && opts.strictManifest) {
    return {
      valid: false,
      envelope,
      error: `Manifest mismatch: save belongs to manifest '${detectedManifestId}', but active manifest is '${opts.expectedManifestId}'.`,
      errorCode: 'INCOMPATIBLE_MANIFEST',
      manifestMismatch: true,
      detectedManifestId,
    };
  }

  return {
    valid: true,
    envelope,
    manifestMismatch,
    detectedManifestId,
  };
}
