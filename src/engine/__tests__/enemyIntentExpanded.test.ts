import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { TILES } from '../grid/tile';
import { computeDangerTiles } from '../ai/intent';
import { WindUpDeclareAction, WindUpExecuteAction } from '../actions/combat';
import { MovementAction } from '../actions/movement';
import { COTW_MANIFEST } from '../../content/cotw';

describe('Expanded Enemy Intent Telegraphing System', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;

  beforeEach(() => {
    map = new GameMap(25, 25);
    map.fill(TILES.FLOOR);
    player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 10, y: 10 },
      stats: { hp: 100, maxHp: 100, attack: 10, defense: 2 },
    });
    map.addEntity(player);
    engine = new GameEngine({ map, player, floor: 1, manifest: COTW_MANIFEST });
  });

  describe('1. Hellfire Surge (Blast Pattern, Fire Element, Fire Surface)', () => {
    it('declares Hellfire Surge blast pattern and spawns fire ground upon execution', () => {
      const caster = new Monster({
        id: 'archmage',
        name: 'Dark Pyromancer',
        position: { x: 10, y: 13 },
        stats: { hp: 80, maxHp: 80, attack: 12, defense: 3 },
        aiType: 'caster',
        spells: ['firebolt'],
      });
      map.addEntity(caster);

      const dangerTiles = computeDangerTiles(caster.position, player.position, 'blast', map, 5, 1);
      expect(dangerTiles.length).toBeGreaterThanOrEqual(5);
      expect(dangerTiles.some((t) => t.x === 10 && t.y === 10)).toBe(true);

      const declare = new WindUpDeclareAction(
        caster,
        { x: 10, y: 10 },
        'Hellfire Surge',
        'Dark Pyromancer prepares Hellfire Surge!',
        {
          targetTiles: dangerTiles,
          pattern: 'blast',
          turnsRemaining: 1,
          multiplier: 2.2,
          element: 'fire',
          spawnSurface: 'fire',
        }
      );
      declare.perform(engine);

      expect(caster.intent.type).toBe('windup');
      expect(caster.intent.abilityName).toBe('Hellfire Surge');
      expect(caster.intent.spawnSurface).toBe('fire');

      // Execute Hellfire Surge
      const execute = new WindUpExecuteAction(caster, { x: 10, y: 10 }, 'Hellfire Surge', 2.2, {
        targetTiles: dangerTiles,
        pattern: 'blast',
        element: 'fire',
        spawnSurface: 'fire',
      });
      const initialHp = player.hp;
      execute.perform(engine);

      expect(player.hp).toBeLessThan(initialHp);
      // Fire surface was spawned on targeted tiles
      expect(engine.surfaces?.getSurface(10, 10)).toBe('fire');

      // Ticking surface deals periodic fire damage
      const hpBeforeTick = player.hp;
      engine.surfaces?.tick(engine);
      expect(player.hp).toBeLessThan(hpBeforeTick);
      expect(engine.messages.some((m) => m.includes('scorched by lingering fire'))).toBe(true);
    });
  });

  describe('2. Battering Charge (Line Pattern, High Push Impulse)', () => {
    it('charges down a linear corridor, dealing massive damage and pushing victim 3 tiles', () => {
      const brute = new Monster({
        id: 'ram-brute',
        name: 'Ironhide Minotaur',
        position: { x: 10, y: 13 },
        stats: { hp: 120, maxHp: 120, attack: 14, defense: 4 },
        aiType: 'brute',
      });
      map.addEntity(brute);

      // Line northward towards player at (10, 10)
      const dangerTiles = computeDangerTiles(brute.position, player.position, 'line', map, 4);
      expect(dangerTiles.some((t) => t.x === 10 && t.y === 10)).toBe(true);
      expect(dangerTiles.some((t) => t.x === 10 && t.y === 11)).toBe(true);

      const declare = new WindUpDeclareAction(
        brute,
        { x: 10, y: 10 },
        'Battering Charge',
        'Ironhide Minotaur prepares Battering Charge!',
        {
          targetTiles: dangerTiles,
          pattern: 'line',
          turnsRemaining: 1,
          multiplier: 2.4,
          pushImpulse: 3,
        }
      );
      declare.perform(engine);

      const execute = new WindUpExecuteAction(brute, { x: 10, y: 10 }, 'Battering Charge', 2.4, {
        targetTiles: dangerTiles,
        pattern: 'line',
        pushImpulse: 3,
      });

      const initialHp = player.hp;
      execute.perform(engine);

      expect(player.hp).toBeLessThan(initialHp);
      // Player pushed North along impulse (10, 10 -> pushed 3 tiles to 10, 7)
      expect(player.x).toBe(10);
      expect(player.y).toBe(7);
      expect(engine.messages.some((m) => m.includes('slams into Hero for'))).toBe(true);
    });
  });

  describe('3. Seismic Ground Slam (Cross Pattern, Impulse + Mud Surface)', () => {
    it('creates cross-shaped shockwave, pushes player and deposits sticky mud', () => {
      const ogre = new Monster({
        id: 'earth-ogre',
        name: 'Mountain Ogre',
        position: { x: 10, y: 11 }, // adjacent south of player (10, 10)
        stats: { hp: 100, maxHp: 100, attack: 15, defense: 4 },
        aiType: 'brute',
      });
      map.addEntity(ogre);

      const dangerTiles = computeDangerTiles(ogre.position, player.position, 'cross', map, 1, 2);
      // Cross with radius 2 centered at (10, 10):
      expect(dangerTiles.some((t) => t.x === 10 && t.y === 10)).toBe(true);
      expect(dangerTiles.some((t) => t.x === 12 && t.y === 10)).toBe(true);
      expect(dangerTiles.some((t) => t.x === 8 && t.y === 10)).toBe(true);
      expect(dangerTiles.some((t) => t.x === 10 && t.y === 8)).toBe(true);

      const declare = new WindUpDeclareAction(
        ogre,
        { x: 10, y: 10 },
        'Seismic Ground Slam',
        'Mountain Ogre raises giant fists!',
        {
          targetTiles: dangerTiles,
          pattern: 'cross',
          turnsRemaining: 1,
          multiplier: 2.6,
          pushImpulse: 2,
          spawnSurface: 'mud',
        }
      );
      declare.perform(engine);

      const execute = new WindUpExecuteAction(ogre, { x: 10, y: 10 }, 'Seismic Ground Slam', 2.6, {
        targetTiles: dangerTiles,
        pushImpulse: 2,
        spawnSurface: 'mud',
      });
      execute.perform(engine);

      // Player pushed North away from ogre at (10, 11) -> player at (10, 8)
      expect(player.y).toBe(8);
      // Mud surface left behind at target epicenter (10, 10)
      expect(engine.surfaces?.getSurface(10, 10)).toBe('mud');

      // Moving through mud incurs energy penalty
      const stepRes = engine.surfaces?.handleEntityStep(player, 10, 10, 0, 1, engine);
      expect(stepRes?.energyPenalty).toBe(50);
      expect(engine.messages.some((m) => m.includes('struggles through thick, clinging mud'))).toBe(true);
    });
  });

  describe('4. Piercing Snipe (Long Range Line & Evasion)', () => {
    it('projects line ray up to 7 tiles; sidestepping completely dodges attack', () => {
      const sniper = new Monster({
        id: 'elven-sniper',
        name: 'Shadow Archer',
        position: { x: 10, y: 16 }, // distance 6 tiles
        stats: { hp: 50, maxHp: 50, attack: 14, defense: 2 },
        aiType: 'kiting_ranged',
      });
      map.addEntity(sniper);

      const dangerTiles = computeDangerTiles(sniper.position, player.position, 'line', map, 7);
      expect(dangerTiles.some((t) => t.x === 10 && t.y === 10)).toBe(true);

      const declare = new WindUpDeclareAction(
        sniper,
        { x: 10, y: 10 },
        'Piercing Snipe',
        'Shadow Archer aims a Piercing Snipe!',
        {
          targetTiles: dangerTiles,
          pattern: 'line',
          turnsRemaining: 1,
          multiplier: 2.8,
        }
      );
      declare.perform(engine);

      // Player steps East to (11, 10) to dodge the line
      new MovementAction(player, 1, 0).perform(engine);
      expect(player.x).toBe(11);
      expect(player.y).toBe(10);

      const initialHp = player.hp;
      const execute = new WindUpExecuteAction(sniper, { x: 10, y: 10 }, 'Piercing Snipe', 2.8, {
        targetTiles: dangerTiles,
      });
      const res = execute.perform(engine);

      expect(res.success).toBe(true);
      expect(player.hp).toBe(initialHp); // Player dodged!
      expect(engine.messages.some((m) => m.includes('strikes the empty ground'))).toBe(true);
    });
  });
});
