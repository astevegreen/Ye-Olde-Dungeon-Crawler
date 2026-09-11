// StatusType is now an open string to allow manifest-defined status effects
export type StatusType = string;

// Built-in status type constants for backward compatibility
export const BUILTIN_STATUS = {
  POISON: 'poison' as StatusType,
  PARALYSIS: 'paralysis' as StatusType,
  SLOW: 'slow' as StatusType,
  HASTE: 'haste' as StatusType,
  BLINDNESS: 'blindness' as StatusType,
  STUNNED: 'stunned' as StatusType,
} as const;

export interface StatusEffect {
  type: StatusType;
  duration: number;
  potency?: number;
  sourceEntityId?: string;
}

export interface SerializedStatusEffect {
  type: StatusType;
  duration: number;
  potency?: number;
  sourceEntityId?: string;
}
