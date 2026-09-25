import { PRNG } from '../dungeon/prng';
import { GameMap } from '../grid/map';
import { TILES, getTileDefinition, hasTileDefinition } from '../grid/tile';
import type { Position, GameDifficulty, TileDefinition } from '../types';
import { DungeonGeneratorRegistry } from '../dungeon/generator';
import { Monster } from '../entities/monster';
import { NPC } from '../entities/npc';

import type { Player } from '../entities/player';
import { QUEST_RELIC_ID, MAX_DUNGEON_FLOOR } from './types';
import { ItemFactory } from '../items/factory';
import { populateDungeonFloor, scaleMonsterStats } from '../dungeon/spawner';
import { populateDungeonLoot } from '../dungeon/lootSpawner';
import type { GameContentManifest, QuestArcDefinition, ItemDefinition } from '../types/manifest';
import type { MonsterScalingConfig } from '../types/monsterScaling';
import { getMonsterDefinition, type MonsterDefinition } from '../bestiary/monsterDefinitions';
import { Container } from '../items/container';
import type { Item } from '../items/item';
import { RuneOfReturnItem } from '../magic/runeOfReturn';
import type { EngineRegistries } from '../registries';
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
    bossId: string = 'boss-monster',
    scalingConfig?: MonsterScalingConfig,
    difficulty?: GameDifficulty
  ): Monster {
    const def = bossDef ?? getMonsterDefinition(bossId) ?? {
      id: bossId,
      name: bossId === 'boss-monster' ? 'Dungeon Boss' : 'Boss',
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
              bossId === 'boss-monster'
                ? 'Ancient Relic'
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
    if (scalingConfig || floorNumber > 5) {
      const scaled = scaleMonsterStats(def, floorNumber, undefined, undefined, scalingConfig, difficulty);
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
   * Handcrafted boss lair on floor >= maxFloor.
   */
  public static generateFloor(
    floorNumber: number,
    seed?: number,
    questArc?: QuestArcDefinition,
    manifest?: GameContentManifest,
    densityMultiplier = 1.0,
    difficulty?: GameDifficulty,
    registries?: EngineRegistries
  ): DungeonFloorResult {
    const maxFloor = questArc?.maxFloor ?? this.MAX_FLOOR;
    if (floorNumber >= maxFloor) {
      return this.generateBossLair(floorNumber, questArc, manifest, difficulty);
    }

    return this.generateProceduralFloor(
      floorNumber,
      seed,
      maxFloor,
      questArc,
      manifest,
      densityMultiplier,
      difficulty,
      registries
    );
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
    densityMultiplier = 1.0,
    difficulty?: GameDifficulty,
    registries?: EngineRegistries
  ): DungeonFloorResult {
    const layoutBand = manifest?.floorLayouts?.find(
      (b) => floorNumber >= b.minFloor && (b.maxFloor === undefined || floorNumber <= b.maxFloor)
    );
    const generatorStrategyId =
      questArc?.floorGenerators?.[floorNumber] ?? layoutBand?.strategy ?? questArc?.defaultGenerator ?? 'bsp';
    const strategy = DungeonGeneratorRegistry.get(generatorStrategyId);
    if (!strategy) {
      // Floor generation always runs inside a pipeline-isolated player action
      // (stairs) or a UI-confirmed floor change, so throwing here fails that one
      // action loudly instead of silently generating a floor with the wrong
      // (possibly much easier/harder) layout algorithm.
      throw new Error(
        `Unknown dungeon generator strategy: '${generatorStrategyId}' is not registered in DungeonGeneratorRegistry.`
      );
    }

    const monsterCatalog: MonsterDefinition[] = manifest?.monsters
      ? (Array.isArray(manifest.monsters) ? manifest.monsters : Object.values(manifest.monsters) as MonsterDefinition[])
      : registries
      ? registries.monsters.getAll()
      : [];
    const itemCatalog: ItemDefinition[] = manifest?.items
      ? (Array.isArray(manifest.items) ? manifest.items : Object.values(manifest.items) as ItemDefinition[])
      : [];

    // The Rune of Return acquisition vault takes precedence over a scripted placement
    // on the same floor (only one forced vault per floor).
    const scriptedPlacement =
      manifest?.runeOfReturn?.acquisition?.floor === floorNumber
        ? undefined
        : manifest?.scriptedVaultPlacements?.find((p) => p.floor === floorNumber);

    const width = manifest?.floorSize?.width ?? 50;
    const height = manifest?.floorSize?.height ?? 35;
    const dungeon = strategy.generate({
      width,
      height,
      // Room count scales with floor area (10 rooms at the default 50x35).
      maxRooms: Math.max(6, Math.round((10 * width * height) / (50 * 35))),
      minRoomSize: 5,
      maxRoomSize: 10,
      floorNumber,
      seed,
      spawnMonsters: false, // Scaled monsters spawned below
      vaults: manifest?.vaults ?? [],
      monsterCandidates: monsterCatalog,
      itemCandidates: itemCatalog,
      scalingConfig: manifest?.monsterScaling,
      difficulty,
      registries,
      roomDecoration: manifest?.roomDecoration,
      layoutParams: layoutBand?.params,
      threshold: layoutBand && floorNumber === layoutBand.minFloor ? layoutBand.threshold : undefined,
      forcedVaultId:
        manifest?.runeOfReturn?.acquisition?.floor === floorNumber
          ? manifest.runeOfReturn.acquisition.vaultId
          : scriptedPlacement?.vaultId,
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
    const populationPrng = new PRNG((seed ?? floorNumber) + floorNumber * 7919);
    const populationRng = () => populationPrng.next();
    populateDungeonFloor(
      map,
      dungeon.rooms,
      floorNumber,
      monsterCatalog,
      populationRng,
      densityMultiplier,
      manifest?.monsterScaling,
      difficulty,
      registries
    );

    // 4. Spawn Floor-scaled loot and chests
    populateDungeonLoot(map, dungeon.rooms, floorNumber, itemCatalog, populationRng);

    // 5. Fixed tile placements declared in manifest (docs/architecture/content-quests-and-triggers.md)
    if (manifest?.fixedTilePlacements?.length) {
      for (const placement of manifest.fixedTilePlacements) {
        if (placement.floor !== floorNumber) continue;
        if (placement.requiresChoiceId && !manifest.choices?.[placement.requiresChoiceId]) continue;
        const tileDef =
          manifest.tiles?.find((t) => t.type === placement.tileId) ??
          (hasTileDefinition(placement.tileId) ? getTileDefinition(placement.tileId) : undefined);
        if (!tileDef) continue;

        if (placement.placement === 'middle_room_center') {
          const eligibleRooms = dungeon.rooms.filter(
            (r) =>
              (r.centerX !== playerSpawn.x || r.centerY !== playerSpawn.y) &&
              (!stairsDown || r.centerX !== stairsDown.x || r.centerY !== stairsDown.y)
          );
          const targetRoom =
            eligibleRooms.length > 2
              ? eligibleRooms[Math.floor(eligibleRooms.length / 2)]
              : eligibleRooms[0] ?? dungeon.rooms[0];
          if (targetRoom) {
            const posX = targetRoom.centerX;
            const posY = targetRoom.centerY;
            if (
              (posX !== playerSpawn.x || posY !== playerSpawn.y) &&
              (!stairsDown || posX !== stairsDown.x || posY !== stairsDown.y)
            ) {
              map.setTile(posX, posY, tileDef);
            }
          }
        }
      }
    }

    // 6. Guaranteed Reward: Rune of Return, guarded by monsters in a hand-placed vault room
    const runeAcquisition = manifest?.runeOfReturn?.acquisition;
    if (runeAcquisition && floorNumber === runeAcquisition.floor && dungeon.forcedVaultChestSpawns?.length) {
      const chestPos = dungeon.forcedVaultChestSpawns[0];
      const rune = new RuneOfReturnItem({
        id: `rune-of-return-f${floorNumber}-${seed ?? floorNumber}`,
        name: 'Rune of Return',
        unidentifiedName: 'Carved Rune Stone',
        identified: true,
        description:
          'A palm-sized stone etched with a rune that hums faintly. Channeling it over several turns teleports you back to town.',
      });
      const chest = map.getItemsAt(chestPos.x, chestPos.y).find((it) => it instanceof Container) as
        | Container
        | undefined;
      // Preferred: inside the chest, alongside its randomly-rolled filler loot.
      // Fallback: dropped loose at the same tile — the general chest-fill logic
      // (lootSpawner.ts's createDungeonChest) can occasionally roll another
      // container as filler and exceed capacity for anything more, and the
      // reward must never silently vanish because of that unrelated quirk.
      if (!chest || !chest.addItem(rune)) {
        map.addItemAt(chestPos.x, chestPos.y, rune);
      }
    }

    // 7. Scripted vault NPCs: the placement's declared NPCs fill the vault's `N`
    // markers in layout order. Extra markers stay empty; extra NPCs are not spawned.
    const npcSpawns = dungeon.forcedVaultNpcSpawns ?? [];
    const placementNpcs = scriptedPlacement?.npcs ?? [];
    for (let i = 0; i < Math.min(npcSpawns.length, placementNpcs.length); i++) {
      const npcDef = placementNpcs[i];
      map.addEntity(
        new NPC({
          id: npcDef.id,
          name: npcDef.name,
          role: npcDef.role ?? 'villager',
          position: { x: npcSpawns[i].x, y: npcSpawns[i].y },
          greeting: npcDef.greeting,
          dialogText: npcDef.dialogText,
          isStationary: true,
        })
      );
    }

    return {
      map,
      playerSpawn,
      stairsUp: playerSpawn,
      stairsDown,
    };
  }

  /**
   * Handcrafted climax floor: the boss lair.
   * Grand Hall with decorative stone pillars, throne dais, bodyguards, and boss.
   */
  public static generateBossLair(
    floorNumber: number = 5,
    questArc?: QuestArcDefinition,
    manifest?: GameContentManifest,
    difficulty?: GameDifficulty
  ): DungeonFloorResult {

    const authored = questArc?.bossFloorLayout;
    if (authored?.layout && authored.layout.length > 0) {
      return this.generateAuthoredLair(floorNumber, authored, questArc, manifest, difficulty);
    }

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
    const bossId = questArc?.bossMonsterId ?? 'boss-monster';
    const bossDef = (Array.isArray(manifest?.monsters) ? manifest?.monsters.find((m) => m.id === bossId) : undefined) ??
      getMonsterDefinition(bossId);
    const boss = this.createBoss(22, 7, floorNumber, bossDef, bossId, manifest?.monsterScaling, difficulty);
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

    // Boss treasure chest behind the throne
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
   * A lair drawn from the quest's `bossFloorLayout.layout`. The boss, its four guards and
   * its hoard keep the built-in hall's arrangement around `bossSpawn`: brutes five tiles to
   * either side, casters four across and five below, the hoard two rows above.
   */
  private static generateAuthoredLair(
    floorNumber: number,
    layout: NonNullable<QuestArcDefinition['bossFloorLayout']>,
    questArc?: QuestArcDefinition,
    manifest?: GameContentManifest,
    difficulty?: GameDifficulty
  ): DungeonFloorResult {
    const rows = layout.layout!;
    const height = rows.length;
    const width = Math.max(...rows.map((r) => r.length));
    const map = new GameMap(width, height, TILES.WALL);
    const symbols: Record<string, TileDefinition> = {
      '#': TILES.WALL,
      '.': TILES.FLOOR,
      '~': TILES.SHALLOW_WATER,
      X: TILES.CHASM,
      P: TILES.PILLAR,
      B: TILES.IRON_BARS,
      '+': TILES.DOOR_CLOSED,
      "'": TILES.DOOR_OPEN,
    };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ch = rows[y][x] ?? '#';
        const legendType = layout.legend?.[ch];
        const tile =
          legendType !== undefined && hasTileDefinition(legendType)
            ? getTileDefinition(legendType)
            : symbols[ch] ?? TILES.FLOOR;
        map.setTile(x, y, tile);
      }
    }

    const stairsUp = { ...layout.stairsUp };
    map.setTile(stairsUp.x, stairsUp.y, TILES.STAIRS_UP);
    const playerSpawn = { ...layout.playerSpawn };
    const { x: bx, y: by } = layout.bossSpawn;

    const bossId = questArc?.bossMonsterId ?? 'boss-monster';
    const bossDef = (Array.isArray(manifest?.monsters) ? manifest?.monsters.find((m) => m.id === bossId) : undefined) ??
      getMonsterDefinition(bossId);
    const boss = this.createBoss(bx, by, floorNumber, bossDef, bossId, manifest?.monsterScaling, difficulty);
    map.addEntity(boss);

    const place = (x: number, y: number) => map.inBounds(x, y) && map.isPassable(x, y) && !map.getEntityAt(x, y);
    const guard = (id: string, x: number, y: number, caster: boolean, drop: (itemId: string) => Item) => {
      if (!place(x, y)) return;
      map.addEntity(
        new Monster({
          id,
          name: caster ? 'Boss Caster' : 'Boss Guard',
          position: { x, y },
          stats: caster ? { hp: 20, maxHp: 20, attack: 6, defense: 3 } : { hp: 45, maxHp: 45, attack: 11, defense: 4 },
          speed: caster ? 100 : 80,
          aiType: caster ? 'caster' : 'brute',
          spells: caster ? ['firebolt', 'slow'] : undefined,
          spellCooldown: caster ? 3 : undefined,
          definitionId: caster ? 'boss-caster' : 'boss-guard',
          xpValue: caster ? 60 : 100,
          lootTable: [{ chance: caster ? 0.5 : 1.0, generate: drop }],
        })
      );
    };
    guard('guard-ogre-1', bx - 5, by, false, (id) => ItemFactory.createGoldCoins(id, 40));
    guard('guard-ogre-2', bx + 5, by, false, (id) => ItemFactory.createGoldCoins(id, 40));
    guard('guard-shaman-1', bx - 4, by + 5, true, (id) => ItemFactory.createManaPotion(id));
    guard('guard-shaman-2', bx + 4, by + 5, true, (id) => ItemFactory.createHealthPotion(id));

    if (place(bx, by - 2)) map.addItemAt(bx, by - 2, ItemFactory.createIronChest('boss-chest-1'));
    if (place(bx - 1, by - 2)) map.addItemAt(bx - 1, by - 2, ItemFactory.createPlatinumCoins('boss-plat-1', 10));
    if (place(bx + 1, by - 2)) map.addItemAt(bx + 1, by - 2, ItemFactory.createHealthPotion('boss-pot-1'));

    return { map, playerSpawn, stairsUp, boss };
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
