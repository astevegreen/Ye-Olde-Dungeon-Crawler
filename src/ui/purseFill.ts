import { COIN_BULK_CM3, getPlayerCoinItems, type Player } from '../engine';

export interface PurseFill {
  /** Coins in the purse, whatever their kind. */
  held: number;
  /** How many coins the purse holds when full. */
  capacity: number;
  /** Coins that spilled into the pack. */
  loose: number;
}

/** How full the hero's purse is, or null when none is worn. The banker and the inventory both show it. */
export function purseFill(player: Player): PurseFill | null {
  const purse = player.inventory.purse;
  if (!purse) return null;
  let held = 0;
  let loose = 0;
  for (const coin of getPlayerCoinItems(player)) {
    if (coin.container === purse) held += coin.parsed.count;
    else loose += coin.parsed.count;
  }
  return { held, capacity: Math.floor(purse.maxBulkCapacity / COIN_BULK_CM3), loose };
}
