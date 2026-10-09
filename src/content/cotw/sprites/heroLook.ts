import type { HeroGear, HeroSpriteArt, Item, PixelSprite } from '../../../engine';
import { bake } from './sculpt/kit';
import { HERO_FRAMES, heroModel, type HeroArmor, type HeroLook, type HeroOffHand, type HeroWeapon } from './sculpt/hero';

/** Weapons whose id names no kind the keywords below can find. */
const WEAPON_BY_ID: Record<string, HeroWeapon> = {
  nidhogg_fang: 'sword',
  rime_bit_chisel: 'dagger',
  duergar_slag_tongs: 'hammer',
  ironwood_bough_stave: 'staff',
};

/** First match wins, so a name with two kinds in it reads as the earlier one. */
const WEAPON_KEYWORDS: ReadonlyArray<[RegExp, HeroWeapon]> = [
  [/\b(bow|sling|crossbow)\b/, 'bow'],
  [/dagger|knife|stiletto|chisel|dirk/, 'dagger'],
  [/\b(spear|glaive|halberd|pike|lance|trident)/, 'spear'],
  [/hammer|maul|pick|tongs/, 'hammer'],
  [/sword|blade|sabre|saber|fang/, 'sword'],
  [/axe|cleaver/, 'axe'],
  [/mace|morningstar|cudgel|club|flail/, 'mace'],
  [/staff|stave|\brod\b|\bwand\b/, 'staff'],
];

/** Body armour weight bands, in grams: hide and mail shirts are light, hauberks medium, plate heavy. */
const LIGHT_MAX_G = 8000;
const MEDIUM_MAX_G = 14000;
/** A shield this heavy, or named a tower, is carried as a tower shield. */
const TOWER_MIN_G = 6000;

function weaponKind(item: Item | null): HeroWeapon {
  if (!item) return 'none';
  if (item.rangedConfig) return 'bow';
  const byId = item.definitionId ? WEAPON_BY_ID[item.definitionId] : undefined;
  if (byId) return byId;
  const words = `${item.definitionId ?? ''} ${item.name}`.toLowerCase().replace(/_/g, ' ');
  for (const [pattern, kind] of WEAPON_KEYWORDS) if (pattern.test(words)) return kind;
  return 'sword';
}

function armorBand(item: Item | null): HeroArmor {
  if (!item) return 'none';
  if (item.weight <= LIGHT_MAX_G) return 'light';
  return item.weight <= MEDIUM_MAX_G ? 'medium' : 'heavy';
}

function offHand(item: Item | null): HeroOffHand {
  if (!item) return 'none';
  if (item.category === 'light') return 'torch';
  if (item.category !== 'shield' || item.definitionId === 'sol_shard_focus') return 'none';
  const words = `${item.definitionId ?? ''} ${item.name}`.toLowerCase();
  return item.weight >= TOWER_MIN_G || words.includes('tower') ? 'tower' : 'round';
}

const ARMORS: readonly HeroArmor[] = ['none', 'light', 'medium', 'heavy'];
const WEAPONS: readonly HeroWeapon[] = ['none', 'sword', 'dagger', 'axe', 'mace', 'hammer', 'spear', 'staff', 'bow'];
const OFF_HANDS: readonly HeroOffHand[] = ['none', 'round', 'tower', 'torch'];

/** The look a gear set shows. */
export function heroLook(gear: HeroGear): HeroLook {
  return {
    g: gear.gender === 'female' ? 'f' : 'm',
    armor: armorBand(gear.equipped('torso')),
    weapon: weaponKind(gear.equipped('mainHand')),
    off: offHand(gear.equipped('offHand')),
  };
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T {
  return allowed.includes(value as T) ? (value as T) : allowed[0];
}

/** Reads a look back from its key; unknown parts fall back to bare. */
export function parseHeroLook(key: string): HeroLook {
  const [g, armor, weapon, off] = key.split('|');
  return {
    g: g === 'f' ? 'f' : 'm',
    armor: pick(armor, ARMORS),
    weapon: pick(weapon, WEAPONS),
    off: pick(off, OFF_HANDS),
  };
}

/**
 * The hero on the map wears their gear: the armour's weight band (bare, hood, spangenhelm,
 * spectacle helm), the weapon's kind and the shield or torch, sculpted and hearth-lit, idling.
 */
export const COTW_HERO_SPRITE: HeroSpriteArt = {
  lookKey(gear) {
    const look = heroLook(gear);
    return `${look.g}|${look.armor}|${look.weapon}|${look.off}`;
  },
  sprite(lookKey): PixelSprite {
    const look = parseHeroLook(lookKey);
    return { frames: HERO_FRAMES, render: (frame, size) => bake(heroModel, { frame, variant: look, px: size }) };
  },
};
