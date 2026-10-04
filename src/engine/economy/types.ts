export type CoinDenomination = 'copper' | 'silver' | 'gold' | 'platinum';

export const COIN_VALUES: Record<CoinDenomination, number> = {
  copper: 1,
  silver: 10,
  gold: 100,
  platinum: 1000,
};

/**
 * Coins weigh nothing but take space: every coin, whatever its metal, takes this many cm³ of a
 * purse's or pack's volume. A purse's capacity in coins is its `maxBulkCapacity` divided by
 * this, so trading copper for gold (the banker) is how a hero carries more value.
 */
export const COIN_BULK_CM3 = 10;

export const COIN_NAMES: Record<CoinDenomination, { singular: string; plural: string }> = {
  copper: { singular: 'Copper Coin', plural: 'Copper Coins' },
  silver: { singular: 'Silver Coin', plural: 'Silver Coins' },
  gold: { singular: 'Gold Coin', plural: 'Gold Coins' },
  platinum: { singular: 'Platinum Coin', plural: 'Platinum Coins' },
};

export const COIN_COLORS: Record<CoinDenomination, string> = {
  copper: '#cd7f32', // Bronze / Copper color scheme
  silver: '#e2e8f0', // Silver sheen
  gold: '#ffd700',   // Gold yellow
  platinum: '#7dd3fc', // Cool gleaming platinum
};

export const COIN_ABBREV: Record<CoinDenomination, string> = {
  copper: 'CP',
  silver: 'SP',
  gold: 'GP',
  platinum: 'PP',
};

export interface CurrencyBreakdown {
  copper: number;
  silver: number;
  gold: number;
  platinum: number;
}

export interface TransactionResult {
  success: boolean;
  message: string;
  costInCp?: number;
  changeGiven?: CurrencyBreakdown;
}

export interface ServiceResult {
  success: boolean;
  message: string;
  costInCp?: number;
  /** The banker's exchange: how many fewer coins the hero carries afterwards. */
  coinsSaved?: number;
}
