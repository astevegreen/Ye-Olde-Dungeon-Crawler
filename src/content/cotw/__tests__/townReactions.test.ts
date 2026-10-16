import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../../engine/engine';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { Player } from '../../../engine/entities/player';
import { NPC } from '../../../engine/entities/npc';
import { MovementAction } from '../../../engine/actions/movement';
import { WaitAction } from '../../../engine/actions/wait';
import { ExecuteChoiceAction } from '../../../engine/actions/choiceAction';
import { endingNarrative } from '../../../engine/quest/endingNarrative';
import type { ChoiceDefinition } from '../../../engine';
import { COTW_GRIMOIRES } from '../grimoires';
import { COTW_CHOICES, cotwManifest } from '../index';
import { COTW_TILES } from '../tiles';
import { COTW_QUEST } from '../quest';
import { OATH_BROKEN_FLAG, OATH_HONORED_FLAG } from '../oath';
import { RELIC_RECOVERED_FLAG } from '../relic';
import { HEARTH_COLD_STAGES, HEARTH_COLD_TURNS_COUNTER } from '../hearthCold';

/** Story choices the town answers in its talk, played on a real engine. */
function engineOn(floor: number): { engine: GameEngine; player: Player; map: GameMap } {
  const map = new GameMap(12, 12, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Sven', position: { x: 4, y: 5 }, stats: { hp: 40, maxHp: 40, attack: 10, defense: 5 }, grimoireSystem: COTW_GRIMOIRES });
  const engine = new GameEngine({ map, player, floor, manifest: cotwManifest });
  return { engine, player, map };
}

/** Steps onto the tile east of the hero and answers its choice with `optionId`. */
function stepAndAnswer(engine: GameEngine, player: Player, map: GameMap, tileType: string, optionId: string): void {
  map.setTile(player.x + 1, player.y, COTW_TILES.find((t) => t.type === tileType)!);
  engine.onChoiceInteract = (choice: ChoiceDefinition, onSelect) => {
    if (choice.id === tileType) onSelect(optionId);
  };
  engine.handlePlayerAction(new MovementAction(player, 1, 0));
}

describe('Father Torvald on a desecrated altar of Tyr', () => {
  it('says why the temple refuses the hero, and stops once it serves them again', () => {
    const { engine, player, map } = engineOn(3);
    stepAndAnswer(engine, player, map, 'altar_tyr', 'desecrate');
    expect(engine.getFactionStanding('temple_standing')).toBe(-10);

    engine.changeFloor(0);
    engine.handlePlayerAction(new WaitAction(player));
    const torvald = engine.map.getEntityById('npc-priest') as NPC;
    expect(torvald.greeting).toContain('Tyr’s altar lies shattered');
    expect(torvald.dialogText).toContain('broke his stone for a dagger');

    // Offerings brought the standing back: the temple serves the hero, and he says so.
    engine.worldState.factions.temple_standing = 0;
    engine.handlePlayerAction(new WaitAction(player));
    expect(torvald.greeting).toContain('Tyr’s altar is still broken');
    expect(torvald.dialogText).toContain('Thor’s door is open to you again');
  });

  it('says nothing of Tyr to a hero who left the altar whole', () => {
    const { engine, player, map } = engineOn(3);
    stepAndAnswer(engine, player, map, 'altar_tyr', 'wash');
    engine.changeFloor(0);
    engine.handlePlayerAction(new WaitAction(player));
    const torvald = engine.map.getEntityById('npc-priest') as NPC;
    expect(`${torvald.greeting} ${torvald.dialogText}`).not.toContain('Tyr');
  });
});

describe('The Matriarch’s Blood-Oath, remembered', () => {
  /** Strikes the bargain on floor 25 with the Hearth-Tear won, then walks into town. */
  function strike(optionId: 'honor' | 'break') {
    const { engine, player } = engineOn(25);
    engine.setWorldFlag(RELIC_RECOVERED_FLAG, true);
    engine.handlePlayerAction(new ExecuteChoiceAction(player, COTW_CHOICES.oath_hearth, optionId));
    engine.changeFloor(0);
    engine.handlePlayerAction(new WaitAction(player));
    const npc = (id: string) => engine.map.getEntityById(id) as NPC;
    return { engine, player, gunther: npc('npc-gunther'), ranvild: npc('npc-trainer') };
  }

  it('keeps the cold: the smith, the hound-warden and both endings say so', () => {
    const { engine, gunther, ranvild } = strike('honor');
    expect(engine.getWorldFlag(OATH_HONORED_FLAG)).toBe(true);
    expect(engine.getWorldFlag(OATH_BROKEN_FLAG)).toBe(false);
    expect(gunther.dialogText).toContain('kept your own frost');
    expect(ranvild.greeting).toContain('frost-hound');
    for (const ending of Object.values(COTW_QUEST.endings ?? {})) {
      const told = endingNarrative(ending, engine.worldState).join('\n');
      expect(told, ending.id).toContain('kept the cold of Thrym’s line');
      expect(told, ending.id).not.toContain('seized the stolen sun');
    }
  });

  it('takes the fire: the smith, the hound-warden and both endings say so', () => {
    const { engine, gunther, ranvild } = strike('break');
    expect(engine.getWorldFlag(OATH_BROKEN_FLAG)).toBe(true);
    expect(gunther.dialogText).toContain('seized the stolen fire');
    expect(ranvild.greeting).toContain('ember-wolf');
    for (const ending of Object.values(COTW_QUEST.endings ?? {})) {
      const told = endingNarrative(ending, engine.worldState).join('\n');
      expect(told, ending.id).toContain('seized the stolen sun');
      expect(told, ending.id).not.toContain('kept the cold');
    }
  });

  it('tells a save from before the side flags which way it went, by the companion the Oath bonded', () => {
    const { engine, player } = strike('break');
    delete engine.worldState.flags[OATH_BROKEN_FLAG];
    engine.handlePlayerAction(new WaitAction(player));
    expect(engine.getWorldFlag(OATH_BROKEN_FLAG)).toBe(true);
    expect(engine.getWorldFlag(OATH_HONORED_FLAG)).toBe(false);
  });

  it('says nothing of the Oath before it is struck', () => {
    const { engine, player } = engineOn(25);
    engine.setWorldFlag(RELIC_RECOVERED_FLAG, true);
    engine.changeFloor(0);
    engine.handlePlayerAction(new WaitAction(player));
    const ranvild = engine.map.getEntityById('npc-trainer') as NPC;
    expect(ranvild.greeting).toBe('A hound is only as good as the hand that trains it.');
    for (const ending of Object.values(COTW_QUEST.endings ?? {})) {
      expect(endingNarrative(ending, engine.worldState).join('\n')).not.toContain('matriarch');
    }
  });
});

describe('Bjarnarhaven’s cold, while the Hearth-Tear is lost', () => {
  const [first, second, third] = HEARTH_COLD_STAGES;
  const turnsBelow = (e: GameEngine) => e.worldState.counters[HEARTH_COLD_TURNS_COUNTER] ?? 0;
  const told = (e: GameEngine, line: string) => e.messages.filter((m) => m.includes(line)).length;

  it('deepens with every turn spent below, and is told once per stage on coming home', () => {
    const { engine, player } = engineOn(5);
    engine.worldState.counters[HEARTH_COLD_TURNS_COUNTER] = first.turns - 2;
    engine.handlePlayerAction(new WaitAction(player));
    expect(turnsBelow(engine)).toBe(first.turns - 1);

    // Still short of the first stage: home is as it was.
    engine.changeFloor(0);
    engine.handlePlayerAction(new WaitAction(player));
    const bjorn = engine.map.getEntityById('npc-guard') as NPC;
    expect(bjorn.greeting).toBe('Halt! Keep your weapons sheathed in Bjarnarhaven, adventurer.');
    expect(turnsBelow(engine)).toBe(first.turns - 1); // time in town does not count

    engine.changeFloor(5);
    engine.handlePlayerAction(new WaitAction(player));
    engine.changeFloor(0);
    engine.handlePlayerAction(new WaitAction(player));
    engine.handlePlayerAction(new WaitAction(player));
    expect(told(engine, first.arrival)).toBe(1);
    expect(bjorn.greeting).toBe(first.greeting);

    // A long trip past two stages tells only the deeper one.
    engine.changeFloor(5);
    engine.worldState.counters[HEARTH_COLD_TURNS_COUNTER] = third.turns;
    engine.handlePlayerAction(new WaitAction(player));
    engine.changeFloor(0);
    engine.handlePlayerAction(new WaitAction(player));
    expect(told(engine, second.arrival)).toBe(0);
    expect(told(engine, third.arrival)).toBe(1);
    expect(bjorn.dialogText).toBe(third.dialogText);
  });

  it('stops when the Hearth-Tear is won, and the guard remarks on the thaw', () => {
    const { engine, player } = engineOn(5);
    engine.worldState.counters[HEARTH_COLD_TURNS_COUNTER] = first.turns;
    engine.changeFloor(0);
    engine.handlePlayerAction(new WaitAction(player));
    const bjorn = engine.map.getEntityById('npc-guard') as NPC;
    expect(bjorn.greeting).toBe(first.greeting);

    engine.changeFloor(25);
    engine.setWorldFlag(RELIC_RECOVERED_FLAG, true);
    engine.handlePlayerAction(new WaitAction(player));
    expect(turnsBelow(engine)).toBe(first.turns);
    engine.changeFloor(0);
    engine.handlePlayerAction(new WaitAction(player));
    expect(bjorn.greeting).toContain('The ice let go of the gate-hinges');
  });

  it('leaves the guard alone at the thaw if the cold never set in', () => {
    const { engine, player } = engineOn(25);
    engine.setWorldFlag(RELIC_RECOVERED_FLAG, true);
    engine.changeFloor(0);
    engine.handlePlayerAction(new WaitAction(player));
    expect((engine.map.getEntityById('npc-guard') as NPC).greeting).toBe('Halt! Keep your weapons sheathed in Bjarnarhaven, adventurer.');
  });
});
