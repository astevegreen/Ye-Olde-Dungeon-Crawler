import type { ActionHook, FactionDefinition, MerchantPricingRules } from '../../engine';
import { TOWN_BUILDINGS } from './townLayout';
import { IRON_CLANS_MET_FLAG } from './ironClans';

/** Set the first time the hero steps into the temple: the Temple faction's `metFlag`. */
export const TEMPLE_MET_FLAG = 'temple_met';

/**
 * The factions the Story lists. A faction is met on first dealing with it: the
 * townsfolk from the start; the temple on the first visit to it, or once an altar
 * choice moves its standing; the Iron Clans through the Accord or their forge-keeper.
 */
/** Townsfolk standing sets the shops' buy prices; the first matching tier wins. */
export const COTW_MERCHANT_PRICING: MerchantPricingRules = {
  faction: 'townsfolk',
  tiers: [
    { minStanding: 30, multiplier: 0.75 },
    { minStanding: 20, multiplier: 0.9 },
    { maxStanding: -20, multiplier: 1.3 },
    { maxStanding: -10, multiplier: 1.15 },
  ],
};

export const COTW_FACTIONS: FactionDefinition[] = [
  { id: 'townsfolk', name: 'Townsfolk', metAtStart: true },
  // One name over Thor's temple in town and the altars of Tyr and the other gods below.
  { id: 'temple_standing', name: 'Temple of the Æsir', metFlag: TEMPLE_MET_FLAG },
  // Met by reading the Smithy's Accord or speaking with Ivalda (ironClans.ts).
  { id: 'iron_clans', name: 'Iron Clans', metFlag: IRON_CLANS_MET_FLAG },
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
