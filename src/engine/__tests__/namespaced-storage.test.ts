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
      bossFloor: 5,
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

  const warcraftManifest: GameContentManifest = {
    id: 'warcraft',
    name: 'Warcraft: Orcs & Humans',
    monsters: [],
    items: [],
    spells: [],
    town: {
      name: 'Stormwind Outpost',
      width: 20,
      height: 20,
      playerSpawn: { x: 5, y: 5 },
      stairsDown: { x: 5, y: 6 },
      buildings: [],
      npcs: [],
    },
    quest: {
      id: 'warcraft_quest',
      name: 'Blackrock Spire',
      maxFloor: 5,
      bossFloor: 5,
      bossMonsterId: 'blackhand',
      relicItemId: 'horde_banner',
      victoryNpcId: 'lothar',
      victoryFloor: 0,
      victoryDialogue: 'For the Alliance!',
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
    atlas: { themeId: 'warcraft' },
    starterKit: { weaponItemId: 'warhammer' },
  };

  it('isolates save files and rosters between CotW and Warcraft manifests in shared storage', () => {
    const sharedStorage = new MemoryStorage();

    const cotwManager = new ProfileManager(sharedStorage, cotwManifest);
    const warcraftManager = new ProfileManager(sharedStorage, warcraftManifest);

    // Create a hero in CotW
    const { profile: cotwHero } = cotwManager.createCharacter('Bjorn', { manifest: cotwManifest });

    // Create a hero in Warcraft
    const { profile: warcraftHero } = warcraftManager.createCharacter('Lothar', { manifest: warcraftManifest });

    // CotW roster must contain only Bjorn
    const cotwProfiles = cotwManager.listProfiles();
    expect(cotwProfiles).toHaveLength(1);
    expect(cotwProfiles[0].name).toBe('Bjorn');
    expect(cotwProfiles[0].id).toBe(cotwHero.id);

    // Warcraft roster must contain only Lothar
    const warcraftProfiles = warcraftManager.listProfiles();
    expect(warcraftProfiles).toHaveLength(1);
    expect(warcraftProfiles[0].name).toBe('Lothar');
    expect(warcraftProfiles[0].id).toBe(warcraftHero.id);

    // Storage keys must be distinct
    expect(sharedStorage.getItem(`cotw_profile_roster_v2`)).not.toBeNull();
    expect(sharedStorage.getItem(`warcraft_profile_roster_v2`)).not.toBeNull();
    expect(sharedStorage.getItem(`cotw_save_${cotwHero.id}`)).not.toBeNull();
    expect(sharedStorage.getItem(`warcraft_save_${warcraftHero.id}`)).not.toBeNull();

    // CotW manager cannot load Warcraft hero and vice versa
    expect(cotwManager.loadCharacter(warcraftHero.id)).toBeNull();
    expect(warcraftManager.loadCharacter(cotwHero.id)).toBeNull();
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
