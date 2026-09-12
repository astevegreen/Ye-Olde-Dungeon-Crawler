import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameEngine, GameMap, Player, TILES, serializeGame, deserializeGame, type GameEvent, type CharacterProfile } from '../src/engine';
import { DeathResolver } from '../src/engine/combat/deathResolver';
import { Monster } from '../src/engine/entities/monster';
import { LevelUpModal } from '../src/ui/levelUpModal';
import { ModalStackManager } from '../src/ui/modalStack';

describe('Level-Up Attribute / Skill Allocation System', () => {
  let engine: GameEngine;
  let player: Player;
  let map: GameMap;

  beforeEach(() => {
    map = new GameMap(20, 20, TILES.FLOOR);
    player = new Player({
      name: 'Ragnor',
      position: { x: 5, y: 5 },
      strength: 14,
      dexterity: 12,
      constitution: 13,
      intelligence: 10,
      unspentStatPoints: 0,
    });
    engine = new GameEngine({ map, player });
  });

  it('awards unspent stat points on level up and dispatches player_leveled_up GameEvent', () => {
    const eventSpy = vi.fn();
    engine.onGameEvent = eventSpy;

    expect(player.level).toBe(1);
    expect(player.unspentStatPoints).toBe(0);

    // Create an enemy with sufficient XP to level up (XP needed for lvl 2 is 50)
    const monster = new Monster({
      id: 'orc-1',
      name: 'Orc',
      position: { x: 5, y: 6 },
      xpValue: 60,
      stats: {
        hp: 1,
        maxHp: 1,
        attack: 1,
        defense: 1,
      },
    });
    engine.addEntity(monster);

    DeathResolver.resolveDeath(engine, player, monster);

    expect(player.level).toBe(2);
    expect(player.unspentStatPoints).toBe(3);
    expect(eventSpy).toHaveBeenCalledTimes(1);

    const emittedEvent = eventSpy.mock.calls[0][0] as GameEvent;
    expect(emittedEvent.type).toBe('player_leveled_up');
    if (emittedEvent.type === 'player_leveled_up') {
      expect(emittedEvent.player).toBe(player);
      expect(emittedEvent.newLevel).toBe(2);
      expect(emittedEvent.statPointsAwarded).toBe(3);
      expect(emittedEvent.unspentStatPoints).toBe(3);
    }
  });

  it('allocates attribute points, increments base values, and derives HP/Mana buffs', () => {
    player.unspentStatPoints = 4;
    const initialStrength = player.strength;
    const initialDex = player.dexterity;
    const initialCon = player.constitution;
    const initialInt = player.intelligence;
    const initialHp = player.maxHp;
    const initialMana = player.maxMana;

    // Allocate 1 strength
    expect(player.allocateAttribute('strength', 1)).toBe(true);
    expect(player.strength).toBe(initialStrength + 1);
    expect(player.unspentStatPoints).toBe(3);

    // Allocate 1 dexterity
    expect(player.allocateAttribute('dexterity', 1)).toBe(true);
    expect(player.dexterity).toBe(initialDex + 1);
    expect(player.unspentStatPoints).toBe(2);

    // Allocate 1 constitution (+2 Max HP)
    expect(player.allocateAttribute('constitution', 1)).toBe(true);
    expect(player.constitution).toBe(initialCon + 1);
    expect(player.maxHp).toBe(initialHp + 2);
    expect(player.hp).toBe(player.maxHp);
    expect(player.unspentStatPoints).toBe(1);

    // Allocate 1 intelligence (+2 Max Mana)
    expect(player.allocateAttribute('intelligence', 1)).toBe(true);
    expect(player.intelligence).toBe(initialInt + 1);
    expect(player.maxMana).toBe(initialMana + 2);
    expect(player.mana).toBe(player.maxMana);
    expect(player.unspentStatPoints).toBe(0);

    // Should reject further allocation when points are exhausted
    expect(player.allocateAttribute('strength', 1)).toBe(false);
    expect(player.strength).toBe(initialStrength + 1);
  });

  it('persists unspentStatPoints through serialization and deserialization cycles', () => {
    player.unspentStatPoints = 5;
    player.level = 3;

    const profile: CharacterProfile = {
      id: 'ragnor-1',
      name: 'Ragnor',
      level: 3,
      floor: 1,
      lastSaved: Date.now(),
      hp: player.hp,
      maxHp: player.maxHp,
      strength: player.strength,
      unspentStatPoints: 5,
    };

    const serialized = serializeGame(engine, profile);
    expect(serialized.player.unspentStatPoints).toBe(5);
    expect(serialized.profile.unspentStatPoints).toBe(5);

    const reloaded = deserializeGame(serialized);
    expect(reloaded.engine.player.unspentStatPoints).toBe(5);
    expect(reloaded.profile.unspentStatPoints).toBe(5);
  });

  it('integrates LevelUpModal with ModalStackManager and keyboard allocation', () => {
    player.unspentStatPoints = 2;
    const modal = new LevelUpModal();
    const modalStack = new ModalStackManager();

    modal.open(engine);
    modalStack.push(modal);

    expect(modal.isOpen).toBe(true);
    expect(modalStack.top()?.id).toBe('level-up-modal');

    // Key '1' / 'Digit1' allocates strength
    const key1Event = { key: '1', code: 'Digit1', preventDefault: () => {} } as unknown as KeyboardEvent;
    const handled1 = modalStack.handleKeyDown(key1Event);
    expect(handled1).toBe(true);
    expect(player.strength).toBe(15);
    expect(player.unspentStatPoints).toBe(1);

    // Key 'KeyC' allocates constitution
    const keyCEvent = { key: 'c', code: 'KeyC', preventDefault: () => {} } as unknown as KeyboardEvent;
    const handledC = modalStack.handleKeyDown(keyCEvent);
    expect(handledC).toBe(true);
    expect(player.constitution).toBe(14);
    expect(player.unspentStatPoints).toBe(0);

    // Escape closes modal
    const escEvent = { key: 'Escape', code: 'Escape', preventDefault: () => {} } as unknown as KeyboardEvent;
    modalStack.handleKeyDown(escEvent);
    expect(modal.isOpen).toBe(false);
  });
});
