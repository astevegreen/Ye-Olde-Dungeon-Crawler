import type { StatusType, StatusEffect, SerializedStatusEffect } from './types';
import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';
import { StatusHandlerRegistry } from './statusHandlers';

export interface StatusTickResult {
  expired: StatusType[];
  damageTaken: number;
  killed: boolean;
  messages: string[];
}

export class StatusManager {
  private effects: Map<StatusType, StatusEffect> = new Map();

  public hasStatus(type: StatusType): boolean {
    return this.effects.has(type);
  }

  public getStatus(type: StatusType): StatusEffect | undefined {
    return this.effects.get(type);
  }

  public getAll(): readonly StatusEffect[] {
    return Array.from(this.effects.values());
  }

  public getAllActive(): readonly StatusEffect[] {
    return this.getAll();
  }

  public applyStatus(
    statusOrType: StatusEffect | StatusType,
    durationOrImmunities?: number | readonly StatusType[],
    potencyOrEntity?: number | Entity,
    engineMaybe?: GameEngine
  ): boolean {
    let status: StatusEffect;
    let immunities: readonly StatusType[] = [];
    let entity: Entity | undefined;
    let engine: GameEngine | undefined;

    if (typeof statusOrType === 'string') {
      status = {
        type: statusOrType,
        duration: typeof durationOrImmunities === 'number' ? durationOrImmunities : 1,
        potency: typeof potencyOrEntity === 'number' ? potencyOrEntity : undefined,
      };
      if (Array.isArray(durationOrImmunities)) {
        immunities = durationOrImmunities;
      }
      if (potencyOrEntity && typeof potencyOrEntity !== 'number') {
        entity = potencyOrEntity;
      }
      engine = engineMaybe;
    } else {
      status = statusOrType;
      immunities = Array.isArray(durationOrImmunities) ? durationOrImmunities : [];
      entity = potencyOrEntity && typeof potencyOrEntity !== 'number' ? potencyOrEntity : undefined;
      engine = engineMaybe;
    }

    if (immunities.includes(status.type)) {
      return false;
    }

    const existing = this.effects.get(status.type);
    if (existing) {
      existing.duration = Math.max(existing.duration, status.duration);
      if (status.potency !== undefined) {
        existing.potency = Math.max(existing.potency ?? 0, status.potency);
      }
    } else {
      this.effects.set(status.type, { ...status });
      const handler = StatusHandlerRegistry.get(status.type);
      if (handler?.onApply && entity && engine) {
        const msg = handler.onApply(entity, status, engine);
        if (msg) engine.log(msg);
      }
    }
    return true;
  }

  public removeStatus(type: StatusType): boolean {
    return this.effects.delete(type);
  }

  public clear(): void {
    this.effects.clear();
  }

  public tick(entity: Entity, engine: GameEngine): StatusTickResult {
    const expired: StatusType[] = [];
    const messages: string[] = [];
    let damageTaken = 0;
    let killed = false;

    for (const [type, effect] of Array.from(this.effects.entries())) {
      const handler = StatusHandlerRegistry.get(type);

      // 1. Process periodic status effects
      if (handler?.onTick) {
        const result = handler.onTick(entity, effect, engine);
        damageTaken += result.damageTaken;
        if (result.message) {
          messages.push(result.message);
        }
        if (result.killed) {
          killed = true;
        }
      }

      // 2. Decrement duration
      effect.duration -= 1;
      if (effect.duration <= 0) {
        this.effects.delete(type);
        expired.push(type);

        if (handler?.onExpire) {
          const msg = handler.onExpire(entity, engine);
          if (msg) messages.push(msg);
        } else {
          messages.push(`${entity.name}'s ${type} effect has worn off.`);
        }
      }
    }

    for (const msg of messages) {
      engine.log(msg);
    }

    return {
      expired,
      damageTaken,
      killed,
      messages,
    };
  }

  public serialize(): SerializedStatusEffect[] {
    return Array.from(this.effects.values()).map((e) => ({
      type: e.type,
      duration: e.duration,
      potency: e.potency,
      sourceEntityId: e.sourceEntityId,
    }));
  }

  public deserialize(data: SerializedStatusEffect[]): void {
    this.effects.clear();
    if (!Array.isArray(data)) return;
    for (const s of data) {
      if (s && s.type && s.duration > 0) {
        this.effects.set(s.type, {
          type: s.type,
          duration: s.duration,
          potency: s.potency,
          sourceEntityId: s.sourceEntityId,
        });
      }
    }
  }
}
