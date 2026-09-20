import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, TILES, Player } from '../../index';
import { MovementAction } from '../movement';
import { serializeGame, deserializeGame } from '../../storage/serializer';
import type { ChoiceDefinition } from '../../types/choice';
import type { AttributeMilestoneTrigger, GameContentManifest } from '../../types/manifest';

/**
 * AttributeMilestoneTrigger (ARCHITECTURE.md §3): unlocks a choice once an attribute
 * reaches `threshold`. Sibling of StoryChoiceTrigger with identical one-time
 * `<id>_offered` persistence semantics.
 */
const TEST_CHOICE_DEX: ChoiceDefinition = {
  id: 'milestone_dex_test',
  title: 'Dexterity Milestone',
  description: 'Test dex choice',
  options: [
    {
      id: 'opt_attack',
      label: 'Precision (+2 Attack)',
      consequences: [
        { type: 'setFlag', flag: 'dex_chosen_attack', value: true },
        { type: 'modifyPermanentStat', stat: 'attack', delta: 2 },
      ],
    },
    {
      id: 'opt_defense',
      label: 'Evasion (+2 Defense)',
      consequences: [
        { type: 'setFlag', flag: 'dex_chosen_defense', value: true },
        { type: 'modifyPermanentStat', stat: 'defense', delta: 2 },
      ],
    },
  ],
  cancelable: false,
};

const TEST_TRIGGER: AttributeMilestoneTrigger = {
  id: 'dex_15',
  attribute: 'dexterity',
  threshold: 15,
  choiceId: 'milestone_dex_test',
};

function buildEngine(manifestOverrides?: Partial<GameContentManifest>, initialDex = 10) {
  const map = new GameMap(10, 10, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 3, y: 3 },
    stats: { hp: 100, maxHp: 100, attack: 10, defense: 5 },
  });
  player.dexterity = initialDex;
  const engine = new GameEngine({ map, player });
  (engine.manifest as any).choices = {
    milestone_dex_test: TEST_CHOICE_DEX,
    ...(manifestOverrides?.choices ?? {}),
  };
  if (manifestOverrides && 'attributeMilestones' in manifestOverrides) {
    (engine.manifest as any).attributeMilestones = manifestOverrides.attributeMilestones;
  } else {
    (engine.manifest as any).attributeMilestones = [TEST_TRIGGER];
  }
  return { engine, player, map };
}

describe('AttributeMilestoneTrigger', () => {
  it('crossing the threshold offers the choice exactly once (second move does not re-offer)', () => {
    const { engine, player } = buildEngine();
    let offerCount = 0;
    let selectedCallback: ((optionId: string) => void) | undefined;
    engine.onChoiceInteract = (_choice, cb) => {
      offerCount++;
      selectedCallback = cb;
    };

    // Below threshold (dex 10)
    engine.handlePlayerAction(new MovementAction(player, 0, 1));
    expect(offerCount).toBe(0);

    // Cross threshold (dex 15)
    player.dexterity = 15;
    engine.handlePlayerAction(new MovementAction(player, 0, -1));
    expect(offerCount).toBe(1);
    expect(engine.getWorldFlag('dex_15_offered')).toBe(true);

    // Pick choice
    selectedCallback?.('opt_attack');
    expect(engine.getWorldFlag('dex_chosen_attack')).toBe(true);
    expect(player.attack).toBe(12);

    // Second move does not re-offer
    engine.handlePlayerAction(new MovementAction(player, 0, 1));
    expect(offerCount).toBe(1);
  });

  it('below the threshold, nothing fires', () => {
    const { engine, player } = buildEngine({}, 14);
    let offered = false;
    engine.onChoiceInteract = () => {
      offered = true;
    };

    engine.handlePlayerAction(new MovementAction(player, 0, 1));
    engine.handlePlayerAction(new MovementAction(player, 0, -1));
    expect(offered).toBe(false);
    expect(engine.getWorldFlag('dex_15_offered')).toBe(false);
  });

  it('a manifest declaring no attributeMilestones fires nothing (proves warcraft is unaffected)', () => {
    const { engine, player } = buildEngine({ attributeMilestones: undefined }, 20);
    let offered = false;
    engine.onChoiceInteract = () => {
      offered = true;
    };

    engine.handlePlayerAction(new MovementAction(player, 0, 1));
    expect(offered).toBe(false);
  });

  it('a milestone whose choiceId is missing from manifest.choices is skipped without throwing', () => {
    const brokenTrigger: AttributeMilestoneTrigger = {
      id: 'missing_choice',
      attribute: 'strength',
      threshold: 10,
      choiceId: 'non_existent_choice',
    };
    const { engine, player } = buildEngine({ attributeMilestones: [brokenTrigger] }, 15);
    player.strength = 15;

    let offered = false;
    engine.onChoiceInteract = () => {
      offered = true;
    };

    expect(() => {
      engine.handlePlayerAction(new MovementAction(player, 0, 1));
    }).not.toThrow();

    expect(offered).toBe(false);
    expect(engine.getWorldFlag('missing_choice_offered')).toBe(false);
  });

  it('the <id>_offered flag survives a save/load round trip, so the choice is not re-offered', () => {
    const { engine, player } = buildEngine({}, 15);
    let offerCount = 0;
    engine.onChoiceInteract = () => {
      offerCount++;
    };

    // First move offers the choice and sets dex_15_offered flag
    engine.handlePlayerAction(new MovementAction(player, 0, 1));
    expect(offerCount).toBe(1);
    expect(engine.getWorldFlag('dex_15_offered')).toBe(true);

    // Save and reload
    const saved = serializeGame(engine);
    const restored = deserializeGame(JSON.parse(JSON.stringify(saved)), engine.manifest);
    expect(restored.engine.getWorldFlag('dex_15_offered')).toBe(true);

    let restoredOfferCount = 0;
    restored.engine.onChoiceInteract = () => {
      restoredOfferCount++;
    };

    // Move on restored engine — should not re-offer
    restored.engine.handlePlayerAction(new MovementAction(restored.engine.player, 0, 1));
    expect(restoredOfferCount).toBe(0);
  });
});
