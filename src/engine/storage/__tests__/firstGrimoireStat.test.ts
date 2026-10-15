import { describe, it, expect } from 'vitest';
import { ProfileManager, MemoryStorage } from '../profile-manager';
import { fixtureManifest, FIXTURE_GRIMOIRES } from '../../../../tests/fixtures/fixture-pack';
import { statPickFor } from '../../magic/grimoires';
import type { GameContentManifest } from '../../types/manifest';

// The title screen's first-stat pick lands on the first axis of the first open grimoire.
const manifest: GameContentManifest = {
  ...fixtureManifest,
  magic: { ...fixtureManifest.magic, grimoires: FIXTURE_GRIMOIRES },
};

describe('the first grimoire stat chosen at run start', () => {
  it('goes onto the first open grimoire\'s first reaching axis', () => {
    const profiles = new ProfileManager(new MemoryStorage());
    const { engine } = profiles.createCharacter('Mani', { manifest, firstGrimoireStat: 'thrift' });
    const state = engine.player.grimoireState!;
    expect(state.opened.length).toBeGreaterThan(0);
    const picked = state.statPicks.filter((p) => p.statId === 'thrift');
    expect(picked).toHaveLength(1);
    expect(statPickFor(state, picked[0].grimoireId, picked[0].axis)).toBe('thrift');
  });

  it('picks nothing when none is given', () => {
    const profiles = new ProfileManager(new MemoryStorage());
    const { engine } = profiles.createCharacter('Mani', { manifest });
    expect(engine.player.grimoireState!.statPicks).toEqual([]);
  });
});
