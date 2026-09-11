import { Item, type ItemConfig } from './item';
import type { GameMap } from '../grid/map';
import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Monster } from '../entities/monster';
import type { Action } from '../actions/action';
import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';

export interface CorpseConfig extends Partial<ItemConfig> {
  archetypeId: string;
  weight?: number;
  decayTicksRemaining?: number;
}

export class CorpseItemInstance extends Item {
  public readonly archetypeId: string;
  public decayTicksRemaining: number;
  public isBurned: boolean = false;

  constructor(config: CorpseConfig) {
    super({
      id: config.id ?? `corpse-${config.archetypeId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `Corpse of ${config.archetypeId}`,
      unidentifiedName: 'Lifeless Remains',
      category: 'quest',
      weight: config.weight ?? 5000,
      bulk: 2000,
      quality: 'normal',
      identified: true,
      description: `The preserved remains of a fallen ${config.archetypeId}.`,
      stats: {},
    });
    this.archetypeId = config.archetypeId;
    this.decayTicksRemaining = config.decayTicksRemaining ?? 50;
  }

  public cremate(map: GameMap, x: number, y: number): Item {
    map.removeItemAt(x, y, this.id);
    this.isBurned = true;
    const ash = new Item({
      id: `ash-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: 'Pile of Ash',
      unidentifiedName: 'Grey Powder',
      category: 'quest',
      weight: 100,
      bulk: 50,
      quality: 'normal',
      identified: true,
      description: 'The cremated, sterile ash of burned organic matter.',
      stats: {},
    });
    map.addItemAt(x, y, ash);
    return ash;
  }
}

export class ReanimateCorpseAction implements Action {
  public readonly caster: Entity;
  public readonly corpse: CorpseItemInstance;
  public readonly targetX: number;
  public readonly targetY: number;

  constructor(caster: Entity, corpse: CorpseItemInstance, targetX: number, targetY: number) {
    this.caster = caster;
    this.corpse = corpse;
    this.targetX = targetX;
    this.targetY = targetY;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.caster.isAlive()) {
      return { success: false, cost: 0, message: `${this.caster.name} is incapacitated.` };
    }

    if (this.corpse.isBurned) {
      return { success: false, cost: 0, message: 'Cremated ash cannot be reanimated.' };
    }

    // Remove corpse from map ground or inventory
    engine.map.removeItemAt(this.targetX, this.targetY, this.corpse.id);

    // Spawn reanimated thrall allied with caster
    const thrall = new Monster({
      id: `thrall-${Date.now()}`,
      name: `Reanimated ${this.corpse.archetypeId} Thrall`,
      position: { x: this.targetX, y: this.targetY },
      stats: { hp: 20, maxHp: 20, attack: 4, defense: 1 },
      speed: 90,
      faction: this.caster.faction,
      definitionId: 'thrall',
      aiType: 'melee',
      xpValue: 0,
    });

    const spawned = engine.map.addEntity(thrall);
    if (spawned) {
      engine.scheduler.addEntity(thrall);
    }

    const cost = this.caster.getActionCost(BASE_ACTION_COST);
    this.caster.consumeEnergy(cost);

    const msg = `${this.caster.name} breathes dark unlife into the remains, raising a ${thrall.name}!`;
    engine.log(msg);

    return { success: true, cost, message: msg };
  }
}

export class ConsumeCorpseAction implements Action {
  public readonly caster: Entity;
  public readonly corpse: CorpseItemInstance;
  public readonly x: number;
  public readonly y: number;

  constructor(caster: Entity, corpse: CorpseItemInstance, x: number, y: number) {
    this.caster = caster;
    this.corpse = corpse;
    this.x = x;
    this.y = y;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.caster.isAlive()) {
      return { success: false, cost: 0, message: `${this.caster.name} is incapacitated.` };
    }

    if (this.corpse.isBurned) {
      return { success: false, cost: 0, message: 'Cannot consume cremated ash.' };
    }

    engine.map.removeItemAt(this.x, this.y, this.corpse.id);

    const healAmount = 15;
    this.caster.hp = Math.min(this.caster.maxHp, this.caster.hp + healAmount);

    const cost = this.caster.getActionCost(BASE_ACTION_COST);
    this.caster.consumeEnergy(cost);

    const msg = `${this.caster.name} consumes the essence of the fallen ${this.corpse.archetypeId}, restoring ${healAmount} HP!`;
    engine.log(msg);

    return { success: true, cost, message: msg };
  }
}

export class CremateCorpseAction implements Action {
  public readonly caster: Entity;
  public readonly corpse: CorpseItemInstance;
  public readonly x: number;
  public readonly y: number;

  constructor(caster: Entity, corpse: CorpseItemInstance, x: number, y: number) {
    this.caster = caster;
    this.corpse = corpse;
    this.x = x;
    this.y = y;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.caster.isAlive()) {
      return { success: false, cost: 0, message: `${this.caster.name} is incapacitated.` };
    }

    this.corpse.cremate(engine.map, this.x, this.y);

    const cost = this.caster.getActionCost(BASE_ACTION_COST);
    this.caster.consumeEnergy(cost);

    const msg = `${this.caster.name} burns the corpse into harmless sterile ash.`;
    engine.log(msg);

    return { success: true, cost, message: msg };
  }
}
