import { GameMap } from '../grid/map';
import { TILES, getTileDefinition } from '../grid/tile';
import type { TileDefinition, TileType } from '../types';
import { Item } from '../items/item';
import { Container } from '../items/container';
import { WandItem, ScrollItem, PotionItem, type PotionType } from '../items/consumables';
import { CoinItem } from '../economy/currency';
import { CorpseItemInstance } from '../items/corpse';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { NPC, type NpcRole } from '../entities/npc';
import { Merchant } from '../economy/merchant';
import { InventoryManager } from '../inventory/inventory-manager';
import { TrapInstance } from '../dungeon/traps';
import { Visibility } from '../fov/types';
import { FovManager } from '../fov/fov-manager';
import { GameEngine } from '../engine';
import { CompendiumManager } from '../compendium/compendiumManager';
import type { GameContentManifest } from '../types/manifest';
import { cloneWorldState, createWorldState } from '../state/worldState';
import { compactTiles, decompactTiles, compactFov, decompactFov } from './compaction';
import type {
  CharacterProfile,
  SaveData,
  SerializedContainer,
  SerializedItem,
  SerializedItemNode,
  SerializedPlayer,
  SerializedMonster,
  SerializedNpc,
  SerializedMap,
} from './types';

export const SAVE_VERSION = 5;

export function getTileDefinitionByType(type: TileType): TileDefinition {
  return getTileDefinition(type);
}


export function serializeItem(item: Item): SerializedItemNode {
  const base: SerializedItem = {
    isContainer: false,
    id: item.id,
    name: item.name,
    unidentifiedName: item.unidentifiedName,
    category: item.category,
    slot: item.slot,
    weight: item.weight,
    unitWeight: item.unitWeight,
    bulk: item.bulk,
    quality: item.quality,
    identified: item.identified,
    stats: { ...item.stats },
    description: item.description,
    value: item.value,
    minFloor: item.minFloor,
    tier: item.tier,
    enchantmentLevel: item.enchantmentLevel,
    elementalAffix: item.elementalAffix ? { ...item.elementalAffix } : undefined,
    durability: item.durability ? { ...item.durability } : undefined,
    aspectState: item.aspectState,
  };

  if (item instanceof Container) {
    const container: SerializedContainer = {
      ...base,
      isContainer: true,
      containerType: item.containerType,
      maxWeightCapacity: item.maxWeightCapacity,
      maxBulkCapacity: item.maxBulkCapacity,
      maxSlots: item.maxSlots,
      acceptedCategories: item.acceptedCategories,
      items: item.getItems().map(serializeItem),
    };
    return container;
  }

  if (item instanceof WandItem) {
    base.wandData = {
      spellId: item.spellId,
      charges: item.charges,
      maxCharges: item.maxCharges,
    };
  } else if (item instanceof ScrollItem) {
    base.scrollSpellId = item.spellId;
  } else if (item instanceof PotionItem) {
    base.potionType = item.potionType;
    base.potionPotency = item.potency;
  } else if (item instanceof CoinItem) {
    base.coinData = {
      denomination: item.denomination,
      count: item.count,
    };
  } else if (item instanceof CorpseItemInstance) {
    base.corpseData = {
      archetypeId: item.archetypeId,
      decayTicksRemaining: item.decayTicksRemaining,
      isBurned: item.isBurned,
    };
  }

  return base;
}

export function deserializeItem(node: SerializedItemNode): Item {
  if (node.isContainer) {
    const container = new Container({
      id: node.id,
      name: node.name,
      unidentifiedName: node.unidentifiedName,
      category: node.category,
      slot: node.slot,
      weight: node.weight,
      unitWeight: node.unitWeight,
      bulk: node.bulk,
      quality: node.quality,
      identified: node.identified,
      stats: node.stats,
      description: node.description,
      value: node.value,
      minFloor: node.minFloor,
      tier: node.tier,
      enchantmentLevel: node.enchantmentLevel,
      elementalAffix: node.elementalAffix,
      containerType: node.containerType,
      maxWeightCapacity: node.maxWeightCapacity,
      maxBulkCapacity: node.maxBulkCapacity,
      maxSlots: node.maxSlots,
      acceptedCategories: node.acceptedCategories,
      durability: node.durability,
      aspectState: node.aspectState,
    });

    for (const childNode of node.items) {
      container.addItem(deserializeItem(childNode));
    }

    return container;
  }

  if (node.coinData) {
    return new CoinItem({
      id: node.id,
      denomination: node.coinData.denomination,
      count: node.coinData.count,
    });
  }

  if (node.wandData) {
    return new WandItem({
      id: node.id,
      name: node.name,
      unidentifiedName: node.unidentifiedName,
      slot: node.slot,
      weight: node.weight,
      unitWeight: node.unitWeight,
      bulk: node.bulk,
      quality: node.quality,
      identified: node.identified,
      stats: node.stats,
      description: node.description,
      value: node.value,
      minFloor: node.minFloor,
      tier: node.tier,
      enchantmentLevel: node.enchantmentLevel,
      elementalAffix: node.elementalAffix,
      spellId: node.wandData.spellId,
      charges: node.wandData.charges,
      maxCharges: node.wandData.maxCharges,
      durability: node.durability,
      aspectState: node.aspectState,
    });
  }

  if (node.scrollSpellId) {
    return new ScrollItem({
      id: node.id,
      name: node.name,
      unidentifiedName: node.unidentifiedName,
      slot: node.slot,
      weight: node.weight,
      unitWeight: node.unitWeight,
      bulk: node.bulk,
      quality: node.quality,
      identified: node.identified,
      stats: node.stats,
      description: node.description,
      value: node.value,
      minFloor: node.minFloor,
      tier: node.tier,
      enchantmentLevel: node.enchantmentLevel,
      elementalAffix: node.elementalAffix,
      spellId: node.scrollSpellId,
      durability: node.durability,
      aspectState: node.aspectState,
    });
  }

  if (node.potionType) {
    return new PotionItem({
      id: node.id,
      name: node.name,
      unidentifiedName: node.unidentifiedName,
      slot: node.slot,
      weight: node.weight,
      unitWeight: node.unitWeight,
      bulk: node.bulk,
      quality: node.quality,
      identified: node.identified,
      stats: node.stats,
      description: node.description,
      value: node.value,
      minFloor: node.minFloor,
      tier: node.tier,
      enchantmentLevel: node.enchantmentLevel,
      elementalAffix: node.elementalAffix,
      potionType: node.potionType as PotionType,
      potency: node.potionPotency ?? 20,
      durability: node.durability,
      aspectState: node.aspectState,
    });
  }

  if (node.corpseData) {
    const corpse = new CorpseItemInstance({
      id: node.id,
      archetypeId: node.corpseData.archetypeId,
      weight: node.weight,
      decayTicksRemaining: node.corpseData.decayTicksRemaining,
    });
    corpse.isBurned = node.corpseData.isBurned;
    return corpse;
  }

  return new Item({
    id: node.id,
    name: node.name,
    unidentifiedName: node.unidentifiedName,
    category: node.category,
    slot: node.slot,
    weight: node.weight,
    unitWeight: node.unitWeight,
    bulk: node.bulk,
    quality: node.quality,
    identified: node.identified,
    stats: node.stats,
    description: node.description,
    value: node.value,
    minFloor: node.minFloor,
    tier: node.tier,
    enchantmentLevel: node.enchantmentLevel,
    elementalAffix: node.elementalAffix,
    durability: node.durability,
    aspectState: node.aspectState,
  });
}

export function serializeGame(engine: GameEngine, profile?: CharacterProfile): SaveData {
  const p = engine.player;
  const inv = p.inventory;
  const baseProfile: CharacterProfile = profile ?? {
    id: p.id,
    name: p.name,
    gender: p.gender,
    difficulty: p.difficulty,
    maxFloor: p.maxFloor,
    level: p.level,
    floor: engine.currentFloor,
    lastSaved: Date.now(),
    hp: p.hp,
    maxHp: p.maxHp,
    strength: p.strength,
  };

  // 1. Serialize Paperdoll
  const paperdollSlots: Record<string, SerializedItemNode | null> = {};
  for (const slotDef of inv.paperdoll.getSlotDefinitions()) {
    const item = inv.paperdoll.getItem(slotDef.id);
    paperdollSlots[slotDef.id] = item ? serializeItem(item) : null;
  }

  // 2. Serialize Primary Pack
  const primaryPack = serializeItem(inv.primaryPack) as SerializedContainer;

  // 3. Serialize Player
  const serializedPlayer: SerializedPlayer = {
    id: p.id,
    name: p.name,
    gender: p.gender,
    difficulty: p.difficulty,
    maxFloor: p.maxFloor,
    attributes: p.attributes,
    x: p.x,
    y: p.y,
    hp: p.hp,
    maxHp: p.maxHp,
    baseAttack: p.baseAttackValue,
    baseDefense: p.baseDefenseValue,
    strength: p.strength,
    intelligence: p.intelligence,
    constitution: p.constitution,
    dexterity: p.dexterity,
    speed: p.speed,
    energy: p.energy,
    mana: p.mana,
    maxMana: p.maxMana,
    spellsKnown: [...p.spellsKnown],
    level: p.level,
    xp: p.xp,
    statusEffects: p.statusManager.serialize(),
    inventory: {
      paperdoll: paperdollSlots,
      primaryPack,
    },
    tutorialFlags: p.tutorialFlags ? { ...p.tutorialFlags } : undefined,
    deepestRecallFloor: p.deepestRecallFloor,
    recallPosition: p.recallPosition ? { ...p.recallPosition } : undefined,
    quickSpells: [...p.quickSpells],
    planeId: p.planeId ?? 'physical',
    corruptionScore: p.corruptionScore ?? 0,
  };

  if (profile) {
    profile.tutorialFlags = p.tutorialFlags ? { ...p.tutorialFlags } : undefined;
    profile.deepestRecallFloor = p.deepestRecallFloor;
    profile.recallPosition = p.recallPosition ? { ...p.recallPosition } : undefined;
  }

  // 4. Map serialization helper
  const serializedMap = serializeMapObject(engine.map);

  // 5. Serialize inactive cached floors
  const storedMaps: Record<number, SerializedMap> = {};
  for (const [floorNum, fMap] of engine.storedFloors.entries()) {
    if (floorNum !== engine.currentFloor) {
      storedMaps[floorNum] = serializeMapObject(fMap);
    }
  }

  // 6. Explored FOV Coordinates & RLE for all visited floors
  const storedFovRle: Record<number, string> = {};
  for (const [floorNum, fovMgr] of engine.storedFov.entries()) {
    const fMap = floorNum === engine.currentFloor ? engine.map : engine.storedFloors.get(floorNum);
    if (fMap) {
      storedFovRle[floorNum] = compactFov(fMap.width, fMap.height, (x, y) => fovMgr.isExplored(x, y));
    }
  }

  const fovExplored: [number, number][] = [];
  for (let y = 0; y < engine.map.height; y++) {
    for (let x = 0; x < engine.map.width; x++) {
      if (engine.fov.isExplored(x, y)) {
        fovExplored.push([x, y]);
      }
    }
  }
  const fovRle = compactFov(engine.map.width, engine.map.height, (x, y) =>
    engine.fov.isExplored(x, y)
  );
  storedFovRle[engine.currentFloor] = fovRle;

  const compendiumData = engine.compendium.serialize();

  const updatedProfile: CharacterProfile = {
    ...baseProfile,
    floor: engine.currentFloor,
    gender: p.gender,
    difficulty: p.difficulty ?? baseProfile.difficulty ?? 'medium',
    maxFloor: p.maxFloor ?? baseProfile.maxFloor ?? 37,
    attributes: p.attributes,
    level: p.level,
    hp: p.hp,
    maxHp: p.maxHp,
    strength: p.strength,
    mana: p.mana,
    maxMana: p.maxMana,
    xp: p.xp,
    xpToNextLevel: p.xpToNextLevel,
    compendium: compendiumData,
    lastSaved: Date.now(),
    tutorialFlags: p.tutorialFlags ? { ...p.tutorialFlags } : undefined,
    deepestRecallFloor: p.deepestRecallFloor,
    recallPosition: p.recallPosition ? { ...p.recallPosition } : undefined,
  };

  return {
    version: SAVE_VERSION,
    profile: updatedProfile,
    savedAt: Date.now(),
    player: serializedPlayer,
    map: serializedMap,
    fovExplored,
    fovRle,
    contentManifestId: engine.manifest?.id ?? 'cotw',
    turnCount: engine.turnCount,
    messages: engine.messages.slice(-100),
    currentFloor: engine.currentFloor,
    difficulty: p.difficulty ?? baseProfile.difficulty ?? 'medium',
    maxFloor: p.maxFloor ?? baseProfile.maxFloor ?? 37,
    storedMaps,
    storedFovRle,
    compendium: compendiumData,
    townReturn: engine.townReturnManager ? engine.townReturnManager.serialize() : undefined,
    worldState: engine.worldState ? (() => {
      const cloned = cloneWorldState(engine.worldState);
      const serializedVaults: Record<string, SerializedItemNode[]> = {};
      if (cloned.remoteVaults) {
        for (const [k, items] of Object.entries(cloned.remoteVaults)) {
          serializedVaults[k] = items.map(serializeItem);
        }
      }
      return {
        ...cloned,
        remoteVaults: serializedVaults as any,
      };
    })() : undefined,
    planes: engine.planeManager ? engine.planeManager.serialize() : undefined,
    prngState: engine.prng ? engine.prng.getState() : undefined,
  };
}

export function serializeMapObject(map: GameMap): SerializedMap {
  const tiles: TileType[][] = [];
  for (let y = 0; y < map.height; y++) {
    const row: TileType[] = [];
    for (let x = 0; x < map.width; x++) {
      const tile = map.getTile(x, y);
      row.push(tile ? tile.type : 'wall');
    }
    tiles.push(row);
  }

  const groundItems = map.getAllGroundItems().map((pile) => ({
    x: pile.x,
    y: pile.y,
    items: pile.items.map(serializeItem),
  }));

  const monsters: SerializedMonster[] = map
    .getAllEntities()
    .filter((e) => e.type === 'monster')
    .map((m) => {
      const mon = m as Monster;
      return {
        id: mon.id,
        name: mon.name,
        x: mon.x,
        y: mon.y,
        hp: mon.hp,
        maxHp: mon.maxHp,
        attack: mon.attack,
        defense: mon.defense,
        speed: mon.speed,
        energy: mon.energy,
        resistances: mon.elementalResistances,
        definitionId: mon.definitionId,
        aiType: mon.aiType,
        aiState: mon.aiState,
        spells: mon.spells ? [...mon.spells] : undefined,
        spellCooldown: mon.spellCooldown,
        fleeHealthPercent: mon.fleeHealthPercent,
        xpValue: mon.xpValue,
        intent: mon.intent ? { ...mon.intent } : undefined,
        statusEffects: mon.statusManager.serialize(),
        planeId: mon.planeId ?? 'physical',
      };
    });

  const npcs: SerializedNpc[] = map
    .getAllEntities()
    .filter((e) => e.type === 'npc')
    .map((n) => {
      const npc = n as NPC;
      return {
        id: npc.id,
        name: npc.name,
        x: npc.x,
        y: npc.y,
        role: npc.role,
        shopId: npc.shopId,
        greeting: npc.greeting,
        dialogText: npc.dialogText,
        isStationary: npc.isStationary,
      };
    });

  const tilesRle = compactTiles(tiles);

  const traps = map.getAllTraps().map((t) => ({
    id: t.id,
    type: t.type,
    x: t.x,
    y: t.y,
    revealed: t.revealed,
    triggered: t.triggered,
    disarmed: t.disarmed,
    damage: t.damage,
    concealment: t.concealment,
    disarmDifficulty: t.disarmDifficulty,
    customMessage: t.customMessage,
  }));

  return {
    width: map.width,
    height: map.height,
    tilesRle,
    groundItems,
    monsters,
    npcs,
    traps: traps.length > 0 ? traps : undefined,
    surfaces: map.surfaces ? map.surfaces.serialize() : undefined,
    substances: map.substances ? map.substances.serialize() : undefined,
    lastVisitedTick: map.lastVisitedTick ?? 0,
  };
}

export function deserializeMapObject(mapData: SerializedMap): GameMap {
  const map = new GameMap(mapData.width, mapData.height, TILES.WALL);
  map.lastVisitedTick = mapData.lastVisitedTick ?? 0;

  const tileGrid = mapData.tilesRle
    ? decompactTiles(mapData.tilesRle, mapData.width, mapData.height)
    : mapData.tiles;

  if (tileGrid) {
    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const tileType = tileGrid[y]?.[x] ?? 'wall';
        map.setTile(x, y, getTileDefinitionByType(tileType));
      }
    }
  }

  if (mapData.traps) {
    for (const tData of mapData.traps) {
      const trap = new TrapInstance(tData);
      trap.triggered = tData.triggered ?? false;
      trap.disarmed = tData.disarmed ?? false;
      map.addTrap(trap);
    }
  }

  if (Array.isArray(mapData.groundItems)) {
    for (const pile of mapData.groundItems) {
      if (!pile || !Array.isArray(pile.items)) continue;
      for (const itemNode of pile.items) {
        if (!itemNode) continue;
        map.addItemAt(pile.x, pile.y, deserializeItem(itemNode));
      }
    }
  }

  if (mapData.monsters) {
    for (const mData of mapData.monsters) {
      const monster = new Monster({
        id: mData.id,
        name: mData.name,
        position: { x: mData.x, y: mData.y },
        stats: {
          hp: mData.hp,
          maxHp: mData.maxHp,
          attack: mData.attack,
          defense: mData.defense,
        },
        speed: mData.speed,
        resistances: mData.resistances,
        definitionId: mData.definitionId,
        aiType: mData.aiType,
        aiState: mData.aiState,
        spells: mData.spells,
        spellCooldown: mData.spellCooldown,
        fleeHealthPercent: mData.fleeHealthPercent,
        xpValue: mData.xpValue,
      });
      monster.energy = mData.energy;
      monster.hp = mData.hp;
      if (mData.intent) {
        monster.intent = { ...mData.intent };
      }
      if (mData.statusEffects) {
        monster.statusManager.deserialize(mData.statusEffects);
      }
      if (mData.planeId) {
        monster.planeId = mData.planeId;
      }
      map.addEntity(monster);
    }
  }

  if (mapData.npcs) {
    for (const nData of mapData.npcs) {
      const npc = new NPC({
        id: nData.id,
        name: nData.name,
        role: nData.role as NpcRole,
        position: { x: nData.x, y: nData.y },
        shopId: nData.shopId,
        greeting: nData.greeting,
        dialogText: nData.dialogText,
        isStationary: nData.isStationary,
      });
      map.addEntity(npc);
    }
  }

  if (mapData.surfaces && map.surfaces) {
    map.surfaces.deserialize(mapData.surfaces);
  }

  if (mapData.substances && map.substances) {
    map.substances.deserialize(mapData.substances);
  }

  return map;
}

export function deserializeGame(
  rawSaveData: SaveData | any,
  manifest?: GameContentManifest
): { engine: GameEngine; profile: CharacterProfile } {
  const saveData: SaveData =
    rawSaveData && typeof rawSaveData.schemaVersion === 'number' && rawSaveData.data
      ? rawSaveData.data
      : rawSaveData;

  // Validate structural integrity before hydration
  if (!saveData || typeof saveData !== 'object') {
    throw new Error('Save file is structurally invalid: payload must be a non-null object.');
  }
  if (!saveData.map || typeof saveData.map.width !== 'number' || typeof saveData.map.height !== 'number') {
    throw new Error('Save file is structurally invalid: missing or malformed map definition.');
  }
  if (!saveData.player || !saveData.player.inventory) {
    throw new Error('Save file is structurally invalid: missing player or inventory definition.');
  }

  // 1. Reconstruct Active Map
  const map = deserializeMapObject(saveData.map);

  // 2. Reconstruct Primary Pack & Inventory Manager
  const primaryPack = deserializeItem(saveData.player.inventory.primaryPack) as Container;
  const inventory = new InventoryManager({
    primaryPack,
    slots: manifest?.equipmentSlots,
  });

  // Clear default equipment to cleanly restore saved paperdoll
  for (const [slot, itemNode] of Object.entries(saveData.player.inventory.paperdoll)) {
    if (itemNode) {
      const item = deserializeItem(itemNode as SerializedItemNode);
      inventory.paperdoll.equip(item, slot);
    } else {
      inventory.paperdoll.unequip(slot);
    }
  }

  // 3. Reconstruct Player
  const pData = saveData.player;
  const player = new Player({
    id: pData.id,
    name: pData.name,
    gender: pData.gender ?? 'male',
    difficulty: pData.difficulty ?? saveData.difficulty ?? saveData.profile.difficulty ?? 'medium',
    maxFloor: pData.maxFloor ?? saveData.maxFloor ?? saveData.profile.maxFloor ?? 37,
    strength: Number(pData.strength ?? pData.attributes?.strength) || 15,
    intelligence: Number(pData.intelligence ?? pData.attributes?.intelligence) || 15,
    constitution: Number(pData.constitution ?? pData.attributes?.constitution) || 15,
    dexterity: Number(pData.dexterity ?? pData.attributes?.dexterity) || 15,
    stats: {
      hp: Number(pData.hp) || 1,
      maxHp: Math.max(1, Number(pData.maxHp) || 1),
      attack: Number(pData.baseAttack) || 0,
      defense: Number(pData.baseDefense) || 0,
    },
    speed: Number(pData.speed) || 100,
    mana: Number(pData.mana) || 0,
    maxMana: Math.max(0, Number(pData.maxMana) || 0),
    position: { x: pData.x, y: pData.y },
    inventory,
    spellsKnown: pData.spellsKnown ? [...pData.spellsKnown] : [],
    level: pData.level ?? 1,
    xp: pData.xp ?? 0,
    deepestRecallFloor: pData.deepestRecallFloor ?? saveData.profile?.deepestRecallFloor,
    recallPosition: pData.recallPosition ?? saveData.profile?.recallPosition,
    quickSpells: pData.quickSpells ? [...pData.quickSpells] : undefined,
    tutorialFlags: pData.tutorialFlags ? { ...pData.tutorialFlags } : (saveData.profile?.tutorialFlags ? { ...saveData.profile.tutorialFlags } : undefined),
  });
  player.energy = Number(pData.energy) || 0;
  player.hp = Math.min(Number(pData.hp) || 1, player.maxHp);
  if (pData.statusEffects) {
    player.statusManager.deserialize(pData.statusEffects);
  }
  if (pData.planeId) {
    player.planeId = pData.planeId;
  }
  player.corruptionScore = Number(pData.corruptionScore) || 0;

  // 4. Determine Current Floor & Compendium
  const currentFloor = saveData.currentFloor ?? saveData.profile?.floor ?? 1;
  const compendium = new CompendiumManager(saveData.compendium ?? saveData.profile?.compendium);

  // 5. Instantiate Engine Core
  const engine = new GameEngine({
    map,
    player,
    floor: currentFloor,
    manifest,
    compendium,
    worldState: saveData.worldState,
  });

  if (saveData.prngState !== undefined && engine.prng) {
    engine.prng.setState(saveData.prngState);
  }

  if (saveData.planes && engine.planeManager) {
    engine.planeManager.deserialize(saveData.planes);
  }

  // 6. Restore Turn Count & Messages
  engine.turnCount = saveData.turnCount;
  for (const msg of saveData.messages) {
    engine.messages.push(msg);
  }

  // 7. Restore Multi-Floor Caches
  if (saveData.storedMaps) {
    for (const [fStr, sMap] of Object.entries(saveData.storedMaps)) {
      const fNum = parseInt(fStr, 10);
      engine.storedFloors.set(fNum, deserializeMapObject(sMap));
    }
  }

  // Register merchants dynamically from manifest if town exists in current or cached floors
  if (engine.storedFloors.has(0) || engine.currentFloor === 0) {
    if (engine.manifest?.town?.npcs) {
      for (const npcDef of engine.manifest.town.npcs) {
        if (npcDef.merchantConfig) {
          const cfg = npcDef.merchantConfig;
          const merchant = new Merchant(
            cfg.id,
            cfg.name,
            cfg.name,
            'general',
            cfg.greeting,
            [...cfg.initialInventory]
          );
          engine.merchants.set(merchant.id, merchant);
        }
      }
    }
  }

  // 7. Restore Explored FOV for active floor and all stored floors
  if (saveData.storedFovRle) {
    for (const [fStr, rle] of Object.entries(saveData.storedFovRle)) {
      const fNum = parseInt(fStr, 10);
      const fMap = fNum === engine.currentFloor ? engine.map : engine.storedFloors.get(fNum);
      if (fMap) {
        const fovMgr = new FovManager(fMap.width, fMap.height);
        const coords = decompactFov(rle, fMap.width, fMap.height);
        for (const [x, y] of coords) {
          fovMgr.setVisibility(x, y, Visibility.Explored);
        }
        engine.storedFov.set(fNum, fovMgr);
        if (fNum === engine.currentFloor) {
          engine.fov = fovMgr;
        }
      }
    }
  } else {
    // Single-floor fallback
    if (saveData.fovRle) {
      const coords = decompactFov(saveData.fovRle, map.width, map.height);
      for (const [x, y] of coords) {
        engine.fov.setVisibility(x, y, Visibility.Explored);
      }
    } else if (saveData.fovExplored) {
      for (const [x, y] of saveData.fovExplored) {
        engine.fov.setVisibility(x, y, Visibility.Explored);
      }
    }
    engine.storedFov.set(engine.currentFloor, engine.fov);
  }
  engine.updateFov();

  if (saveData.townReturn && engine.townReturnManager) {
    engine.townReturnManager.deserialize(saveData.townReturn);
  }

  if (saveData.worldState) {
    const ws = createWorldState(saveData.worldState as any);
    if (saveData.worldState.remoteVaults) {
      ws.remoteVaults = {};
      for (const [k, items] of Object.entries(saveData.worldState.remoteVaults as any)) {
        ws.remoteVaults[k] = (items as SerializedItemNode[]).map(deserializeItem);
      }
    }
    engine.worldState = ws;
  }

  return {
    engine,
    profile: saveData.profile,
  };
}

export function serializeSaveData(engine: GameEngine, profile?: CharacterProfile): SaveData {
  const p: CharacterProfile = profile ?? {
    id: engine.player.id,
    name: engine.player.name,
    level: 1,
    floor: engine.currentFloor,
    lastSaved: Date.now(),
    hp: engine.player.hp,
    maxHp: engine.player.maxHp,
    strength: engine.player.strength,
  };
  return serializeGame(engine, p);
}

export function deserializeSaveData(data: SaveData, manifest?: GameContentManifest): GameEngine {
  const res = deserializeGame(data, manifest);
  return res.engine;
}
