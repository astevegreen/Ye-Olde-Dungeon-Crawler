import type { StatusType, StatusEffect } from './types';
import type { Entity } from '../entities/entity';
import type { Monster } from '../entities/monster';
import type { GameEngine } from '../engine';

export interface StatusTickOutput {
  damageTaken: number;
  killed: boolean;
  message?: string;
}

export interface StatusHandler {
  /** Called each turn while the status is active. Return damage and messages. */
  onTick?(entity: Entity, effect: StatusEffect, engine: GameEngine): StatusTickOutput;
  /** Called when the status is first applied. Return a message to log. */
  onApply?(entity: Entity, effect: StatusEffect, engine: GameEngine): string | undefined;
  /** Called when the status expires naturally. Return a message to log. */
  onExpire?(entity: Entity, engine: GameEngine): string | undefined;
  /**
   * When set, this status forces the player's FOV radius to this value while active
   * (see `GameEngine.updateFov()`, docs/architecture/simulation-and-input.md). If several active statuses
   * declare one, the most restrictive (smallest) applies. Generalizes what was
   * previously a `blindness`-only hardcoded case in `engine.ts`.
   */
  perceptionRadius?: number;
}

import {
  activeStatusHandlerStore,
  getDefaultStatusHandlerRegistrar,
  setDefaultStatusHandlerRegistrar,
} from '../registries/statusHandlerRegistryStore';

/**
 * Process-wide facade over whichever status handler store is active (ARCHITECTURE.md §3).
 * It holds no map of its own: an engine's registrations live in that engine's store, and
 * this forwards there, so there is one copy of the data rather than two.
 */
export class StatusHandlerRegistry {
  public static register(statusType: StatusType, handler: StatusHandler): void {
    activeStatusHandlerStore().register(statusType, handler);
  }

  public static registerAll(handlers: Record<StatusType, StatusHandler> | Map<StatusType, StatusHandler>): void {
    activeStatusHandlerStore().registerAll(handlers);
  }

  public static get(statusType: StatusType): StatusHandler | undefined {
    return activeStatusHandlerStore().get(statusType);
  }

  public static has(statusType: StatusType): boolean {
    return activeStatusHandlerStore().has(statusType);
  }

  public static getAll(): ReadonlyMap<StatusType, StatusHandler> {
    return activeStatusHandlerStore().getMap();
  }

  public static clear(): void {
    activeStatusHandlerStore().clear();
  }

  public static registerBuiltins(): void {
    for (const [type, handler] of Object.entries(BUILTIN_STATUS_HANDLERS)) {
      activeStatusHandlerStore().register(type, handler);
    }
  }

  public static setDefaultRegistrar(registrar: () => void): void {
    setDefaultStatusHandlerRegistrar(registrar);
  }

  public static resetToDefaults(): void {
    activeStatusHandlerStore().clear();
    this.registerBuiltins();
    const registrar = getDefaultStatusHandlerRegistrar();
    if (registrar) {
      registrar();
    }
  }
}

/** Alias for StatusHandlerRegistry matching Roadmap specification */
export const StatusEffectRegistry = StatusHandlerRegistry;

// ── Built-in Handlers ────────────────────────────────────────────────────────

export const BUILTIN_STATUS_HANDLERS: Record<string, StatusHandler> = {
  poison: {
    onTick(entity, effect, _engine) {
      const dmg = effect.potency ?? 2;
      // Periodic damage must not wake a sleeping monster.
      const res =
        entity.type === 'monster' ? (entity as Monster).takeDamage(dmg, { wakeUp: false }) : entity.takeDamage(dmg);
      return {
        damageTaken: res.damageDealt,
        killed: res.killed,
        message: `${entity.name} suffers ${res.damageDealt} periodic poison damage!`,
      };
    },
    onExpire(entity) {
      return `The poison has run its course in ${entity.name}.`;
    },
  },
  paralysis: {
    onExpire(entity) {
      return `${entity.name} is no longer paralyzed.`;
    },
  },
  slow: {
    onExpire(entity) {
      return `${entity.name}'s sluggishness fades and speed normalizes.`;
    },
  },
  haste: {
    onExpire(entity) {
      return `${entity.name}'s supernatural haste subsides.`;
    },
  },
  blindness: {
    perceptionRadius: 1,
    onExpire(entity) {
      return `${entity.name}'s vision returns!`;
    },
  },
  stunned: {
    onExpire(entity) {
      return `${entity.name} recovers from the stunning blow and regains composure.`;
    },
  },
  sensory_masked: {
    // Vision is crippled like blindness; ECHOLOCATION_HEARING_RADIUS (fov/echolocation.ts)
    // separately lets rendering detect audible actors/terrain beyond this radius.
    perceptionRadius: 1,
    onExpire(entity) {
      return `${entity.name}'s heightened hearing fades as ordinary senses return.`;
    },
  },
};

StatusHandlerRegistry.registerBuiltins();

