import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, TILES, Player, CompanionRegistry } from '../../index';
import { ExecuteChoiceAction, applyConsequences } from '../choiceAction';
import type { ChoiceDefinition } from '../../types/choice';

function buildEngine() {
  const map = new GameMap(10, 10, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 3, y: 3 },
    stats: { hp: 30, maxHp: 30, attack: 10, defense: 5 },
  });
  return { engine: new GameEngine({ map, player }), player };
}

describe('ChoiceConsequence — modifyPermanentStat', () => {
  it('permanently raises attack via the raw base, not the equipment-inclusive getter', () => {
    const { engine, player } = buildEngine();
    const baseBefore = player.baseAttackValue;

    const choice: ChoiceDefinition = {
      id: 'oath',
      title: 'The Oath',
      description: 'test',
      options: [
        {
          id: 'fire',
          label: 'Embrace the fire',
          consequences: [{ type: 'modifyPermanentStat', stat: 'attack', delta: 5 }],
        },
      ],
    };

    engine.handlePlayerAction(new ExecuteChoiceAction(player, choice, 'fire'));

    expect(player.baseAttackValue).toBe(baseBefore + 5);
    expect(player.attack).toBe(baseBefore + 5); // no equipment worn, so total == base
  });

  it('lowering defense does not get re-inflated by a later, unrelated equip', () => {
    const { engine, player } = buildEngine();
    const baseBefore = player.baseDefenseValue;

    const choice: ChoiceDefinition = {
      id: 'oath',
      title: 'The Oath',
      description: 'test',
      options: [
        {
          id: 'fire',
          label: 'Embrace the fire',
          consequences: [{ type: 'modifyPermanentStat', stat: 'defense', delta: -3 }],
        },
      ],
    };

    engine.handlePlayerAction(new ExecuteChoiceAction(player, choice, 'fire'));
    expect(player.baseDefenseValue).toBe(baseBefore - 3);

    // Applying the same consequence again (simulating a second, independent story
    // beat) stacks on the raw base, not on a value already inflated by gear —
    // this is the bug the raw-base read guards against.
    applyConsequences(choice.options[0].consequences, engine, player);
    expect(player.baseDefenseValue).toBe(baseBefore - 6);
  });
});

describe('ChoiceConsequence — grantCompanion', () => {
  it('bypasses the trainer-bond gate and summons the named companion immediately', () => {
    const { engine, player } = buildEngine();
    expect(engine.getWorldFlag('companion_bonded')).toBe(false);
    expect(engine.companion).toBeNull();

    // CompanionRegistry is process-wide (P-22) — register directly here, mirroring
    // what GameEngine's constructor does for a manifest-declared companion.
    CompanionRegistry.register({
      id: 'test_frost_pet',
      name: 'Frost Whelp',
      stats: { hp: 20, maxHp: 20, attack: 4, defense: 2 },
      speed: 100,
      packWeightCapacity: 5000,
      packBulkCapacity: 4000,
    });

    const choice: ChoiceDefinition = {
      id: 'oath',
      title: 'The Oath',
      description: 'test',
      options: [
        {
          id: 'cold',
          label: 'Honor the oath',
          consequences: [{ type: 'grantCompanion', companionId: 'test_frost_pet' }],
        },
      ],
    };

    engine.handlePlayerAction(new ExecuteChoiceAction(player, choice, 'cold'));

    expect(engine.getWorldFlag('companion_bonded')).toBe(true);
    expect(engine.companion).not.toBeNull();
    expect(engine.companion?.name).toBe('Frost Whelp');
  });
});
