import { Item } from '../items/item';
import type { Monster } from '../entities/monster';
import type { GameEngine } from '../engine';

/**
 * Generates an evocative, harvested anatomical trophy from a mastered creature
 * defeated by a player with the Trophy Hunter specialization.
 */
export function createMonsterTrophy(victim: Monster, engine: GameEngine): Item {
  const randSuffix = engine.prng.nextInt(1000, 9999).toString();
  const id = `trophy-${engine.turnCount}-${randSuffix}`;

  let name = `Intact ${victim.name} Trophy`;
  let desc = `A skillfully harvested anatomical trophy from a ${victim.name}. Highly sought by town scholars and merchants for bounties.`;

  if (victim.onHitAffliction?.type === 'poison') {
    name = `Pristine Venom Sac (${victim.name})`;
    desc = `A delicate venom gland carefully excised from ${victim.name}. Its potency is prized in alchemical circles.`;
  } else if (victim.hasTag('undead')) {
    name = `Grave Relic (${victim.name})`;
    desc = `A preserved bone or spirit vessel salvaged from the remains of ${victim.name}.`;
  } else if (victim.hasTag('demon')) {
    name = `Demon Horn Trophy (${victim.name})`;
    desc = `A wicked, obsidian-hued horn cut from ${victim.name}. Exudes faint warmth.`;
  } else if (victim.hasTag('elemental')) {
    name = `Pristine Elemental Core (${victim.name})`;
    desc = `A pulsating crystallized core harvested from the heart of ${victim.name}.`;
  } else if (victim.hasTag('dragon') || victim.hasTag('reptile')) {
    name = `Hardened Dragon Scale (${victim.name})`;
    desc = `An unblemished armor scale removed from ${victim.name}. Near impervious to blades.`;
  } else if (victim.hasTag('beast')) {
    name = `Pristine Beast Pelt (${victim.name})`;
    desc = `A thick, unmarred hide preserved from ${victim.name}. Valued by tanners and traders.`;
  }

  const baseVal = Math.max(25, Math.round((victim.xpValue ?? 10) * 2.5));

  return new Item({
    id,
    name,
    category: 'misc',
    weight: 120,
    bulk: 100,
    value: baseVal,
    identified: true,
    description: desc,
  });
}
