import type { GameMap } from '../grid/map';
import type { Position } from '../types';
import type { CoinageDefinition, ItemDefinition, LootRatesDefinition } from '../types/manifest';
import { Item, type ItemCategory, type ElementalAffix } from '../items/item';
import { Container } from '../items/container';
import { WandItem, ScrollItem, PotionItem } from '../items/consumables';
import { CoinItem, mintCoinPile } from '../economy/currency';
import type { CoinDenomination } from '../economy/types';
import { flightRecorder } from '../debug/flightRecorder';
import { rollItemFamily, type ItemFamilyConfig } from '../items/modifierRoller';

/** The built-in loot rates, for a pack without `manifest.loot` (each field documented there). */
const DEFAULT_LOOT_RATES: Required<LootRatesDefinition> = {
  roomDropChance: 0.6,
  roomCoinShare: 0.4,
  roomChestChance: 0.25,
  chestEntries: [2, 4],
  chestCoinShare: 0.35,
  cacheEntries: [2, 3],
  newestShare: 0.75,
  newestDefinitions: 1,
};

const ratesOf = (rates?: LootRatesDefinition): Required<LootRatesDefinition> => ({ ...DEFAULT_LOOT_RATES, ...rates });

/**
 * Calculates a procedural enchantment level (+0 to +5) based on floor depth with variance:
 * targetBonus = Math.min(5, Math.floor(currentFloor / 10))
 * variance in [-1, 0, 1] clamped between 0 and 5.
 */
export function calculateEnchantmentLevel(
  currentFloor: number,
  rng: () => number
): number {
  const targetBonus = Math.min(5, Math.floor(currentFloor / 10));
  const variance = Math.floor(rng() * 3) - 1; // -1, 0, or 1
  return Math.max(0, Math.min(5, targetBonus + variance));
}

/**
 * On Floors 30+, weapons have a 20% chance to roll an elemental suffix:
 * "of Fire", "of Cold", or "of Lightning", dealing bonus elemental damage on hit.
 */
export function rollElementalAffix(
  currentFloor: number,
  category: ItemCategory,
  rng: () => number
): ElementalAffix | undefined {
  if (currentFloor < 30 || category !== 'weapon') {
    return undefined;
  }

  if (rng() >= 0.20) {
    return undefined;
  }

  const roll = rng();
  if (roll < 0.34) {
    return { element: 'fire', bonusDamage: 5, name: 'of Fire' };
  } else if (roll < 0.67) {
    return { element: 'cold', bonusDamage: 5, name: 'of Cold' };
  } else {
    return { element: 'lightning', bonusDamage: 6, name: 'of Lightning' };
  }
}

/**
 * Creates an Item instance from an ItemDefinition with depth-scaled stats and affixes.
 * The ItemDefinition template remains strictly immutable.
 *
 * With `families` (the pack's `itemFamilies`), equipment also rolls a family after its +N
 * (ADR-0012): loot paths pass it; shop stock, starting gear and rewards don't, so they
 * stay Normal.
 */
export function createScaledItem(
  def: ItemDefinition,
  id: string,
  currentFloor: number,
  rng: () => number,
  families?: ItemFamilyConfig
): Item {
  const isEquipment =
    def.category === 'weapon' ||
    def.category === 'armor' ||
    def.category === 'shield' ||
    def.category === 'helmet' ||
    def.category === 'boots';

  const enchantmentLevel = isEquipment ? calculateEnchantmentLevel(currentFloor, rng) : 0;
  const elementalAffix = isEquipment ? rollElementalAffix(currentFloor, def.category, rng) : undefined;
  const family = rollItemFamily(def, currentFloor, rng, families, id);
  const modifiers = family ? [family] : undefined;

  // Calculate scaled attack and defense modifiers
  const stats = { ...(def.stats ?? {}) };
  if (def.category === 'weapon') {
    const baseAtk = def.stats?.attackBonus ?? 0;
    stats.attackBonus = baseAtk + (enchantmentLevel * 2);
  } else if (isEquipment) {
    const baseDef = def.stats?.defenseBonus ?? 0;
    stats.defenseBonus = baseDef + (enchantmentLevel * 1);
  }

  const quality = def.quality ?? 'normal';
  const baseValue = def.value ?? 20;
  const scaledValue = Math.round(baseValue * (1 + enchantmentLevel * 0.4) + (elementalAffix ? 150 : 0));

  // Instantiate appropriate Item subclass based on itemType
  if (def.itemType === 'wand' && def.wandConfig) {
    return new WandItem({
      id,
      definitionId: def.id,
      hooks: def.hooks,
      name: def.name,
      unidentifiedName: def.unidentifiedName,
      spellId: def.wandConfig.spellId,
      charges: def.wandConfig.charges,
      maxCharges: def.wandConfig.maxCharges,
      weight: def.weight,
      bulk: def.bulk,
      quality,
      identified: def.identified ?? false,
      description: def.description,
      value: scaledValue,
      minFloor: def.minFloor,
      tier: def.tier,
    });
  }

  if (def.itemType === 'scroll' && def.scrollConfig) {
    return new ScrollItem({
      id,
      definitionId: def.id,
      hooks: def.hooks,
      name: def.name,
      unidentifiedName: def.unidentifiedName,
      spellId: def.scrollConfig.spellId,
      weight: def.weight,
      bulk: def.bulk,
      quality,
      identified: def.identified ?? false,
      description: def.description,
      value: scaledValue,
      minFloor: def.minFloor,
      tier: def.tier,
    });
  }

  if (def.itemType === 'potion' && def.potionConfig) {
    return new PotionItem({
      id,
      definitionId: def.id,
      hooks: def.hooks,
      name: def.name,
      unidentifiedName: def.unidentifiedName,
      potionType: def.potionConfig.potionType,
      potency: def.potionConfig.potency,
      effects: def.potionConfig.effects,
      weight: def.weight,
      bulk: def.bulk,
      quality,
      identified: def.identified ?? false,
      description: def.description,
      value: scaledValue,
      minFloor: def.minFloor,
      tier: def.tier,
    });
  }

  if (def.itemType === 'container' && def.containerConfig) {
    return new Container({
      id,
      definitionId: def.id,
      hooks: def.hooks,
      name: def.name,
      unidentifiedName: def.unidentifiedName,
      category: def.category,
      slot: def.slot,
      weight: def.weight,
      bulk: def.bulk,
      quality,
      identified: def.identified ?? true,
      stats,
      description: def.description,
      value: scaledValue,
      containerType: def.containerConfig.containerType,
      maxWeightCapacity: def.containerConfig.maxWeightCapacity,
      maxBulkCapacity: def.containerConfig.maxBulkCapacity,
      maxSlots: def.containerConfig.maxSlots,
      acceptedCategories: def.containerConfig.acceptedCategories,
      minFloor: def.minFloor,
      tier: def.tier,
      predicate: def.predicate,
    });
  }

  return new Item({
    id,
    definitionId: def.id,
    hooks: def.hooks,
    name: def.name,
    unidentifiedName: def.unidentifiedName,
    category: def.category,
    slot: def.slot,
    weight: def.weight,
    bulk: def.bulk,
    quality,
    identified: def.identified ?? false,
    stats,
    description: def.description,
    value: scaledValue,
    baseValue,
    minFloor: def.minFloor,
    tier: def.tier,
    enchantmentLevel,
    elementalAffix,
    modifiers,
    twoHanded: def.twoHanded,
    blocksSlot: def.blocksSlot,
    rangedConfig: def.rangedConfig,
    predicate: def.predicate,
  });
}

/**
 * Selects an item definition from candidates filtered by floor depth and tiering:
 * - Candidates must satisfy (minFloor ?? 1) <= currentFloor
 * - Excludes quest relics
 * - The newest-item rule: `newestShare` (75%) of draws come from the `newestDefinitions` newest
 *   definitions by `minFloor` (ties kept together), the rest from the older ones (`manifest.loot`)
 */
export function selectFloorItemDefinition(
  candidates: ItemDefinition[],
  currentFloor: number,
  rng: () => number,
  rates?: LootRatesDefinition
): ItemDefinition | null {
  const { newestShare, newestDefinitions } = ratesOf(rates);
  // A chest is placed by the room chest roll, filled (createDungeonChest); as a loose item
  // it would arrive empty, and too bulky to lift.
  const eligible = candidates.filter(
    (i) => i.category !== 'quest' && i.containerConfig?.containerType !== 'chest' && (i.minFloor ?? 1) <= currentFloor
  );

  if (eligible.length === 0) {
    return null;
  }

  // The `minFloor` of the Nth newest definition: everything at or above it is the newest group.
  const floorsNewestFirst = eligible.map((i) => i.minFloor ?? 1).sort((a, b) => b - a);
  const newestFloor = floorsNewestFirst[Math.min(Math.max(1, newestDefinitions), floorsNewestFirst.length) - 1];
  const recentGroup = eligible.filter((i) => (i.minFloor ?? 1) >= newestFloor);
  const lowerGroup = eligible.filter((i) => (i.minFloor ?? 1) < newestFloor);

  if (lowerGroup.length > 0) {
    if (rng() < newestShare) {
      return pickByLootWeight(recentGroup, rng());
    } else {
      return pickByLootWeight(lowerGroup, rng());
    }
  }

  return pickByLootWeight(recentGroup, rng());
}

/** One definition from `group`, each as likely as its `lootWeight` (default 1); `roll` in [0, 1). */
function pickByLootWeight(group: ItemDefinition[], roll: number): ItemDefinition {
  const weightOf = (def: ItemDefinition) => def.lootWeight ?? 1;
  let target = roll * group.reduce((sum, def) => sum + weightOf(def), 0);
  for (const def of group) {
    target -= weightOf(def);
    if (target < 0) return def;
  }
  return group[group.length - 1];
}

/**
 * Spawns a coin pile for a floor: from the pack's coinage when it has one (`mintCoinPile`),
 * else from this built-in table of depth-scaled denominations:
 * - Floors 1–9: Copper Pieces (CP) and Silver Pieces (SP).
 * - Floors 10–24: Silver Pieces (SP) and Gold Pieces (GP).
 * - Floors 25–50: Gold Pieces (GP).
 */
export function spawnFloorCurrency(
  currentFloor: number,
  id: string,
  rng: () => number,
  coinage?: CoinageDefinition
): CoinItem {
  if (coinage) return mintCoinPile(id, currentFloor, rng, coinage);
  let denomination: CoinDenomination;
  let count: number;

  if (currentFloor < 10) {
    // Floors 1–9: CP (60%) or SP (40%)
    if (rng() < 0.6) {
      denomination = 'copper';
      count = Math.floor(rng() * 70) + 30; // 30–100 CP
    } else {
      denomination = 'silver';
      count = Math.floor(rng() * 15) + 5;  // 5–20 SP (50–200 CP)
    }
  } else if (currentFloor < 25) {
    // Floors 10–24: SP (60%) or GP (40%)
    if (rng() < 0.6) {
      denomination = 'silver';
      count = Math.floor(rng() * 60) + 20; // 20–80 SP (200–800 CP)
    } else {
      denomination = 'gold';
      count = Math.floor(rng() * 15) + 5;  // 5–20 GP (500–2000 CP)
    }
  } else {
    // Floors 25–50: GP, a small pile (65%) or a large one (35%)
    denomination = 'gold';
    if (rng() < 0.65) {
      count = Math.floor(rng() * 40) + 20; // 20–60 GP (2000–6000 CP)
    } else {
      count = (Math.floor(rng() * 10) + 3) * 10; // 30–130 GP (3000–13000 CP)
    }
  }

  return new CoinItem({
    id,
    denomination,
    count,
  });
}

/**
 * Creates an Ironbound Wooden Chest populated with scaled items and currency: 2–4 entries,
 * 35% of them coin piles, unless the pack's `manifest.loot` says otherwise.
 */
export function createDungeonChest(
  id: string,
  currentFloor: number,
  candidates: ItemDefinition[],
  rng: () => number,
  coinage?: CoinageDefinition,
  families?: ItemFamilyConfig,
  rates?: LootRatesDefinition
): Container {
  const { chestEntries, chestCoinShare } = ratesOf(rates);
  const chest = new Container({
    id,
    name: 'Ironbound Wooden Chest',
    unidentifiedName: 'Heavy Chest',
    category: 'container',
    weight: 8000,
    bulk: 12000,
    identified: true,
    stats: {},
    description: 'A sturdy iron-reinforced dungeon chest containing subterranean treasures.',
    containerType: 'chest',
    maxWeightCapacity: 50000,
    maxBulkCapacity: 35000,
  });

  const [fewest, most] = chestEntries;
  const targetCount = fewest + Math.floor(rng() * (most - fewest + 1));
  let attempts = 0;
  while (chest.getItems().length < targetCount && attempts < 15) {
    attempts++;
    const idx = chest.getItems().length;
    if (rng() < chestCoinShare) {
      const coinId = `${id}-coin-${idx}-${attempts}`;
      chest.addItem(spawnFloorCurrency(currentFloor, coinId, rng, coinage));
    } else {
      const def = selectFloorItemDefinition(candidates, currentFloor, rng, rates);
      let added = false;
      if (def) {
        const itemId = `${id}-item-${idx}-${Math.floor(rng() * 1000000)}-${attempts}`;
        added = chest.addItem(createScaledItem(def, itemId, currentFloor, rng, families));
      }
      if (!added) {
        // Fall back to currency if item didn't fit or definition wasn't found
        const coinId = `${id}-coin-${idx}-${attempts}`;
        chest.addItem(spawnFloorCurrency(currentFloor, coinId, rng, coinage));
      }
    }
  }

  return chest;
}

/**
 * Puts a chest in each secret cache (tracker 5.6, N27: finding one should be worth it), on its
 * middle cell, holding the pack's `cacheEntries`. Its own rng, so the floor's population and
 * room loot draw exactly as without caches.
 */
export function stockSecretCaches(
  map: GameMap,
  caches: readonly Position[][],
  currentFloor: number,
  candidates: ItemDefinition[],
  rng: () => number,
  coinage?: CoinageDefinition,
  families?: ItemFamilyConfig,
  rates?: LootRatesDefinition
): void {
  const { cacheEntries } = ratesOf(rates);
  caches.forEach((cells, i) => {
    if (cells.length === 0) return;
    const mid = {
      x: Math.round(cells.reduce((a, c) => a + c.x, 0) / cells.length),
      y: Math.round(cells.reduce((a, c) => a + c.y, 0) / cells.length),
    };
    const at = cells.find((c) => c.x === mid.x && c.y === mid.y) ?? cells[0];
    const chest = createDungeonChest(`cache-chest-${currentFloor}-${i}`, currentFloor, candidates, rng, coinage, families, { ...rates, chestEntries: cacheEntries });
    map.addItemAt(at.x, at.y, chest);
  });
}

/**
 * Populates procedural dungeon rooms with depth-scaled loot and chests: per room past the
 * arrival room, a loose drop (an item or a coin pile) and a chest, each by its chance in the
 * pack's `manifest.loot`.
 */
export function populateDungeonLoot(
  map: GameMap,
  rooms: Array<{ x1: number; y1: number; x2: number; y2: number }>,
  currentFloor: number,
  candidates: ItemDefinition[],
  rng: () => number,
  coinage?: CoinageDefinition,
  families?: ItemFamilyConfig,
  rates?: LootRatesDefinition
): Item[] {
  const { roomDropChance, roomCoinShare, roomChestChance } = ratesOf(rates);
  const spawnedItems: Item[] = [];

  // Iterate rooms 1..N (skipping room 0 which is player entry)
  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i];

    if (rng() < roomDropChance) {
      const lx = room.x1 + 1 + Math.floor(rng() * (room.x2 - room.x1 - 1));
      const ly = room.y1 + 1 + Math.floor(rng() * (room.y2 - room.y1 - 1));

      if (map.isPassable(lx, ly) && !map.getEntityAt(lx, ly)) {
        if (rng() < roomCoinShare) {
          const coinId = `loot-coin-${currentFloor}-${i}-${Math.floor(rng() * 1000000)}`;
          const coins = spawnFloorCurrency(currentFloor, coinId, rng, coinage);
          map.addItemAt(lx, ly, coins);
          spawnedItems.push(coins);
        } else {
          const def = selectFloorItemDefinition(candidates, currentFloor, rng, rates);
          if (def) {
            const itemId = `loot-item-${currentFloor}-${i}-${Math.floor(rng() * 1000000)}`;
            const item = createScaledItem(def, itemId, currentFloor, rng, families);
            map.addItemAt(lx, ly, item);
            spawnedItems.push(item);
          }
        }
      }
    }

    if (rng() < roomChestChance) {
      const cx = room.x1 + 1 + Math.floor(rng() * (room.x2 - room.x1 - 1));
      const cy = room.y1 + 1 + Math.floor(rng() * (room.y2 - room.y1 - 1));

      if (map.isPassable(cx, cy) && !map.getEntityAt(cx, cy)) {
        const chestId = `loot-chest-${currentFloor}-${i}-${Math.floor(rng() * 1000000)}`;
        const chest = createDungeonChest(chestId, currentFloor, candidates, rng, coinage, families, rates);
        map.addItemAt(cx, cy, chest);
        spawnedItems.push(chest);
      }
    }
  }

  flightRecorder.recordState(
    'loot_spawn',
    `Floor ${currentFloor} Loot Spawned (${spawnedItems.length} items/chests): ${spawnedItems.map((it) => it.displayName).join(', ')}`,
    { floor: currentFloor, count: spawnedItems.length }
  );

  return spawnedItems;
}
