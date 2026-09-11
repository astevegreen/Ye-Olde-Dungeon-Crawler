import { describe, it, expect } from 'vitest';
import type { GameContentManifest } from '../types/manifest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { NPC } from '../entities/npc';
import { TownMapGenerator } from '../town/townMap';
import { TempleService, BankService } from '../economy/services';
import { serializeGame, deserializeGame } from '../storage/serializer';
import { ItemFactory } from '../items/factory';
import { Item } from '../items/item';
import { addCurrencyToPlayer, CoinItem } from '../economy/currency';

const ELDORIA_MANIFEST: GameContentManifest = {
  id: 'eldoria',
  name: 'Chronicles of Eldoria',
  description: 'High-fantasy realm decoupled from Norse mythology.',
  monsters: [
    {
      id: 'voidling',
      name: 'Voidling Swarm',
      stats: { hp: 12, maxHp: 12, attack: 6, defense: 2 },
      speed: 110,
      aiType: 'melee',
      fleeHealthPercent: 0.1,
      lootTable: [],
      xpValue: 15,
    },
    {
      id: 'nether_drake',
      name: 'Nether Drake',
      stats: { hp: 35, maxHp: 35, attack: 12, defense: 6 },
      speed: 90,
      aiType: 'melee',
      fleeHealthPercent: 0.15,
      lootTable: [],
      xpValue: 80,
    },
  ],
  items: [
    {
      id: 'sunblade',
      name: 'Sunblade of Dawn',
      category: 'weapon',
      slot: 'mainHand',
      weight: 1200,
      bulk: 800,
      stats: { attackBonus: 14 },
      value: 5000,
    },
  ],
  spells: [],
  town: {
    name: 'Silverglade',
    width: 40,
    height: 25,
    playerSpawn: { x: 20, y: 12 },
    stairsDown: { x: 20, y: 15 },
    buildings: [
      {
        name: 'Cathedral of Light',
        bounds: { x1: 5, y1: 5, x2: 15, y2: 12 },
        door: { x: 10, y: 12 },
      },
    ],
    npcs: [
      {
        id: 'npc_julian',
        name: 'Mayor Julian',
        role: 'villager',
        position: { x: 20, y: 10 },
        greeting: 'Welcome to Silverglade, traveler!',
        dialogText: 'The Abyssal Rift threatens our realm. Please seal it!',
        isStationary: true,
      },
      {
        id: 'npc_serena',
        name: 'High Priestess Serena',
        role: 'priest',
        position: { x: 10, y: 8 },
        greeting: 'May the Sun guide you.',
        dialogText: 'I can purge any dark curses afflictions for a humble tithe.',
        isStationary: true,
      },
      {
        id: 'npc_silas',
        name: 'Banker Silas',
        role: 'banker',
        position: { x: 30, y: 8 },
        greeting: 'Silverglade Vaults are at your disposal.',
        dialogText: 'We convert your heavy copper into radiant platinum.',
        isStationary: true,
      },
    ],
    services: {
      templeName: 'Cathedral of Light',
      priestTitle: 'High Priestess Serena',
      cleanseMessageTemplate: 'High Priestess Serena channels pure radiant sunlight, purging {item} of darkness!',
      healMessageTemplate: 'High Priestess Serena restores your vigor with sacred dawnlight.',
      bankName: 'Silverglade Vaults',
      bankerTitle: 'Banker Silas',
      compactionMessageTemplate: 'Banker Silas trades your bulky coins into concentrated bullion.',
    },
  },
  quest: {
    id: 'eldoria_quest',
    name: 'The Abyssal Rift',
    maxFloor: 3,
    bossFloor: 3,
    bossMonsterId: 'malakor',
    relicItemId: 'shard_of_dawn',
    victoryNpcId: 'npc_julian',
    victoryFloor: 0,
    victoryDialogue: 'You have sealed the Abyssal Rift and saved Silverglade!',
    victoryScoreBonus: 5000,
    championProclamation: 'Hail the Radiant Champion of Eldoria!',
    victoryEpitaph: 'Savior of Silverglade, Cleanser of the Void',
    bossLairTitle: '*** FLOOR 3: THE VOIDWEAVER SANCTUM ***',
    bossEntryMessage: 'A deafening cosmic hum vibrates the stone. Malakor turns his gaze upon you!',
    bossFloorLayout: {
      width: 30,
      height: 30,
      playerSpawn: { x: 15, y: 25 },
      stairsUp: { x: 15, y: 28 },
      bossSpawn: { x: 15, y: 5 },
    },
    floorEncounters: {
      1: { monsterIds: ['voidling'], minMonsters: 2, maxMonsters: 4 },
      2: { monsterIds: ['voidling', 'nether_drake'], minMonsters: 3, maxMonsters: 5 },
      3: { monsterIds: ['nether_drake'], minMonsters: 2, maxMonsters: 4 },
    },
  },
  atlas: { themeId: 'default' },
  starterKit: { weaponItemId: 'sunblade' },
};

describe('Full Content Manifest Swapping (Eldoria Lore Agnosticism)', () => {
  it('generates town and registers services purely from the swappable manifest', () => {
    const townGen = new TownMapGenerator(ELDORIA_MANIFEST.town.width, ELDORIA_MANIFEST.town.height, ELDORIA_MANIFEST.town);
    const town = townGen.generate();

    expect(town.map.width).toBe(40);
    expect(town.map.height).toBe(25);
    expect(town.playerSpawn).toEqual({ x: 20, y: 12 });

    const player = new Player({
      id: 'hero_el',
      name: 'Aurelius',
      position: town.playerSpawn,
      stats: { hp: 50, maxHp: 50, attack: 12, defense: 6 },
    });

    const engine = new GameEngine({
      map: town.map,
      player,
      floor: 0,
      manifest: ELDORIA_MANIFEST,
    });

    expect(engine.manifest.id).toBe('eldoria');

    // Verify NPCs spawned
    const julian = town.map.getEntityById('npc_julian') as NPC;
    expect(julian).toBeDefined();
    expect(julian.name).toBe('Mayor Julian');

    const serena = town.map.getEntityById('npc_serena') as NPC;
    expect(serena).toBeDefined();
    expect(serena.name).toBe('High Priestess Serena');

    // Test Temple Service uses custom Serena dialogue and cathedral title
    const cursedMace = ItemFactory.createCursedMace('cursed_club');
    player.inventory.primaryPack.addItem(cursedMace);
    player.inventory.paperdoll.equip(cursedMace, 'mainHand');
    expect(player.inventory.paperdoll.getItem('mainHand')?.isCursed()).toBe(true);

    addCurrencyToPlayer(player, 10000);
    const cleanseResult = TempleService.cleanseCurses(player, ELDORIA_MANIFEST.town.services);
    expect(cleanseResult.success).toBe(true);
    expect(cleanseResult.message).toContain('High Priestess Serena');
    expect(cleanseResult.message).toContain('purging');

    // Test Bank Service uses custom Silas dialogue (add 500 bulky copper coins to trigger compaction)
    player.inventory.primaryPack.addItem(new CoinItem({ id: 'copper_piles', denomination: 'copper', count: 500 }));
    const bankResult = BankService.compactCurrency(player, ELDORIA_MANIFEST.town.services);
    expect(bankResult.success).toBe(true);
    expect(bankResult.message).toContain('Banker Silas');
  });

  it('custom floor transitions and lair entry messages match swappable manifest', () => {
    const map = GameMap.createBoxRoom(20, 20);
    const player = new Player({
      id: 'hero_el',
      name: 'Aurelius',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 12, defense: 6 },
    });

    const engine = new GameEngine({
      map,
      player,
      floor: 1,
      manifest: ELDORIA_MANIFEST,
    });

    // Ascend to town
    engine.changeFloor(0);
    expect(engine.messages.some((m) => m.includes('Silverglade, haven of adventurers'))).toBe(true);
    // Ensure no Norse Bjarnarhaven mention
    expect(engine.messages.some((m) => m.includes('Bjarnarhaven'))).toBe(false);

    // Descend to boss floor (Floor 3)
    engine.changeFloor(3);
    expect(engine.messages.some((m) => m.includes('*** FLOOR 3: THE VOIDWEAVER SANCTUM ***'))).toBe(true);
    expect(engine.messages.some((m) => m.includes('Malakor turns his gaze upon you!'))).toBe(true);
    expect(engine.messages.some((m) => m.includes('Hrungnir'))).toBe(false);
  });

  it('executes custom victory arc with custom victory NPC dialogue and champion proclamation', () => {
    const map = GameMap.createBoxRoom(20, 20);
    const player = new Player({
      id: 'hero_el',
      name: 'Aurelius',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 12, defense: 6 },
    });

    const engine = new GameEngine({
      map,
      player,
      floor: 0,
      manifest: ELDORIA_MANIFEST,
    });

    // Simulate defeating boss and acquiring Shard of Dawn
    engine.gameState.bossDefeated = true;
    const relic = new Item({
      id: 'shard_of_dawn',
      name: 'Shard of Dawn',
      category: 'quest',
      weight: 100,
      bulk: 100,
      identified: true,
    });
    player.inventory.primaryPack.addItem(relic);

    const julian = new NPC({
      id: 'npc_julian',
      name: 'Mayor Julian',
      role: 'villager',
      position: { x: 6, y: 5 },
      greeting: 'Welcome!',
      dialogText: 'Thanks!',
    });
    engine.addEntity(julian);

    // Speak with Mayor Julian to trigger victory
    engine.interactWithNpc(julian);

    expect(engine.gameState.runStatus).toBe('victorious');
    expect(engine.messages.some((m) => m.includes('sealed the Abyssal Rift and saved Silverglade'))).toBe(true);
    expect(engine.messages.some((m) => m.includes('Hail the Radiant Champion of Eldoria!'))).toBe(true);
  });

  it('serializes and deserializes cleanly with swappable manifest envelope', () => {
    const map = GameMap.createBoxRoom(15, 15);
    const player = new Player({
      id: 'hero_el',
      name: 'Aurelius',
      position: { x: 4, y: 4 },
      stats: { hp: 50, maxHp: 50, attack: 12, defense: 6 },
    });

    const engine = new GameEngine({
      map,
      player,
      floor: 1,
      manifest: ELDORIA_MANIFEST,
    });

    const profile = {
      id: 'hero_el',
      name: 'Aurelius',
      level: 1,
      floor: 1,
      lastSaved: Date.now(),
      hp: 50,
      maxHp: 50,
      strength: 15,
    };

    const serialized = serializeGame(engine, profile);
    expect(serialized.contentManifestId).toBe('eldoria');

    const restored = deserializeGame(serialized, ELDORIA_MANIFEST);
    expect(restored.engine.manifest.id).toBe('eldoria');
    expect(restored.engine.manifest.name).toBe('Chronicles of Eldoria');
    expect(restored.engine.manifest.town.name).toBe('Silverglade');
  });
});
