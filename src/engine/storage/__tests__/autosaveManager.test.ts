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
