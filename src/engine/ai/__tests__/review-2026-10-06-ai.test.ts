import { describe, it, expect, afterAll } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { Companion } from '../../entities/companion';
import { WandItem } from '../../items/consumables';
import { MonsterAI } from '../behaviorTree';
import { SpellRegistry, registerSpells } from '../../magic/spellRegistry';
import { activateRegistries } from '../../registries';
import { CastSpellAction, ZapWandAction } from '../../actions/spell-actions';
import { cotwManifest } from '../../../content/cotw';

/**
 * Whole-codebase review, 2026-10-06, area 4 (AI, world): regression guards for the findings
 * fixed since. R-ai-1: a companion never zaps its wand at the hero, and a hostile wielder
 * zaps only a hero it perceives. R-ai-11: an immobile turret casts only at a hero it can
 * see. R-ai-8: a cleared floor that catch-up has refilled is not refilled again by its
 * timer. R-ai-9: the hero's own companion is no bestiary encounter. R-ai-10: on a lit map a
 * sleeper wakes only within the hero's own radius (§6). Content is a fixture only (§3).
 */

const firebolt = {
  id: 'review_firebolt',
  name: 'Firebolt',
  school: 'Combat',
  manaCost: 5,
  element: 'fire',
  range: 7,
  basePower: 12,
  areaOfEffect: 0,
  reflects: false,
  targetType: 'ray',
  targetingMode: 'ray',
  description: '',
  effects: [{ type: 'damage', amount: 12, element: 'fire' }],
};

afterAll(() => {
  activateRegistries(null);
  SpellRegistry.clear();
});

describe('R-ai-1 · a companion carrying a wand never zaps it at the hero', () => {
  it('a companion with a Wand of Firebolts in its pack does not aim it at the hero', () => {
    SpellRegistry.register(firebolt as never);
    const map = new GameMap(20, 20, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 } });
    const engine = new GameEngine({ map, player });
    const hound = new Companion({
      id: 'dog',
      name: 'Hound',
      position: { x: 7, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
      speed: 100,
      companionDefinitionId: 'hound',
      packWeightCapacity: 20000,
      packBulkCapacity: 20000,
    } as never);
    engine.attachCompanion(hound);
    hound.addItem(new WandItem({ id: 'fire-wand', name: 'Wand of Firebolts', spellId: 'review_firebolt', charges: 5, maxCharges: 5 } as never));

    const action = MonsterAI.decideAction(hound, engine);
    const aimedAtHero = action instanceof ZapWandAction && action.targetX === player.x && action.targetY === player.y;

    expect(aimedAtHero).toBe(false);
  });

  it('a hostile wielder still zaps a hero it perceives, and a blinded one does not', () => {
    SpellRegistry.register(firebolt as never);
    const map = new GameMap(20, 20, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 } });
    const engine = new GameEngine({ map, player });
    const goblin = new Monster({ id: 'gob', name: 'Goblin', position: { x: 10, y: 5 }, stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 }, speed: 100, definitionId: 'gob', aiType: 'melee', aiState: 'hunting' } as never);
    engine.addEntity(goblin);
    goblin.addItem(new WandItem({ id: 'gob-wand', name: 'Wand of Firebolts', spellId: 'review_firebolt', charges: 5, maxCharges: 5 } as never));

    expect(MonsterAI.decideAction(goblin, engine)).toBeInstanceOf(ZapWandAction);

    goblin.statusManager.applyStatus({ type: 'blindness', duration: 5 }, [], goblin, engine);
    expect(MonsterAI.decideAction(goblin, engine)).not.toBeInstanceOf(ZapWandAction);
  });
});

describe('R-ai-11 · an immobile turret casts only at a hero it can see', () => {
  it('a turret with a wall between it and the hero does not cast', () => {
    registerSpells((cotwManifest as unknown as { spells: unknown[] }).spells as never);
    const map = new GameMap(20, 11, TILES.FLOOR);
    for (let y = 0; y < 11; y++) map.setTile(8, y, TILES.WALL);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 6, y: 5 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 50 } });
    const engine = new GameEngine({ map, player });
    const turret = new Monster({
      id: 'nacken',
      name: 'Näcken',
      position: { x: 10, y: 5 },
      stats: { hp: 40, maxHp: 40, attack: 4, defense: 3 },
      aiType: 'immobile_turret',
      aiRoutineId: 'immobile_turret',
      aiState: 'hunting',
      spells: ['slow'],
      xpValue: 1,
      lootTable: [],
    } as never);
    engine.addEntity(turret);

    const action = MonsterAI.decideAction(turret, engine);

    expect(action).not.toBeInstanceOf(CastSpellAction);

    // With the wall gone it sees the hero and casts.
    for (let y = 0; y < 11; y++) map.setTile(8, y, TILES.FLOOR);
    turret.spellCooldown = 0;
    expect(MonsterAI.decideAction(turret, engine)).toBeInstanceOf(CastSpellAction);
  });
});

describe('R-ai-8 · returning to a cleared floor repopulates it once', () => {
  it('after catch-up has refilled a cleared floor, the cleared-floor timer does not refill it again', () => {
    const map1 = new GameMap(57, 40, TILES.WALL);
    for (let y = 1; y < 39; y++) for (let x = 1; x < 56; x++) map1.setTile(x, y, TILES.FLOOR);
    map1.setTile(30, 20, TILES.STAIRS_DOWN);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 25, y: 20 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 } });
    const engine = new GameEngine({ map: map1, player, floor: 1, manifest: cotwManifest });
    engine.map.isCleared = true;
    engine.map.lastRespawnTurn = 0;
    engine.map.floorTurnCount = 200;
    engine.changeFloor(2);
    engine.turnCount += 1000;
    engine.changeFloor(1);
    const monsters = () => engine.map.getAllEntities().filter((e) => e instanceof Monster && e.isAlive()).length;
    expect(monsters()).toBeGreaterThan(0); // catch-up refilled it

    engine.map.floorTurnCount += 1;
    const spawned = engine.floorManager.checkClearedFloorRespawn(engine);

    expect(spawned).toHaveLength(0);
  });
});

describe('R-ai-9 · the hero’s own companion is not a bestiary encounter', () => {
  it('summoning a companion in view neither logs "You encountered" nor adds it to the compendium', () => {
    const map = new GameMap(20, 20, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 } });
    const engine = new GameEngine({ map, player });
    const hound = new Companion({
      id: 'dog',
      name: 'Battle-Hound',
      position: { x: 7, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
      speed: 100,
      companionDefinitionId: 'hound',
      packWeightCapacity: 100,
      packBulkCapacity: 100,
    } as never);
    engine.attachCompanion(hound);

    engine.updateFov();

    expect(engine.messages.some((m) => m.includes('encountered Battle-Hound'))).toBe(false);
    expect(engine.compendium.getEntry(hound.definitionId).tier).toBe(0);
  });
});

describe('R-ai-10 · on a lit map a sleeper wakes only within the hero’s own radius (§6)', () => {
  it('a sleeping monster 30 tiles off across a lit square stays asleep on its turn', () => {
    const map = new GameMap(50, 10, TILES.FLOOR);
    map.lit = true;
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 } });
    const engine = new GameEngine({ map, player });
    const sleeper = new Monster({ id: 'far', name: 'Far', position: { x: 35, y: 5 }, stats: { hp: 10, maxHp: 10, attack: 2, defense: 0 }, speed: 100, definitionId: 'far', aiType: 'melee', aiState: 'sleeping' } as never);
    engine.addEntity(sleeper);
    engine.updateFov();
    expect(engine.fov.isVisible(35, 5)).toBe(true); // a lit map is seen to its end

    MonsterAI.decideAction(sleeper, engine);

    expect(sleeper.aiState).toBe('sleeping');
  });
});
