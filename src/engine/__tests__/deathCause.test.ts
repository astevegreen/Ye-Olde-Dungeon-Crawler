import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { MovementAction } from '../actions/movement';
import { WaitAction } from '../actions/wait';
import { TrapInstance } from '../dungeon/traps';
import { DeathResolver } from '../combat/deathResolver';
import { TILES } from '../grid/tile';
import { applyConsequences } from '../actions/choiceAction';
import { BashDoorAction } from '../actions/door';
import { applyImpulse } from '../combat/impulse';
import { SubstanceBitmask } from '../environment/substanceGrid';

/**
 * The death screen names what killed the hero. With no creature behind it (fire, acid,
 * poison, a trap) it said "Slain by Mortal Wounds"; 19 of the 5 Oct soak's deaths read so.
 */
describe('what the death screen says killed the hero', () => {
  let engine: GameEngine;
  let player: Player;
  let goblin: Monster;

  beforeEach(() => {
    const map = new GameMap(12, 12);
    map.fill(TILES.FLOOR);
    player = new Player({ position: { x: 3, y: 3 }, stats: { hp: 2, maxHp: 50, attack: 10, defense: 2 } });
    goblin = new Monster({
      id: 'test-goblin',
      name: 'Goblin',
      position: { x: 8, y: 8 },
      stats: { hp: 30, maxHp: 30, attack: 4, defense: 1 },
      speed: 100,
      definitionId: 'goblin',
      aiType: 'melee',
    });
    map.addEntity(player);
    map.addEntity(goblin);
    engine = new GameEngine({ map, player });
  });

  const slainBy = () => engine.gameState.killerName;

  it('stepping into fire', () => {
    engine.surfaces.setSurface(4, 3, 'fire', 5);
    new MovementAction(player, 1, 0).perform(engine);
    expect(player.isAlive()).toBe(false);
    expect(slainBy()).toBe('searing fire');
    expect(engine.gameState.causeOfDeath).toBe(`Slain by searing fire on Floor ${engine.currentFloor}`);
  });

  it('standing in lingering fire', () => {
    engine.surfaces.setSurface(3, 3, 'fire', 5);
    engine.surfaces.tick(engine);
    expect(slainBy()).toBe('lingering fire');
  });

  it('a firestorm', () => {
    engine.surfaces.setGas(3, 3, 'fire_storm', 3);
    engine.surfaces.tick(engine);
    expect(slainBy()).toBe('a firestorm');
  });

  it('acid', () => {
    engine.surfaces.setSurface(3, 3, 'acid_pool', 5);
    engine.surfaces.tick(engine);
    expect(slainBy()).toBe('acid');
  });

  it("poison's tick, through the engine's own turn", () => {
    player.statusManager.applyStatus({ type: 'poison', duration: 5, potency: 3 }, [], player, engine);
    engine.handlePlayerAction(new WaitAction(player));
    expect(player.isAlive()).toBe(false);
    expect(slainBy()).toBe('poison');
  });

  it('a pit trap', () => {
    new TrapInstance({ id: 't1', type: 'pit', x: 3, y: 3, damage: 5 }).trigger(player, engine);
    expect(slainBy()).toBe('a pit trap');
  });

  it('a creature is still named', () => {
    player.takeDamage(2);
    DeathResolver.resolveDeath(engine, goblin, player);
    expect(slainBy()).toBe('Goblin');
  });

  it('nothing named is still Mortal Wounds', () => {
    player.takeDamage(2);
    DeathResolver.resolveDeath(engine, undefined, player);
    expect(slainBy()).toBe('Mortal Wounds');
  });

  it("a status's cause is used once: a later death it didn't cause isn't blamed on it", () => {
    player.pendingDeathCause = 'poison';
    DeathResolver.resolveDeath(engine, goblin, player);
    expect(slainBy()).toBe('Goblin');
    expect(player.pendingDeathCause).toBeUndefined();
  });

  // Review 2026-10-06 A3: every damage path resolves its kill and names its cause.
  const fallen = () => expect(engine.gameState.runStatus).toBe('fallen');

  it('a dart trap', () => {
    new TrapInstance({ id: 't1', type: 'arrow', x: 3, y: 3, damage: 5 }).trigger(player, engine);
    fallen();
    expect(slainBy()).toBe('a dart trap');
  });

  it('a lethal choice consequence, by its named cause or a dark bargain', () => {
    applyConsequences([{ type: 'damagePlayer', amount: 5, cause: "a god's wrath" }], engine, player);
    fallen();
    expect(slainBy()).toBe("a god's wrath");
  });

  it('a lethal choice consequence with no cause', () => {
    applyConsequences([{ type: 'damagePlayer', amount: 5 }], engine, player);
    expect(slainBy()).toBe('a dark bargain');
  });

  it('a wall splat', () => {
    engine.map.setTile(4, 3, TILES.WALL);
    applyImpulse(engine, undefined, player, 1, 0, 2);
    fallen();
    expect(slainBy()).toBe('a wall splat');
  });

  it('a hidden trap underfoot at the end of a shove', () => {
    engine.map.setTile(4, 3, TILES.TRAP);
    applyImpulse(engine, undefined, player, 1, 0, 1);
    fallen();
    expect(slainBy()).toBe('a hidden trap');
  });

  it('a fall against the chasm wall, for one too big to plunge', () => {
    player.maxHp = 300;
    engine.map.setTile(4, 3, TILES.CHASM);
    applyImpulse(engine, undefined, player, 1, 0, 1);
    fallen();
    expect(slainBy()).toBe('a fall against the chasm wall');
  });

  it('a door that would not give', () => {
    player.hp = 1;
    engine.map.setTile(4, 3, { ...TILES.DOOR_CLOSED, locked: true, lockDifficulty: 99 });
    new BashDoorAction(player, 4, 3).perform(engine);
    fallen();
    expect(slainBy()).toBe('a door that would not give');
  });

  it('the drift', () => {
    engine.planeManager.transferEntity(engine.map, player, 'liminal', { x: 3, y: 3 });
    engine.map.setTile(4, 3, TILES.WALL);
    engine.planeManager.tickDrift(engine.map, 5, engine);
    fallen();
    expect(slainBy()).toBe('the drift');
  });

  it('ignited vapour', () => {
    engine.substances.addSubstance(3, 3, SubstanceBitmask.IGNITED);
    engine.substances.tickSubstances(engine.map, engine);
    fallen();
    expect(slainBy()).toBe('ignited vapour');
  });
});

describe('a creature killed by a trap or the ground is resolved like any other kill', () => {
  function setup() {
    const map = new GameMap(12, 12);
    map.fill(TILES.FLOOR);
    const player = new Player({ position: { x: 1, y: 1 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 } });
    const rat = new Monster({
      id: 'rat',
      name: 'Rat',
      position: { x: 5, y: 5 },
      stats: { hp: 5, maxHp: 5, attack: 1, defense: 0 },
      speed: 100,
      definitionId: 'rat',
      aiType: 'melee',
      xpValue: 10,
    } as never);
    map.addEntity(player);
    map.addEntity(rat);
    const engine = new GameEngine({ map, player });
    const killed: string[] = [];
    engine.onGameEvent = (e) => {
      if (e.type === 'entity_killed') killed.push(String(e.targetId));
    };
    return { map, player, rat, engine, killed };
  }

  it('a rat on a pit trap leaves the map, and the hero has the XP', () => {
    const { map, player, rat, engine, killed } = setup();
    const xpBefore = player.xp;

    new TrapInstance({ id: 't', type: 'pit', x: 5, y: 5, damage: 10 }).trigger(rat, engine);

    expect(map.getEntityById(rat.id)).toBeNull();
    expect(killed).toEqual(['rat']);
    expect(player.xp).toBeGreaterThan(xpBefore);
  });

  it('a rat shoved onto a dart trap leaves the map', () => {
    const { map, player, rat, engine, killed } = setup();
    map.addTrap(new TrapInstance({ id: 't', type: 'arrow', x: 6, y: 5, damage: 10 }));

    applyImpulse(engine, player, rat, 1, 0, 1);

    expect(map.getEntityById(rat.id)).toBeNull();
    expect(killed).toEqual(['rat']);
  });

  it('a photophobic rat seared by light leaves the map', () => {
    const { map, rat, engine, killed } = setup();
    rat.hp = 2;
    rat.vulnerabilityTags.push('photophobic');
    engine.substances.addSubstance(5, 5, SubstanceBitmask.RADIANT_EXPOSURE);

    engine.substances.tickSubstances(map, engine);

    expect(map.getEntityById(rat.id)).toBeNull();
    expect(killed).toEqual(['rat']);
  });
});
