import type { TileType } from '../../engine/types';
import type { Entity } from '../../engine/entities/entity';
import { Player } from '../../engine/entities/player';
import { NPC } from '../../engine/entities/npc';
import { Monster } from '../../engine/entities/monster';
import type { Item } from '../../engine/items/item';
import type { SpriteKey } from './types';

export function getTerrainSpriteKey(tileType: TileType): SpriteKey {
  switch (tileType) {
    case 'wall':
    case 'secret_door':
      return 'wall';
    case 'trap':
      return 'trap';
    case 'floor':
      return 'floor';
    case 'door_closed':
      return 'door_closed';
    case 'door_open':
      return 'door_open';
    case 'stairs_up':
      return 'stairs_up';
    case 'stairs_down':
      return 'stairs_down';
    default:
      return 'floor';
  }
}

export function getEntitySpriteKey(entity: Entity): SpriteKey {
  if (entity instanceof Player) {
    return entity.gender === 'female' ? 'player_female' : 'player';
  }

  if (entity instanceof NPC) {
    const role = entity.role;
    switch (role) {
      case 'merchant':
        return 'shopkeeper';
      case 'priest':
        return 'priest';
      case 'sage':
        return 'sage';
      case 'banker':
        return 'banker';
      case 'guard':
        return 'guard';
      default:
        return 'townsperson';
    }
  }

  const name = entity.name.toLowerCase();
  const id = entity instanceof Monster ? entity.definitionId : entity.id;
  if (name.includes('hrungnir') || name.includes('chieftain') || id === 'boss_hrungnir') {
    return 'giant_boss';
  }
  if (name.includes('skeleton') || name.includes('draugr')) {
    return 'skeleton';
  }
  if (name.includes('rat') || name.includes('wolf')) {
    return 'giant_rat';
  }
  if (name.includes('orc') || name.includes('ogre') || name.includes('giant')) {
    return 'orc';
  }
  if (name.includes('kobold') || name.includes('goblin') || name.includes('shaman')) {
    return 'kobold';
  }
  return 'kobold';
}

export function getItemSpriteKey(item: Item): SpriteKey {
  const name = item.name.toLowerCase();
  const id = item.id || '';

  if (name.includes('sun-stone') || name.includes('sun stone') || id.includes('sun_stone')) {
    return 'sun_stone';
  }
  if (name.includes('bread') || id.includes('bread')) {
    return 'travel_bread';
  }
  if (name.includes('broadsword') || name.includes('sword') || name.includes('blade')) {
    return 'broadsword';
  }
  if (name.includes('dagger')) {
    return 'dagger';
  }
  if (name.includes('mace')) {
    return 'cursed_mace';
  }
  if (name.includes('chest')) {
    return 'chest';
  }
  if (name.includes('belt')) {
    return 'belt';
  }
  if (name.includes('purse')) {
    return 'purse';
  }
  if (name.includes('pack') || name.includes('bag')) {
    return 'backpack';
  }
  if (name.includes('potion')) {
    return 'health_potion';
  }
  if (name.includes('coin')) {
    return 'gold_coins';
  }
  if (name.includes('leather') || name.includes('chainmail')) {
    return 'leather_armor';
  }

  switch (item.category) {
    case 'weapon':
      return 'broadsword';
    case 'armor':
      return 'leather_armor';
    case 'shield':
      return 'wooden_shield';
    case 'helmet':
      return 'helmet';
    case 'boots':
      return 'boots';
    case 'consumable':
      return 'health_potion';
    case 'currency':
      return 'gold_coins';
    case 'container':
      return 'backpack';
    default:
      return 'dagger';
  }
}
