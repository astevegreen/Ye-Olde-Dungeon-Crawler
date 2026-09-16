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
  SENSORY_MASKED: 'sensory_masked' as StatusType,
} as const;

export interface StatusEffect {
  type: StatusType;
  duration: number;
  potency?: number;
  sourceEntityId?: string;
  /** Effect-specific scalar state, analogous to GameEventBase.data (ARCHITECTURE.md §4).
   * Lets a handler track extra per-instance state (e.g. the Rune of Return channel's
   * last-observed HP and whether this turn's action continued it) without every
   * status effect needing its own bespoke shape. */
  data?: Record<string, number | string | boolean | undefined>;
}

export interface SerializedStatusEffect {
  type: StatusType;
  duration: number;
  potency?: number;
  sourceEntityId?: string;
  data?: Record<string, number | string | boolean | undefined>;
}
