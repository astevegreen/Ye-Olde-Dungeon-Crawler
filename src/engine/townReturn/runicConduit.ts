import type { Position } from '../types';
import { TILES } from '../grid/tile';
import type { GameEngine } from '../engine';
import { Monster } from '../entities/monster';
import { DeathResolver } from '../combat/deathResolver';
import type { RunicConduitState } from './types';

export class RunicConduit {
  public readonly floor: number;
  public readonly conduitPos: Position;
  public ritualActive: boolean = false;
  public turnsRemaining: number = 6;
  public charges: number = 0;
  public activeNode: Position | null = null;
  public cooldownRemaining: number = 0;

  constructor(floor: number, conduitPos: Position, state?: Partial<RunicConduitState>) {
    this.floor = floor;
    this.conduitPos = { ...conduitPos };
    if (state) {
      this.ritualActive = state.ritualActive ?? false;
      this.turnsRemaining = state.turnsRemaining ?? 6;
      this.charges = state.charges ?? 0;
      this.activeNode = state.activeNode ? { ...state.activeNode } : null;
      this.cooldownRemaining = state.cooldownRemaining ?? 0;
    }
  }

  public getState(): RunicConduitState {
    return {
      conduitPos: { ...this.conduitPos },
      ritualActive: this.ritualActive,
      turnsRemaining: this.turnsRemaining,
      charges: this.charges,
      activeNode: this.activeNode ? { ...this.activeNode } : null,
      cooldownRemaining: this.cooldownRemaining,
    };
  }

  /**
   * Returns valid cardinal nodes within the 5x5 zone around the conduit.
   */
  public getCardinalNodes(engine: GameEngine): Position[] {
    const cx = this.conduitPos.x;
    const cy = this.conduitPos.y;
    const candidates: Position[] = [
      { x: cx, y: cy - 2 }, // North
      { x: cx, y: cy + 2 }, // South
      { x: cx + 2, y: cy }, // East
      { x: cx - 2, y: cy }, // West
    ];

    // Filter to passable in-bounds tiles that are not solid walls
    return candidates.filter((pos) => {
      if (!engine.map.inBounds(pos.x, pos.y)) return false;
      const t = engine.map.getTile(pos.x, pos.y);
      return t && t.type !== 'wall';
    });
  }

  /**
   * Starts the 6-turn extraction ritual, alerting nearby monsters.
   */
  public startRitual(engine: GameEngine): { success: boolean; message: string } {
    if (this.cooldownRemaining > 0) {
      const msg = `The Leyline Circle is destabilized and fizzling with static (${this.cooldownRemaining} turns remain before recharge).`;
      engine.log(msg);
      return { success: false, message: msg };
    }

    if (this.ritualActive) {
      return { success: false, message: 'The extraction ritual is already in progress!' };
    }

    this.ritualActive = true;
    this.turnsRemaining = 6;
    this.charges = 0;

    // 1. Awakening: Alert all living monsters within a 15-tile radius to 'hunting'
    let alertedCount = 0;
    for (const ent of engine.map.getAllEntities()) {
      if (ent instanceof Monster && ent.isAlive()) {
        const dist = Math.hypot(ent.x - this.conduitPos.x, ent.y - this.conduitPos.y);
        if (dist <= 15) {
          ent.aiState = 'hunting';
          ent.intent = { type: 'attack', targetTile: { ...this.conduitPos }, turnsRemaining: 0 };
          alertedCount++;
        }
      }
    }

    engine.log('*** The Leyline Circle awakens! A resonant thrum echoes through the stone, alerting nearby beasts! ***');
    if (alertedCount > 0) {
      engine.log(`The psionic shockwave aroused ${alertedCount} dungeon monster${alertedCount > 1 ? 's' : ''} into a hunting frenzy!`);
    }

    // 2. Select initial active cardinal charging node
    this.pickNextActiveNode(engine);

    return { success: true, message: 'The extraction ritual has begun! Stand on charged nodes to accumulate 3 charges within 6 turns!' };
  }

  /**
   * Checks if player steps onto the lit cardinal charging node.
   */
  public checkNodeStep(engine: GameEngine, x: number, y: number): boolean {
    if (!this.ritualActive || !this.activeNode) return false;

    if (this.activeNode.x === x && this.activeNode.y === y) {
      this.charges += 1;
      // Clear node tile back to floor
      engine.map.setTile(x, y, TILES.FLOOR);
      this.activeNode = null;
      engine.log(`You step upon the blazing leyline node! Radiant energy surges into the conduit! (${this.charges}/3 Charges)`);

      if (this.charges >= 3) {
        this.detonateAndTeleport(engine);
      }
      return true;
    }
    return false;
  }

  /**
   * Called each game turn to advance ritual timers and switch nodes.
   */
  public advanceTurn(engine: GameEngine): void {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining -= 1;
    }

    if (!this.ritualActive) return;

    // Check if player fled the 5x5 zone
    const p = engine.player;
    const inZone = Math.abs(p.x - this.conduitPos.x) <= 2 && Math.abs(p.y - this.conduitPos.y) <= 2;
    if (!inZone) {
      engine.log('You stepped outside the 5x5 ritual boundary! The conduit destabilizes!');
      this.destabilize(engine, 'Left the ritual boundary');
      return;
    }

    this.turnsRemaining -= 1;

    if (this.turnsRemaining <= 0 && this.charges < 3) {
      this.destabilize(engine, 'Time expired before 3 charges accumulated');
      return;
    }

    // Still active: if node was not consumed, pick a new cardinal node
    this.pickNextActiveNode(engine);
  }

  private pickNextActiveNode(engine: GameEngine): void {
    // Revert previous node if uncollected
    if (this.activeNode) {
      engine.map.setTile(this.activeNode.x, this.activeNode.y, TILES.FLOOR);
      this.activeNode = null;
    }

    const cardinalCandidates = this.getCardinalNodes(engine);
    // Filter to candidates within reachable movement range (Manhattan distance <= 3 from player)
    let reachableCandidates = cardinalCandidates.filter(
      (pos) => Math.abs(pos.x - engine.player.x) + Math.abs(pos.y - engine.player.y) <= 3
    );

    // If no cardinal node is within distance 3, expand search to any passable floor in the 5x5 zone within distance 3
    if (reachableCandidates.length === 0) {
      const zoneFloorCandidates: Position[] = [];
      const cx = this.conduitPos.x;
      const cy = this.conduitPos.y;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx === cx && ny === cy) continue; // Don't place on the central conduit tile itself
          if (engine.map.inBounds(nx, ny)) {
            const t = engine.map.getTile(nx, ny);
            if (t && t.type === 'floor') {
              const dist = Math.abs(nx - engine.player.x) + Math.abs(ny - engine.player.y);
              if (dist <= 3) {
                zoneFloorCandidates.push({ x: nx, y: ny });
              }
            }
          }
        }
      }
      if (zoneFloorCandidates.length > 0) {
        reachableCandidates = zoneFloorCandidates;
      } else {
        reachableCandidates = cardinalCandidates.length > 0 ? cardinalCandidates : [{ x: cx, y: cy }];
      }
    }

    const randomIndex = Math.floor(Math.random() * reachableCandidates.length);
    const chosen = reachableCandidates[randomIndex];
    this.activeNode = { ...chosen };
    engine.map.setTile(chosen.x, chosen.y, TILES.CONDUIT_NODE);
    engine.log(`A cardinal rune node at (${chosen.x}, ${chosen.y}) blazes with elemental power! (${this.turnsRemaining} turns remaining)`);
  }

  private detonateAndTeleport(engine: GameEngine): void {
    engine.log('*** THE RUNIC CONDUIT DETONATES IN A BLINDING PULSE OF RADIANT LIGHT! ***');

    // Heavy radiant damage to adjacent enemies (radius 2)
    const enemies = engine.map.getAllEntities().filter(
      (e) => e instanceof Monster && e.isAlive() && Math.hypot(e.x - this.conduitPos.x, e.y - this.conduitPos.y) <= 2.5
    );

    for (const victim of enemies) {
      const mon = victim as Monster;
      engine.log(`Radiant shockwave strikes ${mon.name} for 50 radiant damage!`);
      mon.hp -= 50;
      if (mon.hp <= 0) {
        DeathResolver.resolveDeath(engine, engine.player, mon);
      }
    }

    // Clean up active node tile if any
    if (this.activeNode) {
      engine.map.setTile(this.activeNode.x, this.activeNode.y, TILES.FLOOR);
      this.activeNode = null;
    }

    this.ritualActive = false;
    this.charges = 0;
    this.turnsRemaining = 0;

    // Open two-way return portal and record recall floor & position
    if (engine.townReturnManager) {
      engine.townReturnManager.openTownPortal(this.floor, this.conduitPos);
    }
    engine.player.deepestRecallFloor = this.floor;
    engine.player.recallPosition = { ...this.conduitPos };

    // Teleport player directly to Bjarnarhaven Temple of Thor
    engine.log('You are dematerialized in a column of sacred lightning and pulled toward the surface!');
    engine.changeFloor(0, { x: 25, y: 23 });
  }

  private destabilize(engine: GameEngine, reason: string): void {
    if (this.activeNode) {
      engine.map.setTile(this.activeNode.x, this.activeNode.y, TILES.FLOOR);
      this.activeNode = null;
    }

    this.ritualActive = false;
    this.charges = 0;
    this.turnsRemaining = 0;
    this.cooldownRemaining = 20;

    engine.log(`*** RITUAL FAILED: ${reason}! ***`);
    engine.log('Violent magical backlash surges through the conduit, scorching your flesh (-20 HP)!');
    engine.player.takeDamage(20);

    if (!engine.player.isAlive()) {
      DeathResolver.resolveDeath(engine, undefined, engine.player);
    }
  }
}
