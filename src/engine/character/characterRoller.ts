import type { CharacterAttributes, DerivedStats, AttributeRoll } from './types';
import type { Player } from '../entities/player';
import { ItemFactory } from '../items/factory';
import { addCoinsToContainer } from '../economy/currency';
import { Container } from '../items/container';
import { createScaledItem } from '../dungeon/lootSpawner';
import type { StarterKitDefinition, ItemDefinition } from '../types/manifest';
import { RuneOfReturnItem } from '../magic/runeOfReturn';

export const MIN_ATTRIBUTE = 8;
export const MAX_ATTRIBUTE = 18;
const DEFAULT_POOL_POINTS = 5;

export class CharacterRoller {
  /**
   * Simulates rolling 3 standard six-sided dice (3d6), resulting in 3 to 18.
   */
  public static roll3d6(rng: () => number): number {
    const roll = rng;
    const d1 = Math.floor(roll() * 6) + 1;
    const d2 = Math.floor(roll() * 6) + 1;
    const d3 = Math.floor(roll() * 6) + 1;
    return d1 + d2 + d3;
  }

  /**
   * Rolls an attribute guaranteed to be within playable heroic bounds (min 8, max 18).
   */
  public static rollHeroAttribute(rng: () => number): number {
    const raw = this.roll3d6(rng);
    return Math.max(MIN_ATTRIBUTE, Math.min(MAX_ATTRIBUTE, raw));
  }

  /**
   * Generates a fresh roll for all 4 primary attributes with a customizable point pool.
   */
  public static generateRoll(rng: () => number): AttributeRoll {
    return {
      attributes: {
        strength: this.rollHeroAttribute(rng),
        intelligence: this.rollHeroAttribute(rng),
        constitution: this.rollHeroAttribute(rng),
        dexterity: this.rollHeroAttribute(rng),
      },
      availablePoints: DEFAULT_POOL_POINTS,
    };
  }

  /**
   * Calculates derived combat and survival statistics from attributes.
   */
  public static calculateDerivedStats(attrs: CharacterAttributes): DerivedStats {
    const maxHp = Math.floor(attrs.constitution * 2 + 10);
    const maxMana = Math.floor(attrs.intelligence * 2 + 5);
    const maxCarryWeight = Math.floor(15000 + attrs.strength * 1000);
    const baseAttack = Math.floor(attrs.strength * 0.4 + attrs.dexterity * 0.2);
    const baseDefense = Math.floor(attrs.dexterity * 0.25);
    const speed = 100 + Math.max(-10, Math.min(15, (attrs.dexterity - 10) * 2));

    return {
      maxHp,
      maxMana,
      maxCarryWeight,
      baseAttack,
      baseDefense,
      speed,
    };
  }

  /**
   * Adjusts a specific attribute by delta (+1 or -1) consuming or refunding points.
   */
  public static adjustAttribute(
    attrs: CharacterAttributes,
    attr: keyof CharacterAttributes,
    delta: number,
    currentPoints: number
  ): { success: boolean; attributes: CharacterAttributes; availablePoints: number; message?: string } {
    const currentVal = attrs[attr];

    if (delta > 0) {
      if (currentPoints <= 0) {
        return {
          success: false,
          attributes: { ...attrs },
          availablePoints: currentPoints,
          message: 'No attribute points remaining in your pool.',
        };
      }
      if (currentVal >= MAX_ATTRIBUTE) {
        return {
          success: false,
          attributes: { ...attrs },
          availablePoints: currentPoints,
          message: `Cannot increase ${attr} above ${MAX_ATTRIBUTE}.`,
        };
      }
      return {
        success: true,
        attributes: {
          ...attrs,
          [attr]: currentVal + 1,
        },
        availablePoints: currentPoints - 1,
      };
    } else if (delta < 0) {
      if (currentVal <= MIN_ATTRIBUTE) {
        return {
          success: false,
          attributes: { ...attrs },
          availablePoints: currentPoints,
          message: `Cannot decrease ${attr} below ${MIN_ATTRIBUTE}.`,
        };
      }
      return {
        success: true,
        attributes: {
          ...attrs,
          [attr]: currentVal - 1,
        },
        availablePoints: currentPoints + 1,
      };
    }

    return {
      success: true,
      attributes: { ...attrs },
      availablePoints: currentPoints,
    };
  }

  /**
   * Equips a player with a starter kit, driven by manifest or fallback to standard kit.
   */
  public static equipStartingKit(
    player: Player,
    profileId: string,
    starterKit: StarterKitDefinition | undefined,
    itemCatalog: Record<string, ItemDefinition> | ItemDefinition[] | undefined,
    rng: () => number
  ): void {
    if (!starterKit) {
      // 1. Weapon: Iron Dagger
      const startingDagger = ItemFactory.createDagger(`${profileId}-dagger`);
      player.inventory.primaryPack.addItem(startingDagger);
      player.inventory.equipFromPack(startingDagger.id);

      // 2. Purse: Velvet Coin Purse with starter coinage
      const startingPurse = ItemFactory.createCoinPurse(`${profileId}-purse`);
      player.inventory.paperdoll.equip(startingPurse, 'purse');
      addCoinsToContainer(startingPurse, 'copper', 50, `${profileId}-c`);
      addCoinsToContainer(startingPurse, 'silver', 10, `${profileId}-s`);
      addCoinsToContainer(startingPurse, 'gold', 2, `${profileId}-g`);

      // 3. Waist: Utility Belt with Wand of Lightning
      const startingBelt = ItemFactory.createUtilityBelt(`${profileId}-belt`);
      player.inventory.paperdoll.equip(startingBelt, 'waist');
      const startingWand = ItemFactory.createWandOfLightning(`${profileId}-wand-lightning`);
      startingBelt.addItem(startingWand);

      // 4. Provisions & Consumables in Backpack
      player.inventory.primaryPack.addItem(ItemFactory.createTravelBread(`${profileId}-travel-bread`));
      player.inventory.primaryPack.addItem(ItemFactory.createHealthPotion(`${profileId}-health-pot`));
      player.inventory.primaryPack.addItem(ItemFactory.createManaPotion(`${profileId}-mana-pot`));
      player.inventory.primaryPack.addItem(ItemFactory.createScrollOfTeleport(`${profileId}-scroll-teleport`));
      return;
    }

    const itemsMap: Record<string, ItemDefinition> = Array.isArray(itemCatalog)
      ? itemCatalog.reduce((acc, item) => ({ ...acc, [item.id]: item }), {})
      : (itemCatalog ?? {});

    const instantiateItem = (id: string, instanceId: string) => {
      const def = itemsMap[id];
      if (def) {
        return createScaledItem(def, instanceId, 1, rng);
      }
      if (id === 'dagger') return ItemFactory.createDagger(instanceId);
      if (id === 'coin_purse') return ItemFactory.createCoinPurse(instanceId);
      if (id === 'utility_belt') return ItemFactory.createUtilityBelt(instanceId);
      if (id === 'wand_lightning') return ItemFactory.createWandOfLightning(instanceId);
      if (id === 'travel_bread') return ItemFactory.createTravelBread(instanceId);
      if (id === 'mana_potion') return ItemFactory.createManaPotion(instanceId);
      if (id === 'scroll_phase_door' || id === 'scroll_teleport') return ItemFactory.createScrollOfTeleport(instanceId);
      if (id === 'rune_of_return') {
        return new RuneOfReturnItem({
          id: instanceId,
          name: 'Rune of Return',
          unidentifiedName: 'Carved Rune Stone',
          identified: true,
          description: 'A palm-sized stone etched with a rune that hums faintly. Channeling it over several turns teleports you back to town.',
        });
      }
      return ItemFactory.createDagger(instanceId);
    };

    // 1. Weapon
    if (starterKit.weaponItemId) {
      const weapon = instantiateItem(starterKit.weaponItemId, `${profileId}-weapon`);
      player.inventory.primaryPack.addItem(weapon);
      player.inventory.equipFromPack(weapon.id);
    }

    // 2. Purse
    if (starterKit.purseItemId) {
      const purse = instantiateItem(starterKit.purseItemId, `${profileId}-purse`);
      if (purse instanceof Container || 'addItem' in purse) {
        player.inventory.paperdoll.equip(purse as Container, 'purse');
        if (starterKit.coins) {
          for (let i = 0; i < starterKit.coins.length; i++) {
            const c = starterKit.coins[i];
            addCoinsToContainer(purse as Container, c.denomination, c.count, `${profileId}-c-${i}`);
          }
        }
      }
    }

    // 3. Belt
    if (starterKit.beltItemId) {
      const belt = instantiateItem(starterKit.beltItemId, `${profileId}-belt`);
      if (belt instanceof Container || 'addItem' in belt) {
        player.inventory.paperdoll.equip(belt as Container, 'waist');
        if (starterKit.beltSlotItemIds) {
          for (let i = 0; i < starterKit.beltSlotItemIds.length; i++) {
            const subItemId = starterKit.beltSlotItemIds[i];
            const subItem = instantiateItem(subItemId, `${profileId}-belt-${i}`);
            (belt as Container).addItem(subItem);
          }
        }
      }
    }

    // 4. Pack items
    if (starterKit.packItemIds) {
      for (let i = 0; i < starterKit.packItemIds.length; i++) {
        const pItemId = starterKit.packItemIds[i];
        const pItem = instantiateItem(pItemId, `${profileId}-pack-${i}`);
        player.inventory.primaryPack.addItem(pItem);
      }
    }
  }
}
