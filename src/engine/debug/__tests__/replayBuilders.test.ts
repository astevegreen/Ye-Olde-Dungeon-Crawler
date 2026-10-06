import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { Item } from '../../items/item';
import { PotionItem } from '../../items/consumables';
import type { Action } from '../../actions/action';
import { MovementAction } from '../../actions/movement';
import { SearchAction } from '../../actions/search';
import { DisarmTrapAction } from '../../actions/disarm';
import { SmartCloseDoorAction } from '../../actions/door';
import { PickUpAction, DropAction, EquipAction, UnequipAction } from '../../actions/inventory-actions';
import { MeleeAttackAction } from '../../actions/combat';
import { RangedAttackAction } from '../../actions/rangedAttack';
import { CastSpellAction, ArrangeGrimoireSlotAction, DrinkPotionAction } from '../../actions/spell-actions';
import { IdentifyAction } from '../../actions/identificationActions';
import { RestTurnAction } from '../../actions/autoRest';
import { describeAction } from '../actionTrail';
import { rebuildAction, replayActionTrail } from '../replay';

/**
 * Every action the game constructs can reach `handlePlayerAction`, and so the trail, unless
 * only monsters take it. An action with no replay builder stops a replay dead at its first
 * entry (R-dbg-1), so each one needs a builder in `debug/replay.ts`, or a place below.
 */

/** Taken only by monsters, never by the hero: never in the trail. */
const MONSTER_ONLY = new Set(['WindUpDeclareAction', 'WindUpExecuteAction', 'ChannelRiteAction']);
/** Kept out of the trail by the flight recorder (`UNTRAILED`): the next action checkpoints. */
const UNTRAILED = new Set(['ExecuteChoiceAction']);

const SRC = path.resolve(__dirname, '../../..');

function productionSources(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== '__fixtures__') productionSources(full, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(fs.readFileSync(full, 'utf8'));
    }
  }
  return out;
}

describe('every action the game issues can be replayed', () => {
  const sources = productionSources(SRC).join('\n');
  const actionClasses = [...sources.matchAll(/class (\w+)(?: extends \w+)? implements Action\b/g)].map((m) => m[1]);

  it('finds the action classes', () => {
    expect(actionClasses).toContain('MovementAction');
    expect(actionClasses.length).toBeGreaterThan(20);
  });

  it('has a replay builder for each one production code constructs', () => {
    const engine = new GameEngine({ map: new GameMap(8, 8, TILES.FLOOR), player: new Player({ position: { x: 2, y: 2 } }) });
    const issued = actionClasses.filter((name) => new RegExp(`new ${name}\\(`).test(sources));
    const missing = issued.filter((name) => {
      if (MONSTER_ONLY.has(name) || UNTRAILED.has(name)) return false;
      const res = replayActionTrail(engine, [{ seq: 0, turn: 0, floor: 0, action: name, params: {} }]);
      return /no replay builder/.test(res.stoppedAt?.reason ?? '');
    });
    expect(missing).toEqual([]);
  });
});

/**
 * A builder that drops a parameter replays a different action (R-pipe-5: a free pickup came
 * back costed). Each action below is recorded, rebuilt, and recorded again: the two
 * entries must match. One that names an item the replay no longer has must not rebuild.
 */
describe('a rebuilt action is the action that was recorded', () => {
  function world() {
    const map = new GameMap(12, 12, TILES.FLOOR);
    const player = new Player({ id: 'hero', position: { x: 2, y: 2 } });
    const engine = new GameEngine({ map, player, seed: 1 });
    const goblin = new Monster({ id: 'gob', name: 'Goblin', position: { x: 3, y: 2 }, stats: { hp: 10, maxHp: 10, attack: 1, defense: 0 }, definitionId: 'gob', aiType: 'melee' });
    engine.addEntity(goblin);
    const thing = (id: string) => new Item({ id, name: id, category: 'misc', weight: 10, bulk: 1, identified: true });
    map.addItemAt(2, 2, thing('on-ground'));
    for (const id of ['in-pack', 'javelin', 'blade']) player.inventory.primaryPack.addItem(thing(id));
    const potion = new PotionItem({ id: 'pot', name: 'Healing', definitionId: 'heal', potionType: 'health', potency: 1, identified: true });
    player.inventory.primaryPack.addItem(potion);
    return { engine, player, goblin, potion, get: (id: string) => player.inventory.findItemById(id)! };
  }

  it('round-trips every kind of parameter', () => {
    const { engine, player, goblin, potion, get } = world();
    const actions: Action[] = [
      new MovementAction(player, 1, -1),
      new SearchAction(player, engine.rng, 3),
      new DisarmTrapAction(player, 4, 5),
      new SmartCloseDoorAction(player, { dx: 0, dy: 1 }),
      new PickUpAction(player, 'on-ground', true),
      new DropAction(player, get('in-pack'), 'pack'),
      new EquipAction(player, 'blade', 'mainHand'),
      new UnequipAction(player, 'offHand'),
      new MeleeAttackAction(player, goblin),
      new RangedAttackAction(player, 6, 7, get('javelin')),
      new CastSpellAction(player, 'magic_missile', 5, 6, 'in-pack', true, true, 2),
      new ArrangeGrimoireSlotAction(player, 1, 'heal_minor'),
      new DrinkPotionAction(player, potion),
      new IdentifyAction(player, 'in-pack'),
      new RestTurnAction(player),
    ];
    for (const action of actions) {
      const recorded = { seq: 0, turn: 0, floor: 0, ...describeAction(action) };
      const rebuilt = rebuildAction(engine, recorded);
      expect(rebuilt, recorded.action).not.toBeNull();
      expect(describeAction(rebuilt!), recorded.action).toEqual(describeAction(action));
    }
  });

  it('stops at an entry naming an item that is gone (R-dbg-7)', () => {
    const { engine, player, get } = world();
    const entries = [
      describeAction(new RangedAttackAction(player, 6, 7, get('javelin'))),
      describeAction(new PickUpAction(player, 'on-ground', true)),
      describeAction(new EquipAction(player, 'blade')),
    ];
    for (const id of ['javelin', 'blade']) player.inventory.primaryPack.removeItem(id);
    engine.map.removeItemAt(2, 2, 'on-ground');

    for (const entry of entries) expect(rebuildAction(engine, { seq: 0, turn: 0, floor: 0, ...entry }), entry.action).toBeNull();
  });
});
