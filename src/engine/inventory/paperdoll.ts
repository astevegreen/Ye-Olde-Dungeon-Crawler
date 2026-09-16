import { Item, type EquipmentSlot, type ItemCategory } from '../items/item';
import { itemIndex } from '../items/itemIndex';

export interface EquipmentStats {
  attackBonus: number;
  defenseBonus: number; // Armor Value (AV)
  speedBonus: number;
  strengthBonus: number;
}

export interface EquipmentSlotLayout {
  x: number;
  y: number;
  width?: number;
  height?: number;
  gridArea?: string;
}

export interface EquipmentSlotDefinition {
  id: EquipmentSlot;
  name: string;
  acceptedCategories: ItemCategory[];
  blocksSlot?: string;
  iconCoord?: { col: number; row: number };
  layout?: EquipmentSlotLayout;
}

export const DEFAULT_EQUIPMENT_SLOTS: EquipmentSlotDefinition[] = [
  { id: 'head', name: 'Head', acceptedCategories: ['helmet', 'armor'], layout: { x: 93, y: 16, width: 34, height: 34, gridArea: 'head' } },
  { id: 'neck', name: 'Neck', acceptedCategories: ['amulet'], layout: { x: 93, y: 58, width: 34, height: 34, gridArea: 'neck' } },
  { id: 'torso', name: 'Torso', acceptedCategories: ['armor'], layout: { x: 93, y: 104, width: 34, height: 34, gridArea: 'torso' } },
  { id: 'overgarment', name: 'Overgarment', acceptedCategories: ['cloak'], layout: { x: 48, y: 58, width: 34, height: 34, gridArea: 'overgarment' } },
  { id: 'mainHand', name: 'Main Hand', acceptedCategories: ['weapon'], layout: { x: 34, y: 110, width: 34, height: 34, gridArea: 'mainHand' } },
  { id: 'offHand', name: 'Off Hand', acceptedCategories: ['shield', 'weapon'], layout: { x: 152, y: 110, width: 34, height: 34, gridArea: 'offHand' } },
  { id: 'hands', name: 'Hands', acceptedCategories: ['gauntlets'], layout: { x: 20, y: 162, width: 34, height: 34, gridArea: 'hands' } },
  { id: 'wrists', name: 'Wrists', acceptedCategories: ['bracers'], layout: { x: 166, y: 162, width: 34, height: 34, gridArea: 'wrists' } },
  { id: 'waist', name: 'Waist', acceptedCategories: ['container'], layout: { x: 93, y: 154, width: 34, height: 34, gridArea: 'waist' } },
  { id: 'feet', name: 'Feet', acceptedCategories: ['boots'], layout: { x: 93, y: 270, width: 34, height: 34, gridArea: 'feet' } },
  { id: 'fingerLeft', name: 'Left Finger', acceptedCategories: ['ring'], layout: { x: 58, y: 162, width: 34, height: 34, gridArea: 'fingerLeft' } },
  { id: 'fingerRight', name: 'Right Finger', acceptedCategories: ['ring'], layout: { x: 128, y: 162, width: 34, height: 34, gridArea: 'fingerRight' } },
  { id: 'pack', name: 'Pack', acceptedCategories: ['container'], layout: { x: 34, y: 224, width: 34, height: 34, gridArea: 'pack' } },
  { id: 'purse', name: 'Purse', acceptedCategories: ['container'], layout: { x: 152, y: 224, width: 34, height: 34, gridArea: 'purse' } },
];

export interface EquipResult {
  success: boolean;
  unequippedItem: Item | null;
  unequippedItems?: Item[];
  reason?: string;
}

export class Paperdoll {
  private slots: Map<EquipmentSlot, Item | null>;
  private slotDefinitions: Map<EquipmentSlot, EquipmentSlotDefinition>;
  private orderedSlotDefinitions: EquipmentSlotDefinition[];

  constructor(customSlots?: EquipmentSlotDefinition[]) {
    this.orderedSlotDefinitions = customSlots ? [...customSlots] : [...DEFAULT_EQUIPMENT_SLOTS];
    this.slotDefinitions = new Map();
    this.slots = new Map();

    for (const def of this.orderedSlotDefinitions) {
      this.slotDefinitions.set(def.id, def);
      this.slots.set(def.id, null);
    }
  }

  public getSlotDefinitions(): EquipmentSlotDefinition[] {
    return [...this.orderedSlotDefinitions];
  }

  public getSlotDefinition(slotId: EquipmentSlot): EquipmentSlotDefinition | undefined {
    return this.slotDefinitions.get(slotId);
  }

  public getItem(slot: EquipmentSlot): Item | null {
    return this.slots.get(slot) ?? null;
  }

  public getAllEquipped(): Array<{ slot: EquipmentSlot; item: Item }> {
    const equipped: Array<{ slot: EquipmentSlot; item: Item }> = [];
    for (const [slot, item] of this.slots.entries()) {
      if (item !== null) {
        equipped.push({ slot, item });
      }
    }
    return equipped;
  }

  public getEquippedItems(): Item[] {
    return this.getAllEquipped().map((e) => e.item);
  }

  public isSlotBlocked(slotId: EquipmentSlot): boolean {
    for (const [equippedSlot, item] of this.slots.entries()) {
      if (!item) continue;
      if (item.blocksSlot === slotId) {
        return true;
      }
      if (item.twoHanded && equippedSlot === 'mainHand' && slotId === 'offHand') {
        return true;
      }
    }
    return false;
  }

  public canEquip(item: Item, targetSlot?: EquipmentSlot): { allowed: boolean; slot?: EquipmentSlot; reason?: string } {
    let slot = targetSlot ?? item.slot;

    // If item has no designated slot and no targetSlot given, try to find first matching slot
    if (!slot) {
      for (const def of this.orderedSlotDefinitions) {
        if (def.acceptedCategories.includes(item.category)) {
          slot = def.id;
          break;
        }
      }
    }

    if (!slot || !this.slots.has(slot)) {
      return { allowed: false, reason: `${item.name} cannot be equipped into any valid slot.` };
    }

    // Check if slot is blocked by another equipped item (e.g. 2H weapon)
    if (this.isSlotBlocked(slot)) {
      const slotDef = this.slotDefinitions.get(slot);
      return {
        allowed: false,
        reason: `The ${slotDef?.name ?? slot} slot is blocked by another equipped item.`,
      };
    }

    // Check slot compatibility
    const slotDef = this.slotDefinitions.get(slot);
    const isRing = item.category === 'ring' && (slot === 'fingerLeft' || slot === 'fingerRight');
    if (slotDef && slotDef.acceptedCategories && slotDef.acceptedCategories.length > 0) {
      if (!isRing && !slotDef.acceptedCategories.includes(item.category)) {
        return { allowed: false, reason: `${item.name} cannot be equipped in the ${slotDef.name} slot.` };
      }
    } else if (item.slot && item.slot !== slot && !isRing) {
      return { allowed: false, reason: `${item.name} cannot be equipped in the ${slotDef?.name ?? slot} slot.` };
    }

    // If item blocks another slot (e.g. 2H weapon blocking offHand), check if that slot has a cursed item
    const blockedSlot = (item.blocksSlot ?? (item.twoHanded && slot === 'mainHand' ? 'offHand' : undefined)) as EquipmentSlot | undefined;
    if (blockedSlot && this.slots.has(blockedSlot)) {
      const blockedItem = this.getItem(blockedSlot);
      if (blockedItem && blockedItem.isCursed()) {
        return {
          allowed: false,
          reason: `Cannot equip ${item.name} because the cursed item ${blockedItem.name} in ${blockedSlot} cannot be removed!`,
        };
      }
    }

    // Check if existing item in slot is cursed (cannot be replaced/unequipped)
    const currentItem = this.getItem(slot);
    if (currentItem && currentItem.isCursed()) {
      return {
        allowed: false,
        reason: `Cannot replace ${currentItem.name} because it is cursed and bound to you!`,
      };
    }

    return { allowed: true, slot };
  }

  public equip(item: Item, targetSlot?: EquipmentSlot): EquipResult {
    const check = this.canEquip(item, targetSlot);
    if (!check.allowed || !check.slot) {
      return { success: false, unequippedItem: null, reason: check.reason };
    }

    const slot = check.slot;
    const previousItem = this.getItem(slot);
    const unequippedItems: Item[] = [];

    if (previousItem) {
      unequippedItems.push(previousItem);
    }

    // If this item blocks another slot (e.g. twoHanded weapon in mainHand blocking offHand)
    const blockedSlot = (item.blocksSlot ?? (item.twoHanded && slot === 'mainHand' ? 'offHand' : undefined)) as EquipmentSlot | undefined;
    if (blockedSlot && this.slots.has(blockedSlot)) {
      const blockedItem = this.getItem(blockedSlot);
      if (blockedItem) {
        this.slots.set(blockedSlot, null);
        unequippedItems.push(blockedItem);
      }
    }

    this.slots.set(slot, item);
    itemIndex.register(item, { kind: 'equipped', ownerId: item.ownerId ?? 'unknown', slot });
    return {
      success: true,
      unequippedItem: previousItem ?? (unequippedItems[0] ?? null),
      unequippedItems,
    };
  }

  public canUnequip(slot: EquipmentSlot): { allowed: boolean; reason?: string } {
    const item = this.getItem(slot);
    if (!item) {
      return { allowed: false, reason: `No item equipped in ${slot} slot.` };
    }

    if (item.isCursed()) {
      return {
        allowed: false,
        reason: `${item.name} is cursed and bound to your flesh! You cannot remove it.`,
      };
    }

    return { allowed: true };
  }

  public unequip(slot: EquipmentSlot): { success: boolean; item: Item | null; reason?: string } {
    const check = this.canUnequip(slot);
    if (!check.allowed) {
      return { success: false, item: null, reason: check.reason };
    }

    const item = this.getItem(slot);
    this.slots.set(slot, null);
    if (item) itemIndex.unregister(item.id);
    return { success: true, item };
  }

  public calculateStats(): EquipmentStats {
    let attackBonus = 0;
    let defenseBonus = 0;
    let speedBonus = 0;
    let strengthBonus = 0;

  
    for (const item of this.slots.values()) {
      if (item !== null) {
        const stats = item.effectiveStats ?? item.stats;
        attackBonus += stats?.attackBonus ?? 0;
        defenseBonus += stats?.defenseBonus ?? 0;
        speedBonus += stats?.speedBonus ?? 0;
        strengthBonus += stats?.strengthBonus ?? 0;
      }
    }

    return { attackBonus, defenseBonus, speedBonus, strengthBonus };
  }

  public totalWeight(): number {
    let weight = 0;
    for (const item of this.slots.values()) {
      if (item !== null) {
        weight += typeof item.totalWeight === 'function' ? item.totalWeight() : (item.weight ?? 0);
      }
    }
    return weight;
  }
}
