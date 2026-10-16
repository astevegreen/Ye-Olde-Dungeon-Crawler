import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../../engine/engine';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { Player } from '../../../engine/entities/player';
import { NPC } from '../../../engine/entities/npc';
import { MovementAction } from '../../../engine/actions/movement';
import { WaitAction } from '../../../engine/actions/wait';
import type { ChoiceDefinition } from '../../../engine';
import { COTW_GRIMOIRES } from '../grimoires';
import { cotwManifest } from '../index';
import { COTW_TILES } from '../tiles';

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
