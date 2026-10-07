import type { CharacterProfile } from '../engine';

const REPLAY_ID_PREFIX = 'replay-';

/**
 * The profile a run loaded from a bug report plays under (F2 > Load State From Report).
 * The report carries its hero's profile id, so saving under it would overwrite that
 * hero's real character slot and autosave (R-main-10); a `replay-` id is a slot of its own.
 */
export function replayProfile(profile: CharacterProfile): CharacterProfile {
  const id = isReplayProfile(profile) ? profile.id : `${REPLAY_ID_PREFIX}${profile.id}`;
  return { ...profile, id };
}

/**
 * A replayed run never autosaves: the autosave is one rolling slot, so a replay's would push
 * the real hero's aside and Continue would resume the replay. Save & Quit still saves it.
 */
export function isReplayProfile(profile: CharacterProfile): boolean {
  return profile.id.startsWith(REPLAY_ID_PREFIX);
}
