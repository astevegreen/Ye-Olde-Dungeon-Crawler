import { describe, it, expect, beforeEach } from 'vitest';
import { AutosaveManager } from '../autosaveManager';
import { MemoryStorage } from '../profile-manager';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import type { CharacterProfile } from '../types';

describe('AutosaveManager Background Persistence', () => {
  let storage: MemoryStorage;
  let autosaveManager: AutosaveManager;
  let engine: GameEngine;
  let profile: CharacterProfile;

  beforeEach(() => {
    storage = new MemoryStorage();
    autosaveManager = new AutosaveManager(storage);

    const map = new GameMap(15, 15, TILES.FLOOR);
    const player = new Player({
      id: 'p1',
      name: 'Valkyrie',
      position: { x: 5, y: 5 },
      stats: { hp: 45, maxHp: 50, attack: 8, defense: 3 },
      mana: 20,
      maxMana: 25,
    });
    player.quickSpells = ['firebolt', null, null, null, null, null, null, null, null, null];
    engine = new GameEngine({ map, player, floor: 3 });

    profile = {
      id: 'prof-valk',
      name: 'Valkyrie',
      difficulty: 'medium',
      level: 2,
      floor: 3,
      lastSaved: Date.now(),
      questStatus: 'active',
      hp: 45,
      maxHp: 50,
      mana: 20,
      maxMana: 25,
      strength: 14,
      xp: 120,
      xpToNextLevel: 200,
    };
  });

  it('determines autosave intervals accurately (every 50 turns)', () => {
    expect(autosaveManager.shouldAutosave(0)).toBe(false);
    expect(autosaveManager.shouldAutosave(1)).toBe(false);
    expect(autosaveManager.shouldAutosave(49)).toBe(false);
    expect(autosaveManager.shouldAutosave(50)).toBe(true);
    expect(autosaveManager.shouldAutosave(51)).toBe(false);
    expect(autosaveManager.shouldAutosave(100)).toBe(true);
    expect(autosaveManager.shouldAutosave(150)).toBe(true);
  });

  it('persists and loads game state including player quickSpells and floor', () => {
    expect(autosaveManager.hasAutosave()).toBe(false);

    const saved = autosaveManager.autosave(engine, profile);
    expect(saved).toBe(true);
    expect(autosaveManager.hasAutosave()).toBe(true);

    const meta = autosaveManager.getAutosaveMetadata();
    expect(meta).not.toBeNull();
    expect(meta?.profileName).toBe('Valkyrie');
    expect(meta?.floor).toBe(3);

    const loaded = autosaveManager.loadAutosave();
    expect(loaded).not.toBeNull();
    expect(loaded?.profile.name).toBe('Valkyrie');
    expect(loaded?.engine.currentFloor).toBe(3);
    expect(loaded?.engine.player.name).toBe('Valkyrie');
    expect(loaded?.engine.player.hp).toBe(45);
    expect(loaded?.engine.player.quickSpells[0]).toBe('firebolt');
  });

  it('clears autosave successfully', () => {
    autosaveManager.autosave(engine, profile);
    expect(autosaveManager.hasAutosave()).toBe(true);

    autosaveManager.clearAutosave();
    expect(autosaveManager.hasAutosave()).toBe(false);
    expect(autosaveManager.loadAutosave()).toBeNull();
  });

  describe('never erases deeper progress', () => {
    const autosaveAt = (floor: number, who: CharacterProfile = profile) => {
      engine.changeFloor(floor);
      expect(autosaveManager.autosave(engine, who)).toBe(true);
    };

    it('preserves the deeper autosave when the same hero autosaves higher up', () => {
      autosaveAt(6);
      autosaveAt(3);

      expect(autosaveManager.getAutosaveMetadata('latest')?.floor).toBe(3);
      expect(autosaveManager.getAutosaveMetadata('preserved')?.floor).toBe(6);
      expect(autosaveManager.loadAutosaveResult(undefined, 'preserved')).toMatchObject({
        ok: true,
        value: { engine: { currentFloor: 6 } },
      });
    });

    it('does not preserve anything while the hero keeps descending or stays put', () => {
      autosaveAt(3);
      autosaveAt(4);
      autosaveAt(4);

      expect(autosaveManager.getAutosaveMetadata('preserved')).toBeNull();
    });

    it("preserves one hero's autosave when another hero's would overwrite it", () => {
      autosaveAt(6);
      autosaveAt(1, { ...profile, id: 'prof-other', name: 'Other' });

      expect(autosaveManager.getAutosaveMetadata('latest')).toMatchObject({ profileName: 'Other', floor: 1 });
      expect(autosaveManager.getAutosaveMetadata('preserved')).toMatchObject({ profileName: 'Valkyrie', floor: 6 });
    });

    it("keeps the same hero's deepest run through repeated retreats", () => {
      autosaveAt(6);
      autosaveAt(4);
      autosaveAt(2);

      expect(autosaveManager.getAutosaveMetadata('latest')?.floor).toBe(2);
      expect(autosaveManager.getAutosaveMetadata('preserved')?.floor).toBe(6);
    });

    it('still autosaves when the preserved copy cannot be written', () => {
      autosaveAt(6);
      const realSetItem = storage.setItem.bind(storage);
      storage.setItem = (key: string, value: string) => {
        if (key === autosaveManager.preservedAutosaveKey) throw new Error('Quota exceeded');
        realSetItem(key, value);
      };

      autosaveAt(3);

      expect(autosaveManager.getAutosaveMetadata('latest')?.floor).toBe(3);
    });

    it('clears both slots', () => {
      autosaveAt(6);
      autosaveAt(3);
      autosaveManager.clearAutosave();

      expect(autosaveManager.getAutosaveMetadata('latest')).toBeNull();
      expect(autosaveManager.getAutosaveMetadata('preserved')).toBeNull();
    });
  });

  it('handles storage errors gracefully without throwing', () => {
    const errorStorage = {
      getItem: () => { throw new Error('Storage disabled'); },
      setItem: () => { throw new Error('Quota exceeded'); },
      removeItem: () => { throw new Error('Storage disabled'); },
      clear: () => {},
      key: () => null,
      length: 0,
    };
    const manager = new AutosaveManager(errorStorage);

    expect(manager.hasAutosave()).toBe(false);
    expect(manager.autosave(engine, profile)).toBe(false);
    expect(manager.loadAutosave()).toBeNull();
    expect(() => manager.clearAutosave()).not.toThrow();
  });
});
