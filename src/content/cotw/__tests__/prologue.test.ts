import { describe, it, expect } from 'vitest';
import {
  ExecuteChoiceAction,
  Monster,
  MovementAction,
  OpenDoorAction,
  NPC,
  ProfileManager,
  MemoryStorage,
  WaitAction,
  getFaction,
  getTimedEventCountdowns,
  isPrologueRunning,
  type GameEngine,
} from '../../../engine';
import { ClimbStairsAction } from '../../../engine/actions/stairs';
import { DeathResolver } from '../../../engine/combat/deathResolver';
import { COTW_MANIFEST } from '../index';
import { COTW_PROLOGUE, GATEWARD_CHOICE, GATEWARD_HEARD_FLAG, PROLOGUE_VILLAGERS } from '../prologue';
import { TOWN_STAIRS_DOWN } from '../townLayout';

/**
 * The night raid a new cotw hero begins with: staged by `manifest.prologue` on the town,
 * run by `prologue.ts`'s hooks.
 */
function newRun(): GameEngine {
  return new ProfileManager(new MemoryStorage(), COTW_MANIFEST).createCharacter('Hild', { manifest: COTW_MANIFEST, prologue: true }).engine;
}

const villager = (engine: GameEngine, id: string) => engine.map.getEntityById(id) as NPC;
const step = (engine: GameEngine, dx: number, dy: number) => engine.handlePlayerAction(new MovementAction(engine.player, dx, dy));
const wait = (engine: GameEngine) => engine.handlePlayerAction(new WaitAction(engine.player));

/** Stands the hero just west of `npc`, out of the way of its captor. */
function standBeside(engine: GameEngine, npc: NPC): void {
  engine.map.moveEntity(engine.player, npc.x - 1, npc.y);
}

/** Kills whatever monster stands next to `npc` (its captor). */
function killCaptor(engine: GameEngine, npc: NPC): void {
  for (const e of engine.map.getAllEntities()) {
    if (e instanceof Monster && Math.max(Math.abs(e.x - npc.x), Math.abs(e.y - npc.y)) <= 1) engine.removeEntity(e);
  }
}

describe('cotw prologue: the night raid', () => {
  it('places every monster and villager it declares, on a dark town', () => {
    const engine = newRun();
    expect(engine.map.lit).toBe(false);
    expect({ x: engine.player.x, y: engine.player.y }).toEqual(COTW_PROLOGUE.playerSpawn);
    const placed = engine.map.getAllEntities().filter((e) => e instanceof Monster && e.id.startsWith('prologue-monster-'));
    expect(placed).toHaveLength(COTW_PROLOGUE.monsters!.length);
    for (const v of PROLOGUE_VILLAGERS) expect({ x: villager(engine, v.id).x, y: villager(engine, v.id).y }).toEqual(v.position);
  });

  it('will not free a villager while their thrall stands over them', () => {
    const engine = newRun();
    const eir = villager(engine, 'prologue-eir');
    standBeside(engine, eir);
    const result = step(engine, 1, 0);
    expect(result.message).toMatch(/Strike it down first/);
    expect(villager(engine, 'prologue-eir')).toBeTruthy();
  });

  it('frees a villager once the thrall is down: standing rises, and a gift lies where they stood', () => {
    const engine = newRun();
    const eir = villager(engine, 'prologue-eir');
    const { x, y } = eir;
    killCaptor(engine, eir);
    standBeside(engine, eir);
    const before = getFaction(engine.worldState, 'townsfolk');

    step(engine, 1, 0);

    expect(engine.map.getEntityById('prologue-eir')).toBeFalsy();
    expect(engine.getWorldFlag('prologue-eir_saved')).toBe(true);
    expect(getFaction(engine.worldState, 'townsfolk')).toBe(before + 4);
    expect(engine.map.getItemsAt(x, y).some((i) => i.id === 'prologue-eir-gift')).toBe(true);
  });

  it('bars the houses and seals the cellar while the raid lasts', () => {
    const engine = newRun();
    // Olaf's door (12, 11), from the lane below it.
    engine.map.moveEntity(engine.player, 12, 12);
    expect(step(engine, 0, -1).message).toMatch(/barred/);
    expect(engine.player.y).toBe(12);
    expect(engine.handlePlayerAction(new OpenDoorAction(engine.player, 12, 11)).message).toMatch(/barred/);
    expect(engine.map.getTile(12, 11)?.isClosedDoor).toBe(true);

    engine.map.moveEntity(engine.player, TOWN_STAIRS_DOWN.x, TOWN_STAIRS_DOWN.y);
    engine.handlePlayerAction(new ClimbStairsAction(engine.player));
    expect(engine.currentFloor).toBe(0);
  });

  it('ends at once when every villager is free and the coven slain, the matriarch taking the shard', () => {
    const engine = newRun();
    for (const e of engine.map.getAllEntities()) {
      if (!(e instanceof Monster)) continue;
      if (e.definitionId === 'prologue_coven_warlock') DeathResolver.resolveDeath(engine, engine.player, e);
      else engine.removeEntity(e);
    }
    for (const v of PROLOGUE_VILLAGERS) {
      standBeside(engine, villager(engine, v.id));
      step(engine, 1, 0);
    }
    expect(isPrologueRunning(engine.worldState, COTW_PROLOGUE)).toBe(false);
    expect(engine.messages.some((m) => m.includes('a third troll-wife, older and taller'))).toBe(true);
    for (const v of PROLOGUE_VILLAGERS) expect(engine.getWorldFlag(`${v.id}_saved`)).toBe(true);
  });

  it('holds attribute milestones until the raid is over, so none breaks into it', () => {
    const engine = newRun(); // every attribute 15: each milestone is due
    const offered: string[] = [];
    engine.onChoiceInteract = (choice) => offered.push(choice.id);
    step(engine, 0, -1);
    expect(offered).toEqual([]);

    engine.diagnostics.endPrologue();
    step(engine, 0, -1);
    expect(offered).toEqual([]); // Hallvard speaks first

    engine.handlePlayerAction(new ExecuteChoiceAction(engine.player, GATEWARD_CHOICE, 'close_his_eyes'));
    step(engine, 0, 1);
    expect(offered).toHaveLength(1);
  });

  it('opens the held milestones below ground for a hero who walks past Hallvard', () => {
    const engine = newRun();
    const offered: string[] = [];
    engine.onChoiceInteract = (choice) => offered.push(choice.id);
    engine.diagnostics.endPrologue();
    engine.map.moveEntity(engine.player, TOWN_STAIRS_DOWN.x, TOWN_STAIRS_DOWN.y);
    engine.handlePlayerAction(new ClimbStairsAction(engine.player));
    expect(engine.currentFloor).toBe(1);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (offered.length) break;
      step(engine, dx, dy);
    }
    expect(offered).toHaveLength(1);
  });

  it('stops the countdown when the raid is ended from the F2 triage menu', () => {
    const engine = newRun();
    wait(engine);
    expect(getTimedEventCountdowns(engine)).toHaveLength(1);
    engine.diagnostics.endPrologue();
    wait(engine);
    expect(getTimedEventCountdowns(engine)).toHaveLength(0);
  });

  it('gives the townsfolk out in the lanes a line for the raid instead of their trade', () => {
    const engine = newRun();
    const bjorn = engine.map.getEntityById('npc-guard') as NPC;
    standBeside(engine, bjorn);
    expect(step(engine, 1, 0).message).toMatch(/Bjorn leans on his spear/);
  });

  it('ends when the countdown runs out: the held are taken, dawn comes, Hallvard waits', () => {
    const engine = newRun();
    const sigrun = villager(engine, 'prologue-sigrun');
    killCaptor(engine, sigrun);
    standBeside(engine, sigrun);
    step(engine, 1, 0);
    // Out of every monster's way, then let the rite finish.
    for (const e of engine.map.getAllEntities()) if (e instanceof Monster) engine.removeEntity(e);
    for (let i = 0; i < 100 && isPrologueRunning(engine.worldState, COTW_PROLOGUE); i++) wait(engine);

    expect(isPrologueRunning(engine.worldState, COTW_PROLOGUE)).toBe(false);
    expect(engine.getWorldFlag('prologue-sigrun_saved')).toBe(true);
    expect(engine.getWorldFlag('prologue-eir_taken')).toBe(true);
    expect(engine.getWorldFlag('prologue-brandr_taken')).toBe(true);
    expect(engine.map.lit).toBe(true);
    expect(engine.map.getEntityById('prologue-hallvard')).toBeInstanceOf(NPC);
  });

  it('strikes the hero down instead of killing them, and they wake mended', () => {
    const engine = newRun();
    engine.player.takeDamage(engine.player.hp + 100);
    expect(engine.player.isAlive()).toBe(true);
    wait(engine);

    expect(isPrologueRunning(engine.worldState, COTW_PROLOGUE)).toBe(false);
    expect(engine.getWorldFlag('cotw_prologue_struck_down')).toBe(true);
    for (const v of PROLOGUE_VILLAGERS) expect(engine.getWorldFlag(`${v.id}_taken`)).toBe(true);
    expect(engine.player.hp).toBe(engine.player.maxHp);
  });

  it("Hallvard dies once his last words are heard, and the cellar opens", () => {
    const engine = newRun();
    engine.player.takeDamage(engine.player.hp + 100);
    wait(engine);
    expect(engine.map.getEntityById('prologue-hallvard')).toBeTruthy();

    engine.handlePlayerAction(new ExecuteChoiceAction(engine.player, GATEWARD_CHOICE, 'close_his_eyes'));
    expect(engine.getWorldFlag(GATEWARD_HEARD_FLAG)).toBe(true);
    expect(engine.map.getEntityById('prologue-hallvard')).toBeFalsy();

    engine.map.moveEntity(engine.player, TOWN_STAIRS_DOWN.x, TOWN_STAIRS_DOWN.y);
    engine.handlePlayerAction(new ClimbStairsAction(engine.player));
    expect(engine.currentFloor).toBe(1);
  });
});
