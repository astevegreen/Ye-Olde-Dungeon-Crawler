import type { StatusType, StatusEffect, SerializedStatusEffect } from './types';
import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';
import { StatusHandlerRegistry } from './statusHandlers';
import { goOff } from './endings';

export interface StatusTickResult {
  expired: StatusType[];
  damageTaken: number;
  killed: boolean;
  messages: string[];
}

export class StatusManager {
  /** Keyed by type; a stacking status's later instances by `type#n` (`StatusHandler.stacks`). */
  private effects: Map<string, StatusEffect> = new Map();
  /** HP its ticks have taken so far (poison, bleeding), unsaved: a rest tells it from a blow. */
  public tickDamageTotal = 0;

  public hasStatus(type: StatusType): boolean {
    return this.keyOf(type) !== undefined;
  }

  public getStatus(type: StatusType): StatusEffect | undefined {
    const key = this.keyOf(type);
    return key === undefined ? undefined : this.effects.get(key);
  }

  /** The key of the first instance of `type`. */
  private keyOf(type: StatusType): string | undefined {
    if (this.effects.has(type)) return type;
    for (const [key, effect] of this.effects) if (effect.type === type) return key;
    return undefined;
  }

  /** A key no instance holds yet: the type itself, else `type#n`. */
  private freeKey(type: StatusType): string {
    if (!this.effects.has(type)) return type;
    let n = 2;
    while (this.effects.has(`${type}#${n}`)) n++;
    return `${type}#${n}`;
  }

  public getAll(): readonly StatusEffect[] {
    return Array.from(this.effects.values());
  }

  public getAllActive(): readonly StatusEffect[] {
    return this.getAll();
  }

  /** A blow of `amount` on `entity`, through each status's damage-taken hook (a mark lands it harder). */
  public scaleDamageTaken(entity: Entity, amount: number): number {
    for (const effect of this.effects.values()) {
      const hook = StatusHandlerRegistry.get(effect.type)?.onDamageTaken;
      if (hook) amount = hook(entity, effect, amount);
    }
    return amount;
  }

  /** Whether a status makes its bearer seen through walls (a mark). */
  public revealsBearer(): boolean {
    for (const effect of this.effects.values()) {
      if (StatusHandlerRegistry.get(effect.type)?.sensedThroughWalls) return true;
    }
    return false;
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

    return this.applyStatusDetailed(status, immunities, entity, engine).applied;
  }

  /**
   * `applyStatus`, also reporting the line the status's handler logged when it took hold
   * (`StatusHandler.onApply`, which runs only for a new status with both entity and engine
   * given), so a caller with a generic line of its own logs that only when the handler gave none.
   */
  public applyStatusDetailed(
    status: StatusEffect,
    immunities: readonly StatusType[] = [],
    entity?: Entity,
    engine?: GameEngine
  ): { applied: boolean; message?: string } {
    // The list the caller passed, and the entity's own (an Actor's include what it wears).
    if (immunities.includes(status.type) || entity?.isImmuneTo(status.type)) {
      return { applied: false };
    }

    const handler = StatusHandlerRegistry.get(status.type);
    const existing = handler?.stacks ? undefined : this.getStatus(status.type);
    if (existing) {
      existing.duration = Math.max(existing.duration, status.duration);
      if (status.potency !== undefined) {
        existing.potency = Math.max(existing.potency ?? 0, status.potency);
      }
      return { applied: true };
    }
    this.effects.set(this.freeKey(status.type), { ...status });
    if (handler?.onApply && entity && engine) {
      const message = handler.onApply(entity, status, engine);
      if (message) {
        engine.log(message);
        return { applied: true, message };
      }
    }
    return { applied: true };
  }

  public removeStatus(type: StatusType): boolean {
    const key = this.keyOf(type);
    return key !== undefined && this.effects.delete(key);
  }

  /** Removes this one instance, whichever of its type's it is; false when it is gone already. */
  public removeEffect(effect: StatusEffect): boolean {
    for (const [key, held] of this.effects) if (held === effect) return this.effects.delete(key);
    return false;
  }

  public clear(): void {
    this.effects.clear();
  }

  /**
   * Moves the named statuses this manager holds to `recipient`, as it would take them
   * (its immunities refuse one, a handler's `onApply` runs), with `sourceEntityId` the
   * giver. One the recipient refuses stays here. Returns the statuses moved.
   */
  public transferTo(
    types: readonly StatusType[],
    recipient: Entity,
    giverId: string,
    engine?: GameEngine
  ): StatusType[] {
    const moved: StatusType[] = [];
    for (const type of types) {
      const effect = this.getStatus(type);
      if (!effect) continue;
      const handed: StatusEffect = { ...effect, sourceEntityId: giverId, data: effect.data ? { ...effect.data } : undefined };
      if (recipient.statusManager.applyStatusDetailed(handed, [], recipient, engine).applied) {
        this.removeEffect(effect);
        moved.push(type);
      }
    }
    return moved;
  }

  public tick(entity: Entity, engine: GameEngine): StatusTickResult {
    const expired: StatusType[] = [];
    const messages: string[] = [];
    let damageTaken = 0;
    let killed = false;

    for (const [key, effect] of Array.from(this.effects.entries())) {
      const type = effect.type;
      const handler = StatusHandlerRegistry.get(type);

      // 1. Process periodic status effects
      if (handler?.onTick) {
        const result = handler.onTick(entity, effect, engine);
        damageTaken += result.damageTaken;
        this.tickDamageTotal += result.damageTaken;
        if (result.message) {
          messages.push(result.message);
        }
        if (result.killed) {
          killed = true;
          // The caller resolves the death without a killer; this names it ("poison").
          entity.pendingDeathCause ??= type.replace(/^[a-z0-9_-]+:/, '').replace(/_/g, ' ');
        }
      }

      // An onTick handler may have removed its own effect already (e.g. an
      // interrupted Rune of Return channel, which fizzles rather than "expiring" —
      // docs/architecture/content-extensibility.md). Don't double-process expiry for an effect that's no
      // longer tracked.
      if (this.effects.get(key) !== effect) continue;

      // 2. Decrement duration
      effect.duration -= 1;
      if (effect.duration <= 0) {
        this.effects.delete(key);
        expired.push(type);

        if (handler?.onExpire) {
          const msg = handler.onExpire(entity, engine);
          if (msg) messages.push(msg);
        } else {
          messages.push(`${entity.name}'s ${type} effect has worn off.`);
        }
        // Run here, not in `onExpire`, which a pack's expire message replaces (`engine.ts`).
        if (handler?.ending?.on.includes('expire')) goOff(engine, entity, effect, handler.ending);
        handler?.onEnd?.(entity, effect, engine);
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
      data: e.data ? { ...e.data } : undefined,
    }));
  }

  public deserialize(data: SerializedStatusEffect[]): void {
    this.effects.clear();
    if (!Array.isArray(data)) return;
    for (const s of data) {
      if (s && s.type && s.duration > 0) {
        this.effects.set(this.freeKey(s.type), {
          type: s.type,
          duration: s.duration,
          potency: s.potency,
          sourceEntityId: s.sourceEntityId,
          data: s.data ? { ...s.data } : undefined,
        });
      }
    }
  }
}
