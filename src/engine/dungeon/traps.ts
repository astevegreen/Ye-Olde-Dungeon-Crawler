import type { TrapType } from '../types/manifest';
import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { DeathResolver } from '../combat/deathResolver';
import { TILES } from '../grid/tile';

export interface TrapOptions {
  id: string;
  definitionId?: string;
  type: TrapType;
  x: number;
  y: number;
  revealed?: boolean;
  triggered?: boolean;
  disarmed?: boolean;
  damage?: number;
  concealment?: number;
  disarmDifficulty?: number;
  customMessage?: string;
}

/**
 * Mutable runtime instance of a dungeon trap.
 * References an immutable definition ID, strictly maintaining Definition vs. Instance separation.
 */
export class TrapInstance {
  public readonly id: string;
  public readonly definitionId: string;
  public readonly type: TrapType;
  public x: number;
  public y: number;
  public revealed: boolean;
  public triggered: boolean = false;
  public disarmed: boolean = false;
  public damage: number;
  public concealment: number;
  public disarmDifficulty: number;
  public customMessage?: string;

  constructor(options: TrapOptions) {
    this.id = options.id;
    this.definitionId = options.definitionId ?? options.type;
    this.type = options.type;
    this.x = options.x;
    this.y = options.y;
    this.revealed = options.revealed ?? false;
    this.triggered = options.triggered ?? false;
    this.disarmed = options.disarmed ?? false;
    this.concealment = options.concealment ?? 14;
    this.disarmDifficulty = options.disarmDifficulty ?? 14;
    this.customMessage = options.customMessage;

    switch (options.type) {
      case 'pit':
        this.damage = options.damage ?? 10;
        break;
      case 'arrow':
        this.damage = options.damage ?? 8;
        break;
      case 'teleport':
      case 'alarm':
      default:
        this.damage = options.damage ?? 0;
        break;
    }
  }

  /**
   * Triggers trap when stepped on.
   */
  public trigger(entity: Entity, engine: GameEngine): string {
    if (this.disarmed) {
      return `The disabled ${this.type} trap clicks harmlessly under ${entity.name}.`;
    }

    this.triggered = true;
    this.revealed = true;

    // Ensure map tile reflects revealed trap
    const currentTile = engine.map.getTile(this.x, this.y);
    if (currentTile && currentTile.type !== 'trap') {
      engine.map.setTile(this.x, this.y, TILES.TRAP);
    }

    let message = '';

    switch (this.type) {
      case 'pit': {
        const actualDmg = this.damage;
        entity.takeDamage(actualDmg);
        message =
          this.customMessage ??
          `A hidden pit trap opens beneath ${entity.name}'s feet! ${entity.name} takes ${actualDmg} damage!`;
        engine.log(message);

        if (!entity.isAlive() && entity instanceof Player) {
          DeathResolver.resolveDeath(engine, undefined, entity);
        }
        break;
      }

      case 'arrow': {
        const actualDmg = this.damage;
        entity.takeDamage(actualDmg);
        message =
          this.customMessage ??
          `A pressure plate clicks! A dart springs from the wall hitting ${entity.name} for ${actualDmg} damage!`;
        engine.log(message);

        if (!entity.isAlive() && entity instanceof Player) {
          DeathResolver.resolveDeath(engine, undefined, entity);
        }
        break;
      }

      case 'teleport': {
        // Teleport entity to random passable unoccupied tile on current map
        const validCoords: Array<{ x: number; y: number }> = [];
        for (let y = 0; y < engine.map.height; y++) {
          for (let x = 0; x < engine.map.width; x++) {
            if (
              engine.map.isPassable(x, y) &&
              !engine.map.getEntityAt(x, y) &&
              !(x === this.x && y === this.y)
            ) {
              validCoords.push({ x, y });
            }
          }
        }

        if (validCoords.length > 0) {
          const dest = engine.prng.choice(validCoords);
          engine.map.moveEntity(entity, dest.x, dest.y);
          if (entity instanceof Player) {
            engine.updateFov();
          }
          message =
            this.customMessage ??
            `A teleport glyph flares violently! ${entity.name} vanishes and reappears elsewhere in the dungeon!`;
        } else {
          message = `A teleport glyph sparkles feebly, but the air remains stable.`;
        }
        engine.log(message);
        break;
      }

      case 'alarm': {
        let awakened = 0;
        for (const ent of engine.map.getAllEntities()) {
          if (ent instanceof Monster && ent.aiState === 'sleeping') {
            ent.aiState = 'hunting';
            awakened++;
          }
        }
        message =
          this.customMessage ??
          `An alarm tripwire snaps! A shrill brass horn echoes through the dungeon (${awakened} monsters alert)!`;
        engine.log(message);
        break;
      }
    }

    return message;
  }

  /**
   * Attempts to disarm the trap by the player.
   */
  public disarm(player: Player, engine: GameEngine): { success: boolean; message: string } {
    if (this.disarmed) {
      return { success: true, message: 'This trap is already disarmed.' };
    }

    // Perception & Agility roll: DEX + INT check
    const d20 = engine.prng.nextInt(1, 20);
    const roll = d20 + Math.floor((player.dexterity + player.intelligence) / 6);
    if (roll >= this.disarmDifficulty) {
      this.disarmed = true;
      this.revealed = true;
      const msg = `You carefully jam the trigger mechanism of the ${this.type} trap. It is now safely disarmed!`;
      engine.log(msg);
      return { success: true, message: msg };
    } else {
      // Failed attempt triggers the trap
      const triggerMsg = this.trigger(player, engine);
      return {
        success: false,
        message: `Your tools slip! ${triggerMsg}`,
      };
    }
  }
}
