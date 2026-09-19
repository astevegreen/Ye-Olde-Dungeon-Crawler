import type { TileType, TileZoneBand } from '../../engine';
import type { Entity } from '../../engine';
import { Player } from '../../engine';
import { NPC } from '../../engine';
import { Monster } from '../../engine';
import type { Item } from '../../engine';
import type { SpriteKey } from './types';
import { ATLAS_MAP } from './sprite-atlas';

export function getTerrainSpriteKey(
  tileType: TileType,
  currentFloor?: number,
  zoneBands?: TileZoneBand[],
  buildingType?: string
): SpriteKey {
  let baseKey: SpriteKey;
  switch (tileType) {
    case 'wall':
    case 'secret_door':
      baseKey = 'wall';
      break;
    case 'trap':
      return 'trap';
    case 'floor':
      baseKey = 'floor';
      break;
    case 'door_closed':
      return 'door_closed';
    case 'door_open':
      return 'door_open';
    case 'stairs_up':
      return 'stairs_up';
    case 'stairs_down':
      return 'stairs_down';
    default:
      baseKey = 'floor';
      break;
  }

  // Town floor (currentFloor === 0)
  if (currentFloor === 0) {
    if (buildingType) {
      const buildingKey = `${baseKey}_town_${buildingType}` as SpriteKey;
      if (buildingKey in ATLAS_MAP) {
        return buildingKey;
      }
      const townBase = `${baseKey}_town` as SpriteKey;
      if (townBase in ATLAS_MAP) {
        return townBase;
      }
    } else {
      // Exterior town ground / border walls
      if (baseKey === 'floor') {
        const snowKey = 'floor_town_snow' as SpriteKey;
        if (snowKey in ATLAS_MAP) {
          return snowKey;
        }
      }
      const townBase = `${baseKey}_town` as SpriteKey;
      if (townBase in ATLAS_MAP) {
        return townBase;
      }
    }
    return baseKey;
  }

  // Dungeon floor zone theming
  if (currentFloor !== undefined && currentFloor > 0 && zoneBands && zoneBands.length > 0) {
    let activeZoneKey = zoneBands[0]?.zoneKey;
    for (const band of zoneBands) {
      if (currentFloor >= band.floor) {
        activeZoneKey = band.zoneKey;
      } else {
        break;
      }
    }
    if (activeZoneKey) {
      const candidateKey = `${baseKey}_${activeZoneKey}` as SpriteKey;
      if (candidateKey in ATLAS_MAP) {
        return candidateKey;
      }
    }
  }

  return baseKey;
}


export const DEFAULT_TAG_SPRITE_ORDER: Array<{ tag: string; spriteKey: SpriteKey }> = [
  // Bosses & Unique Legends
  { tag: 'boss', spriteKey: 'giant_boss' },
  { tag: 'miniboss', spriteKey: 'giant_boss' },

  // Monstrous Specifics
  { tag: 'dragon', spriteKey: 'dragon' },
  { tag: 'wyrm', spriteKey: 'wyrm' },
  { tag: 'aberration', spriteKey: 'aberration' },
  { tag: 'fiend', spriteKey: 'fiend' },

  // Undead & Spectral Specifics
  { tag: 'wraith', spriteKey: 'wraith' },
  { tag: 'draugr', spriteKey: 'draugr' },
  { tag: 'wight', spriteKey: 'wight' },
  { tag: 'zombie', spriteKey: 'zombie' },
  { tag: 'spectral', spriteKey: 'spectral' },
  { tag: 'spirit', spriteKey: 'spirit' },
  { tag: 'fae', spriteKey: 'fae' },
  { tag: 'imp', spriteKey: 'imp' },

  // Construct & Amorphous Specifics
  { tag: 'construct', spriteKey: 'construct' },
  { tag: 'amorphous', spriteKey: 'slime' },

  // Beast Specifics
  { tag: 'salamander', spriteKey: 'salamander' },
  { tag: 'hound', spriteKey: 'hound' },
  { tag: 'parasite', spriteKey: 'parasite' },
  { tag: 'insect', spriteKey: 'insect' },
  { tag: 'spider', spriteKey: 'spider' },

  // Humanoid Specifics
  { tag: 'dwarf', spriteKey: 'dwarf' },
  { tag: 'hag', spriteKey: 'hag' },
  { tag: 'zealot', spriteKey: 'zealot' },
  { tag: 'cultist', spriteKey: 'cultist' },
  { tag: 'troll', spriteKey: 'troll' },
  { tag: 'goblinoid', spriteKey: 'kobold' },

  // Broad Archetype Fallbacks
  { tag: 'undead', spriteKey: 'skeleton' },
  { tag: 'hazard', spriteKey: 'construct' },
  { tag: 'beast', spriteKey: 'wolf' },
  { tag: 'vermin', spriteKey: 'giant_rat' },
  { tag: 'humanoid', spriteKey: 'orc' },
];

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

  // Boss overrides
  if (name.includes('nidhogg') || id === 'boss_nidhogg') {
    return 'dragon_boss';
  }
  if (name.includes('hrungnir') || name.includes('chieftain') || id === 'boss_hrungnir') {
    return 'giant_boss';
  }

  // Tag-priority resolution (dragon > undead > construct > beast > humanoid)
  const tags: string[] = (entity as any).tags ?? [];
  for (const rule of DEFAULT_TAG_SPRITE_ORDER) {
    if (tags.includes(rule.tag)) {
      return rule.spriteKey;
    }
  }

  // Name / ID fallbacks for legacy or untagged entities
  if (name.includes('skeleton') || name.includes('draugr')) {
    return 'skeleton';
  }
  if (name.includes('spider')) {
    return 'spider';
  }
  if (name.includes('wolf') || name.includes('hound')) {
    return 'wolf';
  }
  if (name.includes('rat')) {
    return 'giant_rat';
  }
  if (name.includes('dragon') || name.includes('drake') || name.includes('wyrm')) {
    return 'dragon';
  }
  if (name.includes('slime') || name.includes('globule') || name.includes('ooze')) {
    return 'slime';
  }
  if (name.includes('troll')) {
    return 'troll';
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

  // Unique / Plot items
  if (name.includes('sun-stone') || name.includes('sun stone') || id.includes('sun_stone')) {
    return 'sun_stone';
  }
  if (name.includes('bread') || id.includes('bread')) {
    return 'travel_bread';
  }

  // Quality-driven overrides
  if (item.quality === 'cursed' && item.category === 'weapon') {
    return 'cursed_mace';
  }

  // Category and affix resolution
  switch (item.category) {
    case 'weapon': {
      if (name.includes('bow') || id.includes('bow')) {
        return 'bow';
      }
      if (name.includes('axe') || id.includes('axe')) {
        return 'battleaxe';
      }
      if (name.includes('hammer') || id.includes('hammer')) {
        return 'warhammer';
      }
      if (name.includes('mace') || id.includes('mace')) {
        return 'mace';
      }
      if (name.includes('dagger') || id.includes('dagger')) {
        return 'dagger';
      }
      return 'broadsword';
    }

    case 'armor': {
      if (name.includes('leather') || name.includes('robe') || name.includes('cloth')) {
        return 'leather_armor';
      }
      return 'iron_armor';
    }

    case 'shield': {
      if (name.includes('wood') || name.includes('buckler')) {
        return 'wooden_shield';
      }
      return 'iron_shield';
    }

    case 'helmet':
      return 'helmet';

    case 'boots':
      return 'boots';

    case 'gauntlets':
    case 'hands':
      return 'gauntlets';

    case 'bracers':
    case 'wrists':
      return 'bracers';

    case 'cloak':
    case 'overgarment':
      return 'cloak';

    case 'ring':
      return 'ring';

    case 'amulet':
    case 'neck':
      return 'amulet';

    case 'consumable': {
      if (name.includes('scroll') || id.includes('scroll')) {
        return 'scroll';
      }
      if (name.includes('mana') || id.includes('mana')) {
        return 'mana_potion';
      }
      return 'health_potion';
    }

    case 'currency':
      return 'gold_coins';

    case 'container': {
      if (name.includes('chest') || id.includes('chest')) {
        return 'chest';
      }
      if (name.includes('belt') || id.includes('belt')) {
        return 'belt';
      }
      if (name.includes('purse') || id.includes('purse') || name.includes('pouch')) {
        return 'purse';
      }
      return 'backpack';
    }

    case 'misc':
    case 'quest': {
      if (name.includes('key') || id.includes('key')) {
        return 'key';
      }
      if (name.includes('gem') || id.includes('gem')) {
        return 'gem';
      }
      if (name.includes('torch') || id.includes('torch')) {
        return 'torch';
      }
      return 'dagger';
    }

    default:
      return 'dagger';
  }
}

