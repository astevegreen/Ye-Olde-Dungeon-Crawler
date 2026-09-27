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

  const key = (k: string, code: string) =>
    ({ key: k, code, shiftKey: false, preventDefault: () => {} }) as unknown as KeyboardEvent;

  it('integrates LevelUpModal with ModalStackManager: letters plan points, Enter locks them in', () => {
    player.unspentStatPoints = 2;
    const modal = new LevelUpModal();
    const modalStack = new ModalStackManager();

    modal.open(engine);
    modalStack.push(modal);

    expect(modal.isOpen).toBe(true);
    expect(modalStack.top()?.id).toBe('level-up-modal');

    // Debounce safety: keys within 200ms of opening are dropped — Enter included
    expect(modalStack.handleKeyDown(key('s', 'KeyS'))).toBe(true);
    expect(modalStack.handleKeyDown(key('Enter', 'Enter'))).toBe(true);
    expect(modal.isOpen).toBe(true);
    expect(player.strength).toBe(14);
    expect(player.unspentStatPoints).toBe(2);

    (modal as any).openedAt = 0;

    // Number keys (e.g. Digit1, Numpad1) must NOT allocate attributes
    expect(modalStack.handleKeyDown(key('1', 'Digit1'))).toBe(true);
    expect(modalStack.handleKeyDown(key('1', 'Numpad1'))).toBe(true);

    // Letters only plan points — the player is untouched until accepted
    modalStack.handleKeyDown(key('s', 'KeyS'));
    modalStack.handleKeyDown(key('c', 'KeyC'));
    modalStack.handleKeyDown(key('c', 'KeyC')); // no third point to plan
    expect(player.strength).toBe(14);
    expect(player.constitution).toBe(13);
    expect(player.unspentStatPoints).toBe(2);

    // Enter locks them in and returns to the game
    modalStack.handleKeyDown(key('Enter', 'Enter'));
    expect(player.strength).toBe(15);
    expect(player.constitution).toBe(14);
    expect(player.unspentStatPoints).toBe(0);
    expect(modal.isOpen).toBe(false);
    expect(modalStack.isEmpty()).toBe(true);
  });

  it('Escape closes without spending planned points', () => {
    player.unspentStatPoints = 3;
    const modal = new LevelUpModal();
    modal.open(engine);
    (modal as any).openedAt = 0;

    modal.allocate('strength');
    modal.allocate('strength');
    modal.handleKeyDown(key('Escape', 'Escape'));

    expect(modal.isOpen).toBe(false);
    expect(player.strength).toBe(14);
    expect(player.unspentStatPoints).toBe(3);

    // Reopening starts from a clean plan
    modal.open(engine);
    (modal as any).openedAt = 0;
    expect(modal.deallocate('strength')).toBe(false);
  });

  it('undo, redo, reset and -1 only move points planned this session', () => {
    player.unspentStatPoints = 3;
    const modal = new LevelUpModal();
    modal.open(engine);
    (modal as any).openedAt = 0;

    // Previously locked-in points can never be taken back
    expect(modal.deallocate('strength')).toBe(false);

    expect(modal.allocate('strength')).toBe(true);
    expect(modal.allocate('strength')).toBe(true);
    expect(modal.allocate('strength')).toBe(true);
    expect(modal.allocate('dexterity')).toBe(false); // all 3 planned

    // -1 removes a planned point, freeing it for another attribute
    expect(modal.deallocate('strength')).toBe(true);
    expect(modal.allocate('dexterity')).toBe(true);

    // Undo via Z reverses the dexterity plan, Y redoes it
    modal.handleKeyDown(key('z', 'KeyZ'));
    expect((modal as any).draft.get('dexterity')).toBe(0);
    modal.handleKeyDown(key('y', 'KeyY'));
    expect((modal as any).draft.get('dexterity')).toBe(1);

    // Reset clears the whole plan
    modal.handleKeyDown(key('r', 'KeyR'));
    expect((modal as any).draft.total).toBe(0);

    // Re-plan all three into intelligence and accept
    modal.allocate('intelligence');
    modal.allocate('intelligence');
    modal.allocate('intelligence');
    modal.accept();
    expect(player.intelligence).toBe(13);
    expect(player.strength).toBe(14);
    expect(player.unspentStatPoints).toBe(0);
  });

  it('a new level-up cannot remove points locked in by an earlier one', () => {
    player.unspentStatPoints = 3;
    const modal = new LevelUpModal();
    modal.open(engine);
    (modal as any).openedAt = 0;
    modal.allocate('strength');
    modal.allocate('strength');
    modal.allocate('strength');
    modal.accept();
    expect(player.strength).toBe(17);

    player.unspentStatPoints = 3;
    modal.open(engine);
    (modal as any).openedAt = 0;
    expect(modal.deallocate('strength')).toBe(false);
    modal.handleKeyDown(key('z', 'KeyZ'));
    modal.handleKeyDown(key('r', 'KeyR'));
    modal.accept();
    expect(player.strength).toBe(17);
    expect(player.unspentStatPoints).toBe(3);
  });
});
