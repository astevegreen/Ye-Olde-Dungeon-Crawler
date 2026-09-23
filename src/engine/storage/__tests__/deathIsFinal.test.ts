import { describe, it, expect, beforeEach } from 'vitest';
import { ProfileManager, MemoryStorage } from '../profile-manager';
import { AutosaveManager } from '../autosaveManager';
import { resolveContinueTarget } from '../continueTarget';

// A dead player's state is never written as a loadable save, and Continue never
// resumes a fallen run; earlier saves stay loadable (ARCHITECTURE.md §5).
describe('death is final for the dead state', () => {
  let storage: MemoryStorage;
  let profiles: ProfileManager;
  let autosaves: AutosaveManager;

  beforeEach(() => {
    storage = new MemoryStorage();
    profiles = new ProfileManager(storage);
    autosaves = new AutosaveManager(storage);
  });

  function kill(engine: { player: { takeDamage(n: number): unknown; isAlive(): boolean } }): void {
    engine.player.takeDamage(1_000_000);
    expect(engine.player.isAlive()).toBe(false);
  }

  it('keeps the last living save in the slot and records the death on the roster', () => {
    const { profile, engine } = profiles.createCharacter('Sven', { hp: 40 });
    profiles.saveCharacter(engine, profile);
    const livingSave = storage.getItem(`${profiles.saveKeyPrefix}${profile.id}`);

    kill(engine);
    profiles.saveCharacter(engine, { ...profile, questStatus: 'fallen', epitaph: 'Slain by a test' });

    expect(storage.getItem(`${profiles.saveKeyPrefix}${profile.id}`)).toBe(livingSave);
    expect(profiles.getProfile(profile.id)).toMatchObject({ questStatus: 'fallen', epitaph: 'Slain by a test' });
    expect(profiles.loadCharacter(profile.id)?.engine.player.isAlive()).toBe(true);
  });

  it('records the current floor on the roster', () => {
    const { profile, engine } = profiles.createCharacter('Astrid', { hp: 35 });
    engine.changeFloor(3);
    profiles.saveCharacter(engine, profile);
    expect(profiles.getProfile(profile.id)?.floor).toBe(3);
  });

  it('never autosaves a dead player', () => {
    const { profile, engine } = profiles.createCharacter('Bjorn', { hp: 30 });
    expect(autosaves.autosave(engine, profile)).toBe(true);
    const livingAutosave = storage.getItem(autosaves.autosaveKey);

    kill(engine);

    expect(autosaves.autosave(engine, profile)).toBe(false);
    expect(storage.getItem(autosaves.autosaveKey)).toBe(livingAutosave);
  });

  describe('Continue', () => {
    it('resumes the autosave while its run is alive', () => {
      const { profile, engine } = profiles.createCharacter('Freya', { hp: 30 });
      profiles.saveCharacter(engine, profile);
      autosaves.autosave(engine, profile);

      expect(resolveContinueTarget(profiles, autosaves)).toMatchObject({ kind: 'autosave', profileId: profile.id });
    });

    it('is unavailable once the only run has fallen, though its saves remain', () => {
      const { profile, engine } = profiles.createCharacter('Sven', { hp: 40 });
      profiles.saveCharacter(engine, profile);
      autosaves.autosave(engine, profile);

      kill(engine);
      profiles.saveCharacter(engine, { ...profile, questStatus: 'fallen' });

      expect(resolveContinueTarget(profiles, autosaves)).toBeNull();
      expect(autosaves.hasAutosave()).toBe(true);
      expect(profiles.loadCharacter(profile.id)).not.toBeNull();
    });

    it('skips a fallen run and offers the latest living hero instead', () => {
      const living = profiles.createCharacter('Astrid', { hp: 35 });
      profiles.saveCharacter(living.engine, living.profile);
      const fallen = profiles.createCharacter('Sven', { hp: 40 });
      profiles.saveCharacter(fallen.engine, fallen.profile);
      autosaves.autosave(fallen.engine, fallen.profile);
      kill(fallen.engine);
      profiles.saveCharacter(fallen.engine, { ...fallen.profile, questStatus: 'fallen' });

      expect(resolveContinueTarget(profiles, autosaves)).toMatchObject({ kind: 'profile', profileId: living.profile.id });
    });
  });
});
