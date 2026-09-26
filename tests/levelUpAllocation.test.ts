import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameEngine, GameMap, Player, TILES, serializeGame, deserializeGame, type GameEvent, isGameEvent, type CharacterProfile } from '../src/engine';
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
    // A kill now also emits entity_killed (§4), so assert on the level-up event itself
    // rather than the total number of events the turn produced.
    const levelUpCalls = eventSpy.mock.calls
      .map((c) => c[0] as GameEvent)
      .filter((e) => e.type === 'player_leveled_up');
    expect(levelUpCalls).toHaveLength(1);

    const emittedEvent = levelUpCalls[0];
    if (isGameEvent(emittedEvent, 'player_leveled_up')) {
      // Events carry scalar IDs, never live entity references (ARCHITECTURE.md §4).
      expect(emittedEvent.actorId).toBe(player.id);
      expect(emittedEvent.turn).toBe(engine.turnCount);
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

    // Debounce safety: keys within 200ms of opening are dropped
    const rapidKey = { key: 's', code: 'KeyS', preventDefault: () => {} } as unknown as KeyboardEvent;
    expect(modalStack.handleKeyDown(rapidKey)).toBe(true);
    // Dropped during debounce window
    expect(player.strength).toBe(14);
    expect(player.unspentStatPoints).toBe(2);

    // After debounce window:
    (modal as any).openedAt = 0;

    // Number keys (e.g. Digit1, Numpad1) must NOT allocate attributes (prevent accidental movement allocations)
    const key1Event = { key: '1', code: 'Digit1', preventDefault: () => {} } as unknown as KeyboardEvent;
    const handled1 = modalStack.handleKeyDown(key1Event);
    expect(handled1).toBe(true);
    expect(player.strength).toBe(14);
    expect(player.unspentStatPoints).toBe(2);

    // Key 'KeyS' allocates strength
    const keySEvent = { key: 's', code: 'KeyS', preventDefault: () => {} } as unknown as KeyboardEvent;
    const handledS = modalStack.handleKeyDown(keySEvent);
    expect(handledS).toBe(true);
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
    expect(modalStack.isEmpty()).toBe(true);
  });

  it('allows undo and redo of attribute allocations in LevelUpModal and hotkeys', () => {
    player.unspentStatPoints = 3;
    const initialStrength = player.strength;
    const modal = new LevelUpModal();

    modal.open(engine);
    (modal as any).openedAt = 0;

    // Allocate Strength via modal method
    expect(modal.allocate('strength')).toBe(true);
    expect(player.strength).toBe(initialStrength + 1);
    expect(player.unspentStatPoints).toBe(2);

    // Allocate Dexterity via modal method
    expect(modal.allocate('dexterity')).toBe(true);
    expect(player.dexterity).toBe(13);
    expect(player.unspentStatPoints).toBe(1);

    // Undo via hotkey 'Z'
    const zEvent = { key: 'z', code: 'KeyZ', preventDefault: () => {} } as unknown as KeyboardEvent;
    expect(modal.handleKeyDown(zEvent)).toBe(true);
    // Dexterity should be reverted
    expect(player.dexterity).toBe(12);
    expect(player.unspentStatPoints).toBe(2);

    // Redo via hotkey 'Y'
    const yEvent = { key: 'y', code: 'KeyY', preventDefault: () => {} } as unknown as KeyboardEvent;
    expect(modal.handleKeyDown(yEvent)).toBe(true);
    // Dexterity re-applied
    expect(player.dexterity).toBe(13);
    expect(player.unspentStatPoints).toBe(1);

    // Reset via hotkey 'R'
    const rEvent = { key: 'r', code: 'KeyR', preventDefault: () => {} } as unknown as KeyboardEvent;
    expect(modal.handleKeyDown(rEvent)).toBe(true);
    expect(player.strength).toBe(initialStrength);
    expect(player.dexterity).toBe(12);
    expect(player.unspentStatPoints).toBe(3);
  });

  it('deallocates attribute points safely and prevents deallocating below baseline', () => {
    player.unspentStatPoints = 2;
    const baselineStrength = player.strength;

    // Cannot deallocate when none allocated
    expect(player.deallocateAttribute('strength', 1)).toBe(false);
    expect(player.strength).toBe(baselineStrength);

    // Allocate 2
    expect(player.allocateAttribute('strength', 2)).toBe(true);
    expect(player.strength).toBe(baselineStrength + 2);
    expect(player.unspentStatPoints).toBe(0);

    // Deallocate 1
    expect(player.deallocateAttribute('strength', 1)).toBe(true);
    expect(player.strength).toBe(baselineStrength + 1);
    expect(player.unspentStatPoints).toBe(1);

    // Deallocate remaining 1
    expect(player.deallocateAttribute('strength', 1)).toBe(true);
    expect(player.strength).toBe(baselineStrength);
    expect(player.unspentStatPoints).toBe(2);

    // Further deallocation refused
    expect(player.deallocateAttribute('strength', 1)).toBe(false);
    expect(player.strength).toBe(baselineStrength);
    expect(player.unspentStatPoints).toBe(2);
  });

  it('persists allocatedAttributes through save serialization and deserialization', () => {
    player.unspentStatPoints = 2;
    player.allocateAttribute('constitution', 2);

    const serialized = serializeGame(engine);
    expect(serialized.player.allocatedAttributes?.constitution).toBe(2);

    const reloaded = deserializeGame(serialized);
    expect(reloaded.engine.player.allocatedAttributes.constitution).toBe(2);

    // Should be able to deallocate from reloaded save
    expect(reloaded.engine.player.deallocateAttribute('constitution', 1)).toBe(true);
    expect(reloaded.engine.player.allocatedAttributes.constitution).toBe(1);
    expect(reloaded.engine.player.unspentStatPoints).toBe(1);
  });
});
