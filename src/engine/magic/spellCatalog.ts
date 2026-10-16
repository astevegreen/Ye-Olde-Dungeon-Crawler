import type { GameEngine } from '../engine';
import type { SpellDefinition } from './types';
import { getSpell } from './spellRegistry';

/** One spell on the Spells page, as this hero has met it. */
export interface SpellCatalogEntry {
  spell: SpellDefinition;
  known: boolean;
  /** Forgotten this run: it is never learned again. */
  forgotten: boolean;
  /** Known, or shown on a stone's face this run: what it does may be read. */
  seen: boolean;
  /** The floors whose stones first show it. */
  floors?: { min: number; max: number };
  /** Where it comes from when no stone shows it, in the pack's words. */
  where?: string;
  /** Some other spell teaches it (`learn_spell`, as a tablet read casts). */
  taughtElsewhere: boolean;
}

/**
 * Every spell a hero can learn (5c), for packs with learning stones: the pack's other sources
 * first, then each zone's spells by floor. Undefined without stones.
 */
export function spellCatalog(engine: GameEngine): SpellCatalogEntry[] | undefined {
  const config = engine.manifest?.magic?.learningStones;
  if (!config) return undefined;
  const player = engine.player;
  const spellFor = (id: string) => engine.manifest?.spells?.find((s) => s.id === id) ?? getSpell(id);
  const taught = new Set(
    (engine.manifest?.spells ?? []).flatMap((s) => s.effects.flatMap((e) => (e.type === 'learn_spell' ? [e.spellId] : [])))
  );
  const entries: SpellCatalogEntry[] = [];
  const add = (id: string, where: Pick<SpellCatalogEntry, 'floors' | 'where'>) => {
    const spell = spellFor(id);
    if (!spell || entries.some((e) => e.spell.id === id)) return;
    const known = player.spellsKnown.includes(id);
    entries.push({
      spell,
      known,
      forgotten: player.grimoireState?.forgotten.includes(id) ?? false,
      seen: known || player.learningStones.shown.includes(id),
      ...where,
      taughtElsewhere: taught.has(id),
    });
  };
  for (const group of config.elsewhere ?? []) for (const id of group.spellIds) add(id, { where: group.where });
  for (const zone of [...config.zones].sort((a, b) => a.minFloor - b.minFloor)) {
    // The zone's stones, not its bounds: a zone may begin before its first stone.
    const stoneFloors = config.stones.map((s) => s.floor).filter((f) => f >= zone.minFloor && f <= zone.maxFloor);
    const floors = stoneFloors.length > 0 ? { min: Math.min(...stoneFloors), max: Math.max(...stoneFloors) } : { min: zone.minFloor, max: zone.maxFloor };
    for (const id of zone.spellIds) add(id, { floors });
  }
  return entries;
}
