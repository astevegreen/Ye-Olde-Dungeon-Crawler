/**
 * Typed load outcomes (ARCHITECTURE.md §5).
 *
 * Loads used to return `null` for every failure, so callers could not tell "no save here"
 * from "this save is corrupt" — and the player was told nothing. A load now reports which
 * of those happened, and presentation notifies for everything except `missing`.
 */
import { CURRENT_SCHEMA_VERSION, defaultMigrator, type SchemaMigrator, type VersionedSaveEnvelope } from './migrator';

export type LoadFailureReason =
  /** Nothing stored under that key. Routine: starting fresh, or no autosave yet. */
  | 'missing'
  /** Stored payload is unparseable or structurally invalid. */
  | 'corrupt'
  /** Written by a newer engine; this build cannot read it without downgrading the save. */
  | 'newer-than-engine'
  /** A forward migration step existed but failed, or none was registered for the jump. */
  | 'migration-failed';

export interface LoadFailure {
  ok: false;
  reason: LoadFailureReason;
  /** Player-facing sentence. */
  message: string;
  /** Underlying error text, for the flight recorder and diagnostics. */
  detail?: string;
}

export type LoadOutcome<T> = { ok: true; value: T } | LoadFailure;

/** True when the player should be told. A missing save is normal; the rest are not. */
export function shouldNotifyPlayer(failure: LoadFailure): boolean {
  return failure.reason !== 'missing';
}

export const MISSING_SAVE: LoadFailure = {
  ok: false,
  reason: 'missing',
  message: 'No saved game was found.',
};

type FailureReason = Exclude<LoadFailureReason, 'missing'>;

const PLAYER_MESSAGES: Record<FailureReason, string> = {
  corrupt: 'This save is damaged and could not be loaded.',
  'newer-than-engine': 'This save was written by a newer version of the game and cannot be loaded.',
  'migration-failed': 'This save could not be upgraded to the current format.',
};

/** A load error that knows its reason, so nothing has to read it back out of the error text. */
export class SaveLoadError extends Error {
  constructor(
    public readonly reason: FailureReason,
    detail: string
  ) {
    super(detail);
    this.name = 'SaveLoadError';
  }
}

type SaveRecord = { schemaVersion?: unknown; data?: unknown; timestamp?: unknown };

/**
 * The schema version a stored save declares: its `schemaVersion`; undefined for an envelope
 * shape without one (the migrator rejects it); 0 for a bare save, as `SchemaMigrator` reads it.
 */
function declaredVersion(record: SaveRecord): number | undefined {
  if (typeof record.schemaVersion === 'number') return record.schemaVersion;
  if (record.data && record.timestamp) return undefined;
  return 0;
}

/**
 * Runs a stored save through the migrator, throwing a `SaveLoadError` whose reason comes from
 * the save itself: its version above the engine's is `newer-than-engine`; a version below it
 * (a save under the version floor, or a forward step that threw) is `migration-failed`;
 * anything unreadable is `corrupt`. A save with no version and no envelope shape counts as
 * version 0, as `SchemaMigrator` reads it.
 */
export function migrateForLoad(
  raw: unknown,
  migrator: SchemaMigrator = defaultMigrator,
  targetVersion: number = CURRENT_SCHEMA_VERSION
): VersionedSaveEnvelope {
  let input: unknown = raw;
  if (typeof raw === 'string') {
    try {
      input = JSON.parse(raw);
    } catch (err) {
      throw new SaveLoadError('corrupt', `Failed to parse save JSON: ${(err as Error).message}`);
    }
  }
  if (!input || typeof input !== 'object') {
    throw new SaveLoadError('corrupt', 'Invalid save payload: expected an object.');
  }
  const version = declaredVersion(input as SaveRecord);
  if (version !== undefined && version > targetVersion) {
    throw new SaveLoadError('newer-than-engine', `Save schema version ${version} is newer than engine version ${targetVersion}.`);
  }
  try {
    return migrator.migrate(input, targetVersion).envelope;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new SaveLoadError(version !== undefined && version < targetVersion ? 'migration-failed' : 'corrupt', detail);
  }
}

/**
 * Maps a thrown load error onto a reason. Only a `SaveLoadError` (from `migrateForLoad`)
 * carries one; anything else, a deserializer's throw included, is `corrupt`: the save exists
 * but could not be read.
 */
export function classifyLoadError(err: unknown): LoadFailure {
  const detail = err instanceof Error ? err.message : String(err);
  const reason: FailureReason = err instanceof SaveLoadError ? err.reason : 'corrupt';
  return { ok: false, reason, message: PLAYER_MESSAGES[reason], detail };
}
