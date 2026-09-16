import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import type { Position } from '../types';
import type { GameEngine } from '../engine';
import { Monster } from '../entities/monster';
import { DeathResolver } from '../combat/deathResolver';
import type { ValkyrieSprintState } from './types';

export class ValkyrieSprintGauntlet {
  public active: boolean = false;
  public stage: 1 | 2 | 3 = 1;
  public stageTurnsRemaining: number = 5;
  public originFloor: number = 1;
  public originPosition: Position = { x: 0, y: 0 };
  public telegraphedDangerTiles: Position[] = [];
  public barricadeCleared: boolean = false;
  public doorHp: number = 20;

  constructor(state?: Partial<ValkyrieSprintState>) {
    if (state) {
      this.active = state.active ?? false;
      this.stage = state.stage ?? 1;
      this.stageTurnsRemaining = state.stageTurnsRemaining ?? 5;
      this.originFloor = state.originFloor ?? 1;
      this.originPosition = state.originPosition ? { ...state.originPosition } : { x: 0, y: 0 };
      this.telegraphedDangerTiles = state.telegraphedDangerTiles ? [...state.telegraphedDangerTiles] : [];
      this.doorHp = state.doorHp ?? 20;
    }
  }

  public getState(): ValkyrieSprintState {
    return {
      active: this.active,
      stage: this.stage,
      stageTurnsRemaining: this.stageTurnsRemaining,
      originFloor: this.originFloor,
      originPosition: { ...this.originPosition },
      telegraphedDangerTiles: [...this.telegraphedDangerTiles],
      doorHp: this.doorHp,
    };
  }

  /**
   * Initiates the Valkyrie's Sprint 3-room escape gauntlet.
   */
  public startGauntlet(engine: GameEngine): void {
    this.active = true;
    this.stage = 1;
    this.stageTurnsRemaining = 5;
    this.originFloor = engine.currentFloor;
    this.originPosition = { x: engine.player.x, y: engine.player.y };
    this.barricadeCleared = false;

    // Cache the origin floor map and fov so we can safely return if aborted
    engine.storedFloors.set(this.originFloor, engine.map);
    if (engine.fov) {
      engine.storedFov.set(this.originFloor, engine.fov);
    }

    engine.log('*** Sounding the Gjallarhorn resonates across the realms! ***');
    engine.log(`The Valkyrie’s Sprint begins! Escape through 3 micro-stages to reach ${engine.manifest?.town?.name ?? 'town'}’s gate!`);

    this.loadStage1(engine);
  }

  /**
   * STAGE 1: The Collapsing Chasm (12x8)
   */
  public loadStage1(engine: GameEngine): void {
    this.stage = 1;
    this.stageTurnsRemaining = 5;
    this.telegraphedDangerTiles = [];

    const map = this.createBaseMicroMap();

    // Place exit threshold at (10, 4)
    map.setTile(10, 4, TILES.STAIRS_UP);

    this.setupStageMap(engine, map, { x: 1, y: 4 });

    // Telegraph initial danger tiles
    this.telegraphDebris(engine);

    engine.log('STAGE 1: Collapsing Chasm! Reach the threshold at (10, 4) within 5 turns before debris crushes you!');
  }

  /**
   * STAGE 2: The Barricade (12x8)
   */
  public loadStage2(engine: GameEngine): void {
    this.stage = 2;
    this.stageTurnsRemaining = 10;
    this.barricadeCleared = false;
    this.doorHp = 20;
    this.telegraphedDangerTiles = [];

    const map = this.createBaseMicroMap();

    // Reinforced Portcullis Wall across column 6
    for (let y = 1; y < 7; y++) {
      if (y === 3 || y === 4) {
        map.setTile(6, y, TILES.DOOR_CLOSED);
      } else {
        map.setTile(6, y, TILES.WALL);
      }
    }

    // Exit ladder at (10, 4)
    map.setTile(10, 4, TILES.STAIRS_UP);

    this.setupStageMap(engine, map, { x: 1, y: 4 });

    engine.log('STAGE 2: The Barricade! A heavy reinforced portcullis blocks your flight!');
    engine.log('Clear the portcullis via Strength (Bash), Dexterity (Pick Lock), Magic (Blast Gate), or Weapon Attacks (Hack Down)!');
  }

  /**
   * Clears the Stage 2 Barricade via Strength check.
   */
  public attemptBashBarricade(engine: GameEngine): { success: boolean; message: string } {
    if (this.stage !== 2 || this.barricadeCleared) {
      return { success: false, message: 'No barricade to bash.' };
    }

    const p = engine.player;
    const rollStr = engine.rng();
    // Strength check: STR >= 12 or roll
    const strCheck = p.strength >= 12 || rollStr + (p.strength / 20) >= 0.7;
    if (strCheck) {
      this.clearBarricade(engine);
      const msg = `You shoulder-slam the portcullis with mighty strength! The timber splinters open!`;
      engine.log(msg);
      return { success: true, message: msg };
    } else {
      p.takeDamage(4);
      const msg = `You crash against the ironwood gate but fail to break it (-4 HP recoil)!`;
      engine.log(msg);
      return { success: false, message: msg };
    }
  }

  /**
   * Clears the Stage 2 Barricade via Dexterity check.
   */
  public attemptPickBarricade(engine: GameEngine): { success: boolean; message: string } {
    if (this.stage !== 2 || this.barricadeCleared) {
      return { success: false, message: 'No barricade to pick.' };
    }

    const p = engine.player;
    const hasLockpicks = p.inventory.primaryPack.hasItem('lockpicks');
    const rollDex = engine.rng();
    const dexCheck = hasLockpicks || p.dexterity >= 12 || rollDex + (p.dexterity / 20) >= 0.7;

    if (dexCheck) {
      this.clearBarricade(engine);
      const msg = `With nimble fingers${hasLockpicks ? ' and lockpicks' : ''}, you trip the portcullis tumbler! The gate creaks open!`;
      engine.log(msg);
      return { success: true, message: msg };
    } else {
      const msg = `Your hands fumble with the intricate dwarven lock!`;
      engine.log(msg);
      return { success: false, message: msg };
    }
  }

  /**
   * Clears the Stage 2 Barricade via Magic projectile / mana blast.
   */
  public attemptSpellBlastBarricade(engine: GameEngine, spellName = 'firebolt'): { success: boolean; message: string } {
    if (this.stage !== 2 || this.barricadeCleared) {
      return { success: false, message: 'No barricade to blast.' };
    }

    const p = engine.player;
    const manaCost = 8;
    if (p.mana < manaCost) {
      const msg = `Not enough mana to shatter the gate! (${p.mana}/${manaCost} MP)`;
      engine.log(msg);
      return { success: false, message: msg };
    }

    p.consumeMana(manaCost);
    this.clearBarricade(engine);
    const msg = `You unleash a blazing bolt of ${spellName}! The reinforced gate disintegrates in a shower of embers!`;
    engine.log(msg);
    return { success: true, message: msg };
  }

  /**
   * Clears the Stage 2 Barricade via Physical Weapon Attack (Fallback for any class build).
   * Spends 1 stage turn, damages door HP, and clears when door reaches 0 HP.
   */
  public attemptAttackBarricade(engine: GameEngine): { success: boolean; message: string; doorHpRemaining: number } {
    if (this.stage !== 2 || this.barricadeCleared) {
      return { success: false, message: 'No barricade to attack.', doorHpRemaining: 0 };
    }

    const p = engine.player;
    this.stageTurnsRemaining = Math.max(0, this.stageTurnsRemaining - 1);

    // Weapon/Physical damage fallback (minimum 8 damage so 2-3 swings break it for anyone)
    const baseDmg = Math.max(8, p.attack);
    this.doorHp = Math.max(0, this.doorHp - baseDmg);

    if (this.doorHp <= 0) {
      this.clearBarricade(engine);
      const msg = `You violently batter the reinforced portcullis for ${baseDmg} damage! The ironwood timbers splinter and collapse!`;
      engine.log(msg);
      return { success: true, message: msg, doorHpRemaining: 0 };
    } else {
      const msg = `You strike the reinforced portcullis for ${baseDmg} damage! (Portcullis HP: ${this.doorHp}/20, Turns Left: ${this.stageTurnsRemaining})`;
      engine.log(msg);
      return { success: false, message: msg, doorHpRemaining: this.doorHp };
    }
  }

  private clearBarricade(engine: GameEngine): void {
    this.barricadeCleared = true;
    engine.map.setTile(6, 3, TILES.DOOR_OPEN);
    engine.map.setTile(6, 4, TILES.DOOR_OPEN);
  }

  /**
   * STAGE 3: The Guardian Gate (12x8)
   */
  public loadStage3(engine: GameEngine): void {
    this.stage = 3;
    this.stageTurnsRemaining = 20;
    this.telegraphedDangerTiles = [];

    const map = this.createBaseMicroMap();

    // Exit ladder at (10, 4)
    map.setTile(10, 4, TILES.STAIRS_UP);

    // High-tier brute guarding the ladder
    const brute = new Monster({
      id: 'valkyrie-guardian-brute',
      name: 'Jotun Gatekeeper',
      position: { x: 9, y: 4 },
      stats: { hp: 55, maxHp: 55, attack: 13, defense: 5 },
      speed: 90,
      aiType: 'brute',
      definitionId: 'ogre',
      xpValue: 120,
    });
    map.addEntity(brute);

    this.setupStageMap(engine, map, { x: 1, y: 4 });

    engine.log('STAGE 3: The Guardian Gate! A towering Jotun Gatekeeper blocks the exit ladder at (10, 4)!');
    engine.log('Slay the brute, incapacitate it, or slip past to make your escape!');
  }

  /**
   * Checks if player stepped onto the stage exit threshold.
   */
  public checkThresholdStep(engine: GameEngine, x: number, y: number): void {
    if (!this.active) return;

    if (x === 10 && y === 4) {
      if (this.stage === 1) {
        engine.log('You dive through the collapsing archway just as the ceiling crashes down!');
        this.loadStage2(engine);
      } else if (this.stage === 2) {
        if (!this.barricadeCleared) {
          engine.log('The reinforced portcullis blocks the exit!');
          return;
        }
        engine.log('You vault past the shattered barricade into the final passage!');
        this.loadStage3(engine);
      } else if (this.stage === 3) {
        this.completeGauntlet(engine);
      }
    }
  }

  /**
   * Advances gauntlet turn state (debris falling in stage 1, timer tracking).
   */
  public advanceTurn(engine: GameEngine): void {
    if (!this.active) return;

    if (this.stage === 1) {
      this.stageTurnsRemaining -= 1;

      // 1. Resolve collapsing debris from previous telegraph
      for (const pos of this.telegraphedDangerTiles) {
        if (engine.player.x === pos.x && engine.player.y === pos.y) {
          engine.log(`Falling boulders crash down upon you (-15 HP)!`);
          engine.player.takeDamage(15);
          if (!engine.player.isAlive()) {
            DeathResolver.resolveDeath(engine, undefined, engine.player);
            return;
          }
        }
        // Turn crushed tile into rubble/wall
        engine.map.setTile(pos.x, pos.y, TILES.WALL);
      }

      if (this.stageTurnsRemaining <= 0) {
        engine.log('*** The chasm collapses entirely! You are buried in rubble (-35 HP)! ***');
        engine.player.takeDamage(35);
        this.abortGauntlet(engine);
        return;
      }

      // 2. Telegraph new danger tiles for next turn
      this.telegraphDebris(engine);
    }
  }

  private telegraphDebris(engine: GameEngine): void {
    this.telegraphedDangerTiles = [];
    const candidates: Position[] = [];

    for (let y = 1; y < 7; y++) {
      for (let x = 2; x < 10; x++) {
        // Don't collapse on player immediately or on exit
        if (x === engine.player.x && y === engine.player.y) continue;
        if (x === 10 && y === 4) continue;
        if (engine.map.getTile(x, y)?.type === 'floor') {
          candidates.push({ x, y });
        }
      }
    }

    // Pick 2 random candidate tiles
    for (let i = 0; i < 2 && candidates.length > 0; i++) {
      const idx = Math.floor(engine.rng() * candidates.length);
      const chosen = candidates.splice(idx, 1)[0];
      this.telegraphedDangerTiles.push(chosen);
      engine.log(`Crumbling dust and falling pebbles warn of collapse at (${chosen.x}, ${chosen.y}) next turn!`);
    }
  }

  public completeGauntlet(engine: GameEngine): void {
    this.active = false;
    this.stage = 1;
    this.telegraphedDangerTiles = [];

    // Open two-way return portal and record recall floor & position
    if (engine.townReturnManager) {
      engine.townReturnManager.openTownPortal(this.originFloor, this.originPosition);
    }
    engine.player.deepestRecallFloor = this.originFloor;
    engine.player.recallPosition = { ...this.originPosition };

    engine.log('*** GAUNTLET CONQUERED! Radiant wings sweep you through the mountain fissures! ***');
    engine.log(`You emerge breathless into daylight outside ${engine.manifest?.town?.name ?? 'town'}’s southern town gate!`);

    // Teleport to Bjarnarhaven Town Gate (Floor 0, near guard Bjorn)
    engine.changeFloor(0, { x: 25, y: 15 });
  }

  public abortGauntlet(engine: GameEngine, reason?: string): void {
    this.active = false;
    this.stage = 1;
    this.telegraphedDangerTiles = [];

    const reasonMsg = reason ? ` (${reason})` : '';
    engine.log(`The gauntlet collapsed!${reasonMsg} You tumble back into the dungeon floor!`);

    // Deal minor attrition damage (10 HP)
    if (engine.player.hp > 10) {
      engine.player.takeDamage(10);
    }

    // Return to origin floor and position
    const originMap = engine.storedFloors.get(this.originFloor);
    if (originMap) {
      engine.map.removeEntity(engine.player);
      engine.map = originMap;
      engine.currentFloor = this.originFloor;
      engine.player.x = this.originPosition.x;
      engine.player.y = this.originPosition.y;
      engine.map.addEntity(engine.player);
      engine.scheduler.reset();
      engine.scheduler.addEntity(engine.player);
      for (const ent of originMap.getAllEntities()) {
        if (ent !== engine.player && ent.isAlive()) {
          engine.scheduler.addEntity(ent);
        }
      }
      if (engine.fov) {
        engine.updateFov();
      }
    } else {
      engine.changeFloor(this.originFloor, this.originPosition);
    }
  }

  private createBaseMicroMap(): GameMap {
    const map = new GameMap(12, 8, TILES.WALL);
    for (let y = 1; y < 7; y++) {
      for (let x = 1; x < 11; x++) {
        map.setTile(x, y, TILES.FLOOR);
      }
    }
    return map;
  }

  private setupStageMap(engine: GameEngine, map: GameMap, playerPos: Position): void {
    engine.map = map;
    engine.scheduler.reset();

    engine.player.x = playerPos.x;
    engine.player.y = playerPos.y;
    engine.map.addEntity(engine.player);
    engine.scheduler.addEntity(engine.player);

    for (const ent of engine.map.getAllEntities()) {
      if (ent !== engine.player && ent.isAlive()) {
        engine.scheduler.addEntity(ent);
      }
    }

    if (engine.fov) {
      engine.updateFov();
    }
  }
}
