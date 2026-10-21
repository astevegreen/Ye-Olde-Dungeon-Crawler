import { describe, it, expect } from 'vitest';
import { GameEngine, createWorldState, getCurrentObjective, setFlag } from '../../../engine';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { Player } from '../../../engine/entities/player';
import { Item } from '../../../engine/items/item';
import { MovementAction } from '../../../engine/actions/movement';
import { ReadLearningStoneAction } from '../../../engine/magic/learningStones';
import { cotwManifest } from '../index';
import { COTW_OBJECTIVES } from '../objectives';
import { COTW_DEEPEST_FLOOR_COUNTER } from '../spellTablets';
import { GATEWARD_HEARD_FLAG, PROLOGUE_ENDED_FLAG } from '../prologue';
import { FIRST_STONE_READ_FLAG } from '../firstSpell';
import { COTW_LEARNING_STONES } from '../learningStones';

describe('"Learn your first spell" in the HUD objective', () => {
  const objectiveAt = (deepest: number, flags: string[]) => {
    const worldState = createWorldState();
    worldState.counters[COTW_DEEPEST_FLOOR_COUNTER] = deepest;
    for (const f of flags) setFlag(worldState, f, true);
    const view = {
      manifest: { objectives: COTW_OBJECTIVES },
      getWorldFlag: (f: string) => Boolean(worldState.flags[f]),
      getWorldCounter: (c: string) => worldState.counters[c] ?? 0,
    };
    return getCurrentObjective(view as never)?.id;
  };

  const afterRaid = [PROLOGUE_ENDED_FLAG, GATEWARD_HEARD_FLAG];

  it('follows Hallvard and the stairs, and stands until a stone is read', () => {
    expect(objectiveAt(0, [PROLOGUE_ENDED_FLAG])).toBe('cotw_objective_prologue_gateward');
    expect(objectiveAt(0, afterRaid)).toBe('cotw_objective_descend');
    expect(objectiveAt(1, afterRaid)).toBe('cotw_objective_first_spell');
    expect(objectiveAt(4, afterRaid)).toBe('cotw_objective_first_spell');
    expect(objectiveAt(4, [...afterRaid, FIRST_STONE_READ_FLAG])).toBe('cotw_objective_act1');
  });

  it('reads "Learn your first spell."', () => {
    expect(COTW_OBJECTIVES.find((o) => o.id === 'cotw_objective_first_spell')?.text).toBe('Learn your first spell.');
  });

  it('never shows before the prologue has ended', () => {
    expect(objectiveAt(1, [])).toBe('cotw_objective_act1');
  });
});

describe('The first stone read', () => {
  const STONE_TILE = cotwManifest.tiles!.find((t) => t.type === COTW_LEARNING_STONES.tileId)!;

  /** A hero on floor 4 holding its shard, standing on the stone at (3, 2) with the card open. */
  const atTheStone = () => {
    const player = new Player({ position: { x: 2, y: 2 }, stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 } });
    const engine = new GameEngine({ map: new GameMap(15, 15, TILES.FLOOR), player, floor: 4, manifest: cotwManifest, seed: 1337 });
    engine.map.setTile(3, 2, STONE_TILE);
    player.addItem(new Item({ id: 'shard-4', definitionId: COTW_LEARNING_STONES.shardItemId, name: 'Shard', category: 'quest', weight: 1, bulk: 1 }));
    engine.handlePlayerAction(new MovementAction(player, 1, 0));
    expect(player.x).toBe(3);
    return { engine, player };
  };

  it('sets the flag when the hero learns a face', () => {
    const { engine, player } = atTheStone();
    expect(engine.getWorldFlag(FIRST_STONE_READ_FLAG)).toBe(false);
    expect(engine.handlePlayerAction(new ReadLearningStoneAction(player, 'firebolt')).success).toBe(true);
    expect(engine.getWorldFlag(FIRST_STONE_READ_FLAG)).toBe(true);
  });

  it('sets the flag when the hero takes the rune instead', () => {
    const { engine, player } = atTheStone();
    expect(engine.handlePlayerAction(new ReadLearningStoneAction(player, null)).success).toBe(true);
    expect(engine.getWorldFlag(FIRST_STONE_READ_FLAG)).toBe(true);
  });

  it('leaves it unset when the read is refused', () => {
    const { engine, player } = atTheStone();
    player.x = 8;
    expect(engine.handlePlayerAction(new ReadLearningStoneAction(player, 'firebolt')).success).toBe(false);
    expect(engine.getWorldFlag(FIRST_STONE_READ_FLAG)).toBe(false);
  });
});
