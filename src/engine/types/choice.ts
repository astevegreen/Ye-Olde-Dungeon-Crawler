import type { Predicate } from '../predicates/types';

export type ChoiceConsequence =
  | { type: 'setFlag'; flag: string; value: boolean }
  | { type: 'modifyCounter'; counter: string; delta: number }
  | { type: 'modifyFaction'; faction: string; delta: number }
  | { type: 'grantItem'; itemId: string; toInventory?: boolean }
  | { type: 'applyBuff' | 'applyStatus'; statusType: string; duration: number; potency?: number }
  | { type: 'damagePlayer'; amount: number }
  | { type: 'logMessage'; message: string }
  | { type: 'alertMonsters'; radius?: number };

export interface ChoiceOption {
  id: string;
  label: string;
  description?: string;
  predicate?: Predicate;
  disabledReason?: string;
  consequences: ChoiceConsequence[];
}

export interface ChoiceDefinition {
  id: string;
  title: string;
  description: string;
  options: ChoiceOption[];
  cancelable?: boolean;
  cancelLabel?: string;
}
