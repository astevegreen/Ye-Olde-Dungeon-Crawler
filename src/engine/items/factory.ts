import { Item } from './item';
import type { ItemStatModifiers } from './item';
import { Container } from './container';
import { WandItem, ScrollItem, PotionItem } from './consumables';
import type { Predicate } from '../predicates/types';

export class ItemFactory {
  public static createDagger(id = 'dagger-1'): Item {
    return new Item({
      id,
      name: 'Iron Dagger',
      value: 2000,
      unidentifiedName: 'Small Dagger',
      category: 'weapon',
      slot: 'mainHand',
      weight: 450,
      bulk: 250,
      stats: { attackBonus: 3 },
      identified: true,
      description: 'A sharp, swift iron dagger.',
    });
  }

  public static createBroadsword(id = 'sword-1'): Item {
    return new Item({
      id,
      name: 'Steel Broadsword',
      value: 15000,
      unidentifiedName: 'Heavy Sword',
      category: 'weapon',
      slot: 'mainHand',
      weight: 1600,
      bulk: 1200,
      stats: { attackBonus: 8 },
      identified: false,
      description: 'A well-balanced double-edged steel sword.',
    });
  }

  public static createFrostBlade(id = 'frost-1'): Item {
    return new Item({
      id,
      name: 'Frost Broadsword',
      value: 45000,
      unidentifiedName: 'Glowing Broadsword',
      category: 'weapon',
      slot: 'mainHand',
      weight: 1500,
      bulk: 1200,
      quality: 'enchanted',
      stats: { attackBonus: 12 },
      identified: false,
      description: 'Runic frost emanates from this enchanted steel blade.',
    });
  }

  public static createCursedMace(id = 'cursed-mace-1'): Item {
    return new Item({
      id,
      name: 'Spiked Mace',
      value: 12000,
      unidentifiedName: 'Dark Spiked Mace',
      category: 'weapon',
      slot: 'mainHand',
      weight: 4000,
      bulk: 2500,
      quality: 'cursed',
      stats: { attackBonus: 2 },
      identified: false,
      description: 'A heavy mace bearing foul demonic runes.',
    });
  }

  public static createWoodenShield(id = 'shield-1'): Item {
    return new Item({
      id,
      name: 'Reinforced Wooden Shield',
      value: 3000,
      unidentifiedName: 'Round Shield',
      category: 'shield',
      slot: 'offHand',
      weight: 2200,
      bulk: 3000,
      stats: { defenseBonus: 3 },
      identified: true,
      description: 'Sturdy oak banded with iron.',
    });
  }

  public static createLeatherArmor(id = 'armor-1'): Item {
    return new Item({
      id,
      name: 'Studded Leather Armor',
      value: 8000,
      unidentifiedName: 'Leather Tunic',
      category: 'armor',
      slot: 'torso',
      weight: 4500,
      bulk: 6000,
      stats: { defenseBonus: 4 },
      identified: true,
      description: 'Supple boiled leather studded with steel rivets.',
    });
  }

  public static createChainmail(id = 'chainmail-1'): Item {
    return new Item({
      id,
      name: 'Iron Chainmail',
      value: 30000,
      unidentifiedName: 'Heavy Mail Shirt',
      category: 'armor',
      slot: 'torso',
      weight: 12000,
      bulk: 8000,
      stats: { defenseBonus: 8 },
      identified: true,
      description: 'Interlinked steel rings offering robust protection.',
    });
  }

  public static createIronHelmet(id = 'helm-1'): Item {
    return new Item({
      id,
      name: 'Iron Helmet',
      value: 5000,
      unidentifiedName: 'Iron Cap',
      category: 'helmet',
      slot: 'head',
      weight: 2400,
      bulk: 2200,
      stats: { defenseBonus: 3 },
      identified: true,
      description: 'A solid forged iron pot helm.',
    });
  }

  public static createBoots(id = 'boots-1'): Item {
    return new Item({
      id,
      name: 'Traveler Boots',
      value: 3000,
      unidentifiedName: 'Leather Boots',
      category: 'boots',
      slot: 'feet',
      weight: 1200,
      bulk: 1600,
      stats: { defenseBonus: 1 },
      identified: true,
      description: 'Sturdy high-laced boots for dungeon crawling.',
    });
  }

  public static createCursedRing(id = 'cursed-ring-1'): Item {
    return new Item({
      id,
      name: 'Ring of Clumsiness',
      unidentifiedName: 'Twisted Silver Ring',
      category: 'ring',
      slot: 'fingerLeft',
      weight: 15,
      bulk: 10,
      quality: 'cursed',
      stats: { defenseBonus: -2 },
      identified: false,
      description: 'A ring that binds to your finger with malevolent force.',
    });
  }

  public static createUtilityBelt(id = 'belt-1'): Container {
    return new Container({
      id,
      name: 'Leather Utility Belt',
      value: 4000,
      category: 'container',
      slot: 'waist',
      containerType: 'belt',
      weight: 600,
      bulk: 800,
      maxSlots: 6,
      maxWeightCapacity: 6000,
      maxBulkCapacity: 4000,
      identified: true,
      description: 'A sturdy belt with quick-access loops and pouches.',
    });
  }

  public static createCoinPurse(id = 'purse-1'): Container {
    return new Container({
      id,
      name: 'Velvet Coin Purse',
      category: 'container',
      slot: 'purse',
      containerType: 'purse',
      weight: 150,
      bulk: 300,
      maxWeightCapacity: 4000,
      maxBulkCapacity: 1500,
      acceptedCategories: ['currency'],
      identified: true,
      description: 'A soft velvet drawstring pouch dedicated to holding coins.',
    });
  }

  public static createLeatherPurse(id = 'purse-1'): Container {
    return new Container({
      id,
      name: 'Leather Coin Purse',
      category: 'container',
      slot: 'purse',
      containerType: 'purse',
      weight: 180,
      bulk: 350,
      maxWeightCapacity: 5000,
      maxBulkCapacity: 2000,
      acceptedCategories: ['currency'],
      identified: true,
      description: 'A sturdy leather coin pouch with a secure leather cinch.',
    });
  }

  public static createIronChest(id = 'chest-1'): Container {
    return new Container({
      id,
      name: 'Heavy Iron Chest',
      category: 'container',
      containerType: 'chest',
      weight: 8500,
      bulk: 18000,
      maxWeightCapacity: 60000,
      maxBulkCapacity: 18000,
      identified: true,
      description: 'A rigid iron-reinforced chest with a heavy latch.',
    });
  }

  public static createHealthPotion(id = 'potion-1'): PotionItem {
    return new PotionItem({
      id,
      name: 'Minor Health Potion',
      value: 5000,
      unidentifiedName: 'Red Potion',
      potionType: 'health',
      potency: 25,
      weight: 350,
      bulk: 200,
      identified: true,
      description: 'A glowing flask containing restorative ruby-red draught.',
    });
  }

  public static createManaPotion(id = 'mana-potion-1'): PotionItem {
    return new PotionItem({
      id,
      name: 'Mana Draught',
      value: 7500,
      unidentifiedName: 'Blue Potion',
      potionType: 'mana',
      potency: 20,
      weight: 350,
      bulk: 200,
      identified: true,
      description: 'An azure vial that refreshes the drinker’s magical reserves.',
    });
  }

  public static createAntidotePotion(id = 'antidote-1'): PotionItem {
    return new PotionItem({
      id,
      name: 'Purifying Antidote',
      unidentifiedName: 'Green Potion',
      potionType: 'antidote',
      potency: 1,
      weight: 300,
      bulk: 180,
      identified: true,
      description: 'A bitter herbal tincture that neutralizes venom and acid.',
    });
  }

  public static createDraughtOfVolatileEnergy(id = 'draught-volatile-energy-1'): PotionItem {
    return new PotionItem({
      id,
      name: 'Draught of Volatile Energy',
      unidentifiedName: 'Black Glass Phial',
      potionType: 'volatile_energy',
      weight: 250,
      bulk: 150,
      value: 350,
      quality: 'enchanted',
      identified: true,
      description: 'A swirling, effervescent phial of concentrated occult vigor. Very rare. Drinking it completely refills your Volatile Energy meter.',
    });
  }

  public static createWandOfLightning(id = 'wand-lightning-1', charges = 8): WandItem {
    return new WandItem({
      id,
      name: 'Wand of Lightning',
      value: 50000,
      unidentifiedName: 'Copper Wand',
      spellId: 'lightning_bolt',
      charges,
      maxCharges: charges,
      weight: 300,
      bulk: 150,
      identified: true,
      description: 'A slender copper rod tipped with a crackling fulgurite shard.',
    });
  }

  public static createWandOfFireballs(id = 'wand-fireball-1', charges = 5): WandItem {
    return new WandItem({
      id,
      name: 'Wand of Fireballs',
      value: 60000,
      unidentifiedName: 'Brass Wand',
      spellId: 'fireball',
      charges,
      maxCharges: charges,
      weight: 320,
      bulk: 160,
      identified: true,
      description: 'A warm brass wand engraved with dancing runes of flame.',
    });
  }

  public static createScrollOfIdentify(id = 'scroll-identify-1'): ScrollItem {
    return new ScrollItem({
      id,
      name: 'Scroll of Identify',
      value: 5000,
      unidentifiedName: 'Parchment Scroll',
      spellId: 'identify',
      weight: 50,
      bulk: 40,
      identified: true,
      description: 'A crisp parchment inscribed with golden revelation runes.',
    });
  }

  public static createScrollOfTeleport(id = 'scroll-teleport-1'): ScrollItem {
    return new ScrollItem({
      id,
      name: 'Scroll of Phase Door',
      value: 4000,
      unidentifiedName: 'Faded Scroll',
      spellId: 'phase_door',
      weight: 50,
      bulk: 40,
      identified: true,
      description: 'Unfurling this scroll instantly bends space to displace the reader.',
    });
  }

  public static createPlateArmor(id = 'plate-1'): Item {
    return new Item({
      id,
      name: 'Full Plate Armor',
      value: 80000,
      unidentifiedName: 'Heavy Steel Armor',
      category: 'armor',
      slot: 'torso',
      weight: 24000,
      bulk: 15000,
      stats: { defenseBonus: 15 },
      identified: true,
      description: 'Masterfully forged polished steel plate providing maximum defense.',
    });
  }

  public static createBattleaxe(id = 'axe-1'): Item {
    return new Item({
      id,
      name: 'Bearded Battleaxe',
      value: 20000,
      unidentifiedName: 'Heavy Axe',
      category: 'weapon',
      slot: 'mainHand',
      weight: 2800,
      bulk: 1800,
      stats: { attackBonus: 11 },
      identified: true,
      description: 'A heavy bearded axe forged for powerful cleaving.',
    });
  }

  public static createIronShield(id = 'shield-iron-1'): Item {
    return new Item({
      id,
      name: 'Iron Tower Shield',
      value: 12000,
      unidentifiedName: 'Large Iron Shield',
      category: 'shield',
      slot: 'offHand',
      weight: 5000,
      bulk: 4500,
      stats: { defenseBonus: 6 },
      identified: true,
      description: 'A massive iron shield offering substantial missile and melee deflection.',
    });
  }

  public static createTorch(id = 'torch-1'): Item {
    return new Item({
      id,
      name: 'Wooden Torch',
      value: 500,
      unidentifiedName: 'Torch',
      category: 'misc',
      weight: 800,
      bulk: 600,
      identified: true,
      description: 'Pitch-soaked wooden branch providing essential light in subterranean depths.',
    });
  }

  public static createRations(id = 'rations-1'): Item {
    return new Item({
      id,
      name: 'Iron Rations',
      value: 1000,
      unidentifiedName: 'Travel Rations',
      category: 'consumable',
      weight: 500,
      bulk: 400,
      identified: true,
      description: 'Dried salted meats and hard bread, hearty sustenance for long journeys.',
    });
  }

  public static createLockpicks(id = 'lockpicks-1'): Item {
    return new Item({
      id,
      name: 'Thief Lockpicks',
      value: 2500,
      unidentifiedName: 'Slender Metal Picks',
      category: 'misc',
      weight: 200,
      bulk: 100,
      identified: true,
      description: 'Delicate tempered steel tension tools for bypassing locked chests and gates.',
    });
  }

  public static createCurePoisonPotion(id = 'pot-cure-1'): PotionItem {
    return new PotionItem({
      id,
      name: 'Antidote Potion',
      value: 4000,
      unidentifiedName: 'Emerald Potion',
      potionType: 'health',
      potency: 10,
      weight: 350,
      bulk: 200,
      identified: true,
      description: 'An herbal tincture that neutralizes toxic venoms and cleanses the blood.',
    });
  }

  public static createGoldCoins(id = 'coins-1', amount = 100): Item {
    return new Item({
      id,
      name: `${amount} Gold Coins`,
      unidentifiedName: 'Pile of Coins',
      category: 'currency',
      weight: amount * 10,
      bulk: Math.max(1, Math.ceil(amount * 0.5)),
      identified: true,
      description: 'Brightly minted gold coins (100 CP value).',
    });
  }

  public static createCopperCoins(id = 'coins-cp-1', amount = 100): Item {
    return new Item({
      id,
      name: `${amount} Copper Pieces`,
      unidentifiedName: 'Pile of Copper Coins',
      category: 'currency',
      weight: amount * 10,
      bulk: Math.max(1, Math.ceil(amount * 0.5)),
      identified: true,
      description: 'Heavy reddish copper coins common among tradesfolk (1 CP value).',
    });
  }

  public static createSilverCoins(id = 'coins-sp-1', amount = 100): Item {
    return new Item({
      id,
      name: `${amount} Silver Pieces`,
      unidentifiedName: 'Pile of Silver Coins',
      category: 'currency',
      weight: amount * 10,
      bulk: Math.max(1, Math.ceil(amount * 0.5)),
      identified: true,
      description: 'Gleaming silver pieces of fine mint (10 CP value).',
    });
  }

  public static createPlatinumCoins(id = 'coins-pp-1', amount = 10): Item {
    return new Item({
      id,
      name: `${amount} Platinum Pieces`,
      unidentifiedName: 'Gleaming White Coins',
      category: 'currency',
      weight: amount * 10,
      bulk: Math.max(1, Math.ceil(amount * 0.5)),
      identified: true,
      description: 'Exceedingly rare and valuable platinum coins of royal mint (1000 CP value).',
    });
  }

  public static createTravelBread(id = 'bread-1'): Item {
    return new Item({
      id,
      name: 'Travel Bread',
      unidentifiedName: 'Hard Loaf',
      category: 'misc',
      weight: 250,
      bulk: 300,
      identified: true,
      description: 'A hearty loaf of dense hearth bread baked for treacherous dungeon treks.',
    });
  }

  public static createQuestRelic(id = 'quest-relic', name = 'Quest Relic', description = 'An ancient relic of great power.'): Item {
    return new Item({
      id,
      name,
      unidentifiedName: 'Radiant Artifact',
      category: 'quest',
      weight: 500,
      bulk: 200,
      quality: 'artifact',
      identified: true,
      description,
    });
  }

  /**
   * A generic reward trinket a merchant can gate behind a `Predicate` (e.g. a
   * `minCounter` renown threshold — see `renown/renownLedger.ts`). Deliberately
   * campaign-agnostic: content chooses the name, description, stat bonus, and
   * predicate; the engine only owns the mechanism.
   */
  public static createRenownCharm(config: {
    id: string;
    name: string;
    description: string;
    unidentifiedName?: string;
    stats?: ItemStatModifiers;
    predicate?: Predicate;
  }): Item {
    return new Item({
      id: config.id,
      name: config.name,
      unidentifiedName: config.unidentifiedName ?? 'Engraved Charm',
      category: 'amulet',
      slot: 'neck',
      weight: 40,
      bulk: 20,
      stats: config.stats,
      identified: true,
      description: config.description,
      predicate: config.predicate,
    });
  }
}
