import { Merchant } from '../../../engine';
import { COTW_TOWN } from '../town';

/**
 * A shop built straight from its town NPC's `merchantConfig`, for tests that trade with one
 * merchant without generating a town. The game builds its merchants in `TownMapGenerator`.
 */
function merchantOf(npcId: string, kind: 'general' | 'armory'): Merchant {
  const cfg = COTW_TOWN.npcs.find((n) => n.id === npcId)!.merchantConfig!;
  return new Merchant(cfg.id, cfg.name, cfg.name, kind, cfg.greeting, cfg.initialInventory(), cfg);
}

export const createOlafGeneralStore = (): Merchant => merchantOf('npc-olaf', 'general');

export const createGuntherArmory = (): Merchant => merchantOf('npc-gunther', 'armory');
