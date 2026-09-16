/**
 * Typed load outcomes (ARCHITECTURE.md §5).
 *
 * Loads used to return `null` for every failure, so callers could not tell "no save here"
 * from "this save is corrupt" — and the player was told nothing. A load now reports which
 * of those happened, and presentation notifies for everything except `missing`.
 */
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

/**
 * Maps a thrown load error onto a reason, using the messages `SchemaMigrator` throws.
 * Anything unrecognised is treated as `corrupt`: the save exists but could not be read.
 */
export function classifyLoadError(err: unknown): LoadFailure {
  const detail = err instanceof Error ? err.message : String(err);

  if (detail.includes('is newer than engine version')) {
    return {
      ok: false,
      reason: 'newer-than-engine',
      message: 'This save was written by a newer version of the game and cannot be loaded.',
      detail,
    };
  }
  if (detail.includes('Missing migration function') || detail.includes('Schema migration')) {
    return {
      ok: false,
      reason: 'migration-failed',
      message: 'This save could not be upgraded to the current format.',
      detail,
    };
  }
  return {
    ok: false,
    reason: 'corrupt',
    message: 'This save is damaged and could not be loaded.',
    detail,
  };
}
