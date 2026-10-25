import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../../engine/engine';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { Player } from '../../../engine/entities/player';
import { MovementAction } from '../../../engine/actions/movement';
import type { ChoiceDefinition } from '../../../engine';
import { cotwManifest } from '../index';
import { SKALDIC_RUNESTONE_LORE } from '../runestones';
import { SAP_SHRINE_CHOICES, SAP_SHRINE_LORE, SAP_SHRINE_PLACEMENTS, SAP_SHRINE_TILES } from '../sapShrines';

const SHRINES = [1, 2, 3, 4].map((n) => ({ n, id: `sap_shrine_${n}`, flag: `sap_shrine_${n}_read` }));
const FLOORS = [28, 33, 38, 41];

function engineOn(floor: number): { engine: GameEngine; player: Player; map: GameMap } {
  const map = new GameMap(12, 12, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Sven', position: { x: 4, y: 5 }, stats: { hp: 40, maxHp: 40, attack: 10, defense: 5 } });
  const engine = new GameEngine({ map, player, floor, manifest: cotwManifest });
  return { engine, player, map };
}

describe('the sap-shrines', () => {
  it('stand one per floor on 28, 33, 38 and 41, in the middle of a room, each behind its own choice', () => {
    const placed = (cotwManifest.fixedTilePlacements ?? []).filter((p) => p.tileId.startsWith('sap_shrine_'));
    expect(placed).toEqual(SAP_SHRINE_PLACEMENTS);
    expect(placed.map((p) => [p.floor, p.tileId, p.placement, p.requiresChoiceId])).toEqual(
      SHRINES.map((s, i) => [FLOORS[i], s.id, 'middle_room_center', s.id]),
    );
    const tiles = new Set((cotwManifest.tiles ?? []).map((t) => t.type));
    for (const p of placed) {
      expect(tiles.has(p.tileId), p.tileId).toBe(true);
      expect(cotwManifest.choices?.[p.requiresChoiceId!], p.tileId).toBeDefined();
    }
    // No galdr altar shares a shrine's floor.
    const others = (cotwManifest.fixedTilePlacements ?? []).filter((p) => !p.tileId.startsWith('sap_shrine_'));
    expect(others.filter((p) => FLOORS.includes(p.floor))).toEqual([]);
  });

  it('are the pack’s tiles, each handled by its own choice', () => {
    for (const tile of SAP_SHRINE_TILES) {
      const real = (cotwManifest.tiles ?? []).find((t) => t.type === tile.type);
      expect(real?.interactionHandlerId).toBe(tile.type);
      expect(cotwManifest.choices?.[real!.interactionHandlerId!]).toBe(SAP_SHRINE_CHOICES[tile.type]);
    }
  });

  it('offer one read-only option each: it sets the read flag and logs the verse, and nothing else', () => {
    for (const s of SHRINES) {
      const choice = SAP_SHRINE_CHOICES[s.id];
      expect(choice.cancelable).toBe(true);
      expect(choice.options).toHaveLength(1);
      const [read] = choice.options;
      expect(read.consequences.map((c) => c.type)).toEqual(['setFlag', 'logMessage']);
      expect(read.consequences[0]).toEqual({ type: 'setFlag', flag: s.flag, value: true });
      expect(choice.resolvedStates).toEqual([{ flag: s.flag, message: expect.stringMatching(/already read/) }]);
    }
  });

  it('keep each verse in the Story’s Carved Verses, distinct from each other and from the runestones', () => {
    const lore = cotwManifest.loreEntries ?? [];
    for (const entry of SAP_SHRINE_LORE) expect(lore).toContain(entry);
    expect(SAP_SHRINE_LORE.map((l) => l.flag)).toEqual(SHRINES.map((s) => s.flag));
    const all = [...SKALDIC_RUNESTONE_LORE, ...SAP_SHRINE_LORE];
    expect(new Set(all.map((l) => l.title)).size).toBe(all.length);
    expect(new Set(all.map((l) => l.verse)).size).toBe(all.length);
    expect(SAP_SHRINE_LORE.every((l) => l.verse.length > 0 && l.lore.length > 0 && !l.forgePair)).toBe(true);
  });

  it('read on stepping in: the flag is set, the verse logged, the hero unchanged; a second visit shows "already read"', () => {
    for (const [i, s] of SHRINES.entries()) {
      const { engine, player, map } = engineOn(FLOORS[i]);
      map.setTile(5, 5, (cotwManifest.tiles ?? []).find((t) => t.type === s.id)!);
      const offered: string[] = [];
      engine.onChoiceInteract = (choice: ChoiceDefinition, onSelect) => {
        offered.push(choice.id);
        onSelect('read');
      };
      const statsOf = (p: Player) => [p.hp, p.maxHp, p.attack, p.defense];
      const before = { stats: statsOf(player), items: player.inventory.primaryPack.getItems().length, factions: { ...engine.worldState.factions } };

      engine.handlePlayerAction(new MovementAction(player, 1, 0));
      expect(offered).toEqual([s.id]);
      expect(engine.getWorldFlag(s.flag)).toBe(true);
      const verse = SAP_SHRINE_LORE[i].verse.replace(/\n/g, ' ');
      expect(engine.messages.some((m) => m.includes(verse))).toBe(true);
      expect(statsOf(player)).toEqual(before.stats);
      expect(player.inventory.primaryPack.getItems()).toHaveLength(before.items);
      expect(engine.worldState.factions).toEqual(before.factions);

      engine.handlePlayerAction(new MovementAction(player, -1, 0));
      engine.handlePlayerAction(new MovementAction(player, 1, 0));
      expect(offered).toEqual([s.id]);
      expect(engine.messages.at(-1)).toBe(SAP_SHRINE_CHOICES[s.id].resolvedStates![0].message);
    }
  });
});
