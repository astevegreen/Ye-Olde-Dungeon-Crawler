import { describe, it, expect } from 'vitest';
import { isReplayProfile, replayProfile } from '../replayProfile';
import type { CharacterProfile } from '../../engine';

describe('replayProfile', () => {
  const reported = { id: 'hero_1759700000000_ab12', name: 'Astrid', questStatus: 'active' } as CharacterProfile;

  it('gives the replayed run an id of its own, so its saves cannot overwrite the reported hero', () => {
    const profile = replayProfile(reported);
    expect(profile.id).not.toBe(reported.id);
    expect(profile.id.startsWith('replay-')).toBe(true);
    expect({ ...profile, id: reported.id }).toEqual(reported);
  });

  it('leaves the report\'s own profile untouched', () => {
    replayProfile(reported);
    expect(reported.id).toBe('hero_1759700000000_ab12');
  });

  it('keeps the id of a report taken from a replayed run', () => {
    const once = replayProfile(reported);
    expect(replayProfile(once).id).toBe(once.id);
  });

  it('tells a replayed run, which never autosaves, from the hero it was taken from', () => {
    expect(isReplayProfile(replayProfile(reported))).toBe(true);
    expect(isReplayProfile(reported)).toBe(false);
  });
});
