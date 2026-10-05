import type { TileType, TileZoneBand } from '../../engine';
import type { Entity } from '../../engine';
import { Player } from '../../engine';
import { NPC } from '../../engine';
import { Monster } from '../../engine';
import type { Item, MonsterDefinition, SpriteTagRule } from '../../engine';
import type { SpriteKey } from './types';
import { ATLAS_MAP } from './sprite-atlas';

/**
 * Town and zone variants (`floor_town_shop`, `wall_frost`, …) are used only when the pack
 * draws them (`hasRecipe`); otherwise the pack's base floor/wall stands in, so a pack with
 * a small sprite set never shows unpainted cells.
 */
export function getTerrainSpriteKey(
  tileType: TileType,
  currentFloor?: number,
  zoneBands?: TileZoneBand[],
  buildingType?: string,
  hasRecipe: (key: string) => boolean = (key) => key in ATLAS_MAP
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
      if (hasRecipe(buildingKey)) {
        return buildingKey;
      }
      const townBase = `${baseKey}_town` as SpriteKey;
      if (hasRecipe(townBase)) {
        return townBase;
      }
    } else {
      // Exterior town ground / border walls
      if (baseKey === 'floor') {
        const outdoorKey: SpriteKey = 'floor_town_outdoor';
        if (hasRecipe(outdoorKey)) {
          return outdoorKey;
        }
      }
      const townBase = `${baseKey}_town` as SpriteKey;
      if (hasRecipe(townBase)) {
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
      if (hasRecipe(candidateKey)) {
        return candidateKey;
      }
    }
  }

  return baseKey;
}


/**
 * Built-in archetype rules, generic across packs. A pack's own creatures come first via
 * `atlas.spriteTagRules` (see getEntitySpriteKey).
 */
export const DEFAULT_TAG_SPRITE_ORDER: Array<{ tag: string; spriteKey: SpriteKey }> = [
  // Bosses & Unique Legends
  { tag: 'boss', spriteKey: 'giant_boss' },
  { tag: 'miniboss', spriteKey: 'giant_boss' },

  // Monstrous Specifics — elder variants checked first so a shared 'dragon'/'wyrm'
  // tag on a late-game monster doesn't collapse it onto the early-game look.
  { tag: 'dragon_elder', spriteKey: 'dragon_elder' },
  { tag: 'dragon', spriteKey: 'dragon' },
  { tag: 'wyrm', spriteKey: 'wyrm' },
  { tag: 'aberration', spriteKey: 'aberration' },
  { tag: 'shadow', spriteKey: 'shadow' },
  { tag: 'fiend', spriteKey: 'fiend' },

  // Undead & Spectral Specifics — 'ghost' and 'bound_spirit' checked before the
  // broader 'spirit'/'undead' fallbacks they'd otherwise collapse into.
  { tag: 'wraith', spriteKey: 'wraith' },
  { tag: 'wight', spriteKey: 'wight' },
  { tag: 'zombie', spriteKey: 'zombie' },
  { tag: 'spectral', spriteKey: 'spectral' },
  { tag: 'ghost', spriteKey: 'ghost' },
  { tag: 'bound_spirit', spriteKey: 'bound_spirit' },
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
  { tag: 'sorcerer', spriteKey: 'sorcerer' },
  { tag: 'zealot', spriteKey: 'zealot' },
  { tag: 'cultist', spriteKey: 'cultist' },
  { tag: 'troll', spriteKey: 'troll' },
  { tag: 'fire_giant', spriteKey: 'giant_fire' },
  { tag: 'giant', spriteKey: 'giant' },
  { tag: 'goblinoid', spriteKey: 'kobold' },

  // Broad Archetype Fallbacks
  { tag: 'undead', spriteKey: 'skeleton' },
  { tag: 'hazard', spriteKey: 'construct' },
  { tag: 'beast', spriteKey: 'wolf' },
  { tag: 'vermin', spriteKey: 'giant_rat' },
  { tag: 'humanoid', spriteKey: 'orc' },
];

/** Tells the mapper which sprite keys the atlas holds (built-ins plus pack recipes). */
type HasSprite = (key: string) => boolean;

/**
 * A pack gives a monster its own art by keying a sprite recipe with the monster's
 * definition ID; otherwise the pack's `spriteTagRules`, then the built-in tag rules and
 * name heuristics, pick a shared archetype sprite.
 */
export function getEntitySpriteKey(
  entity: Entity,
  hasSprite?: HasSprite,
  packTagRules: readonly SpriteTagRule[] = []
): SpriteKey | string {
  if (entity instanceof Player) {
    return entity.gender === 'female' ? 'player_female' : 'player';
  }

  if (entity instanceof NPC) {
    // A pack recipe keyed by the NPC's id is that NPC's art, as a definition id is a monster's.
    if (hasSprite?.(entity.id)) return entity.id;
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

  return creatureSpriteKey(
    { definitionId: entity instanceof Monster ? entity.definitionId : undefined, name: entity.name, tags: entity.tags },
    hasSprite,
    packTagRules
  );
}

/** What picks a creature's sprite: its definition, name and tags. */
interface CreatureLooks {
  definitionId?: string;
  name: string;
  tags?: readonly string[];
}

/**
 * A creature's sprite from its definition alone (the bestiary's picture, tracker 4.2): the
 * same key a spawned monster of that definition draws with on the map.
 */
export function getMonsterDefinitionSpriteKey(
  def: MonsterDefinition,
  hasSprite?: HasSprite,
  packTagRules: readonly SpriteTagRule[] = []
): SpriteKey | string {
  return creatureSpriteKey({ definitionId: def.id, name: def.name, tags: def.tags }, hasSprite, packTagRules);
}

function creatureSpriteKey(looks: CreatureLooks, hasSprite: HasSprite | undefined, packTagRules: readonly SpriteTagRule[]): SpriteKey | string {
  const name = looks.name.toLowerCase();

  if (looks.definitionId && hasSprite?.(looks.definitionId)) {
    return looks.definitionId;
  }

  // Tag-priority resolution (dragon > undead > construct > beast > humanoid)
  const tags: readonly string[] = looks.tags ?? [];
  for (const rule of [...packTagRules, ...DEFAULT_TAG_SPRITE_ORDER]) {
    if (tags.includes(rule.tag)) {
      return rule.spriteKey;
    }
  }

  // Name / ID fallbacks for legacy or untagged entities
  if (name.includes('skeleton')) {
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

/** As for monsters, a pack recipe keyed by the item's definition ID wins over the heuristics. */
export function getItemSpriteKey(item: Item, hasSprite?: HasSprite): SpriteKey | string {
  const name = item.name.toLowerCase();
  const id = item.id || '';
  const defId = (item.definitionId || '').toLowerCase();

  if (defId && hasSprite?.(defId)) {
    return defId;
  }

  // Unique / Plot items
  if (name.includes('rune of return') || id.includes('rune_of_return') || name.includes('rune stone') || id.includes('rune_stone')) {
    return 'rune_stone';
  }
  if (name.includes('bread') || id.includes('bread')) {
    return 'travel_bread';
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

    case 'light':
      return 'torch';

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

