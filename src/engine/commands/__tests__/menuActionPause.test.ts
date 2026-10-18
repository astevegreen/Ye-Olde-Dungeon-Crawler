import { describe, it, expect } from 'vitest';
import { fixtureManifest, FIXTURE_GRIMOIRES } from '../../../../tests/fixtures/fixture-pack';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { PlaceGrimoireSpellAction } from '../../actions/spell-actions';
import { WaitAction } from '../../actions/wait';

/**
 * The Spellbook tab's edits run while the character menu holds the modal pause. With a foe in
 * view each edit costs a turn (grimoireEditCost); called straight through handlePlayerAction the
 * monsters never answered it. Through the bus (`performAction`) they do, as for a potion drunk
 * from the open inventory (R-pipe-6).
 */
describe('Spellbook grimoire edits from the paused character menu', () => {
  const orcAttacksAfter = (paused: boolean) => {
    const player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 2, y: 2 },
      stats: { hp: 200, maxHp: 200, attack: 5, defense: 0 },
      spellsKnown: ['spell_1', 'spell_2'],
      grimoireSystem: FIXTURE_GRIMOIRES,
    });
    const engine = new GameEngine({ map: new GameMap(12, 12, TILES.FLOOR), player, floor: 3, seed: 11, manifest: fixtureManifest });
    engine.addEntity(
      new Monster({
        id: 'orc',
        name: 'Orc',
        position: { x: 3, y: 2 },
        stats: { hp: 30, maxHp: 30, attack: 3, defense: 0 },
        speed: 100,
        definitionId: 'orc',
        aiType: 'melee',
        aiState: 'hunting',
        xpValue: 10,
      })
    );
    engine.updateFov();
    player.energy = 100;

    const costs: number[] = [];
    if (paused) engine.setPaused(true); // the character menu is open
    for (const x of [1, -1, 1]) {
      costs.push(engine.commandBus.performAction(new PlaceGrimoireSpellAction(player, 'spell_1', 'row', x, 0)).cost);
    }
    if (paused) engine.setPaused(false); // the menu closes
    engine.handlePlayerAction(new WaitAction(player));
    // Every swing the orc takes, hit or miss.
    return { costs, attacks: engine.messages.filter((m) => m.startsWith('Orc attacks') || m.startsWith('Orc misses')).length };
  };

  it('each edit that takes a turn is answered by the monsters, menu open or not', () => {
    const open = orcAttacksAfter(true);
    const closed = orcAttacksAfter(false);
    expect(closed.costs.every((c) => c > 0)).toBe(true); // the edits do take a turn with a foe in view
    expect(open.attacks).toBe(closed.attacks);
  });
});
