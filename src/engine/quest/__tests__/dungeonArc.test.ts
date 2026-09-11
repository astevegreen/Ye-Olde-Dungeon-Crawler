import { describe, it, expect } from 'vitest';
import { DungeonArc } from '../dungeonArc';
import { Player } from '../../entities/player';
import { createTestSunStone } from '../../__fixtures__/testHelpers';
import { QUEST_RELIC_ID } from '../types';

describe('DungeonArc & Floor 5 Chieftain Encounter', () => {
  it('identifies Floor 5 as the Boss Floor', () => {
    expect(DungeonArc.isBossFloor(1)).toBe(false);
    expect(DungeonArc.isBossFloor(4)).toBe(false);
    expect(DungeonArc.isBossFloor(5)).toBe(true);
  });

  it('generates procedural dungeon floors (1 to 4) with both stairs up and down', () => {
    const floor2 = DungeonArc.generateFloor(2, 42);
    expect(floor2.map.width).toBe(50);
    expect(floor2.map.height).toBe(35);
    expect(floor2.stairsUp).toBeDefined();
    expect(floor2.stairsDown).toBeDefined();
    expect(floor2.boss).toBeUndefined();

    const upTile = floor2.map.getTile(floor2.stairsUp!.x, floor2.stairsUp!.y);
    expect(upTile?.type).toBe('stairs_up');

    const downTile = floor2.map.getTile(floor2.stairsDown!.x, floor2.stairsDown!.y);
    expect(downTile?.type).toBe('stairs_down');
  });

  it('generates Floor 5 (The Chieftain\'s Lair) with Hrungnir, stairs up, and no stairs down', () => {
    const floor5 = DungeonArc.generateFloor(5);
    expect(floor5.map.width).toBe(44);
    expect(floor5.map.height).toBe(34);
    expect(floor5.stairsUp).toBeDefined();
    expect(floor5.stairsDown).toBeUndefined(); // Climax floor has no deeper stairs
    expect(floor5.boss).toBeDefined();

    const boss = floor5.boss!;
    expect(boss.name).toBe('Hrungnir the Hill Giant Chieftain');
    expect(boss.hp).toBe(120);
    expect(boss.attack).toBe(18);
    expect(boss.defense).toBe(8);

    // Guaranteed Sun-Stone of Freyr loot drop rule
    const sunStoneRule = boss.lootTable.find((r) => {
      const itm = r.generate('test-check');
      return itm.name === 'The Sun-Stone of Freyr';
    });
    expect(sunStoneRule).toBeDefined();
    expect(sunStoneRule!.chance).toBe(1.0);
  });

  it('detects when the player carries The Sun-Stone of Freyr', () => {
    const player = new Player({
      id: 'relic-carrier',
      name: 'Ragnor',
      position: { x: 5, y: 5 },
    });

    expect(DungeonArc.isRelicInPlayerPossession(player)).toBe(false);

    // Add Sun-Stone into player's pack
    const sunStone = createTestSunStone(QUEST_RELIC_ID);
    player.inventory.primaryPack.addItem(sunStone);

    expect(DungeonArc.isRelicInPlayerPossession(player)).toBe(true);
  });
});
