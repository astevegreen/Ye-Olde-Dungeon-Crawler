import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES, getTileDefinition, registerTileDefinition } from '../grid/tile';
import { Player } from '../entities/player';
import { PotionItem } from '../items/consumables';
import { DrinkPotionAction } from '../actions/spell-actions';
import { SmartCloseDoorAction, getAdjacentOpenDoors } from '../actions/door';
import { MovementAction } from '../actions/movement';
import { SpellPipeline } from '../magic/spellPipeline';
import { getSpell, SPELL_ID_ALIASES } from '../magic/spellRegistry';
import { ActionRegistry } from '../actions/actionRegistry';
import { cotwManifest } from '../../content/cotw';
import { Visibility } from '../fov/types';

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
      registerTileDefinition({
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

  describe('2. Divination Spell Unification & Aliases', () => {
    it('resolves legacy divination spell IDs through SPELL_ID_ALIASES', () => {
      expect(SPELL_ID_ALIASES['sense_living']).toBe('detect_monsters');
      expect(SPELL_ID_ALIASES['detect_treasure']).toBe('detect_objects');

      const senseLiving = getSpell('sense_living');
      const detectMonsters = getSpell('detect_monsters');
      expect(senseLiving).toBeDefined();
      expect(detectMonsters).toBeDefined();
      expect(senseLiving?.id).toBe(detectMonsters?.id);

      const detectTreasure = getSpell('detect_treasure');
      const detectObjects = getSpell('detect_objects');
      expect(detectTreasure).toBeDefined();
      expect(detectObjects).toBeDefined();
      expect(detectTreasure?.id).toBe(detectObjects?.id);
    });

    it('executes detect_monsters with strongly typed reveal effect and updates duration turns', () => {
      const spell = getSpell('detect_monsters')!;
      expect(spell).toBeDefined();
      expect(spell.effects?.[0]?.type).toBe('reveal');

      const initialTurns = engine.detectMonstersTurns;
      const res = SpellPipeline.executeSpell(engine, spell, player, { x: 10, y: 10 });
      expect(res.success).toBe(true);
      expect(engine.detectMonstersTurns).toBeGreaterThan(initialTurns);
    });

    it('executes detect_objects with strongly typed reveal effect and updates duration turns', () => {
      const spell = getSpell('detect_objects')!;
      expect(spell).toBeDefined();
      expect(spell.effects?.[0]?.type).toBe('reveal');

      const initialTurns = engine.detectObjectsTurns;
      const res = SpellPipeline.executeSpell(engine, spell, player, { x: 10, y: 10 });
      expect(res.success).toBe(true);
      expect(engine.detectObjectsTurns).toBeGreaterThan(initialTurns);
    });

    it('executes clairvoyance to reveal map tiles', () => {
      // Put a solid wall blocking line of sight so (18, 18) starts unexplored
      for (let y = 0; y < 20; y++) {
        map.setTile(14, y, TILES.WALL);
      }
      engine.updateFov();
      expect(engine.fov.getVisibility(18, 18)).toBe(Visibility.Unexplored);

      const spell = getSpell('clairvoyance')!;
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

  describe('4. Smart-Close Door Targeting & Action Registry', () => {
    it('verifies close_door is registered in ActionRegistry', () => {
      const descriptor = ActionRegistry.get('close_door');
      expect(descriptor).toBeDefined();
      expect(descriptor?.id).toBe('close_door');
      expect(descriptor?.name).toBe('Close Door');
    });

    it('returns 0-cost failure when no open doors are adjacent', () => {
      const initialEnergy = player.energy;
      const action = new SmartCloseDoorAction(player);
      const res = action.perform(engine);

      expect(res.success).toBe(false);
      expect(res.cost).toBe(0);
      expect(res.message).toBe('No open door nearby.');
      expect(player.energy).toBe(initialEnergy);
    });

    it('instantly closes when exactly 1 open door is adjacent', () => {
      map.setTile(11, 10, TILES.DOOR_OPEN);
      expect(getAdjacentOpenDoors(map, player.x, player.y)).toHaveLength(1);

      const action = new SmartCloseDoorAction(player);
      const res = action.perform(engine);

      expect(res.success).toBe(true);
      expect(res.cost).toBeGreaterThan(0);

      // Tile at (11, 10) must now be DOOR_CLOSED
      const targetTile = map.getTile(11, 10);
      expect(targetTile?.isClosedDoor).toBe(true);
      expect(targetTile?.isOpenDoor).toBe(false);
    });

    it('signals direction prompt required when multiple open doors are adjacent', () => {
      map.setTile(11, 10, TILES.DOOR_OPEN); // East
      map.setTile(10, 11, TILES.DOOR_OPEN); // South
      expect(getAdjacentOpenDoors(map, player.x, player.y)).toHaveLength(2);

      const promptAction = new SmartCloseDoorAction(player);
      const promptRes = promptAction.perform(engine);
      expect(promptRes.success).toBe(false);
      expect(promptRes.cost).toBe(0);
      expect(promptRes.message).toBe('Close which door? [Direction]');

      // Targeted close with direction on South door (0, 1)
      const dirAction = new SmartCloseDoorAction(player, { dx: 0, dy: 1 });
      const dirRes = dirAction.perform(engine);
      expect(dirRes.success).toBe(true);
      expect(dirRes.cost).toBeGreaterThan(0);

      // South door is closed, East door is still open
      expect(map.getTile(10, 11)?.isClosedDoor).toBe(true);
      expect(map.getTile(11, 10)?.isOpenDoor).toBe(true);
    });
  });
});
