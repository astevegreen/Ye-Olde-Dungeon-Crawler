import { describe, it, expect } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { createTestKoboldShaman } from '../../__fixtures__/testHelpers';
import { GameEngine } from '../../engine';
import { serializeGame, deserializeGame } from '../serializer';
import type { CharacterProfile } from '../types';

describe('Status Effects & Monster AI Persistence', () => {
  it('preserves active status effects, monster AI states, and player XP across save and load', () => {
    const map = new GameMap(12, 12, TILES.FLOOR);
    const player = new Player({
      id: 'hero-test',
      name: 'Ragnar',
      position: { x: 3, y: 3 },
      stats: { hp: 35, maxHp: 35, attack: 10, defense: 4 },
      level: 2,
      xp: 45,
    });

    // Afflict player with poison and slow
    player.statusManager.applyStatus({ type: 'poison', duration: 4, potency: 3 });
    player.statusManager.applyStatus({ type: 'slow', duration: 6 });

    const engine = new GameEngine({ map, player });

    // Add a Kobold Shaman in combat state afflicted with paralysis
    const shaman = createTestKoboldShaman('shaman-saved', { x: 7, y: 3 });
    shaman.aiState = 'combat';
    shaman.spellCooldown = 1;
    shaman.statusManager.applyStatus({ type: 'paralysis', duration: 2 });
    engine.addEntity(shaman);

    const profile: CharacterProfile = {
      id: player.id,
      name: player.name,
      level: player.level,
      floor: 1,
      lastSaved: Date.now(),
      hp: player.hp,
      maxHp: player.maxHp,
      strength: player.strength,
      mana: player.mana,
      maxMana: player.maxMana,
      xp: player.xp,
      xpToNextLevel: player.xpToNextLevel,
    };

    // Serialize
    const saveData = serializeGame(engine, profile);

    expect(saveData.player.level).toBe(2);
    expect(saveData.player.xp).toBe(45);
    expect(saveData.player.statusEffects).toHaveLength(2);
    expect(saveData.map.monsters).toHaveLength(1);
    expect(saveData.map.monsters[0].definitionId).toBe('kobold_shaman');
    expect(saveData.map.monsters[0].aiState).toBe('combat');
    expect(saveData.map.monsters[0].statusEffects).toHaveLength(1);

    // Deserialize
    const restored = deserializeGame(saveData);
    const restoredPlayer = restored.engine.player;

    expect(restoredPlayer.level).toBe(2);
    expect(restoredPlayer.xp).toBe(45);
    expect(restoredPlayer.statusManager.hasStatus('poison')).toBe(true);
    expect(restoredPlayer.statusManager.getStatus('poison')?.potency).toBe(3);
    expect(restoredPlayer.statusManager.hasStatus('slow')).toBe(true);

    const restoredShaman = restored.engine.map.getEntityById('shaman-saved') as Monster;
    expect(restoredShaman).toBeDefined();
    expect(restoredShaman.definitionId).toBe('kobold_shaman');
    expect(restoredShaman.aiState).toBe('combat');
    expect(restoredShaman.statusManager.hasStatus('paralysis')).toBe(true);
    expect(restoredShaman.spells).toContain('firebolt');
  });
});
