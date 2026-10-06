import { GameMap } from '../grid/map';
import { TILES, getTileDefinition, hasTileDefinition } from '../grid/tile';
import type { TileDefinition, TileType } from '../types';
import { Item } from '../items/item';
import { Container } from '../items/container';
import { WandItem, ScrollItem, PotionItem, type PotionType } from '../items/consumables';
import { CoinItem } from '../economy/currency';
import { RuneOfReturnItem, defaultRuneMastery } from '../magic/runeOfReturn';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { Companion, CompanionRegistry } from '../entities/companion';
import { NPC, type NpcRole } from '../entities/npc';
import { Merchant } from '../economy/merchant';
import { InventoryManager } from '../inventory/inventory-manager';
import { TrapInstance } from '../dungeon/traps';
import { Visibility } from '../fov/types';
import { FovManager } from '../fov/fov-manager';
import { GameEngine } from '../engine';
import { activateRegistries, type EngineRegistries } from '../registries';
import { rebuildItemRegistries } from '../items/rebuildItemRegistries';
import { registerSerializeGameFn, flightRecorder } from '../debug/flightRecorder';
import { CompendiumManager, masteryPerkOptions } from '../compendium/compendiumManager';
import type { GameContentManifest, ItemDefinition } from '../types/manifest';
import type { ItemQuality } from '../items/item';
import type { ItemModifier } from '../items/modifiers';
import { familyModifier, type ItemFamilyConfig } from '../items/modifierRoller';
import { cloneWorldState, createWorldState, type WorldState } from '../state/worldState';
import { compactTilesWithDictionary, decompactTiles, compactFov, decompactFov } from './compaction';
import { EnergyModel } from '../actors/energyModel';
import { applyPrologueState } from '../quest/prologue';
import { GameStateManager } from '../quest/gameStateManager';
import type {
  CharacterProfile,
  SaveData,
  SerializedContainer,
  SerializedItem,
  SerializedItemBase,
  SerializedItemNode,
  SerializedPlayer,
  SerializedMonster,
  SerializedNpc,
  SerializedMap,
  SerializedCompanion,
} from './types';

function getTileDefinitionByType(type: TileType): TileDefinition {
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
    junk: item.junk || undefined,
    stats: { ...item.stats },
    description: item.description,
    value: item.value,
    minFloor: item.minFloor,
    tier: item.tier,
    enchantmentLevel: item.enchantmentLevel,
    elementalAffix: item.elementalAffix ? { ...item.elementalAffix } : undefined,
    aspectState: item.aspectState,
    modifiers: item.modifiers.length > 0 ? item.modifiers.map((m) => ({ ...m })) : undefined,
    parentId: item.parentId ?? undefined,
    ownerId: item.ownerId ?? undefined,
    definitionId: item.definitionId,
    quantity: item.quantity > 1 ? item.quantity : undefined,
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
      opened: item.wasOpened || undefined,
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
  } else if (item instanceof RuneOfReturnItem) {
    base.runeOfReturnData = { charges: item.charges };
  } else if (item instanceof CoinItem) {
    base.coinData = {
      denomination: item.denomination,
      count: item.count,
    };
  }

  return base;
}

/** The manifest's item definitions, which hold what a save leaves out. */
interface ItemDefinitionLookup {
  byId: ReadonlyMap<string, ItemDefinition>;
  /**
   * For saves written before items kept their definitionId. A name two definitions
   * share is left out rather than guessed.
   */
  idByName: ReadonlyMap<string, string>;
  /** The pack's item families, for a relic saved with the old `cursed` label. */
  families?: ItemFamilyConfig;
}

export function itemDefinitionLookup(manifest: GameContentManifest | undefined): ItemDefinitionLookup {
  const byId = new Map<string, ItemDefinition>();
  const idByName = new Map<string, string>();
  const shared = new Set<string>();
  for (const def of manifest?.items ?? []) {
    byId.set(def.id, def);
    if (idByName.has(def.name) && idByName.get(def.name) !== def.id) shared.add(def.name);
    idByName.set(def.name, def.id);
  }
  for (const name of shared) idByName.delete(name);
  return { byId, idByName, families: manifest?.itemFamilies };
}

/** The `enchanted`/`cursed`/`broken` labels are gone (ADR-0012): an older save's loads as normal. */
function legacyQuality(quality: SerializedItemBase['quality']): ItemQuality {
  return quality === 'artifact' ? 'artifact' : 'normal';
}

/**
 * An item's saved modifiers; a relic saved with the old `cursed` label and none gets its
 * definition's family (the Cursed tier of its own floor), so it stays bound.
 */
function restoredModifiers(
  node: SerializedItemBase,
  def: ItemDefinition | undefined,
  definitions: ItemDefinitionLookup | undefined
): ItemModifier[] | undefined {
  if (node.modifiers && node.modifiers.length > 0) return [...node.modifiers];
  if (node.quality === 'cursed' && def?.family && definitions?.families) {
    const relic = familyModifier(definitions.families, def.family, node.minFloor ?? def.minFloor ?? 1, node.id);
    if (relic) return [relic];
  }
  return undefined;
}

export function deserializeItem(node: SerializedItemNode, definitions?: ItemDefinitionLookup): Item {
  const definitionId = node.definitionId ?? definitions?.idByName.get(node.name);
  const quantity = node.quantity;
  // Definition-only fields come back as createScaledItem gives them to a new item; the
  // save holds everything a run can change.
  const def = definitionId ? definitions?.byId.get(definitionId) : undefined;

  if (node.isContainer) {
    const container = new Container({
      id: node.id,
      definitionId,
      hooks: def?.hooks,
      wornEffects: def?.wornEffects,
      predicate: def?.predicate,
      name: node.name,
      unidentifiedName: node.unidentifiedName,
      category: node.category,
      slot: node.slot,
      weight: node.weight,
      unitWeight: node.unitWeight,
      bulk: node.bulk,
      quality: legacyQuality(node.quality),
      identified: node.identified,
      junk: node.junk,
      stats: node.stats,
      description: node.description,
      value: node.value,
      minFloor: node.minFloor,
      tier: node.tier,
      enchantmentLevel: node.enchantmentLevel,
      elementalAffix: node.elementalAffix,
      containerType: node.containerType,
      // Capacity is the definition's, like hooks: nothing in a run changes it.
      maxWeightCapacity: def?.containerConfig?.maxWeightCapacity ?? node.maxWeightCapacity,
      maxBulkCapacity: def?.containerConfig?.maxBulkCapacity ?? node.maxBulkCapacity,
      maxSlots: node.maxSlots,
      acceptedCategories: node.acceptedCategories,
      aspectState: node.aspectState,
      modifiers: restoredModifiers(node, def, definitions),
      parentId: node.parentId ?? null,
      ownerId: node.ownerId ?? null,
    });

    // Put back exactly what was saved: no merging, so two stacks saved apart come back
    // apart, and no capacity check, so a capacity that shrank since loses nothing.
    for (const childNode of node.items) {
      container.placeItem(deserializeItem(childNode, definitions));
    }
    if (node.opened) container.markOpened();

    return container;
  }

  if (node.coinData) {
    // Platinum is gone (Q24, Q42): an older save's platinum coin is worth ten gold.
    const { denomination, count } = node.coinData;
    return new CoinItem({
      id: node.id,
      denomination: denomination === 'platinum' ? 'gold' : denomination,
      count: denomination === 'platinum' ? count * 10 : count,
      parentId: node.parentId ?? null,
      ownerId: node.ownerId ?? null,
    });
  }

  if (node.wandData) {
    return new WandItem({
      id: node.id,
      definitionId,
      hooks: def?.hooks,
      wornEffects: def?.wornEffects,
      quantity,
      name: node.name,
      unidentifiedName: node.unidentifiedName,
      slot: node.slot,
      weight: node.weight,
      unitWeight: node.unitWeight,
      bulk: node.bulk,
      quality: legacyQuality(node.quality),
      identified: node.identified,
      junk: node.junk,
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
      aspectState: node.aspectState,
      modifiers: restoredModifiers(node, def, definitions),
      parentId: node.parentId ?? null,
      ownerId: node.ownerId ?? null,
    });
  }

  if (node.scrollSpellId) {
    return new ScrollItem({
      id: node.id,
      definitionId,
      hooks: def?.hooks,
      wornEffects: def?.wornEffects,
      quantity,
      name: node.name,
      unidentifiedName: node.unidentifiedName,
      slot: node.slot,
      weight: node.weight,
      unitWeight: node.unitWeight,
      bulk: node.bulk,
      quality: legacyQuality(node.quality),
      identified: node.identified,
      junk: node.junk,
      stats: node.stats,
      description: node.description,
      value: node.value,
      minFloor: node.minFloor,
      tier: node.tier,
      enchantmentLevel: node.enchantmentLevel,
      elementalAffix: node.elementalAffix,
      spellId: node.scrollSpellId,
      aspectState: node.aspectState,
      modifiers: restoredModifiers(node, def, definitions),
      parentId: node.parentId ?? null,
      ownerId: node.ownerId ?? null,
    });
  }

  if (node.potionType) {
    return new PotionItem({
      id: node.id,
      definitionId,
      hooks: def?.hooks,
      wornEffects: def?.wornEffects,
      quantity,
      name: node.name,
      unidentifiedName: node.unidentifiedName,
      slot: node.slot,
      weight: node.weight,
      unitWeight: node.unitWeight,
      bulk: node.bulk,
      quality: legacyQuality(node.quality),
      identified: node.identified,
      junk: node.junk,
      stats: node.stats,
      description: node.description,
      value: node.value,
      minFloor: node.minFloor,
      tier: node.tier,
      enchantmentLevel: node.enchantmentLevel,
      elementalAffix: node.elementalAffix,
      potionType: node.potionType as PotionType,
      potency: node.potionPotency ?? 20,
      effects: def?.potionConfig?.effects,
      aspectState: node.aspectState,
      modifiers: restoredModifiers(node, def, definitions),
      parentId: node.parentId ?? null,
      ownerId: node.ownerId ?? null,
    });
  }

  if (node.runeOfReturnData) {
    return new RuneOfReturnItem({
      id: node.id,
      definitionId,
      hooks: def?.hooks,
      wornEffects: def?.wornEffects,
      quantity,
      name: node.name,
      unidentifiedName: node.unidentifiedName,
      slot: node.slot,
      weight: node.weight,
      unitWeight: node.unitWeight,
      bulk: node.bulk,
      quality: legacyQuality(node.quality),
      identified: node.identified,
      junk: node.junk,
      stats: node.stats,
      description: node.description,
      value: node.value,
      minFloor: node.minFloor,
      tier: node.tier,
      enchantmentLevel: node.enchantmentLevel,
      elementalAffix: node.elementalAffix,
      charges: node.runeOfReturnData.charges,
      aspectState: node.aspectState,
      modifiers: restoredModifiers(node, def, definitions),
      parentId: node.parentId ?? null,
      ownerId: node.ownerId ?? null,
    });
  }

  return new Item({
    id: node.id,
    definitionId,
    hooks: def?.hooks,
    wornEffects: def?.wornEffects,
    quantity,
    twoHanded: def?.twoHanded,
    blocksSlot: def?.blocksSlot,
    rangedConfig: def?.rangedConfig,
    predicate: def?.predicate,
    name: node.name,
    unidentifiedName: node.unidentifiedName,
    category: node.category,
    slot: node.slot,
    weight: node.weight,
    unitWeight: node.unitWeight,
    bulk: node.bulk,
    quality: legacyQuality(node.quality),
    identified: node.identified,
    junk: node.junk,
    stats: node.stats,
    description: node.description,
    value: node.value,
    // The plain item's worth is the definition's, like its hooks.
    baseValue: def?.value ?? node.value,
    minFloor: node.minFloor,
    tier: node.tier,
    enchantmentLevel: node.enchantmentLevel,
    elementalAffix: node.elementalAffix,
    aspectState: node.aspectState,
    modifiers: restoredModifiers(node, def, definitions),
    parentId: node.parentId ?? null,
    ownerId: node.ownerId ?? null,
  });
}

/**
 * Companions & Pet Progression, Phase 1 (docs/architecture/content-companions.md). Serialized at the
 * SaveData top level (sibling to `player`), not inside `SerializedMap.monsters`,
 * since the companion travels with the player across floors rather than
 * belonging to any one floor.
 */
function serializeCompanion(companion: Companion): SerializedCompanion {
  return {
    id: companion.id,
    name: companion.name,
    companionDefinitionId: companion.companionDefinitionId,
    x: companion.x,
    y: companion.y,
    hp: companion.hp,
    // Base values, as the player's are: the getters fold in attribute modifiers
    // (a status's ×1.25) that the restored status would then apply a second time.
    maxHp: companion.baseMaxHpValue,
    attack: companion.baseAttackValue,
    defense: companion.baseDefenseValue,
    speed: companion.speed,
    energy: companion.energy,
    statusEffects: companion.statusManager.serialize(),
    primaryPack: serializeItem(companion.inventory.primaryPack) as SerializedContainer,
    archetype: companion.archetype === 'balanced' ? undefined : companion.archetype,
    unlockedSkills: companion.unlockedSkills.length ? [...companion.unlockedSkills] : undefined,
  };
}

function deserializeCompanion(
  data: SerializedCompanion,
  registries?: EngineRegistries,
  definitions?: ItemDefinitionLookup
): Companion {
  const primaryPack = deserializeItem(data.primaryPack, definitions) as Container;
  const inventory = new InventoryManager({ primaryPack, ownerId: data.id });

  const def = registries ? registries.companions.get(data.companionDefinitionId) : CompanionRegistry.get(data.companionDefinitionId);
  const companion = new Companion({
    id: data.id,
    name: data.name,
    position: { x: data.x, y: data.y },
    stats: {
      hp: data.hp,
      maxHp: data.maxHp,
      attack: data.attack,
      defense: data.defense,
    },
    speed: data.speed,
    companionDefinitionId: data.companionDefinitionId,
    packWeightCapacity: def?.packWeightCapacity ?? primaryPack.maxWeightCapacity,
    packBulkCapacity: def?.packBulkCapacity ?? primaryPack.maxBulkCapacity,
    inventory,
  });
  companion.energy = data.energy;
  if (data.statusEffects) {
    companion.statusManager.deserialize(data.statusEffects);
  }
  if (data.archetype) companion.setArchetype(data.archetype);
  if (data.unlockedSkills) companion.unlockedSkills = [...data.unlockedSkills];
  return companion;
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
    maxHp: p.baseMaxHpValue,
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
    quickPotions: p.quickPotions ? [...p.quickPotions] : undefined,
    planeId: p.planeId ?? 'physical',
    corruptionScore: p.corruptionScore ?? 0,
    unspentStatPoints: p.unspentStatPoints ?? 0,
    runeMastery: { ...p.runeMastery },
    runeChannelBankedTurns: p.runeChannelBankedTurns ?? 0,
    hasDiscoveredRune: p.hasDiscoveredRune,
    runeCharges: p.runeCharges,
    runeMaxCharges: p.runeMaxCharges,
    voidDebt: p.voidDebt ?? 0,
    maxHpPercentBonus: p.maxHpPercentBonus || undefined,
    perks: p.perkIds.length > 0 ? p.perkIds : undefined,
    carriedAtStairs: p.carriedAtStairs.length > 0 ? [...p.carriedAtStairs] : undefined,
    activeGrimoireIndex: p.activeGrimoireIndex ?? 0,
    grimoireOpenSlots: p.grimoireOpenSlots ? [...p.grimoireOpenSlots] : undefined,
    grimoireGrounds: Object.keys(p.grimoireGrounds).length > 0 ? { ...p.grimoireGrounds } : undefined,
    grimoirePages: p.grimoirePages
      ? p.grimoirePages.map((page) => ({
          ...page,
          slots: page.slots.map((s) => ({
            ...s,
            infusedGlyphs: s.infusedGlyphs ? [...s.infusedGlyphs] : undefined,
          })),
        }))
      : undefined,
    energyModel: p.energyModel
      ? {
          structuredEnergy: p.energyModel.structuredEnergy,
          maxStructuredEnergy: p.energyModel.maxStructuredEnergy,
          volatileEnergy: p.energyModel.volatileEnergy,
          maxVolatileEnergy: p.energyModel.maxVolatileEnergy,
          vitalityTenderBurned: p.energyModel.vitalityTenderBurned,
        }
      : undefined,
  };

  if (profile) {
    profile.tutorialFlags = p.tutorialFlags ? { ...p.tutorialFlags } : undefined;
    profile.deepestRecallFloor = p.deepestRecallFloor;
    profile.recallPosition = p.recallPosition ? { ...p.recallPosition } : undefined;
    profile.unspentStatPoints = p.unspentStatPoints ?? 0;
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
  const compendiumCategoryPerks = engine.compendium.serializeCategoryPerks();

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
    compendiumCategoryPerks,
    lastSaved: Date.now(),
    tutorialFlags: p.tutorialFlags ? { ...p.tutorialFlags } : undefined,
    deepestRecallFloor: p.deepestRecallFloor,
    recallPosition: p.recallPosition ? { ...p.recallPosition } : undefined,
    unspentStatPoints: p.unspentStatPoints ?? 0,
  };

  return {
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
    compendiumCategoryPerks,
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
        remoteVaults: serializedVaults,
      };
    })() : undefined,
    planes: engine.planeManager ? engine.planeManager.serialize() : undefined,
    prngState: engine.prng ? engine.prng.getState() : undefined,
    companion: engine.companion ? serializeCompanion(engine.companion) : undefined,
    dismissedCompanion: engine.dismissedCompanion ? serializeCompanion(engine.dismissedCompanion) : undefined,
    deadCompanion: engine.deadCompanionRecord ? serializeCompanion(engine.deadCompanionRecord) : undefined,
    discoveryEvents: engine.discoveryEvents?.length ? engine.discoveryEvents.slice(-100) : undefined,
    merchantStock: engine.merchants.size
      ? Object.fromEntries([...engine.merchants].map(([id, m]) => [id, m.stock.map(serializeItem)]))
      : undefined,
    gameState: {
      deepestFloor: engine.gameState.deepestFloor,
      runStatus: engine.gameState.runStatus === 'victorious' ? 'victorious' : undefined,
    },
  };
}

// Self-register with flightRecorder's diagnostic-snapshot injection point (see
// debug/flightRecorder.ts) instead of flightRecorder.ts importing this module
// directly, which would sit in a load-order cycle with entities/monster.ts.
registerSerializeGameFn(serializeGame);

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
    // Companions are serialized separately at the SaveData top level (they travel
    // with the player across floors rather than belonging to one floor's monster list).
    .filter((e) => e.type === 'monster' && !(e instanceof Companion))
    .map((m) => {
      const mon = m as Monster;
      return {
        id: mon.id,
        name: mon.name,
        x: mon.x,
        y: mon.y,
        hp: mon.hp,
        // Base values (see serializeCompanion): a computed attack would compound.
        maxHp: mon.baseMaxHpValue,
        attack: mon.baseAttackValue,
        defense: mon.baseDefenseValue,
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
        catchUpScale: mon.catchUpScale > 1 ? mon.catchUpScale : undefined,
        pursuit: mon.pursuit ? { ...mon.pursuit } : undefined,
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
        choiceId: npc.choiceId,
      };
    });

  const { tilesRle, tileCodes } = compactTilesWithDictionary(tiles);

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
    tileCodes,
    groundItems,
    monsters,
    npcs,
    traps: traps.length > 0 ? traps : undefined,
    surfaces: map.surfaces ? map.surfaces.serialize() : undefined,
    substances: map.substances ? map.substances.serialize() : undefined,
    lastVisitedTick: map.lastVisitedTick ?? 0,
    floorTurnCount: map.floorTurnCount ?? 0,
    isCleared: map.isCleared ?? false,
    lastRespawnTurn: map.lastRespawnTurn,
  };
}

/**
 * A lit town (`TownLayoutDefinition.lit`, `GameMap.lit`) isn't saved with its map: floor 0
 * takes it from the manifest, as the town generator does, so older saves light up too.
 */
export function restoreFloorLight(map: GameMap, floor: number, manifest: GameContentManifest | undefined): void {
  if (floor === 0) map.lit = manifest?.town?.lit ?? false;
}

export function deserializeMapObject(
  mapData: SerializedMap,
  customTiles?: TileDefinition[],
  definitions?: ItemDefinitionLookup
): GameMap {
  const map = new GameMap(mapData.width, mapData.height, TILES.WALL);
  map.lastVisitedTick = mapData.lastVisitedTick ?? 0;
  map.floorTurnCount = mapData.floorTurnCount ?? 0;
  map.isCleared = mapData.isCleared ?? false;
  // An older save lacks it: start the respawn interval afresh rather than from turn 0.
  map.lastRespawnTurn = mapData.lastRespawnTurn ?? map.floorTurnCount;

  // Run-length tile data is meaningless without the dictionary its tokens index into;
  // decoding anyway would turn the whole floor into walls without saying so.
  if (mapData.tilesRle && !mapData.tileCodes) {
    flightRecorder.recordWarning('Serialized map has tilesRle but no tileCodes dictionary', {
      source: 'deserializeMapObject',
    });
  }

  const tileGrid = mapData.tilesRle
    ? decompactTiles(mapData.tilesRle, mapData.width, mapData.height, mapData.tileCodes ?? [])
    : mapData.tiles;

  if (tileGrid) {
    const customTileMap = new Map<string, TileDefinition>();
    if (customTiles) {
      for (const t of customTiles) {
        customTileMap.set(t.type, t);
      }
    }
    // A renamed or corrupted tile type must not load as walkable floor (getTileDefinition's default).
    const unknownTileCounts = new Map<string, number>();
    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const tileType = tileGrid[y]?.[x] ?? 'wall';
        if (customTileMap.has(tileType)) {
          map.setTile(x, y, customTileMap.get(tileType)!);
        } else if (hasTileDefinition(tileType)) {
          map.setTile(x, y, getTileDefinitionByType(tileType));
        } else {
          unknownTileCounts.set(tileType, (unknownTileCounts.get(tileType) ?? 0) + 1);
          map.setTile(x, y, TILES.WALL);
        }
      }
    }
    for (const [tileType, count] of unknownTileCounts) {
      flightRecorder.recordWarning(`Unknown tile type '${tileType}' in save data loaded as wall`, {
        source: 'deserializeMapObject',
        tileType,
        count,
      });
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
        map.addItemAt(pile.x, pile.y, deserializeItem(itemNode, definitions));
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
      if (mData.catchUpScale) {
        monster.catchUpScale = mData.catchUpScale;
      }
      if (mData.pursuit) {
        monster.pursuit = { ...mData.pursuit };
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
        choiceId: nData.choiceId,
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

/**
 * A merchant's stock from the save: an item the shop was authored with comes back as the
 * manifest's own (its availability `predicate` isn't saved), anything else, such as what
 * the hero sold, from its saved form. No saved stock = the authored stock.
 */
function restoreMerchantStock(
  authored: Item[],
  saved: SerializedItemNode[] | undefined,
  definitions: ItemDefinitionLookup
): Item[] {
  if (!saved) return [...authored];
  const byId = new Map(authored.map((item) => [item.id, item]));
  return saved.map((node) => byId.get(node.id) ?? deserializeItem(node, definitions));
}

function restoreMonsterDefinitionFields(map: GameMap, registries: EngineRegistries): void {
  for (const entity of map.getAllEntities()) {
    if (!(entity instanceof Monster)) continue;
    const def = registries.monsters.get(entity.definitionId);
    if (!def) continue;
    entity.lootTable = def.lootTable ? [...def.lootTable] : [];
    entity.statusImmunities = def.statusImmunities ? [...def.statusImmunities] : entity.statusImmunities;
    entity.onHitAffliction = def.onHitAffliction;
    entity.hooks = def.hooks ? [...def.hooks] : [];
    entity.tags = def.tags ? [...def.tags] : entity.tags;
    entity.targetingMode = def.targetingMode ?? entity.targetingMode;
  }
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

  const definitions = itemDefinitionLookup(manifest);

  // 1. Reconstruct Active Map
  const map = deserializeMapObject(saveData.map, manifest?.tiles, definitions);

  // 2. Reconstruct Primary Pack & Inventory Manager
  const primaryPack = deserializeItem(saveData.player.inventory.primaryPack, definitions) as Container;
  const inventory = new InventoryManager({
    primaryPack,
    slots: manifest?.equipmentSlots,
  });

  // Clear default equipment to cleanly restore saved paperdoll
  for (const [slot, itemNode] of Object.entries(saveData.player.inventory.paperdoll)) {
    if (itemNode) {
      // The pack slot holds the primary pack, which the save also records as `primaryPack`.
      // InventoryManager already equipped that one; a second copy here would displace it
      // with a ghost pack whose contents count twice toward carried weight.
      if ((itemNode as SerializedItemNode).id === primaryPack.id) continue;
      const item = deserializeItem(itemNode as SerializedItemNode, definitions);
      // As it was worn: the equip rules can drop an item here (a shield beside a two-hander
      // under Giant's Grip, whose rule the hero brings only once it exists).
      inventory.paperdoll.restore(item, slot);
    } else {
      inventory.paperdoll.unequip(slot);
    }
  }
  // An older save's purse may hold more coins than it has room for now.
  inventory.settlePurse();

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
    quickPotions: pData.quickPotions ? [...pData.quickPotions] : undefined,
    tutorialFlags: pData.tutorialFlags ? { ...pData.tutorialFlags } : (saveData.profile?.tutorialFlags ? { ...saveData.profile.tutorialFlags } : undefined),
    unspentStatPoints: Number(pData.unspentStatPoints) || Number(saveData.profile?.unspentStatPoints) || 0,
    runeMastery: pData.runeMastery ? { ...pData.runeMastery } : defaultRuneMastery(),
    runeChannelBankedTurns: Number(pData.runeChannelBankedTurns) || 0,
    hasDiscoveredRune: Boolean(pData.hasDiscoveredRune),
    runeCharges: pData.runeCharges !== undefined ? Number(pData.runeCharges) : undefined,
    runeMaxCharges: pData.runeMaxCharges !== undefined ? Number(pData.runeMaxCharges) : undefined,
    // Single-page `grimoire` is only read, for saves made before grimoirePages existed.
    grimoire: pData.grimoire ? [...pData.grimoire.map((s) => ({ ...s, infusedGlyphs: s.infusedGlyphs ? [...s.infusedGlyphs] : undefined }))] : undefined,
    // A page holds one copy of a spell (Player.setGrimoireSlot). An older save may hold
    // more; the first one is the copy that casts, so later ones load empty.
    grimoirePages: pData.grimoirePages
      ? pData.grimoirePages.map((page) => ({
          ...page,
          slots: page.slots.map((s, i) => ({
            ...s,
            spellId: s.spellId && page.slots.findIndex((o) => o.spellId === s.spellId) < i ? null : s.spellId,
            infusedGlyphs: s.infusedGlyphs ? [...s.infusedGlyphs] : undefined,
          })),
        }))
      : undefined,
    activeGrimoireIndex: pData.activeGrimoireIndex !== undefined ? Number(pData.activeGrimoireIndex) : undefined,
    grimoireOpenSlots: Array.isArray(pData.grimoireOpenSlots) ? pData.grimoireOpenSlots.map(Number) : undefined,
    grimoireGrounds: pData.grimoireGrounds ? { ...pData.grimoireGrounds } : undefined,
    // A perk the pack no longer declares is dropped; the rest come back with their effects.
    perks: Array.isArray(pData.perks)
      ? pData.perks.map((id: string) => manifest?.perks?.find((perk) => perk.id === id)).filter((perk): perk is NonNullable<typeof perk> => Boolean(perk))
      : undefined,
  });
  player.energy = Number(pData.energy) || 0;
  if (Array.isArray(pData.carriedAtStairs)) player.carriedAtStairs = pData.carriedAtStairs.map(String);
  // Before HP is clamped to max HP, which the blessing raises.
  player.maxHpPercentBonus = Number(pData.maxHpPercentBonus) || 0;
  player.hp = Math.min(Number(pData.hp) || 1, player.maxHp);
  if (pData.statusEffects) {
    player.statusManager.deserialize(pData.statusEffects);
  }
  if (pData.planeId) {
    player.planeId = pData.planeId;
  }
  player.corruptionScore = Number(pData.corruptionScore) || 0;
  player.voidDebt = Number(pData.voidDebt) || 0;
  if (pData.energyModel) {
    player.energyModel = new EnergyModel({
      structuredEnergy: Number(pData.energyModel.structuredEnergy),
      maxStructuredEnergy: Number(pData.energyModel.maxStructuredEnergy),
      volatileEnergy: Number(pData.energyModel.volatileEnergy),
      maxVolatileEnergy: Number(pData.energyModel.maxVolatileEnergy),
    });
    player.energyModel.vitalityTenderBurned = Number(pData.energyModel.vitalityTenderBurned) || 0;
  }

  // 4. Determine Current Floor & Compendium
  const currentFloor = saveData.currentFloor ?? saveData.profile?.floor ?? 1;
  const compendium = new CompendiumManager(
    saveData.compendium ?? saveData.profile?.compendium,
    saveData.compendiumCategoryPerks ?? saveData.profile?.compendiumCategoryPerks
  );
  // A save from before Q7 "A" (tracker 3.5): each species perk becomes its family's, once.
  compendium.convertSpeciesPerks(manifest?.monsterCategories ?? []);
  // A family choice the pack no longer offers is forgotten, so that mastery asks again.
  if (manifest) compendium.forgetUnofferedPerks((categoryId) => masteryPerkOptions(manifest, categoryId).map((p) => p.id));

  // 5. Rebuild world state (remote-vault items are serialized trees) before the engine
  // sees it, so it is never handed plain JSON where live Items belong.
  let worldState: WorldState | undefined;
  if (saveData.worldState) {
    const { remoteVaults: savedVaults, ...savedState } = saveData.worldState;
    worldState = createWorldState(savedState);
    if (savedVaults) {
      worldState.remoteVaults = {};
      for (const [k, items] of Object.entries(savedVaults)) {
        worldState.remoteVaults[k] = items.map((node) => deserializeItem(node, definitions));
      }
    }
  }

  // 6. Instantiate Engine Core. The run record comes back first: the engine raises its
  // deepest floor to the one loaded onto, never lowers it.
  const gameState = new GameStateManager();
  if (saveData.gameState) {
    gameState.deepestFloor = Number(saveData.gameState.deepestFloor) || 0;
    if (saveData.gameState.runStatus === 'victorious') gameState.runStatus = 'victorious';
  }
  const engine = new GameEngine({
    map,
    player,
    floor: currentFloor,
    manifest,
    compendium,
    worldState,
    gameState,
  });

  if (saveData.prngState !== undefined && engine.prng) {
    engine.prng.setState(saveData.prngState);
  }

  if (saveData.planes && engine.planeManager) {
    engine.planeManager.deserialize(saveData.planes);
  }

  // 5b. Restore Companion (docs/architecture/content-companions.md) — top-level, not part of map.monsters
  if (saveData.companion) {
    engine.attachCompanion(deserializeCompanion(saveData.companion, engine.registries, definitions));
  }
  // Off the map: summoned back, or revived by a trainer.
  if (saveData.dismissedCompanion) engine.dismissedCompanion = deserializeCompanion(saveData.dismissedCompanion, engine.registries, definitions);
  if (saveData.deadCompanion) engine.deadCompanionRecord = deserializeCompanion(saveData.deadCompanion, engine.registries, definitions);

  // 6. Restore Turn Count & Messages & Discovery Events
  engine.turnCount = saveData.turnCount;
  for (const msg of saveData.messages) {
    engine.messages.push(msg);
  }
  if (Array.isArray(saveData.discoveryEvents)) {
    for (const evt of saveData.discoveryEvents) {
      engine.discoveryEvents.push(evt);
    }
  }

  // 7. Restore Multi-Floor Caches
  if (saveData.storedMaps) {
    for (const [fStr, sMap] of Object.entries(saveData.storedMaps)) {
      const fNum = parseInt(fStr, 10);
      engine.storedFloors.set(fNum, deserializeMapObject(sMap, manifest?.tiles, definitions));
    }
  }
  restoreFloorLight(engine.map, engine.currentFloor, manifest);
  for (const [fNum, floorMap] of engine.storedFloors) restoreFloorLight(floorMap, fNum, manifest);
  // A prologue under way darkens the town and wards the hero, neither of which is saved.
  applyPrologueState(engine);

  // Loot tables hold generator functions, so the save leaves them (and the other
  // definition-only fields) out; restore them from each monster's definition, or a
  // monster that existed at save time dies with no drops after a load.
  for (const floorMap of [engine.map, ...engine.storedFloors.values()]) {
    restoreMonsterDefinitionFields(floorMap, engine.registries);
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
            restoreMerchantStock(cfg.initialInventory, saveData.merchantStock?.[cfg.id], definitions)
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


  rebuildItemRegistries(engine);
  activateRegistries(engine.registries);

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
