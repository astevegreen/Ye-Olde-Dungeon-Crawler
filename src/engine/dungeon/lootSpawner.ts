import type { GameMap } from '../grid/map';
import type { ItemDefinition } from '../types/manifest';
import { Item, type ItemCategory, type ElementalAffix } from '../items/item';
import { Container } from '../items/container';
import { WandItem, ScrollItem, PotionItem } from '../items/consumables';
import { CoinItem } from '../economy/currency';
import type { CoinDenomination } from '../economy/types';
import { flightRecorder } from '../debug/flightRecorder';

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
 */
export function createScaledItem(
  def: ItemDefinition,
  id: string,
  currentFloor: number,
  rng: () => number
): Item {
  const isEquipment =
    def.category === 'weapon' ||
    def.category === 'armor' ||
    def.category === 'shield' ||
    def.category === 'helmet' ||
    def.category === 'boots';

  const enchantmentLevel = isEquipment ? calculateEnchantmentLevel(currentFloor, rng) : 0;
  const elementalAffix = isEquipment ? rollElementalAffix(currentFloor, def.category, rng) : undefined;

  // Calculate scaled attack and defense modifiers
  const stats = { ...(def.stats ?? {}) };
  if (def.category === 'weapon') {
    const baseAtk = def.stats?.attackBonus ?? 0;
    stats.attackBonus = baseAtk + (enchantmentLevel * 2);
  } else if (isEquipment) {
    const baseDef = def.stats?.defenseBonus ?? 0;
    stats.defenseBonus = baseDef + (enchantmentLevel * 1);
  }

  const quality = (enchantmentLevel > 0 || elementalAffix) ? 'enchanted' : (def.quality ?? 'normal');
  const baseValue = def.value ?? 20;
  const scaledValue = Math.round(baseValue * (1 + enchantmentLevel * 0.4) + (elementalAffix ? 150 : 0));

  // Instantiate appropriate Item subclass based on itemType
  if (def.itemType === 'wand' && def.wandConfig) {
    return new WandItem({
      id,
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
    });
  }

  return new Item({
    id,
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
    minFloor: def.minFloor,
    tier: def.tier,
    enchantmentLevel,
    elementalAffix,
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
 * - 75% chance to draw from highest recently unlocked tier, 25% from lower tiers
 */
export function selectFloorItemDefinition(
  candidates: ItemDefinition[],
  currentFloor: number,
  rng: () => number
): ItemDefinition | null {
  const eligible = candidates.filter(
    (i) => i.category !== 'quest' && (i.minFloor ?? 1) <= currentFloor
  );

  if (eligible.length === 0) {
    return null;
  }

  const maxMinFloor = Math.max(...eligible.map((i) => i.minFloor ?? 1));
  const recentGroup = eligible.filter((i) => (i.minFloor ?? 1) === maxMinFloor);
  const lowerGroup = eligible.filter((i) => (i.minFloor ?? 1) < maxMinFloor);

  if (lowerGroup.length > 0) {
    if (rng() < 0.75) {
      return recentGroup[Math.floor(rng() * recentGroup.length)];
    } else {
      return lowerGroup[Math.floor(rng() * lowerGroup.length)];
    }
  }

  return recentGroup[Math.floor(rng() * recentGroup.length)];
}

/**
 * Spawns depth-scaled currency denominations:
 * - Floors 1–9: Copper Pieces (CP) and Silver Pieces (SP).
 * - Floors 10–24: Silver Pieces (SP) and Gold Pieces (GP).
 * - Floors 25–50: Gold Pieces (GP) and Platinum Pieces (PP).
 */
export function spawnFloorCurrency(
  currentFloor: number,
  id: string,
  rng: () => number
): CoinItem {
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
    // Floors 25–50: GP (65%) or PP (35%)
    if (rng() < 0.65) {
      denomination = 'gold';
      count = Math.floor(rng() * 40) + 20; // 20–60 GP (2000–6000 CP)
    } else {
      denomination = 'platinum';
      count = Math.floor(rng() * 10) + 3;  // 3–13 PP (3000–13000 CP)
    }
  }

  return new CoinItem({
    id,
    denomination,
    count,
  });
}

/**
 * Creates an Ironbound Wooden Chest populated with 2–4 scaled items and currency.
 */
export function createDungeonChest(
  id: string,
  currentFloor: number,
  candidates: ItemDefinition[],
  rng: () => number
): Container {
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

  const targetCount = Math.floor(rng() * 3) + 2; // 2 to 4 items inside
  let attempts = 0;
  while (chest.getItems().length < targetCount && attempts < 15) {
    attempts++;
    const idx = chest.getItems().length;
    // 35% chance currency, 65% chance item
    if (rng() < 0.35) {
      const coinId = `${id}-coin-${idx}-${attempts}`;
      chest.addItem(spawnFloorCurrency(currentFloor, coinId, rng));
    } else {
      const def = selectFloorItemDefinition(candidates, currentFloor, rng);
      let added = false;
      if (def) {
        const itemId = `${id}-item-${idx}-${Math.floor(rng() * 1000000)}-${attempts}`;
        added = chest.addItem(createScaledItem(def, itemId, currentFloor, rng));
      }
      if (!added) {
        // Fall back to currency if item didn't fit or definition wasn't found
        const coinId = `${id}-coin-${idx}-${attempts}`;
        chest.addItem(spawnFloorCurrency(currentFloor, coinId, rng));
      }
    }
  }

  return chest;
}

/**
 * Populates procedural dungeon rooms with depth-scaled loot and chests.
 */
export function populateDungeonLoot(
  map: GameMap,
  rooms: Array<{ x1: number; y1: number; x2: number; y2: number }>,
  currentFloor: number,
  candidates: ItemDefinition[],
  rng: () => number
): Item[] {
  const spawnedItems: Item[] = [];

  // Iterate rooms 1..N (skipping room 0 which is player entry)
  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i];

    // 60% chance to spawn ground loot (item or currency)
    if (rng() < 0.60) {
      const lx = room.x1 + 1 + Math.floor(rng() * (room.x2 - room.x1 - 1));
      const ly = room.y1 + 1 + Math.floor(rng() * (room.y2 - room.y1 - 1));

      if (map.isPassable(lx, ly) && !map.getEntityAt(lx, ly)) {
        // 40% currency pile, 60% equipment/consumable
        if (rng() < 0.40) {
          const coinId = `loot-coin-${currentFloor}-${i}-${Math.floor(rng() * 1000000)}`;
          const coins = spawnFloorCurrency(currentFloor, coinId, rng);
          map.addItemAt(lx, ly, coins);
          spawnedItems.push(coins);
        } else {
          const def = selectFloorItemDefinition(candidates, currentFloor, rng);
          if (def) {
            const itemId = `loot-item-${currentFloor}-${i}-${Math.floor(rng() * 1000000)}`;
            const item = createScaledItem(def, itemId, currentFloor, rng);
            map.addItemAt(lx, ly, item);
            spawnedItems.push(item);
          }
        }
      }
    }

    // 25% chance to spawn an ironbound chest
    if (rng() < 0.25) {
      const cx = room.x1 + 1 + Math.floor(rng() * (room.x2 - room.x1 - 1));
      const cy = room.y1 + 1 + Math.floor(rng() * (room.y2 - room.y1 - 1));

      if (map.isPassable(cx, cy) && !map.getEntityAt(cx, cy)) {
        const chestId = `loot-chest-${currentFloor}-${i}-${Math.floor(rng() * 1000000)}`;
        const chest = createDungeonChest(chestId, currentFloor, candidates, rng);
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
