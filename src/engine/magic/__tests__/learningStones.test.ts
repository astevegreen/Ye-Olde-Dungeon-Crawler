import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { activateRegistries } from '../../registries';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { Item } from '../../items/item';
import { DeathResolver } from '../../combat/deathResolver';
import { MonsterRegistry } from '../../bestiary/monsterDefinitions';
import { MovementAction } from '../../actions/movement';
import { PickUpAction } from '../../actions/inventory-actions';
import { ClimbStairsAction } from '../../actions/stairs';
import { effectiveManaCost } from '../castNumbers';
import { DungeonArc } from '../../quest/dungeonArc';
import { Visibility } from '../../fov/types';
import { deserializeGame, serializeGame } from '../../storage/serializer';
import {
  learningStoneCard,
  learningStoneMarks,
  learningStoneTarget,
  ReadLearningStoneAction,
  shardFadesOnLeaving,
} from '../learningStones';
import type { LearningStoneConfig } from '../magicConfig';
import type { SpellDefinition } from '../types';
import type { TileDefinition } from '../../types';
import { cotwManifest } from '../../../content/cotw';

const spell = (id: string, element: SpellDefinition['element']): SpellDefinition => ({
  id,
  name: id.toUpperCase(),
  school: 'Combat',
  manaCost: 20,
  element,
  range: 6,
  basePower: 10,
  areaOfEffect: 0,
  reflects: false,
  targetType: 'ray',
  targetingMode: 'ray',
  description: `${id} does a thing.`,
  effects: [{ type: 'damage', amount: 10, element }],
});

const STONE: TileDefinition = { ...TILES.FLOOR, type: 'test_stone', name: 'Broken Stone' };

const stones: LearningStoneConfig = {
  tileId: 'test_stone',
  shardItemId: 'test_shard',
  stones: [{ floor: 4 }, { floor: 6 }, { floor: 8, faces: ['fixed_a', 'fixed_b'] }],
  zones: [
    { minFloor: 1, maxFloor: 5, spellIds: ['a1', 'a2', 'a3'], carrierIds: ['carrier_kind'] },
    { minFloor: 6, maxFloor: 9, spellIds: ['b1', 'fixed_a', 'fixed_b'], carrierIds: ['carrier_kind'] },
  ],
  messages: {
    arrival: '{stone} hums; {monster} glows.',
    stoneFound: '{monster} carries the shard of {stone}.',
    shardMarks: 'The shard marks {stone}.',
    shortcut: 'The shard sings as {monster} falls.',
    learned: 'You read {spell} from {stone}.',
    rune: 'The shard becomes {essence}.',
  },
};

const manifest = {
  id: 'test_pack',
  name: 'Test Pack',
  version: '1.0.0',
  description: '',
  dungeonFloors: 10,
  spells: ['a1', 'a2', 'a3', 'b1', 'fixed_a', 'fixed_b'].map((id) => spell(id, id === 'a2' ? 'cold' : 'fire')),
  monsters: [],
  tiles: [STONE],
  items: [
    { id: 'test_shard', name: 'Stone Shard', category: 'quest', weight: 1, bulk: 1, identified: true },
    { id: 'essence_fire', name: 'Fire Rune', category: 'quest', weight: 1, bulk: 1, identified: true },
    { id: 'essence_cold', name: 'Cold Rune', category: 'quest', weight: 1, bulk: 1, identified: true },
  ],
  magic: {
    killRites: {
      title: 'Rites',
      prophecyLabel: 'Hint',
      reapedLabel: 'Done',
      learnMessage: 'You learn {spell} from {monster}.',
      essenceMessage: '{monster} leaves a {essence}.',
      essenceItems: { fire: 'essence_fire', cold: 'essence_cold' },
    },
    learningStones: stones,
  },
};

describe('Shard and stone', () => {
  let engine: GameEngine;
  let player: Player;

  afterAll(() => {
    activateRegistries(null);
    MonsterRegistry.clear();
  });
  beforeAll(() => MonsterRegistry.register({
    id: 'carrier_kind',
    name: 'Carrier',
    stats: { hp: 40, maxHp: 40, attack: 1, defense: 0 },
    speed: 100,
    aiType: 'melee',
    fleeHealthPercent: 0,
    xpValue: 0,
    lootTable: [],
    killRite: { hintVerse: '', essenceElement: 'cold', teachesSpellId: 'a1', requiredDamageElement: 'fire' },
  }));

  const shard = () => new Item({ id: 'shard-f4', definitionId: 'test_shard', name: 'Stone Shard', category: 'quest', weight: 1, bulk: 1 });
  const runes = () => player.inventory.getAllCarriedItems().filter((i) => i.definitionId?.startsWith('essence_'));

  const carrier = (id = 'c1', withShard = true) => {
    const m = new Monster({
      id,
      definitionId: 'carrier_kind',
      name: 'Carrier',
      position: { x: 9, y: 9 },
      stats: { hp: 40, maxHp: 40, attack: 1, defense: 0 },
      speed: 100,
      aiType: 'melee',
      xpValue: 0,
    });
    if (withShard) m.addItem(shard());
    engine.map.addEntity(m);
    return m;
  };

  const build = (floor: number) => {
    player = new Player({
      position: { x: 2, y: 2 },
      mana: 50,
      maxMana: 50,
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 },
      spellsKnown: [],
    });
    engine = new GameEngine({ map: new GameMap(15, 15, TILES.FLOOR), player, manifest: manifest as any, seed: 1337, floor });
    engine.map.setTile(3, 2, STONE);
  };

  beforeEach(() => build(4));

  /** The hero steps east onto the stone at (3, 2) and back, returning the events of the step on. */
  const stepOn = () => {
    player.x = 2;
    const capture = engine.beginEventCapture();
    engine.handlePlayerAction(new MovementAction(player, 1, 0));
    return capture;
  };

  it('names the carrier on arrival, and when the stone is found without its shard', () => {
    carrier();
    const events = stepOn();
    expect(events.some((e) => e.type === 'learning_stone_reached')).toBe(false);
    expect(engine.messages.some((m: string) => m.includes('Carrier carries the shard of Broken Stone'))).toBe(true);
  });

  /** The hero has never seen the stone's tile at (3, 2). */
  const unseeStone = () => engine.fov.setVisibility(3, 2, Visibility.Unexplored);

  it('marks an unseen stone once the shard is picked up, and the carrier while it lives', () => {
    const m = carrier();
    unseeStone();
    expect(learningStoneMarks(engine)).toEqual({ stone: undefined, carrierId: m.id });
    DeathResolver.resolveDeath(engine, undefined, m);
    const dropped = engine.map.getItemsAt(m.x, m.y).find((i) => i.definitionId === 'test_shard');
    expect(dropped).toBeDefined();
    player.x = m.x;
    player.y = m.y;
    engine.handlePlayerAction(new PickUpAction(player, dropped!.id));
    expect(engine.messages.some((l: string) => l.includes('The shard marks Broken Stone'))).toBe(true);
    expect(learningStoneMarks(engine)).toEqual({ stone: { x: 3, y: 2 }, carrierId: undefined });
  });

  describe('the mark on a stone the hero has seen', () => {
    it('stays while the carrier still holds the shard, in sight or remembered', () => {
      const m = carrier();
      expect(engine.fov.getVisibility(3, 2)).toBe(Visibility.Visible);
      expect(learningStoneMarks(engine)).toEqual({ stone: { x: 3, y: 2 }, carrierId: m.id });
      engine.fov.setVisibility(3, 2, Visibility.Explored);
      expect(learningStoneMarks(engine)).toEqual({ stone: { x: 3, y: 2 }, carrierId: m.id });
    });

    it('is not shown for a stone never seen whose shard the hero lacks', () => {
      const m = carrier();
      unseeStone();
      expect(learningStoneMarks(engine)).toEqual({ stone: undefined, carrierId: m.id });
    });

    it('goes once a spell is read from it', () => {
      player.addItem(shard());
      stepOn();
      engine.handlePlayerAction(new ReadLearningStoneAction(player, learningStoneCard(engine)!.faces[0].id));
      const m = carrier('c2');
      expect(engine.fov.getVisibility(3, 2)).not.toBe(Visibility.Unexplored);
      expect(learningStoneMarks(engine)).toEqual({ stone: undefined, carrierId: m.id });
    });

    it('goes once the shard turns into a rune, at the stone or on leaving the floor', () => {
      player.addItem(shard());
      stepOn();
      engine.handlePlayerAction(new ReadLearningStoneAction(player, null));
      expect(learningStoneMarks(engine).stone).toBeUndefined();

      build(6);
      player.addItem(shard());
      shardFadesOnLeaving(engine);
      expect(engine.fov.getVisibility(3, 2)).not.toBe(Visibility.Unexplored);
      expect(learningStoneMarks(engine).stone).toBeUndefined();
    });
  });

  describe('the way to the stone', () => {
    it('leads to the living carrier, then the dropped shard, then the stone once the shard is held', () => {
      const m = carrier();
      expect(learningStoneTarget(engine)).toEqual({ kind: 'carrier', x: 9, y: 9 });
      DeathResolver.resolveDeath(engine, undefined, m);
      expect(learningStoneTarget(engine)).toEqual({ kind: 'shard', x: 9, y: 9 });
      const dropped = engine.map.getItemsAt(9, 9).find((i) => i.definitionId === 'test_shard')!;
      player.x = 9;
      player.y = 9;
      engine.handlePlayerAction(new PickUpAction(player, dropped.id));
      expect(learningStoneTarget(engine)).toEqual({ kind: 'stone', x: 3, y: 2 });
    });

    it('leads to the stone after the shortcut', () => {
      DeathResolver.resolveDeath(engine, player, carrier(), { damageElement: 'fire' });
      expect(learningStoneTarget(engine)).toEqual({ kind: 'stone', x: 3, y: 2 });
    });

    it('leads nowhere once the stone is spent, or on a floor without one', () => {
      player.addItem(shard());
      stepOn();
      engine.handlePlayerAction(new ReadLearningStoneAction(player, learningStoneCard(engine)!.faces[0].id));
      carrier('c2');
      expect(learningStoneTarget(engine)).toBeUndefined();

      build(5);
      carrier();
      expect(learningStoneTarget(engine)).toBeUndefined();
    });
  });

  it('opens the card on the stone with two unknown faces from its zone, and reads one', () => {
    player.addItem(shard());
    const events = stepOn();
    expect(events.some((e) => e.type === 'learning_stone_reached')).toBe(true);
    const card = learningStoneCard(engine)!;
    expect(card.faces).toHaveLength(2);
    expect(card.faces.every((f) => ['a1', 'a2', 'a3'].includes(f.id))).toBe(true);
    expect(card.shortcut).toBe(false);

    const picked = card.faces[0].id;
    const read = engine.beginEventCapture();
    expect(engine.handlePlayerAction(new ReadLearningStoneAction(player, picked)).success).toBe(true);
    expect(read.find((e) => e.type === 'learning_stone_read')?.data).toMatchObject({ spellId: picked, learned: true });
    expect(player.spellsKnown).toEqual([picked]);
    expect(player.inventory.getAllCarriedItems().some((i) => i.definitionId === 'test_shard')).toBe(false);
    expect(learningStoneCard(engine)).toBeUndefined();
    expect(effectiveManaCost(player, spell(picked, 'fire'))).toBe(20);
  });

  it('shows the same faces again after "not now"', () => {
    player.addItem(shard());
    stepOn();
    const first = learningStoneCard(engine)!.faces.map((f) => f.id);
    stepOn();
    expect(learningStoneCard(engine)!.faces.map((f) => f.id)).toEqual(first);
    expect(player.learningStones.shown).toEqual(first);
  });

  it('refuses a read away from the stone without a shortcut', () => {
    player.addItem(shard());
    stepOn();
    const face = learningStoneCard(engine)!.faces[0].id;
    player.x = 8;
    expect(engine.handlePlayerAction(new ReadLearningStoneAction(player, face)).success).toBe(false);
  });

  it('turns the shard into a rune of a face when both are turned down', () => {
    player.addItem(shard());
    stepOn();
    const read = engine.beginEventCapture();
    engine.handlePlayerAction(new ReadLearningStoneAction(player, null));
    expect(read.find((e) => e.type === 'learning_stone_read')?.data?.learned).toBe(false);
    expect(player.spellsKnown).toEqual([]);
    expect(runes()).toHaveLength(1);
    expect(learningStoneCard(engine)).toBeUndefined();
  });

  it('shows one face with one spell left to learn, and none, a rune, with none', () => {
    player.spellsKnown.push('a1', 'a2', 'a3', 'b1', 'fixed_a');
    player.addItem(shard());
    stepOn();
    expect(learningStoneCard(engine)!.faces.map((f) => f.id)).toEqual(['fixed_b']);

    build(6);
    player.spellsKnown.push('a1', 'a2', 'a3', 'b1', 'fixed_a', 'fixed_b');
    player.addItem(shard());
    stepOn();
    expect(learningStoneCard(engine)!.faces).toEqual([]);
  });

  it('borrows from the next zone once its own spells have all been shown', () => {
    player.learningStones.shown.push('a1', 'a2', 'a3');
    player.addItem(shard());
    stepOn();
    const faces = learningStoneCard(engine)!.faces.map((f) => f.id);
    expect(faces.some((id) => ['b1', 'fixed_a', 'fixed_b'].includes(id))).toBe(true);
  });

  it("shows a stone's fixed faces", () => {
    build(8);
    player.addItem(shard());
    stepOn();
    expect(learningStoneCard(engine)!.faces.map((f) => f.id)).toEqual(['fixed_a', 'fixed_b']);
  });

  describe('the shortcut', () => {
    it("opens the card on the spot when the carrier falls to its kind's rite, a tenth cheaper", () => {
      const m = carrier();
      const capture = engine.beginEventCapture();
      DeathResolver.resolveDeath(engine, player, m, { damageElement: 'fire' });
      expect(capture.find((e) => e.type === 'learning_stone_reached')?.data?.shortcut).toBe(true);
      // The shard went to the hero's hand, not the ground; the kind's first shortcut gives its rune.
      expect(engine.map.getItemsAt(m.x, m.y).some((i) => i.definitionId === 'test_shard')).toBe(false);
      expect(runes().map((i) => i.definitionId)).toEqual(['essence_cold']);

      const card = learningStoneCard(engine)!;
      expect(card.shortcut).toBe(true);
      expect(card.costShare).toBe(0.9);
      player.x = 8; // anywhere on the floor
      const face = card.faces[0].id;
      expect(engine.handlePlayerAction(new ReadLearningStoneAction(player, face)).success).toBe(true);
      expect(player.spellsKnown).toEqual([face]);
      expect(effectiveManaCost(player, spell(face, 'fire'))).toBe(18);
    });

    it("gives the kind's rune only on its first shortcut", () => {
      engine.compendium.recordKillRite('carrier_kind');
      DeathResolver.resolveDeath(engine, player, carrier(), { damageElement: 'fire' });
      expect(runes()).toEqual([]);
      expect(learningStoneCard(engine)?.shortcut).toBe(true);
    });

    it('teaches nothing when the rite is met on a monster without a shard', () => {
      DeathResolver.resolveDeath(engine, player, carrier('plain', false), { damageElement: 'fire' });
      expect(player.spellsKnown).toEqual([]);
      expect(engine.compendium.isKillRitePerformed('carrier_kind')).toBe(false);
      expect(engine.map.getItemsAt(9, 9)).toEqual([]);
    });

    it('drops the shard as any death does when the rite is not met', () => {
      const m = carrier();
      DeathResolver.resolveDeath(engine, player, m, { damageElement: 'cold' });
      expect(engine.map.getItemsAt(m.x, m.y).some((i) => i.definitionId === 'test_shard')).toBe(true);
      expect(learningStoneCard(engine)).toBeUndefined();
    });
  });

  describe('leaving the floor', () => {
    it('turns a held shard into a rune, and the stone teaches no more', () => {
      player.addItem(shard());
      shardFadesOnLeaving(engine);
      expect(player.inventory.getAllCarriedItems().some((i) => i.definitionId === 'test_shard')).toBe(false);
      expect(runes()).toHaveLength(1);
      expect(player.learningStones.stones.find((s) => s.floor === 4)?.spent).toBe(true);
    });

    it('turns an unread shortcut into a rune', () => {
      engine.compendium.recordKillRite('carrier_kind');
      DeathResolver.resolveDeath(engine, player, carrier(), { damageElement: 'fire' });
      shardFadesOnLeaving(engine);
      expect(runes()).toHaveLength(1);
      expect(learningStoneCard(engine)).toBeUndefined();
    });

    it('by the stairs', () => {
      player.addItem(shard());
      engine.map.setTile(player.x, player.y, TILES.STAIRS_UP);
      expect(engine.handlePlayerAction(new ClimbStairsAction(player)).success).toBe(true);
      expect(engine.currentFloor).toBe(3);
      expect(runes()).toHaveLength(1);
      expect(player.inventory.getAllCarriedItems().some((i) => i.definitionId === 'test_shard')).toBe(false);
    });

    it('leaves a shard on the ground as it is', () => {
      DeathResolver.resolveDeath(engine, undefined, carrier());
      shardFadesOnLeaving(engine);
      expect(runes()).toEqual([]);
    });
  });

  it('saves what the hero has met, and the price of a shortcut spell', () => {
    DeathResolver.resolveDeath(engine, player, carrier(), { damageElement: 'fire' });
    const face = learningStoneCard(engine)!.faces[0].id;
    engine.handlePlayerAction(new ReadLearningStoneAction(player, face));
    const { engine: loaded } = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine))), manifest as any);
    expect(loaded.player.learningStones).toEqual(player.learningStones);
    expect(effectiveManaCost(loaded.player, spell(face, 'fire'))).toBe(18);
  });

  it('saves nothing for a hero who has met no stone', () => {
    expect(serializeGame(engine).player.learningStones).toBeUndefined();
  });
});

describe('Placing a stone on a generated floor', () => {
  const withStones = {
    ...cotwManifest,
    tiles: [...(cotwManifest.tiles ?? []), STONE],
    items: [...(cotwManifest.items ?? []), { id: 'test_shard', name: 'Stone Shard', category: 'quest', weight: 1, bulk: 1, identified: true }],
    magic: { ...cotwManifest.magic, learningStones: { ...stones, zones: [{ minFloor: 1, maxFloor: 9, spellIds: [], carrierIds: ['kobold'] }], stones: [{ floor: 4 }, { floor: 6, carrierId: 'kobold' }] } },
  } as typeof cotwManifest;

  const stoneAt = (map: GameMap) => {
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (map.getTile(x, y)?.type === 'test_stone') return { x, y };
    return undefined;
  };

  it.each([1, 2, 3, 4, 5])('places one stone and one deep-sleeping carrier with its shard (seed %i)', (seed) => {
    for (const floor of [4, 6]) {
      const { map, playerSpawn } = DungeonArc.generateFloor(floor, seed * 7919, withStones.quest, withStones);
      const at = stoneAt(map);
      expect(at).toBeDefined();
      expect(Math.max(Math.abs(at!.x - playerSpawn.x), Math.abs(at!.y - playerSpawn.y))).toBeGreaterThan(1);
      const carriers = map
        .getAllEntities()
        .filter((e): e is Monster => e instanceof Monster && e.getItems().some((i) => i.definitionId === 'test_shard'));
      expect(carriers).toHaveLength(1);
      expect(carriers[0].deepSleep).toBe(true);
      expect(carriers[0].aiState).toBe('sleeping');
      if (floor === 6) expect(carriers[0].definitionId).toBe('kobold');
    }
  });

  it('places nothing on a floor without a stone', () => {
    const { map } = DungeonArc.generateFloor(5, 7919, withStones.quest, withStones);
    expect(stoneAt(map)).toBeUndefined();
  });

  it('leaves the rest of the floor as it was', () => {
    const plain = DungeonArc.generateFloor(4, 7919, cotwManifest.quest, cotwManifest);
    const stoned = DungeonArc.generateFloor(4, 7919, withStones.quest, withStones);
    const ids = (map: GameMap) => map.getAllEntities().map((e) => `${e.id}@${e.x},${e.y}`);
    expect(ids(stoned.map).filter((id) => !id.startsWith('mon-4-carrier'))).toEqual(ids(plain.map));
  });
});
