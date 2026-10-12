import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { Player } from '../../entities/player';
import { TrapInstance } from '../traps';
import { WaitAction } from '../../actions/wait';
import { SearchAction } from '../../actions/search';
import { senseTraps, trapDodgeChance, trapSpotChance } from '../trapSense';

function build(stats: { intelligence?: number; dexterity?: number } = {}) {
  const map = GameMap.createBoxRoom(20, 20);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 5, y: 5 },
    stats: { hp: 50, maxHp: 50, attack: 10, defense: 4 },
    intelligence: stats.intelligence ?? 15,
    dexterity: stats.dexterity ?? 15,
  });
  const engine = new GameEngine({ map, player, floor: 1 });
  engine.updateFov();
  return { engine, map, player };
}

describe('trap sense: Intelligence spots, Dexterity dodges', () => {
  it('the chances follow the owner-set numbers', () => {
    const { player } = build();
    expect(trapSpotChance(player)).toBeCloseTo(0.2);
    expect(trapDodgeChance(player)).toBeCloseTo(0.3);
    player.intelligence = 5;
    player.dexterity = 5;
    expect(trapSpotChance(player)).toBe(0);
    expect(trapDodgeChance(player)).toBe(0);
    player.dexterity = 60;
    expect(trapDodgeChance(player)).toBe(0.75);
  });

  it('a hidden trap in sight within 3 tiles is spotted on a turn roll; one farther is not', () => {
    const { engine, map } = build({ intelligence: 55 });
    const near = new TrapInstance({ id: 'near', type: 'pit', x: 8, y: 5 });
    const far = new TrapInstance({ id: 'far', type: 'pit', x: 9, y: 5 });
    map.addTrap(near);
    map.addTrap(far);
    senseTraps(engine);
    expect(near.revealed).toBe(true);
    expect(far.revealed).toBe(false);
  });

  it('a Wayfarer spots twice as far', () => {
    const { engine, map, player } = build({ intelligence: 55 });
    player.grantPerk({ id: 'wayfarer', name: 'Wayfarer', description: '', source: 'saga', effects: { perceptionRadiusMultiplier: 2 } });
    const trap = new TrapInstance({ id: 't', type: 'pit', x: 11, y: 5 });
    map.addTrap(trap);
    senseTraps(engine);
    expect(trap.revealed).toBe(true);
  });

  it('INT 5 never spots in passing, and spotting runs on every turn, waiting included', () => {
    const dull = build({ intelligence: 5 });
    const t1 = new TrapInstance({ id: 't1', type: 'pit', x: 6, y: 5 });
    dull.map.addTrap(t1);
    for (let i = 0; i < 20; i++) dull.engine.handlePlayerAction(new WaitAction(dull.player));
    expect(t1.revealed).toBe(false);

    const sharp = build({ intelligence: 55 });
    const t2 = new TrapInstance({ id: 't2', type: 'pit', x: 6, y: 5 });
    sharp.map.addTrap(t2);
    sharp.engine.handlePlayerAction(new WaitAction(sharp.player));
    expect(t2.revealed).toBe(true);
  });

  it('a nimble hero leaps clear of a sprung pit, which is then revealed', () => {
    const { engine, map, player } = build({ dexterity: 60 });
    engine.prng.next = () => 0.1;
    const trap = new TrapInstance({ id: 't', type: 'pit', x: 6, y: 5, damage: 15 });
    map.addTrap(trap);
    trap.trigger(player, engine);
    expect(player.hp).toBe(50);
    expect(trap.revealed).toBe(true);
    expect(trap.triggered).toBe(false);
  });

  it('an alarm cannot be dodged', () => {
    const { engine, map, player } = build({ dexterity: 60 });
    engine.prng.next = () => 0;
    const trap = new TrapInstance({ id: 't', type: 'alarm', x: 6, y: 5 });
    map.addTrap(trap);
    trap.trigger(player, engine);
    expect(trap.triggered).toBe(true);
  });

  it('Search rolls on Intelligence alone', () => {
    const lowInt = build({ intelligence: 5, dexterity: 60 });
    const a = new TrapInstance({ id: 'a', type: 'pit', x: 6, y: 5, concealment: 14 });
    lowInt.map.addTrap(a);
    new SearchAction(lowInt.player, () => 0.5).perform(lowInt.engine); // 11 + floor((10 + 1) / 4) = 13
    expect(a.revealed).toBe(false);

    const highInt = build({ intelligence: 15, dexterity: 5 });
    const b = new TrapInstance({ id: 'b', type: 'pit', x: 6, y: 5, concealment: 14 });
    highInt.map.addTrap(b);
    new SearchAction(highInt.player, () => 0.5).perform(highInt.engine); // 11 + floor((30 + 1) / 4) = 18
    expect(b.revealed).toBe(true);
  });

  it('Disarm rolls on Dexterity alone', () => {
    const { engine, map, player } = build({ intelligence: 60, dexterity: 6 });
    engine.prng.nextInt = () => 10; // 10 + floor(6/3) = 12
    const trap = new TrapInstance({ id: 't', type: 'alarm', x: 6, y: 5, revealed: true, disarmDifficulty: 14 });
    map.addTrap(trap);
    expect(trap.disarm(player, engine).success).toBe(false);
    player.dexterity = 15; // 10 + 5 = 15
    trap.triggered = false;
    expect(trap.disarm(player, engine).success).toBe(true);
  });
});
