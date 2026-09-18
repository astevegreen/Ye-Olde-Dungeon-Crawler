import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../../engine';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { Player } from '../../../engine/entities/player';
import { Monster } from '../../../engine/entities/monster';
import { MovementAction } from '../../../engine/actions/movement';
import { MeleeAttackAction } from '../../../engine/actions/combat';
import { WaitAction } from '../../../engine/actions/wait';
import { COTW_CHOICES } from '../choices';
import { COTW_COMPANIONS } from '../companions';
import { OATH_TRIGGER, OATH_TIMED_EVENT, OATH_WARLOCKS_REQUIRED } from '../oath';
import { CompanionRegistry } from '../../../engine/entities/companion';

function buildEngine() {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 3, y: 3 },
    stats: { hp: 200, maxHp: 200, attack: 80, defense: 5 },
  });
  const engine = new GameEngine({ map, player });
  (engine.manifest as any).choices = COTW_CHOICES;
  (engine.manifest as any).storyChoiceTriggers = [OATH_TRIGGER];
  (engine.manifest as any).timedEvents = [OATH_TIMED_EVENT];
  CompanionRegistry.registerAll(COTW_COMPANIONS);
  return { engine, player, map };
}

function slayWarlock(engine: GameEngine, map: GameMap, at: { x: number; y: number }) {
  const warlock = new Monster({
    id: `warlock-${at.x}-${at.y}`,
    name: 'Troll-Wife Warlock',
    definitionId: 'troll_wife_warlock',
    position: at,
    stats: { hp: 1, maxHp: 1, attack: 1, defense: 0 },
  });
  map.addEntity(warlock);
  engine.handlePlayerAction(new MeleeAttackAction(engine.player, warlock));
}

describe('The Oath (integration, real cotw content)', () => {
  it('honoring the oath: -2 attack, +3 defense, and a Frost-Ward Hound, exactly once', () => {
    const { engine, player, map } = buildEngine();
    const baseAttack = player.baseAttackValue;
    const baseDefense = player.baseDefenseValue;

    let choicePicked: ((optionId: string) => void) | undefined;
    engine.onChoiceInteract = (_choice, onOptionSelected) => {
      choicePicked = onOptionSelected;
    };

    const positions = [
      { x: 4, y: 3 },
      { x: 4, y: 4 },
      { x: 4, y: 5 },
    ];
    expect(positions.length).toBe(OATH_WARLOCKS_REQUIRED);
    let toggle = 1;
    for (const pos of positions) {
      slayWarlock(engine, map, pos);
      engine.handlePlayerAction(new MovementAction(player, 0, toggle)); // any move re-checks triggers
      toggle = -toggle;
    }

    expect(choicePicked).toBeDefined();
    choicePicked!('honor');

    expect(player.baseAttackValue).toBe(baseAttack - 2);
    expect(player.baseDefenseValue).toBe(baseDefense + 3);
    expect(engine.getWorldFlag('blood_oath_honored')).toBe(true);
    expect(engine.getWorldFlag('oath_resolved')).toBe(true);
    expect(engine.companion?.name).toBe('Frost-Ward Hound');
  });

  it('breaking the oath: +3 attack, -2 defense, and an Ember-Fang Wolf', () => {
    const { engine, player, map } = buildEngine();
    const baseAttack = player.baseAttackValue;
    const baseDefense = player.baseDefenseValue;

    let choicePicked: ((optionId: string) => void) | undefined;
    engine.onChoiceInteract = (_choice, onOptionSelected) => {
      choicePicked = onOptionSelected;
    };

    let toggle = 1;
    for (let i = 0; i < OATH_WARLOCKS_REQUIRED; i++) {
      slayWarlock(engine, map, { x: 4, y: 3 + i });
      engine.handlePlayerAction(new MovementAction(player, 0, toggle));
      toggle = -toggle;
    }

    choicePicked!('break');

    expect(player.baseAttackValue).toBe(baseAttack + 3);
    expect(player.baseDefenseValue).toBe(baseDefense - 2);
    expect(engine.getWorldFlag('blood_oath_broken')).toBe(true);
    expect(engine.companion?.name).toBe('Ember-Fang Wolf');
  });

  it('hesitating past the timed event\'s turnLimit defaults to a worse outcome than either branch', () => {
    const { engine, player, map } = buildEngine();
    const baseAttack = player.baseAttackValue;
    const baseDefense = player.baseDefenseValue;
    const hpBefore = player.hp;

    // Never call onChoiceInteract's callback — simulate a player who lets the
    // choice modal sit unresolved (or, more realistically, one qualifying kill
    // without reaching the full threshold yet, so the countdown is running but the
    // choice hasn't unlocked).
    engine.onChoiceInteract = () => {};

    slayWarlock(engine, map, { x: 4, y: 3 });
    engine.handlePlayerAction(new MovementAction(player, 0, 1)); // starts oath_climax_started
    expect(engine.getWorldFlag('oath_climax_started')).toBe(true);

    for (let i = 0; i < OATH_TIMED_EVENT.turnLimit + 2; i++) {
      engine.handlePlayerAction(new WaitAction(player));
    }

    expect(engine.getWorldFlag('oath_defaulted')).toBe(true);
    expect(engine.getWorldFlag('oath_resolved')).toBe(true);
    // Worse than either deliberate branch: both stats move the wrong way, not just one.
    expect(player.baseAttackValue).toBe(baseAttack - 1);
    expect(player.baseDefenseValue).toBe(baseDefense - 1);
    expect(player.hp).toBeLessThan(hpBefore);
    expect(engine.companion).toBeNull();
  });
});
