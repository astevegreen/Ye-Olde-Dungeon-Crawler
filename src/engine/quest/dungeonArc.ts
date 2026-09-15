import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import type { Position } from '../types';
import { DungeonGeneratorRegistry } from '../dungeon/generator';
import { Monster } from '../entities/monster';

import type { Player } from '../entities/player';
import { QUEST_RELIC_ID, MAX_DUNGEON_FLOOR } from './types';
import { ItemFactory } from '../items/factory';
import { populateDungeonFloor, scaleMonsterStats } from '../dungeon/spawner';
import { populateDungeonLoot } from '../dungeon/lootSpawner';
import { TownReturnDispatcher } from '../dungeon/townReturnDispatcher';
import type { GameContentManifest, QuestArcDefinition, ItemDefinition } from '../types/manifest';
import { getMonsterDefinition, type MonsterDefinition } from '../bestiary/monsterDefinitions';

export interface DungeonFloorResult {
  map: GameMap;
  playerSpawn: Position;
  stairsUp?: Position;
  stairsDown?: Position;
  boss?: Monster;
}

export class DungeonArc {
  public static readonly MAX_FLOOR = MAX_DUNGEON_FLOOR;

  public static isBossFloor(floor: number, questArc?: QuestArcDefinition): boolean {
    const maxFloor = questArc?.maxFloor ?? this.MAX_FLOOR;
    return floor === maxFloor;
  }

  /**
   * Spawns a boss monster scaled for the climax floor.
   */
  public static createBoss(
    x: number,
    y: number,
    floorNumber: number = 5,
    bossDef?: MonsterDefinition,
    bossId: string = 'boss_hrungnir'
  ): Monster {
    const def = bossDef ?? getMonsterDefinition(bossId) ?? {
      id: bossId,
      name: bossId === 'boss_hrungnir' || bossId === 'boss-monster' ? 'Hrungnir the Hill Giant Chieftain' : 'Boss',
      stats: { hp: 120, maxHp: 120, attack: 18, defense: 8 },
      speed: 80,
      aiType: 'brute',
      fleeHealthPercent: 0,
      xpValue: 500,
      lootTable: [
        {
          chance: 1.0,
          generate: (id) =>
            ItemFactory.createQuestRelic(
              id,
              bossId === 'boss_hrungnir' || bossId === 'boss-monster'
                ? 'The Sun-Stone of Freyr'
                : 'Quest Relic',
              'The ancient radiant relic, warm to the touch. Returning it to town will bring lasting peace.'
            ),
        },
      ],
      statusImmunities: ['paralysis', 'poison'],
      resistances: {},
    };
    let stats = { ...def.stats };
    let xpValue = def.xpValue;
    if (floorNumber > 5) {
      const scaled = scaleMonsterStats(def, floorNumber);
      stats = { hp: scaled.hp, maxHp: scaled.maxHp, attack: scaled.attack, defense: scaled.defense };
      xpValue = scaled.xpValue;
    }

    const boss = new Monster({
      id: bossId,
      name: def.name,
      position: { x, y },
      stats,
      speed: def.speed,
      aiType: def.aiType,
      definitionId: def.id,
      resistances: def.resistances,
      statusImmunities: def.statusImmunities,
      spells: def.spells ? [...def.spells] : [],
      spellCooldown: def.spellCooldown ?? 3,
      fleeHealthPercent: def.fleeHealthPercent,
      xpValue,
      lootTable: def.lootTable ? [...def.lootTable] : [],
    });
    return boss;
  }



  /**
   * Generates a floor for the multi-level quest descent.
   * Procedural dungeons for floors < maxFloor.
   * Handcrafted Chieftain's Lair on floor >= maxFloor.
   */
  public static generateFloor(
    floorNumber: number,
    seed?: number,
    questArc?: QuestArcDefinition,
    manifest?: GameContentManifest,
    densityMultiplier = 1.0
  ): DungeonFloorResult {
    const maxFloor = questArc?.maxFloor ?? this.MAX_FLOOR;
    if (floorNumber >= maxFloor) {
      return this.generateChieftainLair(floorNumber, questArc, manifest);
    }

    return this.generateProceduralFloor(floorNumber, seed, maxFloor, questArc, manifest, densityMultiplier);
  }

  /**
   * Generates procedural floors with progressive monster difficulty and depth scaling.
   */
  private static generateProceduralFloor(
    floorNumber: number,
    seed?: number,
    maxFloor: number = this.MAX_FLOOR,
    questArc?: QuestArcDefinition,
    manifest?: GameContentManifest,
    densityMultiplier = 1.0
  ): DungeonFloorResult {
    const generatorStrategyId =
      questArc?.floorGenerators?.[floorNumber] ?? questArc?.defaultGenerator ?? 'bsp';
    const strategy = DungeonGeneratorRegistry.get(generatorStrategyId);
    if (!strategy) {
      // Floor generation always runs inside a pipeline-isolated player action
      // (stairs, town-return fixtures) or a UI-confirmed floor change, so throwing
      // here fails that one action loudly instead of silently generating a floor
      // with the wrong (possibly much easier/harder) layout algorithm.
      throw new Error(
        `Unknown dungeon generator strategy: '${generatorStrategyId}' is not registered in DungeonGeneratorRegistry.`
      );
    }

    const monsterCatalog: MonsterDefinition[] = manifest?.monsters
      ? (Array.isArray(manifest.monsters) ? manifest.monsters : Object.values(manifest.monsters) as MonsterDefinition[])
      : [];
    const itemCatalog: ItemDefinition[] = manifest?.items
      ? (Array.isArray(manifest.items) ? manifest.items : Object.values(manifest.items) as ItemDefinition[])
      : [];

    const dungeon = strategy.generate({
      width: 50,
      height: 35,
      minRoomSize: 5,
      maxRoomSize: 10,
      floorNumber,
      seed,
      spawnMonsters: false, // Scaled monsters spawned below
      vaults: manifest?.vaults ?? [],
      monsterCandidates: monsterCatalog,
      itemCandidates: itemCatalog,
    });

    const map = dungeon.map;
    const playerSpawn = dungeon.playerSpawn;

    // 1. Place Stairs Up at player entry (returning to previous floor or town)
    map.setTile(playerSpawn.x, playerSpawn.y, TILES.STAIRS_UP);

    // 2. Place Stairs Down in the deepest room/exit ONLY if below maxFloor
    let stairsDown: Position | undefined;
    if (floorNumber < maxFloor) {
      const exitPos = dungeon.stairsDown;
      map.setTile(exitPos.x, exitPos.y, TILES.STAIRS_DOWN);
      stairsDown = { x: exitPos.x, y: exitPos.y };
    }

    // 3. Spawn Floor-scaled monsters via encounter spawner
    populateDungeonFloor(map, dungeon.rooms, floorNumber, monsterCatalog, Math.random, densityMultiplier);

    // 4. Spawn Floor-scaled loot and chests
    populateDungeonLoot(map, dungeon.rooms, floorNumber, itemCatalog);

    // 5. Spawn Town-Return shortcut fixture if floor >= 5 and < maxFloor
    TownReturnDispatcher.spawnShortcutFixture(
      map,
      floorNumber,
      maxFloor,
      dungeon.rooms,
      playerSpawn,
      stairsDown
    );

    // 6. Spawn Reference Choice Encounter: Ancient Altar of Tyr on Floor 3
    if (floorNumber === 3 && manifest?.choices?.['altar_tyr']) {
      const targetRoom =
        dungeon.rooms.length > 2 ? dungeon.rooms[Math.floor(dungeon.rooms.length / 2)] : dungeon.rooms[0];
      if (targetRoom) {
        const altarX = targetRoom.centerX;
        const altarY = targetRoom.centerY;
        if (
          (altarX !== playerSpawn.x || altarY !== playerSpawn.y) &&
          (!stairsDown || altarX !== stairsDown.x || altarY !== stairsDown.y)
        ) {
          map.setTile(altarX, altarY, TILES.ALTAR_TYR);
        }
      }
    }

    return {
      map,
      playerSpawn,
      stairsUp: playerSpawn,
      stairsDown,
    };
  }

  /**
   * Handcrafted Climax Floor: The Chieftain's Lair.
   * Grand Hall with decorative stone pillars, throne dais, bodyguards, and Hrungnir.
   */
  public static generateChieftainLair(
    floorNumber: number = 5,
    questArc?: QuestArcDefinition,
    manifest?: GameContentManifest
  ): DungeonFloorResult {

    const width = 44;
    const height = 34;
    const map = new GameMap(width, height);

    // Fill entirely with solid wall
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        map.setTile(x, y, TILES.WALL);
      }
    }

    // Carve South Entrance Antechamber (x: 18..26, y: 24..30)
    for (let y = 24; y <= 30; y++) {
      for (let x = 18; x <= 26; x++) {
        map.setTile(x, y, TILES.FLOOR);
      }
    }

    // Carve Central Grand Hallway (x: 10..34, y: 12..23)
    for (let y = 12; y <= 23; y++) {
      for (let x = 10; x <= 34; x++) {
        map.setTile(x, y, TILES.FLOOR);
      }
    }

    // Carve North Throne Dais Room (x: 12..32, y: 4..11)
    for (let y = 4; y <= 11; y++) {
      for (let x = 12; x <= 32; x++) {
        map.setTile(x, y, TILES.FLOOR);
      }
    }

    // Decorative Pillars in the Grand Hall
    const pillarPositions = [
      { x: 15, y: 14 }, { x: 29, y: 14 },
      { x: 15, y: 18 }, { x: 29, y: 18 },
      { x: 15, y: 22 }, { x: 29, y: 22 },
    ];
    for (const p of pillarPositions) {
      map.setTile(p.x, p.y, TILES.WALL);
    }

    // Open Door between Entrance Antechamber and Grand Hall
    map.setTile(22, 24, TILES.DOOR_OPEN);

    // Stairs Up at South entrance
    const stairsUp: Position = { x: 22, y: 29 };
    map.setTile(stairsUp.x, stairsUp.y, TILES.STAIRS_UP);

    // Player Spawns just north of stairs up
    const playerSpawn: Position = { x: 22, y: 28 };

    // Spawn Boss: on the Throne Dais
    const bossId = questArc?.bossMonsterId ?? 'boss_hrungnir';
    const bossDef = (Array.isArray(manifest?.monsters) ? manifest?.monsters.find((m) => m.id === bossId) : undefined) ??
      getMonsterDefinition(bossId);
    const boss = this.createBoss(22, 7, floorNumber, bossDef, bossId);
    map.addEntity(boss);

    // Spawn Bodyguard Minions flanking the throne
    const ogreLeft = new Monster({
      id: 'guard-ogre-1',
      name: 'Boss Guard',
      position: { x: 17, y: 7 },
      stats: { hp: 45, maxHp: 45, attack: 11, defense: 4 },
      speed: 80,
      aiType: 'brute',
      definitionId: 'boss-guard',
      xpValue: 100,
      lootTable: [
        { chance: 1.0, generate: (id) => ItemFactory.createGoldCoins(id, 40) },
      ],
    });
    map.addEntity(ogreLeft);

    const ogreRight = new Monster({
      id: 'guard-ogre-2',
      name: 'Boss Guard',
      position: { x: 27, y: 7 },
      stats: { hp: 45, maxHp: 45, attack: 11, defense: 4 },
      speed: 80,
      aiType: 'brute',
      definitionId: 'boss-guard',
      xpValue: 100,
      lootTable: [
        { chance: 1.0, generate: (id) => ItemFactory.createGoldCoins(id, 40) },
      ],
    });
    map.addEntity(ogreRight);

    // Two Shamans guarding the hall threshold
    const shamanLeft = new Monster({
      id: 'guard-shaman-1',
      name: 'Boss Caster',
      position: { x: 18, y: 12 },
      stats: { hp: 20, maxHp: 20, attack: 6, defense: 3 },
      speed: 100,
      aiType: 'caster',
      spells: ['firebolt', 'slow'],
      spellCooldown: 3,
      definitionId: 'boss-caster',
      xpValue: 60,
      lootTable: [
        { chance: 0.5, generate: (id) => ItemFactory.createManaPotion(id) },
      ],
    });
    map.addEntity(shamanLeft);

    const shamanRight = new Monster({
      id: 'guard-shaman-2',
      name: 'Boss Caster',
      position: { x: 26, y: 12 },
      stats: { hp: 20, maxHp: 20, attack: 6, defense: 3 },
      speed: 100,
      aiType: 'caster',
      spells: ['firebolt', 'slow'],
      spellCooldown: 3,
      definitionId: 'boss-caster',
      xpValue: 60,
      lootTable: [
        { chance: 0.5, generate: (id) => ItemFactory.createHealthPotion(id) },
      ],
    });
    map.addEntity(shamanRight);

    // Chieftain's Treasure Chest behind throne
    map.addItemAt(22, 5, ItemFactory.createIronChest('boss-chest-1'));
    map.addItemAt(21, 5, ItemFactory.createPlatinumCoins('boss-plat-1', 10)); // 10,000 CP
    map.addItemAt(23, 5, ItemFactory.createHealthPotion('boss-pot-1'));

    return {
      map,
      playerSpawn,
      stairsUp,
      boss,
    };
  }

  /**
   * Checks if the player is currently carrying the legendary quest relic.
   */
  public static isRelicInPlayerPossession(player: Player, relicId: string = QUEST_RELIC_ID): boolean {
    const inPack = player.inventory.primaryPack.getItems().some(
      (i) => i.id === relicId || i.category === 'quest'
    );
    if (inPack) return true;

    const inEquipped = player.inventory.paperdoll.getAllEquipped().some(
      (e) => e.item.id === relicId || e.item.category === 'quest'
    );
    return inEquipped;
  }
}
