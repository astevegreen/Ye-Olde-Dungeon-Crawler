import type { ActionHook, FactionDefinition } from '../../engine';
import { TOWN_BUILDINGS } from './townLayout';

/** Set the first time the hero steps into the temple: the Temple faction's `metFlag`. */
export const TEMPLE_MET_FLAG = 'temple_met';

/**
 * The factions the Story lists. A faction is met on first dealing with it: the
 * townsfolk from the start; the temple on the first visit to it, or once an altar
 * choice moves its standing.
 */
export const COTW_FACTIONS: FactionDefinition[] = [
  { id: 'townsfolk', name: 'Townsfolk', metAtStart: true },
  // One name over Thor's temple in town and the altars of Tyr and the other gods below.
  { id: 'temple_standing', name: 'Temple of the Æsir', metFlag: TEMPLE_MET_FLAG },
  { id: 'iron_clans', name: 'Iron Clans' },
];

const TEMPLE = TOWN_BUILDINGS.find((b) => b.buildingType === 'temple')!.bounds;

/** Meets the temple when the hero first stands inside it (its door counts). */
export const COTW_TEMPLE_MET_HOOK: ActionHook = {
  id: 'cotw-temple-met',
  phase: 'post',
  actionType: '*',
  execute: ({ actor, engine }) => {
    if (actor !== engine.player || engine.currentFloor !== 0 || engine.getWorldFlag(TEMPLE_MET_FLAG)) return;
    const { x, y } = engine.player;
    if (x >= TEMPLE.x1 && x <= TEMPLE.x2 && y >= TEMPLE.y1 && y <= TEMPLE.y2) {
      engine.setWorldFlag(TEMPLE_MET_FLAG, true);
    }
  },
};
