export type CoinDenomination = 'copper' | 'silver' | 'gold' | 'platinum';

export const COIN_VALUES: Record<CoinDenomination, number> = {
  copper: 1,
  silver: 10,
  gold: 100,
  platinum: 1000,
};

export const COIN_WEIGHT_GRAMS = 10; // Every coin weighs exactly 10 grams

export const COIN_NAMES: Record<CoinDenomination, { singular: string; plural: string }> = {
  copper: { singular: 'Copper Piece', plural: 'Copper Pieces' },
  silver: { singular: 'Silver Piece', plural: 'Silver Pieces' },
  gold: { singular: 'Gold Piece', plural: 'Gold Pieces' },
  platinum: { singular: 'Platinum Piece', plural: 'Platinum Pieces' },
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
  weightSavedGrams?: number;
}
