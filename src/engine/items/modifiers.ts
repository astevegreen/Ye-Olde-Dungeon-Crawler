import type { ItemStatModifiers } from './item';

export type ModifierAlignment = 'positive' | 'negative' | 'chaotic';

export type ModifierCategory =
  | 'blessed'
  | 'enchanted'
  | 'holy'
  | 'cursed'
  | 'hexed'
  | 'unholy'
  | 'chaotic';

/** Extra melee damage against a defender that answers to `tag` (`Entity.hasTag`). */
export interface TagCombatBonus {
  tag: string;
  multiplier: number;
  flatBonus: number;
  /** The attacker heals this share of the damage dealt (Hel-touched: a fifth). */
  healPercentOfDamage?: number;
  message?: string;
}

export interface ItemModifier {
  id: string;
  name: string;
  alignment: ModifierAlignment;
  category: ModifierCategory;
  prefix?: string;
  suffix?: string;
  /** While worn, the item stays on until a cleansing takes this modifier off it. */
  binds?: boolean;
  statDeltas?: ItemStatModifiers;
  meleeDamageMultiplier?: number;
  meleeDamageFlatBonus?: number;
  spellDamageMultiplier?: number;
  manaCostDiscount?: number;
  damageTakenMultiplier?: number;
  damageTakenFlatBonus?: number;
  tagBonuses?: TagCombatBonus[];
  /** Damage the bearer takes on stepping onto, or striking from, sacred ground (`isSacredGround`). */
  sacredGroundBurn?: number;
  /** While worn, the temple serves the bearer only to cleanse, at double the price. */
  templeShunned?: boolean;

  // ── Rule-benders (the Chaotic family, Q22). Each is read in one place. ──
  /** A damaging spell the bearer casts takes a random element of the pack's (`CastSpellAction`). */
  randomSpellElement?: boolean;
  /** Each kill heals the bearer this share of max HP (`DeathResolver`). */
  killHealPercent?: number;
  /** The bearer cannot rest while this is worn (`AutoRestManager.restRefusal`). */
  forbidsRest?: boolean;
  /** Melee attacks strike this many more times; each strike that misses costs `missSelfDamage` HP. */
  extraMeleeStrikes?: number;
  missSelfDamage?: number;
  /** Chance a melee blow against the bearer misses outright (0–1). */
  evasionBonus?: number;
  /** Every Nth step the bearer takes blinks it `blinkRange` tiles away (`MovementAction`). */
  blinkEverySteps?: number;
  blinkRange?: [number, number];
  /** Each melee blow the bearer lands is scaled by a uniform roll in this range (Fickle Fortune: 0–2.5). */
  meleeDamageRoll?: [number, number];
  /** A cast short of mana accrues no debt, and rolls its surge this many tiers up (`ManaOverflowManager`). */
  overflowNoDebt?: boolean;
  overflowTierShift?: number;
  /** The highest tier `overflowTierShift` lifts a surge to; a surge already above it stays where it is. */
  overflowTierShiftCap?: number;
  /** This share of a melee blow the bearer takes is dealt back to the attacker. */
  reflectMeleePercent?: number;
  /** Healing the bearer receives is scaled by this (`Actor.heal`). */
  healingReceivedMultiplier?: number;
  // ── Perk effects (tracker 3.6), in the same vocabulary; each read in one place. ──
  /** Replaces `meleeDamageMultiplier` while the attacker is at or below half health (Berserkergang). */
  belowHalfHpMeleeMultiplier?: number;
  /** Scales a spell's mana cost before any flat discount (Seiðr-Woven: 0.8). */
  manaCostMultiplier?: number;
  /** Scales how far a search and a step's passive perception reach (Wayfarer: 2). */
  perceptionRadiusMultiplier?: number;
  /** Scales melee damage the bearer takes, after mitigation (Shield-Wall: 0.85). */
  meleeDamageTakenMultiplier?: number;
  /** The bearer is never knocked back (Shield-Wall). */
  impulseImmune?: boolean;
  /** Each kill restores this share of the killer's max mana (Spell-Thief: 0.1). */
  killManaPercent?: number;
  /** Scales how much overflow debt a rest turn clears (Spell-Thief: 2). */
  overflowDebtDecayMultiplier?: number;
  /** Scales the Strength the bearer carries with (Ox-Shoulders: 1.5; `Player.carryStrength`). */
  carryMultiplier?: number;
  /** Extra tiles the bearer's knock-backs throw a foe (Ox-Shoulders: 1; `applyImpulse`). */
  knockbackBonus?: number;
  /** A status the bearer's melee hits may leave on the foe (Bone-Breaker: slow, a turn, one hit in four). */
  onHitStatus?: { status: string; chance: number; duration: number; potency?: number };
  /** Percentage points added to the bearer's ranged hit chance (Sure Shot: 15). */
  rangedHitBonus?: number;
  /** Flat damage added to the bearer's ranged hits (Sure Shot: 2). */
  rangedDamageBonus?: number;
  /** These afflictions last the bearer a share of their length (Iron Stomach: poison and burning, half). */
  shortenedAfflictions?: { types: string[]; multiplier: number };
  /** Taking the stairs identifies every unidentified item the bearer has carried since the last stairs (Lore-Keeper). */
  identifiesCarriedOnStairs?: boolean;
  /** Tiles added to the hero's sight radius (Wayfarer: 1; `Player.sightBonus`, read by `GameEngine.updateFov`; ADR-0013). */
  sightBonus?: number;
  /** Each melee attack strikes once more for this share of a blow (Twin Fangs: 0.5; `MeleeAttackAction`). */
  followUpStrikeShare?: number;
  /** Spells' damage of this element is scaled (Elementalist: +30%; `SpellPipeline.applyDamageEffect`). */
  elementSpellMultiplier?: { element: string; multiplier: number };
  /** The bearer resists these elements: neutral becomes resisted, a weakness neutral (Elementalist; `Actor.affinityTo`). */
  resistsElements?: string[];
  /** Each grimoire neighbor synergy counts this many more times (Galdr-Master: 1; `resolveEffectiveSpellDetailed`). */
  grimoireSynergyRepeats?: number;
  /** Added to the chance a melee blow is a critical (Thor's Wrath: 0.25; `MeleeAttackAction`). */
  critChanceBonus?: number;
  /** A critical's multiplier, when higher than the pack's (Thor's Wrath: 2). */
  critMultiplier?: number;
  /** The hero's companion has this much more max HP and attack, once, for good (Beast-Friend: 1.5; `bondCompanion`). */
  companionStatMultiplier?: number;
  /** Once each floor visit, the hero's fallen companion rises at full health (Beast-Friend; `refusesDeath`). */
  companionRisesPerFloor?: boolean;
  /** Once each floor visit, a blow that would kill the hero leaves it at 1 HP (Einherjar; `refusesDeath`). */
  lastStandPerFloor?: boolean;
  /** The hero senses every monster on the floor through walls (Odin's Eye; `sensesThroughWalls`). */
  sensesAllMonsters?: boolean;
  /** Tiles added to the range of the hero's spells (Odin's Eye: 2; `withSpellRangeBonus`). */
  spellRangeBonus?: number;
  /** A share of the defender's defense the bearer's melee ignores, beside Anatomist's half (Sunder: 0.25). */
  defensePenetration?: number;
  /** The bearer may hold a shield beside a two-handed weapon (Giant's Grip; `Paperdoll.shieldBesideTwoHanded`). */
  shieldWithTwoHanded?: boolean;
  /** Evading a melee blow strikes the attacker back, free (Riposte). */
  ripostesOnEvade?: boolean;
  /** Evading a melee blow blinks the bearer up to this many tiles, if there is room (Shadow-Step: 1). */
  evadeBlinkRange?: number;
  /** Evasion per point of Intelligence above the baseline (Mind over Matter: 0.01). */
  evasionPerIntelligence?: number;
  /** Traps never trigger under the bearer (Trap-Dancer; `TrapInstance.trigger`). */
  trapImmune?: boolean;
  /** Scales the HP a rest turn heals (Second Wind: 2; `AutoRestManager.recoverRestTurn`). */
  restHealMultiplier?: number;
  /** Statuses that never take hold on the hero; added to `statusImmunities` when a perk is granted (Stalwart). */
  grantsStatusImmunities?: string[];
  /** Hops added to the bearer's chain spells (Chain-Weaver: 1). */
  chainExtraHops?: number;
  /** Scales the first spell damage to hit the hero on each floor visit (Warding Glyph: 0.5). */
  firstSpellPerFloorMultiplier?: number;
  /** A share added to the hero's max HP (Mountain's Root: 0.15, Juggernaut: 0.25; `Player.wornMaxHpPercent`). */
  maxHpPercent?: number;
  /** A level-up heals HP and mana in full (Undying). */
  levelUpFullHeal?: boolean;
  // ── Effects of the family perks (tracker 3.6); scoped to a family by `familyModifiers`. ──
  /** A landed melee blow knocks the foe back this many tiles (Giant-Bane: 1). */
  meleeKnockback?: number;
  /** The hero senses monsters within this many tiles through walls (Pack-Sense: 10; `sensesThroughWalls`). */
  sensesWithin?: number;
  /** Scales the coins a kill drops (Reaver: 1.5). */
  coinMultiplier?: number;
  /** Scales the XP a kill gives (Iron Will: 1.5). */
  xpMultiplier?: number;
  /** The chance a foe's affliction on the hero is shrugged off (Spirit-Ward: 0.5). */
  afflictionShrugChance?: number;
  /** Turns of warning added to a foe's wind-up (Wyrm-Bane: 1; `WindUpDeclareAction`). */
  windUpWarningBonus?: number;
  /** Scales the damage a foe's wind-up (a breath, a slam) deals the hero (Wyrm-Bane: 0.5; `WindUpExecuteAction`). */
  windUpDamageTakenMultiplier?: number;
  /** A sleeping monster farther than this many tiles does not wake on seeing the hero (Shadow-Walker: 4; Reaver against folk: 5; `wakesOnSight`). */
  wakeRadius?: number;
  description?: string;
}

export function isModifierCursed(mod: ItemModifier): boolean {
  return mod.category === 'cursed';
}

/** A worn item with a binding modifier cannot be taken off until it is cleansed. */
export function isModifierBinding(mod: ItemModifier): boolean {
  return mod.binds === true;
}

export function isModifierBlessed(mod: ItemModifier): boolean {
  return mod.category === 'blessed';
}

export function isModifierChaotic(mod: ItemModifier): boolean {
  return mod.category === 'chaotic';
}

export function isModifierHexed(mod: ItemModifier): boolean {
  return mod.category === 'hexed';
}

export function isModifierUnholy(mod: ItemModifier): boolean {
  return mod.category === 'unholy';
}

export function isModifierHoly(mod: ItemModifier): boolean {
  return mod.category === 'holy';
}

/** The Enchanted family only: `Item.isEnchanted()` also counts +N and elemental affixes. */
export function isModifierEnchantedCategory(mod: ItemModifier): boolean {
  return mod.category === 'enchanted';
}
