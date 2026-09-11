/**
 * VisualEffectDescriptor & SpellVisualConfig
 * Declarative, serializable descriptors for visual spell effects, projectile paths,
 * explosive bursts, screen flashes, and chain lightning links.
 *
 * Strict Headless Isolation: Zero browser/DOM/timing dependencies.
 */

export interface ProjectileEffectDescriptor {
  type: 'projectile';
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
  id?: string;
  epicenter: { x: number; y: number };
  radius: number;
  color: string;
  durationMs: number;
  style?: 'flame' | 'spark' | 'shockwave' | 'aura';
}

export interface ScreenFlashEffectDescriptor {
  type: 'screen_flash';
  id?: string;
  color: string;
  durationMs: number;
}

export interface ChainLinkEffectDescriptor {
  type: 'chain_link';
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
