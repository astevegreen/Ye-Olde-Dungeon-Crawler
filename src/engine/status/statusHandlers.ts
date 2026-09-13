import type { StatusType, StatusEffect } from './types';
import type { Entity } from '../entities/entity';
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
}

const registry = new Map<StatusType, StatusHandler>();

export class StatusHandlerRegistry {
  public static register(statusType: StatusType, handler: StatusHandler): void {
    registry.set(statusType, handler);
  }

  public static registerAll(handlers: Record<StatusType, StatusHandler> | Map<StatusType, StatusHandler>): void {
    const entries = handlers instanceof Map ? handlers.entries() : Object.entries(handlers);
    for (const [statusType, handler] of entries) {
      registry.set(statusType, handler);
    }
  }

  public static get(statusType: StatusType): StatusHandler | undefined {
    return registry.get(statusType);
  }

  public static has(statusType: StatusType): boolean {
    return registry.has(statusType);
  }

  public static getAll(): ReadonlyMap<StatusType, StatusHandler> {
    return registry;
  }

  public static clear(): void {
    registry.clear();
  }

  public static registerBuiltins(): void {
    for (const [type, handler] of Object.entries(BUILTIN_STATUS_HANDLERS)) {
      registry.set(type, handler);
    }
  }

  public static resetToDefaults(): void {
    registry.clear();
    this.registerBuiltins();
  }
}

/** Alias for StatusHandlerRegistry matching Roadmap specification */
export const StatusEffectRegistry = StatusHandlerRegistry;

// ── Built-in Handlers ────────────────────────────────────────────────────────

export const BUILTIN_STATUS_HANDLERS: Record<string, StatusHandler> = {
  poison: {
    onTick(entity, effect, _engine) {
      const dmg = effect.potency ?? 2;
      const res = (entity as any).takeDamage(dmg, { wakeUp: false });
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
    onExpire(entity) {
      return `${entity.name}'s vision returns!`;
    },
  },
  stunned: {
    onExpire(entity) {
      return `${entity.name} recovers from the stunning blow and regains composure.`;
    },
  },
};

StatusHandlerRegistry.registerBuiltins();

