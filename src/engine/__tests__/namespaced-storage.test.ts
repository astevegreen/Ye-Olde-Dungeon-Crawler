import { describe, it, expect } from 'vitest';
import { ProfileManager, MemoryStorage } from '../storage/profile-manager';
import type { GameContentManifest } from '../types/manifest';

describe('Manifest-Namespaced Storage Isolation', () => {
  const cotwManifest: GameContentManifest = {
    id: 'cotw',
    name: 'Castle of the Winds',
    monsters: [],
    items: [],
    spells: [],
    town: {
      name: 'Bjarnarhaven',
      width: 20,
      height: 20,
      playerSpawn: { x: 5, y: 5 },
      stairsDown: { x: 5, y: 6 },
      buildings: [],
      npcs: [],
    },
    quest: {
      id: 'cotw_quest',
      name: 'Main Quest',
      maxFloor: 5,
      bossMonsterId: 'hrungnir',
      relicItemId: 'relic',
      victoryNpcId: 'elder',
      victoryFloor: 0,
      victoryDialogue: 'Victory!',
      victoryScoreBonus: 5000,
      bossFloorLayout: {
        width: 20,
        height: 20,
        playerSpawn: { x: 10, y: 10 },
        stairsUp: { x: 10, y: 11 },
        bossSpawn: { x: 10, y: 5 },
      },
      floorEncounters: {},
    },
    atlas: { themeId: 'classic' },
    starterKit: { weaponItemId: 'dagger' },
  };

  const fixtureManifest: GameContentManifest = {
    id: 'fixture',
    name: 'Fixture Pack',
    monsters: [],
    items: [],
    spells: [],
    town: {
      name: 'Fixture Keep',
      width: 20,
      height: 20,
      playerSpawn: { x: 5, y: 5 },
      stairsDown: { x: 5, y: 6 },
      buildings: [],
      npcs: [],
    },
    quest: {
      id: 'fixture_quest',
      name: 'Fixture Quest',
      maxFloor: 5,
      bossMonsterId: 'warlord',
      relicItemId: 'war_banner',
      victoryNpcId: 'captain',
      victoryFloor: 0,
      victoryDialogue: 'The banner is home!',
      victoryScoreBonus: 5000,
      bossFloorLayout: {
        width: 20,
        height: 20,
        playerSpawn: { x: 10, y: 10 },
        stairsUp: { x: 10, y: 11 },
        bossSpawn: { x: 10, y: 5 },
      },
      floorEncounters: {},
    },
    atlas: { themeId: 'fixture' },
    starterKit: { weaponItemId: 'broadsword' },
  };

  it('isolates save files and rosters between the manifests of two packs in shared storage', () => {
    const sharedStorage = new MemoryStorage();

    const cotwManager = new ProfileManager(sharedStorage, cotwManifest);
    const fixtureManager = new ProfileManager(sharedStorage, fixtureManifest);

    // Create a hero in CotW
    const { profile: cotwHero } = cotwManager.createCharacter('Bjorn', { manifest: cotwManifest });

    // Create a hero in the fixture pack
    const { profile: fixtureHero } = fixtureManager.createCharacter('Ash', { manifest: fixtureManifest });

    // CotW roster must contain only Bjorn
    const cotwProfiles = cotwManager.listProfiles();
    expect(cotwProfiles).toHaveLength(1);
    expect(cotwProfiles[0].name).toBe('Bjorn');
    expect(cotwProfiles[0].id).toBe(cotwHero.id);

    // The fixture roster must contain only Ash
    const fixtureProfiles = fixtureManager.listProfiles();
    expect(fixtureProfiles).toHaveLength(1);
    expect(fixtureProfiles[0].name).toBe('Ash');
    expect(fixtureProfiles[0].id).toBe(fixtureHero.id);

    // Storage keys must be distinct
    expect(sharedStorage.getItem(`cotw_profile_roster_v2`)).not.toBeNull();
    expect(sharedStorage.getItem(`fixture_profile_roster_v2`)).not.toBeNull();
    expect(sharedStorage.getItem(`cotw_save_${cotwHero.id}`)).not.toBeNull();
    expect(sharedStorage.getItem(`fixture_save_${fixtureHero.id}`)).not.toBeNull();

    // CotW manager cannot load the fixture hero and vice versa
    expect(cotwManager.loadCharacter(fixtureHero.id)).toBeNull();
    expect(fixtureManager.loadCharacter(cotwHero.id)).toBeNull();
  });

  it('ignores un-namespaced keys left by an unrelated app on the same origin', () => {
    const sharedStorage = new MemoryStorage();

    const manager = new ProfileManager(sharedStorage, cotwManifest);
    const { profile: hero } = manager.createCharacter('Bjorn', { manifest: cotwManifest });

    // A bare, un-namespaced key must never be consulted as a fallback.
    sharedStorage.setItem('cotw_roster_manifest', JSON.stringify({ profiles: [{ id: 'ghost', name: 'Ghost' }] }));

    const profiles = manager.listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe(hero.id);
    expect(manager.loadCharacter('ghost')).toBeNull();
  });
});
