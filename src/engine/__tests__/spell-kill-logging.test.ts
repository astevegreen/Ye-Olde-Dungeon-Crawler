import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { CastSpellAction } from '../actions/spell-actions';
import { beforeEach, afterEach } from 'vitest';
import { registerSpells, SPELL_REGISTRY } from '../magic/spellRegistry';

describe('Unified Kill Logging & Spell Fatalities', () => {
  beforeEach(() => {
    registerSpells([
      { id: 'magic_arrow', name: 'Magic Arrow', school: 'Combat', manaCost: 3, element: 'arcane', range: 6, basePower: 8, areaOfEffect: 0, reflects: false, targetType: 'ray', targetingMode: 'ray', description: '', effects: [{ type: 'damage', amount: 8, element: 'arcane' }] },
      { id: 'firebolt', name: 'Firebolt', school: 'Combat', manaCost: 5, element: 'fire', range: 7, basePower: 12, areaOfEffect: 0, reflects: false, targetType: 'ray', targetingMode: 'ray', description: '', effects: [{ type: 'damage', amount: 12, element: 'fire' }] },
    ]);
  });
  afterEach(() => {
    for (const key of Object.keys(SPELL_REGISTRY)) delete SPELL_REGISTRY[key];
  });
  function setupEngine() {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({
      id: 'p1',
      name: 'Freya',
      position: { x: 2, y: 2 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
    });
    player.mana = 50;
    player.maxMana = 50;

    const engine = new GameEngine({ map, player });
    return { engine, map, player };
  }

  it('emits unified slain log "${victim.name} is slain! (+${xp} XP)" on lethal spell hit', () => {
    const { engine, map, player } = setupEngine();

    // Create a monster with low HP so magic bolt kills it
    const goblin = new Monster({
      id: 'gob-1',
      name: 'Goblin Scout',
      position: { x: 4, y: 2 },
      stats: { hp: 4, maxHp: 15, attack: 4, defense: 1 },
      xpValue: 20,
    });
    goblin.definitionId = 'goblin_scout';
    map.addEntity(goblin);

    // Cast magic_arrow at (4, 2)
    const action = new CastSpellAction(player, 'magic_arrow', 4, 2);
    const result = engine.handlePlayerAction(action);

    expect(result.success).toBe(true);
    expect(goblin.isAlive()).toBe(false);

    // Verify messages in event log
    const logs = engine.messages;
    
    // Must contain strike message
    const strikeLog = logs.find((l) => l.includes("Freya's Magic Arrow strikes Goblin Scout for"));
    expect(strikeLog).toBeDefined();

    // Must contain unified slain message with XP reward
    const slainLog = logs.find((l) => l.includes('Goblin Scout is slain! (+20 XP)'));
    expect(slainLog).toBeDefined();

    // Must NOT contain old non-standard phrase
    const oldDefeatedLog = logs.find((l) => l.includes('defeated Goblin'));
    expect(oldDefeatedLog).toBeUndefined();
  });

  it('emits unified slain log on lethal elemental Firebolt hit with weakness', () => {
    const { engine, map, player } = setupEngine();

    const troll = new Monster({
      id: 'troll-1',
      name: 'Frost Troll',
      position: { x: 5, y: 2 },
      stats: { hp: 10, maxHp: 40, attack: 8, defense: 2 },
      xpValue: 45,
    });
    troll.definitionId = 'frost_troll';
    troll.elementalResistances = { fire: 'weak' };
    map.addEntity(troll);

    // Cast firebolt at (5, 2)
    const action = new CastSpellAction(player, 'firebolt', 5, 2);
    const result = engine.handlePlayerAction(action);

    expect(result.success).toBe(true);
    expect(troll.isAlive()).toBe(false);

    const logs = engine.messages;
    const slainLog = logs.find((l) => l.includes('Frost Troll is slain! (+45 XP)'));
    expect(slainLog).toBeDefined();

    const vulnLog = logs.find((l) => l.includes('Vulnerable! 150% damage'));
    expect(vulnLog).toBeDefined();
  });
});
