import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES, getTileDefinition } from '../grid/tile';
import { Player } from '../entities/player';
import { PotionItem } from '../items/consumables';
import { DrinkPotionAction } from '../actions/spell-actions';
import { MovementAction } from '../actions/movement';
import { SpellPipeline } from '../magic/spellPipeline';
import { cotwManifest } from '../../content/cotw';
import type { SpellDefinition } from '../magic/types';
import { Visibility } from '../fov/types';

/** A whole-floor reveal, as the old seer's spells were (cotw's Hliðskjálf reaches only so far). */
const wholeFloorReveal = (target: 'actors' | 'items' | 'map', duration = 30): SpellDefinition => ({
  id: `whole_floor_${target}`,
  name: `Whole-floor ${target}`,
  school: 'Divination',
  manaCost: 0,
  element: 'arcane',
  range: 0,
  basePower: 0,
  areaOfEffect: 0,
  reflects: false,
  targetType: 'self',
  targetingMode: 'self',
  description: '',
  effects: [{ type: 'reveal', target, duration }],
});

describe('Pre-Freeze Architectural Refactor Verification', () => {
  let map: GameMap;
  let player: Player;
  let engine: GameEngine;

  beforeEach(() => {
    map = new GameMap(20, 20);
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        map.setTile(x, y, TILES.FLOOR);
      }
    }
    player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 10, y: 10 },
      stats: { hp: 50, maxHp: 100, attack: 10, defense: 5 },
      mana: 30,
      maxMana: 50,
      strength: 14,
      dexterity: 14,
      constitution: 14,
      intelligence: 14,
    });
    engine = new GameEngine({ manifest: cotwManifest, map, player });
  });

  describe('1. Data-Driven Tile Capability Model', () => {
    it('registers and resolves capability flags on canonical tiles', () => {
      const wall = getTileDefinition('wall');
      expect(wall.walkable).toBe(false);
      expect(wall.transparent).toBe(false);
      expect(wall.blocksProjectiles).toBe(true);

      const floor = getTileDefinition('floor');
      expect(floor.walkable).toBe(true);
      expect(floor.transparent).toBe(true);

      const closedDoor = getTileDefinition('door_closed');
      expect(closedDoor.isDoor).toBe(true);
      expect(closedDoor.isClosedDoor).toBe(true);
      expect(closedDoor.walkable).toBe(false);

      const openDoor = getTileDefinition('door_open');
      expect(openDoor.isDoor).toBe(true);
      expect(openDoor.isOpenDoor).toBe(true);
      expect(openDoor.walkable).toBe(true);

      const stairsDown = getTileDefinition('stairs_down');
      expect(stairsDown.isStairsDown).toBe(true);
      expect(stairsDown.interactionHandlerId).toBe('stairs_down');
    });

    it('allows registering custom open-string tile types with custom capabilities', () => {
      engine.registries.tiles.register({
        type: 'arcane_forcefield',
        name: 'Arcane Forcefield',
        passable: false,
        walkable: false,
        transparent: true,
        blocksProjectiles: true,
        glyph: '░',
        description: 'A crackling barrier of translucent energy.',
      });

      const def = getTileDefinition('arcane_forcefield');
      expect(def.name).toBe('Arcane Forcefield');
      expect(def.walkable).toBe(false);
      expect(def.transparent).toBe(true);

      // Place custom tile on map and verify collision
      map.setTile(11, 10, def);
      const moveAction = new MovementAction(player, 1, 0);
      const res = moveAction.perform(engine);
      expect(res.success).toBe(false);
      expect(res.cost).toBe(0);
      expect(res.message).toContain('arcane forcefield');
    });
  });

  describe('2. Whole-floor reveals', () => {
    it('executes a whole-floor foe reveal with strongly typed reveal effect and updates duration turns', () => {
      const spell = wholeFloorReveal('actors');
      expect(spell).toBeDefined();
      expect(spell.effects?.[0]?.type).toBe('reveal');

      const initialTurns = engine.detectMonstersTurns;
      const res = SpellPipeline.executeSpell(engine, spell, player, { x: 10, y: 10 });
      expect(res.success).toBe(true);
      expect(engine.detectMonstersTurns).toBeGreaterThan(initialTurns);
    });

    it('executes a whole-floor loot reveal with strongly typed reveal effect and updates duration turns', () => {
      const spell = wholeFloorReveal('items');
      expect(spell).toBeDefined();
      expect(spell.effects?.[0]?.type).toBe('reveal');

      const initialTurns = engine.detectObjectsTurns;
      const res = SpellPipeline.executeSpell(engine, spell, player, { x: 10, y: 10 });
      expect(res.success).toBe(true);
      expect(engine.detectObjectsTurns).toBeGreaterThan(initialTurns);
    });

    it('executes a whole-floor map reveal to reveal map tiles', () => {
      // Put a solid wall blocking line of sight so (18, 18) starts unexplored
      for (let y = 0; y < 20; y++) {
        map.setTile(14, y, TILES.WALL);
      }
      engine.updateFov();
      expect(engine.fov.getVisibility(18, 18)).toBe(Visibility.Unexplored);

      const spell = wholeFloorReveal('map', 1);
      expect(spell).toBeDefined();

      const res = SpellPipeline.executeSpell(engine, spell, player, { x: 10, y: 10 });
      expect(res.success).toBe(true);
      expect(engine.fov.getVisibility(18, 18)).not.toBe(Visibility.Unexplored);
    });
  });

  describe('3. Declarative Consumable Resolution', () => {
    it('sequentially executes multi-effect declarative potion manifest without callbacks', () => {
      player.hp = 20;
      player.mana = 5;

      const multiPotion = new PotionItem({
        id: 'potion-rejuvenation-1',
        definitionId: 'potion_rejuvenation',
        name: 'Potion of Rejuvenation',
        weight: 100,
        bulk: 50,
        effects: [
          { type: 'restore_hp', amount: 30 },
          { type: 'restore_mana', amount: 15 },
        ],
      });

      player.inventory.primaryPack.addItem(multiPotion);
      const action = new DrinkPotionAction(player, multiPotion);
      const res = action.perform(engine);

      expect(res.success).toBe(true);
      expect(player.hp).toBe(50);
      expect(player.mana).toBe(20);
      expect(player.inventory.getAllCarriedItems().some((i) => i.id === multiPotion.id)).toBe(false);
    });

    it('executes status effect application via declarative consumable descriptor', () => {
      const speedPotion = new PotionItem({
        id: 'potion-speed-1',
        definitionId: 'potion_speed',
        name: 'Potion of Swiftness',
        weight: 100,
        bulk: 50,
        effects: [
          { type: 'apply_status', status: 'haste', duration: 10 },
        ],
      });

      player.inventory.primaryPack.addItem(speedPotion);
      const action = new DrinkPotionAction(player, speedPotion);
      const res = action.perform(engine);

      expect(res.success).toBe(true);
      expect(player.statusManager.hasStatus('haste')).toBe(true);
    });
  });
});
