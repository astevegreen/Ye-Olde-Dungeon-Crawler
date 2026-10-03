import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../../engine';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { Player } from '../../../engine/entities/player';
import { Monster } from '../../../engine/entities/monster';
import { MovementAction } from '../../../engine/actions/movement';
import { MeleeAttackAction } from '../../../engine/actions/combat';
import { WaitAction } from '../../../engine/actions/wait';
import { ClimbStairsAction } from '../../../engine/actions/stairs';
import { ChannelRuneOfReturnAction } from '../../../engine/magic/runeOfReturn';
import { cotwManifest } from '../index';
import { OATH_GUARDIAN_ID } from '../oath';
import { HEARTH_TEAR_ID, RELIC_RECOVERED_FLAG } from '../relic';
import { makeLootItem } from '../items/makeItem';

/**
 * The Matriarch's Blood-Oath comes when the Sun-Chariot Warden is dead and the Hearth-Tear
 * is in hand, before the hero leaves the floor. It once ran on a countdown from the first
 * troll-wife warlock's death; that countdown is gone.
 */
function buildEngine() {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 3, y: 3 },
    stats: { hp: 200, maxHp: 200, attack: 80, defense: 5 },
    // Under every attribute milestone, so no other choice opens on a step.
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
  });
  const engine = new GameEngine({ map, player, floor: 25, manifest: cotwManifest });
  const offers: string[] = [];
  let pick: ((optionId: string) => void) | undefined;
  engine.onChoiceInteract = (choice, onOptionSelected) => {
    offers.push(choice.id);
    pick = onOptionSelected;
  };
  return { engine, player, map, offers, choose: (optionId: string) => pick!(optionId) };
}

function slay(engine: GameEngine, map: GameMap, definitionId: string, at: { x: number; y: number }) {
  const monster = new Monster({
    id: `${definitionId}-${at.x}-${at.y}`,
    name: definitionId,
    definitionId,
    position: at,
    stats: { hp: 1, maxHp: 1, attack: 1, defense: 0 },
  });
  map.addEntity(monster);
  engine.handlePlayerAction(new MeleeAttackAction(engine.player, monster));
}

/** The Warden falls and the hero takes the Hearth-Tear; the relic hook notices on the next action. */
function winTheHearthTear(engine: GameEngine, map: GameMap) {
  slay(engine, map, OATH_GUARDIAN_ID, { x: 4, y: 3 });
  engine.player.inventory.primaryPack.addItem(makeLootItem(HEARTH_TEAR_ID, 'shard', () => 0.5));
  engine.handlePlayerAction(new WaitAction(engine.player));
  expect(engine.getWorldFlag(RELIC_RECOVERED_FLAG)).toBe(true);
}

describe("The Matriarch's Blood-Oath (real cotw manifest)", () => {
  it('has no countdown: warlock kills start nothing and offer nothing', () => {
    const { engine, player, map, offers } = buildEngine();
    expect((cotwManifest.timedEvents ?? []).map((e) => e.id)).not.toContain('oath_climax');

    for (let i = 0; i < 3; i++) slay(engine, map, 'troll_wife_warlock', { x: 4, y: 3 + i });
    engine.handlePlayerAction(new MovementAction(player, 0, 1));

    expect(offers).toEqual([]);
    expect(engine.getWorldFlag('oath_climax_started')).toBe(false);
  });

  it('waits for the Hearth-Tear after the Warden falls, then opens on the next move', () => {
    const { engine, player, map, offers } = buildEngine();
    slay(engine, map, OATH_GUARDIAN_ID, { x: 4, y: 3 });
    engine.handlePlayerAction(new MovementAction(player, 0, 1));
    expect(offers).toEqual([]);

    winTheHearthTear(engine, map);
    engine.handlePlayerAction(new MovementAction(player, 0, -1));
    expect(offers).toEqual(['oath_hearth']);
  });

  it('honoring the oath: -2 attack, +3 defense and a Frost-Ward Hound', () => {
    const { engine, player, map, choose } = buildEngine();
    const baseAttack = player.baseAttackValue;
    const baseDefense = player.baseDefenseValue;
    winTheHearthTear(engine, map);
    engine.handlePlayerAction(new MovementAction(player, 0, 1));
    choose('honor');

    expect(player.baseAttackValue).toBe(baseAttack - 2);
    expect(player.baseDefenseValue).toBe(baseDefense + 3);
    expect(engine.getWorldFlag('blood_oath_honored')).toBe(true);
    expect(engine.getWorldFlag('oath_resolved')).toBe(true);
    expect(engine.companion?.name).toBe('Frost-Ward Hound');
  });

  it('breaking the oath: +3 attack, -2 defense and an Ember-Fang Wolf', () => {
    const { engine, player, map, choose } = buildEngine();
    const baseAttack = player.baseAttackValue;
    const baseDefense = player.baseDefenseValue;
    winTheHearthTear(engine, map);
    engine.handlePlayerAction(new MovementAction(player, 0, 1));
    choose('break');

    expect(player.baseAttackValue).toBe(baseAttack + 3);
    expect(player.baseDefenseValue).toBe(baseDefense - 2);
    expect(engine.getWorldFlag('blood_oath_broken')).toBe(true);
    expect(engine.companion?.name).toBe('Ember-Fang Wolf');
  });

  it('holds the stairs and the Rune of Return until the matriarch has made her offer', () => {
    const { engine, player, map } = buildEngine();
    winTheHearthTear(engine, map);

    for (const leave of [new ClimbStairsAction(player), new ChannelRuneOfReturnAction(player)]) {
      const held = engine.handlePlayerAction(leave);
      expect(held.success).toBe(false);
      expect(held.cost).toBe(0);
      expect(held.message).toMatch(/forge-smoke/);
    }

    engine.handlePlayerAction(new MovementAction(player, 0, 1)); // the offer opens
    const after = engine.handlePlayerAction(new ClimbStairsAction(player));
    expect(after.message ?? '').not.toMatch(/forge-smoke/);
  });

  it('never re-offers a save whose old countdown already ran out', () => {
    const { engine, player, map, offers } = buildEngine();
    engine.setWorldFlag('oath_resolved', true); // what the expired countdown set
    winTheHearthTear(engine, map);
    engine.handlePlayerAction(new MovementAction(player, 0, 1));

    expect(offers).toEqual([]);
    expect(engine.handlePlayerAction(new ClimbStairsAction(player)).message ?? '').not.toMatch(/forge-smoke/);
  });
});
