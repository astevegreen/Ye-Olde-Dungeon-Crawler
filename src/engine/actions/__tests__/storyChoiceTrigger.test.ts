import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, TILES, Player, Monster } from '../../index';
import { MovementAction } from '../movement';
import { MeleeAttackAction } from '../combat';
import type { ChoiceDefinition } from '../../types/choice';
import type { StoryChoiceTrigger } from '../../types/manifest';

/**
 * StoryChoiceTrigger (ARCHITECTURE.md §3): unlocks a choice once a monster has been
 * slain `killsRequired` times, tracked via `GameEngine.compendium` (cross-floor safe,
 * persisted) rather than a tile — no engine mechanism guarantees a hand-placed
 * special room on a non-final, procedurally generated floor.
 */
const TEST_CHOICE: ChoiceDefinition = {
  id: 'test_climax',
  title: 'The Test Climax',
  description: 'test',
  options: [{ id: 'accept', label: 'Accept', consequences: [{ type: 'setFlag', flag: 'accepted', value: true }] }],
  cancelable: false,
};

const TRIGGER: StoryChoiceTrigger = {
  id: 'test_trigger',
  choiceId: 'test_climax',
  monsterDefinitionId: 'test_monster',
  killsRequired: 2,
  progressStartFlag: 'test_climax_started',
};

function buildEngine() {
  const map = new GameMap(10, 10, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 3, y: 3 },
    stats: { hp: 100, maxHp: 100, attack: 50, defense: 5 },
  });
  const engine = new GameEngine({ map, player });
  (engine.manifest.choices as any) = { test_climax: TEST_CHOICE };
  (engine.manifest as any).storyChoiceTriggers = [TRIGGER];
  return { engine, player, map };
}

function killTestMonster(engine: GameEngine, map: GameMap, at: { x: number; y: number }) {
  const monster = new Monster({
    id: `victim-${at.x}-${at.y}`,
    name: 'Test Monster',
    definitionId: 'test_monster',
    position: at,
    stats: { hp: 1, maxHp: 1, attack: 1, defense: 0 },
  });
  map.addEntity(monster);
  // Melee the monster to death via a real combat action so DeathResolver records
  // the compendium kill exactly the way a real playthrough would.
  engine.handlePlayerAction(new MeleeAttackAction(engine.player, monster));
}

describe('StoryChoiceTrigger', () => {
  it('sets progressStartFlag on the first qualifying kill, before the threshold is reached', () => {
    const { engine, player, map } = buildEngine();
    expect(engine.getWorldFlag('test_climax_started')).toBe(false);

    killTestMonster(engine, map, { x: 4, y: 3 });
    engine.handlePlayerAction(new MovementAction(player, 0, 1)); // any move re-checks triggers

    expect(engine.getWorldFlag('test_climax_started')).toBe(true);
  });

  it('offers the choice once killsRequired is reached, and not before', () => {
    const { engine, player, map } = buildEngine();
    let offered = false;
    engine.onChoiceInteract = () => {
      offered = true;
    };

    killTestMonster(engine, map, { x: 4, y: 3 });
    engine.handlePlayerAction(new MovementAction(player, 0, 1));
    expect(offered).toBe(false); // only 1 of 2 required kills so far

    killTestMonster(engine, map, { x: 4, y: 4 });
    engine.handlePlayerAction(new MovementAction(player, 0, -1));
    expect(offered).toBe(true);
  });

  it('never re-offers once already offered', () => {
    const { engine, player, map } = buildEngine();
    let offerCount = 0;
    engine.onChoiceInteract = () => {
      offerCount++;
    };

    killTestMonster(engine, map, { x: 4, y: 3 });
    killTestMonster(engine, map, { x: 4, y: 4 });
    engine.handlePlayerAction(new MovementAction(player, 0, 1));
    expect(offerCount).toBe(1);

    engine.handlePlayerAction(new MovementAction(player, 0, -1));
    engine.handlePlayerAction(new MovementAction(player, 0, 1));
    expect(offerCount).toBe(1);
  });
});
