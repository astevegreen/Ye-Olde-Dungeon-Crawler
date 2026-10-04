import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { MeleeAttackAction } from '../actions/combat';
import { MovementAction } from '../actions/movement';
import { ExecuteChoiceAction } from '../actions/choiceAction';
import { sumWorn } from '../items/wornModifiers';
import { serializeGame, deserializeGame } from '../storage/serializer';
import type { GameContentManifest, PerkDefinition } from '../types/manifest';
import type { ChoiceDefinition } from '../types/choice';

/**
 * Tracker 3.6 (Q27 "Separate sources."): perks are pack data granted by choices, held on the
 * hero, saved by id, and read where worn modifiers are read.
 */
const BERSERK: PerkDefinition = {
  id: 'berserk',
  name: 'Berserkergang',
  description: 'Melee damage +50%.',
  source: 'saga',
  effects: { meleeDamageMultiplier: 1.5 },
};
const NIMBLE: PerkDefinition = {
  id: 'nimble',
  name: 'Nimble',
  description: 'Evasion +100%.',
  source: 'milestone',
  effects: { evasionBonus: 1 },
};
const SAGA_10: ChoiceDefinition = {
  id: 'saga_10',
  title: 'The First Path',
  description: 'Choose.',
  options: [
    { id: 'berserk', label: 'Berserkergang', consequences: [{ type: 'grantPerk', perkId: 'berserk' }] },
    { id: 'jarl', label: 'Jarl', consequences: [{ type: 'modifyAttribute', attribute: 'strength', delta: 2 }, { type: 'modifyAttribute', attribute: 'constitution', delta: 2 }] },
  ],
  cancelable: false,
};

function build(level = 1) {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 }, stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 }, level });
  const foe = new Monster({ id: 'foe', name: 'Foe', position: { x: 6, y: 5 }, stats: { hp: 1000, maxHp: 1000, attack: 10, defense: 0 }, speed: 100, definitionId: 'foe', aiType: 'melee', xpValue: 1 });
  map.addEntity(player);
  map.addEntity(foe);
  const manifest = {
    id: 'test',
    name: 'Test',
    monsters: [],
    items: [],
    spells: [],
    perks: [BERSERK, NIMBLE],
    choices: { saga_10: SAGA_10 },
    levelMilestones: [{ id: 'saga_10', level: 10, choiceId: 'saga_10' }],
  } as unknown as GameContentManifest;
  const engine = new GameEngine({ map, player, manifest });
  player.gainEnergy(100);
  return { engine, player, foe };
}

describe('perks', () => {
  it('a granted perk is read where worn modifiers are read: Berserkergang makes a 10 blow a 15', () => {
    const { engine, player, foe } = build();
    expect(player.grantPerk(BERSERK)).toBe(true);
    expect(player.grantPerk(BERSERK)).toBe(false); // held once
    expect(player.hasPerk('berserk')).toBe(true);
    expect(sumWorn(player, 'meleeDamageMultiplier')).toBe(1.5);
    new MeleeAttackAction(player, foe).perform(engine);
    expect(1000 - foe.hp).toBe(15);
  });

  it('a perk’s evasion joins the defender’s roll like a worn ring’s', () => {
    const { engine, player, foe } = build();
    player.grantPerk(NIMBLE);
    foe.gainEnergy(100);
    new MeleeAttackAction(foe, player).perform(engine);
    expect(player.hp).toBe(100);
  });

  it('the grantPerk and modifyAttribute consequences take effect through a choice', () => {
    const { engine, player } = build();
    engine.handlePlayerAction(new ExecuteChoiceAction(player, SAGA_10, 'berserk'));
    expect(player.hasPerk('berserk')).toBe(true);
    const str = player.strength;
    const con = player.constitution;
    const maxHp = player.maxHp;
    engine.handlePlayerAction(new ExecuteChoiceAction(player, SAGA_10, 'jarl'));
    expect(player.strength).toBe(str + 2);
    expect(player.constitution).toBe(con + 2);
    expect(player.maxHp).toBe(maxHp + 4);
  });

  it('a level milestone offers its choice once, on the first move at or past the level', () => {
    const { engine, player } = build(9);
    const offered: string[] = [];
    engine.onChoiceInteract = (choice) => offered.push(choice.id);
    engine.handlePlayerAction(new MovementAction(player, 0, 1));
    expect(offered).toEqual([]);

    player.gainXp(100_000); // past level 10 (no cap in this manifest)
    expect(player.level).toBeGreaterThanOrEqual(10);
    player.gainEnergy(100);
    engine.handlePlayerAction(new MovementAction(player, 0, 1));
    expect(offered).toEqual(['saga_10']);
    player.gainEnergy(100);
    engine.handlePlayerAction(new MovementAction(player, 0, 1));
    expect(offered).toEqual(['saga_10']);
    expect(engine.getWorldFlag('saga_10_offered')).toBe(true);
  });

  it('perks survive a save and load by id, and one the pack no longer declares is dropped', () => {
    const { engine, player } = build();
    player.grantPerk(BERSERK);
    player.grantPerk(NIMBLE);
    const save = serializeGame(engine, { id: 'p', name: 'Hero', level: 1, floor: 1, lastSaved: 0, hp: 100, maxHp: 100, strength: 15 });
    expect(save.player.perks).toEqual(['berserk', 'nimble']);

    const loaded = deserializeGame(save, engine.manifest);
    expect(loaded.engine.player.perkIds).toEqual(['berserk', 'nimble']);
    expect(sumWorn(loaded.engine.player, 'meleeDamageMultiplier')).toBe(1.5);

    const narrower = { ...engine.manifest, perks: [BERSERK] } as GameContentManifest;
    expect(deserializeGame(save, narrower).engine.player.perkIds).toEqual(['berserk']);
  });
});
