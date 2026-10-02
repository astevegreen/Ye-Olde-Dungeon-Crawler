import { describe, it, expect } from 'vitest';
import { DungeonArc } from '../../../engine/quest/dungeonArc';
import { GameEngine } from '../../../engine/engine';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { Player } from '../../../engine/entities/player';
import { Monster } from '../../../engine/entities/monster';
import { NPC } from '../../../engine/entities/npc';
import { MovementAction } from '../../../engine/actions/movement';
import { WaitAction } from '../../../engine/actions/wait';
import { DeathResolver } from '../../../engine/combat/deathResolver';
import type { ChoiceDefinition } from '../../../engine';
import { cotwManifest } from '../index';
import { COTW_QUEST } from '../quest';
import { COTW_TILES } from '../tiles';
import { DWARVEN_HEARTH_FLOOR } from '../vaults';
import { IRON_CLANS_FACTION, IRON_CLANS_MET_FLAG, IVALDA, IVALDA_ID, IVALDA_IN_TOWN_FLAG, IVALDA_TOWN_POSITION } from '../ironClans';

const standing = (e: GameEngine) => e.getFactionStanding(IRON_CLANS_FACTION);

function engineOn(floor: number): { engine: GameEngine; player: Player; map: GameMap } {
  const map = new GameMap(12, 12, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Sven', position: { x: 4, y: 5 }, stats: { hp: 40, maxHp: 40, attack: 10, defense: 5 } });
  const engine = new GameEngine({ map, player, floor, manifest: cotwManifest });
  return { engine, player, map };
}

/** Answers only the choice with this id, picking `optionId`; records what was offered. */
function answer(engine: GameEngine, id: string, optionId?: string): Array<{ id: string; enabled: string[] }> {
  const offered: Array<{ id: string; enabled: string[] }> = [];
  engine.onChoiceInteract = (choice: ChoiceDefinition, onSelect) => {
    if (choice.id !== id) return;
    offered.push({ id: choice.id, enabled: choice.options.map((o) => o.id) });
    if (optionId) onSelect(optionId);
  };
  return offered;
}

describe('The Iron Clans', () => {
  it('starts cold toward Thrym’s kin, and hidden until met', () => {
    const { engine } = engineOn(13);
    expect(standing(engine)).toBe(-15);
    expect(engine.getWorldFlag(IRON_CLANS_MET_FLAG)).toBe(false);
  });

  it('puts Ivalda by the Dwarven Hearth on Floor 13, carrying her choice', () => {
    const { engine } = engineOn(1);
    const floor = DungeonArc.generateFloor(DWARVEN_HEARTH_FLOOR, 104729, { ...COTW_QUEST }, cotwManifest, 1, undefined, engine.registries);
    const ivalda = floor.map.getEntityById(IVALDA_ID);
    expect(ivalda).toBeInstanceOf(NPC);
    expect((ivalda as NPC).choiceId).toBe(IVALDA.choiceId);
  });

  it('places one barrow on each of floors 12, 16 and 17', () => {
    const { engine } = engineOn(1);
    for (const [floorNo, tile] of [[12, 'duergar_barrow_1'], [16, 'duergar_barrow_2'], [17, 'duergar_barrow_3']] as const) {
      const floor = DungeonArc.generateFloor(floorNo, 7919 * floorNo, { ...COTW_QUEST }, cotwManifest, 1, undefined, engine.registries);
      let found = 0;
      for (let y = 0; y < floor.map.height; y++) for (let x = 0; x < floor.map.width; x++) if (floor.map.getTile(x, y)?.type === tile) found++;
      expect(found, `floor ${floorNo}`).toBe(1);
    }
  });

  it('meets the hero through Ivalda, whose forge opens again on every visit', () => {
    const { engine, map } = engineOn(13);
    map.addEntity(new NPC({ ...IVALDA, role: 'villager', position: { x: 5, y: 5 } }));
    const offered = answer(engine, 'ivalda_forge');

    engine.handlePlayerAction(new MovementAction(engine.player, 1, 0));
    engine.handlePlayerAction(new MovementAction(engine.player, 1, 0));
    expect(offered).toHaveLength(2);
    expect(engine.getWorldFlag(IRON_CLANS_MET_FLAG)).toBe(true);
    expect(engine.player.x).toBe(4); // she stands her ground
  });

  it('meets the hero through the Smithy’s Accord too', () => {
    const { engine, map } = engineOn(14);
    map.setTile(5, 5, COTW_TILES.find((t) => t.type === 'skaldic_runestone_2')!);
    answer(engine, 'skaldic_runestone_2', 'sharpen_forge');
    engine.handlePlayerAction(new MovementAction(engine.player, 1, 0));
    expect(engine.getWorldFlag(IRON_CLANS_MET_FLAG)).toBe(true);
  });

  it('rises for honoured barrows and falls for plundered ones', () => {
    const honour = engineOn(12);
    honour.map.setTile(5, 5, COTW_TILES.find((t) => t.type === 'duergar_barrow_1')!);
    answer(honour.engine, 'duergar_barrow_1', 'rites');
    honour.engine.handlePlayerAction(new MovementAction(honour.player, 1, 0));
    expect(standing(honour.engine)).toBe(-10);

    const loot = engineOn(16);
    loot.map.setTile(5, 5, COTW_TILES.find((t) => t.type === 'duergar_barrow_2')!);
    answer(loot.engine, 'duergar_barrow_2', 'plunder');
    loot.engine.handlePlayerAction(new MovementAction(loot.player, 1, 0));
    expect(standing(loot.engine)).toBe(-25);
    expect(loot.player.inventory.primaryPack.getItems().some((i) => i.definitionId === 'broadsword')).toBe(true);
  });

  it('rises for the first five Cinder-Gilded laid to rest, and once for the broken siphon', () => {
    const { engine, player, map } = engineOn(12);
    for (let i = 0; i < 7; i++) {
      const ash = new Monster({ id: `ash-${i}`, name: 'Cinder-Gilded Duergar', definitionId: 'cinder_gilded_duergar', position: { x: 8, y: 1 + i }, stats: { hp: 1, maxHp: 1, attack: 1, defense: 0 } });
      map.addEntity(ash);
      DeathResolver.resolveDeath(engine, player, ash);
      engine.handlePlayerAction(new WaitAction(player));
    }
    expect(standing(engine)).toBe(-5);

    engine.setWorldFlag('oath_resolved', true);
    engine.handlePlayerAction(new WaitAction(player));
    engine.setWorldFlag('savior_of_jarnvidr', true);
    engine.handlePlayerAction(new WaitAction(player));
    expect(standing(engine)).toBe(5);
  });

  it('opens Ivalda’s rewards with trust: the tempering at 0, the Steam Lance at 10', () => {
    const { engine, player, map } = engineOn(13);
    map.addEntity(new NPC({ ...IVALDA, role: 'villager', position: { x: 5, y: 5 } }));
    const baseAttack = player.baseAttackValue;

    answer(engine, 'ivalda_forge', 'temper');
    engine.handlePlayerAction(new MovementAction(player, 1, 0));
    expect(player.baseAttackValue).toBe(baseAttack); // still distrusted

    engine.worldState.factions[IRON_CLANS_FACTION] = 0;
    engine.handlePlayerAction(new MovementAction(player, 1, 0));
    expect(player.baseAttackValue).toBe(baseAttack + 2);
    engine.handlePlayerAction(new MovementAction(player, 1, 0));
    expect(player.baseAttackValue).toBe(baseAttack + 2); // only once

    answer(engine, 'ivalda_forge', 'steam_lance');
    engine.handlePlayerAction(new MovementAction(player, 1, 0));
    expect(player.spellsKnown).not.toContain('steam_lance');
    engine.worldState.factions[IRON_CLANS_FACTION] = 10;
    engine.handlePlayerAction(new MovementAction(player, 1, 0));
    expect(player.spellsKnown).toContain('steam_lance');
  });

  it('sends Ivalda up to Gunther’s armory once trusted, never mid-visit, and off the hearth', () => {
    const { engine, player } = engineOn(1);
    engine.changeFloor(DWARVEN_HEARTH_FLOOR);
    expect(engine.map.getEntityById(IVALDA_ID)).not.toBeNull();

    // Trusted while on her floor: she stays for now.
    engine.worldState.factions[IRON_CLANS_FACTION] = 0;
    engine.handlePlayerAction(new WaitAction(player));
    expect(engine.getWorldFlag(IVALDA_IN_TOWN_FLAG)).toBe(false);
    expect(engine.map.getEntityById(IVALDA_ID)).not.toBeNull();

    // Off it, word comes that she has gone; in town she is at the armory, with the town forge.
    engine.changeFloor(0);
    engine.handlePlayerAction(new WaitAction(player));
    expect(engine.getWorldFlag(IVALDA_IN_TOWN_FLAG)).toBe(true);
    expect(engine.messages.some((m) => m.includes('carried her coals to Bjarnarhaven'))).toBe(true);
    engine.handlePlayerAction(new WaitAction(player));
    const inTown = engine.map.getEntityById(IVALDA_ID) as NPC;
    expect([inTown.x, inTown.y]).toEqual([IVALDA_TOWN_POSITION.x, IVALDA_TOWN_POSITION.y]);
    expect(inTown.choiceId).toBe('ivalda_forge_town');
    expect(engine.map.getTile(inTown.x, inTown.y)?.walkable ?? engine.map.getTile(inTown.x, inTown.y)?.passable).toBe(true);
    engine.handlePlayerAction(new WaitAction(player));
    expect(engine.map.getAllEntities().filter((e) => e.id === IVALDA_ID)).toHaveLength(1);

    // Back at the hearth, she is gone from it.
    engine.changeFloor(DWARVEN_HEARTH_FLOOR);
    engine.handlePlayerAction(new WaitAction(player));
    expect(engine.map.getEntityById(IVALDA_ID)).toBeNull();
  });

  it('has the Haugbui stand aside for a trusted hero, until one is hurt or trust is lost', () => {
    const { engine, player, map } = engineOn(16);
    const wight = new Monster({ id: 'wight', name: 'Haugbui', definitionId: 'haugbui', position: { x: 6, y: 5 }, stats: { hp: 55, maxHp: 55, attack: 12, defense: 7 } });
    map.addEntity(wight);

    engine.handlePlayerAction(new WaitAction(player));
    expect(wight.faction).toBe('hostile');

    engine.worldState.factions[IRON_CLANS_FACTION] = 0;
    engine.handlePlayerAction(new WaitAction(player));
    expect(wight.faction).toBe('neutral');
    const hp = player.hp;
    for (let i = 0; i < 3; i++) engine.handlePlayerAction(new WaitAction(player));
    expect(player.hp).toBe(hp);

    engine.worldState.factions[IRON_CLANS_FACTION] = -1;
    engine.handlePlayerAction(new WaitAction(player));
    expect(wight.faction).toBe('hostile');

    engine.worldState.factions[IRON_CLANS_FACTION] = 5;
    wight.takeDamage(3);
    engine.handlePlayerAction(new WaitAction(player));
    expect(wight.faction).toBe('hostile');
  });
});
