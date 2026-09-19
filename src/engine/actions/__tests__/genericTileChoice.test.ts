import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, TILES, Player, registerTileDefinition } from '../../index';
import { MovementAction } from '../movement';
import type { ChoiceDefinition } from '../../types/choice';

/**
 * Generic tile-triggered choice (ARCHITECTURE.md §3): any tile whose
 * `interactionHandlerId` matches a `manifest.choices` key becomes an interactive
 * decision point with zero campaign-specific names in the engine — the reusable
 * generalization of the existing `altar_tyr`-specific branch in movement.ts.
 */
function buildEngine(choice: ChoiceDefinition) {
  registerTileDefinition({
    type: 'test_shrine',
    name: 'Test Shrine',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '?',
    interactionHandlerId: 'test_shrine',
  });

  const map = new GameMap(10, 10, TILES.FLOOR);
  map.setTile(4, 3, { ...TILES.FLOOR, type: 'test_shrine', interactionHandlerId: 'test_shrine' } as any);

  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 3, y: 3 },
    stats: { hp: 30, maxHp: 30, attack: 10, defense: 5 },
  });
  const engine = new GameEngine({ map, player });
  (engine.manifest.choices as any) = { test_shrine: choice };
  return { engine, player };
}

const TEST_CHOICE: ChoiceDefinition = {
  id: 'test_shrine',
  title: 'The Test Shrine',
  description: 'A shrine for testing.',
  options: [
    {
      id: 'accept',
      label: 'Accept',
      consequences: [{ type: 'setFlag', flag: 'accepted', value: true }],
    },
  ],
  cancelable: true,
};

describe('Generic tile-triggered choice', () => {
  it('fires onChoiceInteract when a player steps onto a tile with a matching choices key', () => {
    const { engine, player } = buildEngine(TEST_CHOICE);
    let offeredChoice: ChoiceDefinition | undefined;
    let confirm: ((optionId: string) => void) | undefined;
    engine.onChoiceInteract = (choice, onOptionSelected) => {
      offeredChoice = choice;
      confirm = onOptionSelected;
    };

    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    expect(offeredChoice?.id).toBe('test_shrine');
    confirm?.('accept');
    expect(engine.getWorldFlag('accepted')).toBe(true);
  });

  it('does not re-trigger after an option has been chosen once', () => {
    const { engine, player } = buildEngine(TEST_CHOICE);
    let interactCount = 0;
    engine.onChoiceInteract = (choice, onOptionSelected) => {
      interactCount++;
      onOptionSelected(choice.options[0].id);
    };

    engine.handlePlayerAction(new MovementAction(player, 1, 0));
    expect(interactCount).toBe(1);
    expect(engine.getWorldFlag('test_shrine_resolved')).toBe(true);

    // Step off and back on: should not re-offer the choice.
    engine.handlePlayerAction(new MovementAction(player, -1, 0));
    engine.handlePlayerAction(new MovementAction(player, 1, 0));
    expect(interactCount).toBe(1);
  });

  it('remains re-triggerable if the player cancels instead of choosing', () => {
    const { engine, player } = buildEngine(TEST_CHOICE);
    let interactCount = 0;
    engine.onChoiceInteract = (_choice, _onOptionSelected, onCancel) => {
      interactCount++;
      onCancel?.();
    };

    engine.handlePlayerAction(new MovementAction(player, 1, 0));
    engine.handlePlayerAction(new MovementAction(player, -1, 0));
    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    expect(interactCount).toBe(2);
    expect(engine.getWorldFlag('test_shrine_resolved')).toBe(false);
  });

  it('has no effect on ordinary tiles with no matching choices entry', () => {
    const { engine, player } = buildEngine(TEST_CHOICE);
    let interactCount = 0;
    engine.onChoiceInteract = () => {
      interactCount++;
    };

    // Move somewhere that is not the shrine tile.
    engine.handlePlayerAction(new MovementAction(player, 0, 1));
    expect(interactCount).toBe(0);
  });

  it('displays resolvedState message instead of prompting when a resolvedState flag is set', () => {
    const choiceWithResolved: ChoiceDefinition = {
      ...TEST_CHOICE,
      resolvedStates: [
        { flag: 'shrine_cleansed', message: 'The shrine radiates serene calm.' },
      ],
    };
    const { engine, player } = buildEngine(choiceWithResolved);
    engine.setWorldFlag('shrine_cleansed', true);

    let interactCount = 0;
    engine.onChoiceInteract = () => {
      interactCount++;
    };

    engine.handlePlayerAction(new MovementAction(player, 1, 0));
    expect(interactCount).toBe(0);
    expect(engine.messages).toContain('The shrine radiates serene calm.');
  });
});
