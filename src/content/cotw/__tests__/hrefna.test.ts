import { describe, it, expect } from 'vitest';
import { cotwManifest, COTW_CHOICES } from '../index';
import { HREFNA_CHOICE_ID, HREFNA_ID, HREFNA_POSITION, seatHrefna } from '../hrefna';
import { PROLOGUE_ENDED_FLAG } from '../prologue';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { serializeGame, deserializeGame } from '../../../engine/storage/serializer';
import { WaitAction } from '../../../engine/actions/wait';
import { MovementAction } from '../../../engine/actions/movement';
import { GameMap, NPC, Player, createWorldState, setFlag, type EngineContext } from '../../../engine';

function newHero() {
  return new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Seer', { seed: 3, prologue: true }).engine;
}

describe('Hrefna the völva, by the plaza fountain after the raid', () => {
  it('is not in town during the raid, and sits beside the fountain from the turn after it ends', () => {
    const engine = newHero();
    engine.handlePlayerAction(new WaitAction(engine.player));
    expect(engine.map.getEntityById(HREFNA_ID), 'not while the raid lasts').toBeNull();

    engine.diagnostics.endPrologue?.();
    expect(engine.worldState.flags[PROLOGUE_ENDED_FLAG]).toBe(true);
    engine.handlePlayerAction(new WaitAction(engine.player));

    const hrefna = engine.map.getEntityById(HREFNA_ID) as NPC;
    expect(hrefna).toBeInstanceOf(NPC);
    expect(hrefna).toMatchObject({ ...HREFNA_POSITION, choiceId: HREFNA_CHOICE_ID, spriteKey: HREFNA_ID });
    expect(engine.map.getTile(HREFNA_POSITION.x, HREFNA_POSITION.y)?.type).not.toBe('town_fountain');
    expect(engine.messages.filter((m) => m.includes('Hrefna the völva sits by the plaza fountain'))).toHaveLength(1);

    // Seated once: later turns neither add a second nor say it again.
    engine.handlePlayerAction(new WaitAction(engine.player));
    expect(engine.map.getAllEntities().filter((e) => e.id === HREFNA_ID)).toHaveLength(1);
    expect(engine.messages.filter((m) => m.includes('Hrefna the völva sits by the plaza fountain'))).toHaveLength(1);
  }, 30_000);

  it('comes to a town saved after the raid, before she was there, on its next turn', () => {
    const engine = newHero();
    engine.diagnostics.endPrologue?.();
    // A save made after the raid by a build without her.
    expect(engine.map.getEntityById(HREFNA_ID)).toBeNull();
    const { engine: loaded } = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine))), cotwManifest);
    expect(loaded.map.getEntityById(HREFNA_ID)).toBeNull();

    loaded.handlePlayerAction(new WaitAction(loaded.player));
    expect(loaded.map.getEntityById(HREFNA_ID)).toMatchObject(HREFNA_POSITION);
  }, 30_000);

  it('speaks her three lines on what Seiðr is through a one-option choice, opened by walking into her', () => {
    const choice = COTW_CHOICES[HREFNA_CHOICE_ID];
    expect(choice.options).toHaveLength(1);
    const lines = choice.description.split('\n\n').slice(1);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('Seiðr is borrowed. Take more than you hold and the Void keeps the tally.');

    const engine = newHero();
    engine.diagnostics.endPrologue?.();
    engine.handlePlayerAction(new WaitAction(engine.player));
    const beside = { x: HREFNA_POSITION.x - 1, y: HREFNA_POSITION.y };
    expect(engine.map.moveEntity(engine.player, beside.x, beside.y)).toBe(true);
    let opened: string | undefined;
    engine.onChoiceInteract = (offered, onSelect) => {
      opened = offered.id;
      onSelect('nod');
    };
    engine.handlePlayerAction(new MovementAction(engine.player, 1, 0));
    expect(opened).toBe(HREFNA_CHOICE_ID);
    expect(engine.player.position).toEqual(beside);
    expect(engine.messages.some((m) => m.startsWith('Hrefna turns back to the water'))).toBe(true);
  }, 30_000);
});

describe('seating Hrefna', () => {
  function fakeTown(floor = 0) {
    const worldState = createWorldState();
    const player = new Player({ name: 'Sven', position: { x: 0, y: 0 } });
    const map = new GameMap(50, 50);
    const logs: string[] = [];
    const ctx: EngineContext = {
      player,
      map,
      surfaces: null as never,
      worldState,
      rng: () => 0.5,
      log: (m) => logs.push(m),
      getWorldFlag: (f) => Boolean(worldState.flags[f]),
      setWorldFlag: (f, v) => setFlag(worldState, f, v),
      currentFloor: floor,
      removeEntity: (e) => map.removeEntity(e),
      addEntity: (e) => map.addEntity(e),
      compendium: null as never,
    };
    return { ctx, map, worldState, logs };
  }

  it('waits for the raid to end, and for town', () => {
    const below = fakeTown(1);
    setFlag(below.worldState, PROLOGUE_ENDED_FLAG, true);
    expect(seatHrefna(below.ctx)).toBe(false);

    const town = fakeTown();
    expect(seatHrefna(town.ctx)).toBe(false);
    setFlag(town.worldState, PROLOGUE_ENDED_FLAG, true);
    expect(seatHrefna(town.ctx)).toBe(true);
    expect(seatHrefna(town.ctx)).toBe(false);
    expect(town.logs).toHaveLength(1);
  });

  it('waits a turn when someone stands in her place', () => {
    const { ctx, map, worldState } = fakeTown();
    setFlag(worldState, PROLOGUE_ENDED_FLAG, true);
    map.addEntity(ctx.player);
    map.moveEntity(ctx.player, HREFNA_POSITION.x, HREFNA_POSITION.y);
    expect(seatHrefna(ctx)).toBe(false);
    expect(map.getEntityById(HREFNA_ID)).toBeNull();

    map.moveEntity(ctx.player, HREFNA_POSITION.x - 1, HREFNA_POSITION.y);
    expect(seatHrefna(ctx)).toBe(true);
    expect(map.getEntityById(HREFNA_ID)).toMatchObject(HREFNA_POSITION);
  });
});
