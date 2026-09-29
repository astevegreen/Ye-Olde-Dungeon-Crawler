import type { HybridRecipe, SpellDefinition } from '../../engine';

/**
 * Spells forged at Odin's Gallows-Stone by fusing a known spell with an offering of another
 * element (engine `magic.hybrids`). Hybrids are wider, not bigger: each splits its power
 * across two elements (so resistance to one never stops it) or adds a rider, at roughly
 * the stronger parent's total.
 */
const hybrid = (
  id: string,
  name: string,
  description: string,
  manaCost: number,
  element: string,
  targetingMode: 'ray' | 'bounce_ray' | 'area_burst' | 'self',
  effects: SpellDefinition['effects'],
  color: string
): SpellDefinition => ({
  id,
  name,
  school: 'Hybrid',
  manaCost,
  element,
  range: targetingMode === 'self' ? 0 : 7,
  basePower: 0,
  areaOfEffect: targetingMode === 'area_burst' ? 1 : 0,
  reflects: targetingMode === 'bounce_ray',
  targetType: targetingMode === 'self' ? 'self' : targetingMode === 'area_burst' ? 'tile' : 'ray',
  targetingMode,
  description,
  visual:
    targetingMode === 'self'
      ? { archetype: 'self_buff', color, durationMs: 200 }
      : targetingMode === 'area_burst'
        ? { archetype: 'projectile_burst', color, stepDelayMs: 26, burstRadius: 1, durationMs: 280, travelMode: 'smooth' }
        : { archetype: 'projectile', color, stepDelayMs: 22, travelMode: targetingMode === 'bounce_ray' ? 'stepped' : 'smooth' },
  effects,
});

export const COTW_HYBRID_SPELLS: SpellDefinition[] = [
  hybrid('steam_lance', 'Steam Lance', 'A scalding lance of fire and frost: 10 fire and 10 cold damage.', 9, 'fire', 'ray',
    [{ type: 'damage', amount: 10, element: 'fire' }, { type: 'damage', amount: 10, element: 'cold' }], '#e2e8f0'),
  hybrid('surtr_brand', "Surtr's Brand", 'A thunderbolt wreathed in fire that rebounds off stone: 12 lightning and 8 fire damage.', 11, 'lightning', 'bounce_ray',
    [{ type: 'damage', amount: 12, element: 'lightning' }, { type: 'damage', amount: 8, element: 'fire' }], '#fb923c'),
  hybrid('hagalaz_hail', 'Hagalaz Hail', 'A 3x3 storm of hail: 10 cold and 8 lightning damage, stunning for a turn.', 13, 'cold', 'area_burst',
    [{ type: 'damage', amount: 10, element: 'cold' }, { type: 'damage', amount: 8, element: 'lightning' }, { type: 'applyStatus', statusId: 'stunned', duration: 1 }], '#bae6fd'),
  hybrid('rune_flare', 'Rune-Flare', 'A 3x3 burst of galdr and flame: 8 arcane and 8 fire damage.', 8, 'arcane', 'area_burst',
    [{ type: 'damage', amount: 8, element: 'arcane' }, { type: 'damage', amount: 8, element: 'fire' }], '#f472b6'),
  hybrid('rime_shard', 'Rime Shard', 'A rune-cut shard of ice: 6 arcane and 8 cold damage, slowing for 3 turns.', 7, 'cold', 'ray',
    [{ type: 'damage', amount: 6, element: 'arcane' }, { type: 'damage', amount: 8, element: 'cold' }, { type: 'applyStatus', statusId: 'slow', duration: 3 }], '#7dd3fc'),
  hybrid('galdr_spark', 'Galdr Spark', 'A rune-guided spark: 12 lightning damage that leaps to two more foes.', 9, 'lightning', 'ray',
    [{ type: 'damage', amount: 12, element: 'lightning' }, { type: 'chain', maxHops: 2, hopRange: 3, damageDecay: 0.3 }], '#fde047'),
  hybrid('hel_fire', 'Hel-Fire', 'Black flame from the corpse-realm: 14 fire and 10 shadow damage.', 12, 'fire', 'ray',
    [{ type: 'damage', amount: 14, element: 'fire' }, { type: 'damage', amount: 10, element: 'shadow' }], '#7f1d1d'),
  hybrid('forge_bolt', 'Forge Bolt', 'A white-hot iron bolt: 12 fire and 8 physical damage.', 8, 'fire', 'ray',
    [{ type: 'damage', amount: 12, element: 'fire' }, { type: 'damage', amount: 8, element: 'physical' }], '#f97316'),
  hybrid('ice_spear', 'Ice Spear', 'A spear of black ice: 12 cold and 8 physical damage, slowing for 2 turns.', 8, 'cold', 'ray',
    [{ type: 'damage', amount: 12, element: 'cold' }, { type: 'damage', amount: 8, element: 'physical' }, { type: 'applyStatus', statusId: 'slow', duration: 2 }], '#38bdf8'),
  hybrid('thunder_maul', 'Thunder Maul', "A blow of the Thunderer's hammer: 14 lightning and 8 physical damage, stunning for a turn.", 10, 'lightning', 'ray',
    [{ type: 'damage', amount: 14, element: 'lightning' }, { type: 'damage', amount: 8, element: 'physical' }, { type: 'applyStatus', statusId: 'stunned', duration: 1 }], '#facc15'),
  hybrid('renewal', 'Renewal', 'Galdr-woven mending that restores 40 health.', 12, 'healing', 'self',
    [{ type: 'heal', amount: 40 }], '#4ade80'),
  hybrid('iron_blessing', 'Iron Blessing', 'Mending hardened with iron: restores 30 health.', 7, 'healing', 'self',
    [{ type: 'heal', amount: 30 }], '#a3e635'),
];

export const COTW_HYBRID_RECIPES: HybridRecipe[] = [
  { elements: ['fire', 'cold'], spellId: 'steam_lance' },
  { elements: ['fire', 'lightning'], spellId: 'surtr_brand' },
  { elements: ['cold', 'lightning'], spellId: 'hagalaz_hail' },
  { elements: ['arcane', 'fire'], spellId: 'rune_flare' },
  { elements: ['arcane', 'cold'], spellId: 'rime_shard' },
  { elements: ['arcane', 'lightning'], spellId: 'galdr_spark' },
  { elements: ['fire', 'shadow'], spellId: 'hel_fire' },
  { elements: ['fire', 'physical'], spellId: 'forge_bolt' },
  { elements: ['cold', 'physical'], spellId: 'ice_spear' },
  { elements: ['lightning', 'physical'], spellId: 'thunder_maul' },
  { elements: ['healing', 'arcane'], spellId: 'renewal' },
  { elements: ['healing', 'physical'], spellId: 'iron_blessing' },
];
