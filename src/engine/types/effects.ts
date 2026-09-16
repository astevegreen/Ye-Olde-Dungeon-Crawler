/**
 * VisualEffectDescriptor & SpellVisualConfig
 * Declarative, serializable descriptors for visual spell effects, projectile paths,
 * explosive bursts, screen flashes, and chain lightning links.
 *
 * Strict Headless Isolation: Zero browser/DOM/timing dependencies.
 */

export interface ProjectileEffectDescriptor {
  type: 'projectile';
  /** Overrides the default tactical/ambient classification (§4). */
  priority?: EffectPriority;
  id?: string;
  path: Array<{ x: number; y: number; isReflection?: boolean }>;
  spriteId?: string;
  color: string;
  stepDelayMs: number;
  travelMode?: 'stepped' | 'smooth';
  tailLength?: number;
}

export interface BurstEffectDescriptor {
  type: 'burst';
  /** Overrides the default tactical/ambient classification (§4). */
  priority?: EffectPriority;
  id?: string;
  epicenter: { x: number; y: number };
  radius: number;
  color: string;
  durationMs: number;
  style?: 'flame' | 'spark' | 'shockwave' | 'aura';
}

export interface ScreenFlashEffectDescriptor {
  type: 'screen_flash';
  /** Overrides the default tactical/ambient classification (§4). */
  priority?: EffectPriority;
  id?: string;
  color: string;
  durationMs: number;
}

export interface ChainLinkEffectDescriptor {
  type: 'chain_link';
  /** Overrides the default tactical/ambient classification (§4). */
  priority?: EffectPriority;
  id?: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  durationMs: number;
}

export type VisualEffectDescriptor =
  | ProjectileEffectDescriptor
  | BurstEffectDescriptor
  | ScreenFlashEffectDescriptor
  | ChainLinkEffectDescriptor;

export interface SpellVisualConfig {
  archetype: 'projectile' | 'projectile_burst' | 'direct_burst' | 'chain' | 'self_buff' | 'teleport' | 'screen_flash';
  color: string;
  spriteId?: string;
  stepDelayMs?: number;
  durationMs?: number;
  burstRadius?: number;
  travelMode?: 'stepped' | 'smooth';
}

/**
 * Whether an effect gates input while it plays (ARCHITECTURE.md §4).
 *
 * - `tactical` conveys information the player needs before acting: where a projectile
 *   flew, where a beam reflected, what an explosion covered. Input waits for it.
 * - `ambient` is feedback: screen pulses, floating numbers, ledger updates. It plays
 *   without blocking, so a fast player is never held up by decoration.
 */
export type EffectPriority = 'tactical' | 'ambient';

/** Effect types that are ambient unless a descriptor says otherwise. */
const AMBIENT_BY_DEFAULT: ReadonlySet<string> = new Set(['screen_flash']);

/**
 * Classifies an effect. A descriptor may set `priority` explicitly — content can mark a
 * decorative burst as ambient, or a screen flash as tactical when it is the only cue.
 */
export function isTacticalEffect(effect: VisualEffectDescriptor): boolean {
  const declared = (effect as { priority?: EffectPriority }).priority;
  if (declared) return declared === 'tactical';
  return !AMBIENT_BY_DEFAULT.has(effect.type);
}
