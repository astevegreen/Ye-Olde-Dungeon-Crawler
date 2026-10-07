import { describe, it, expect } from 'vitest';
import { DungeonArc } from '../dungeonArc';
import { Player } from '../../entities/player';
import { createTestSunStone } from '../../__fixtures__/testHelpers';
import type { QuestArcDefinition } from '../../types/manifest';
import { COTW_MONSTERS } from '../../../content/cotw/monsters';
import { COTW_ITEMS } from '../../../content/cotw/items';
import { Container } from '../../items/container';
import { Item } from '../../items/item';

/** The relic a quest names (`QuestArcDefinition.relicItemId`). */
const RELIC_ID = 'quest-relic';

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

  it('generates Floor 5 (The Chieftain\'s Lair) with stairs up, and no stairs down', () => {
    const floor5 = DungeonArc.generateFloor(5);
    expect(floor5.map.width).toBe(44);
    expect(floor5.map.height).toBe(34);
    expect(floor5.stairsUp).toBeDefined();
    expect(floor5.stairsDown).toBeUndefined(); // Climax floor has no deeper stairs
    expect(floor5.boss).toBeDefined();

    const boss = floor5.boss!;
    expect(boss.name).toBe('Dungeon Boss');
    expect(boss.hp).toBe(120);
    expect(boss.attack).toBe(18);
    expect(boss.defense).toBe(8);

    // Guaranteed relic loot drop rule
    const relicRule = boss.lootTable.find((r) => {
      const itm = r.generate('test-check', () => 0.5)!;
      return itm.name === 'Ancient Relic';
    });
    expect(relicRule).toBeDefined();
    expect(relicRule!.chance).toBe(1.0);
  });

  it('detects when the player carries The Sun-Stone of Freyr', () => {
    const player = new Player({
      id: 'relic-carrier',
      name: 'Ragnor',
      position: { x: 5, y: 5 },
    });

    expect(DungeonArc.isRelicInPlayerPossession(player, RELIC_ID)).toBe(false);

    // Add Sun-Stone into player's pack
    const sunStone = createTestSunStone(RELIC_ID);
    player.inventory.primaryPack.addItem(sunStone);

    expect(DungeonArc.isRelicInPlayerPossession(player, RELIC_ID)).toBe(true);
  });

  it('knows the relic by its id or definition, wherever it is carried, and no other quest item (R-econ-17)', () => {
    const player = new Player({ id: 'relic-seeker', name: 'Ragnor', position: { x: 5, y: 5 } });
    player.inventory.primaryPack.addItem(
      new Item({ id: 'essence-rune', name: 'Essence-Rune', category: 'quest', weight: 10, bulk: 10, identified: true })
    );
    expect(DungeonArc.isRelicInPlayerPossession(player, RELIC_ID)).toBe(false);

    const bag = new Container({
      id: 'relic-bag',
      name: 'Bag',
      category: 'container',
      containerType: 'pack',
      weight: 100,
      bulk: 100,
      maxWeightCapacity: 5000,
      maxBulkCapacity: 5000,
      identified: true,
    });
    bag.addItem(new Item({ id: 'drop-7-1234', definitionId: RELIC_ID, name: 'The Sun-Stone of Freyr', category: 'quest', weight: 10, bulk: 10, identified: true }));
    player.inventory.primaryPack.addItem(bag);
    expect(DungeonArc.isRelicInPlayerPossession(player, RELIC_ID)).toBe(true);
  });

  describe('Unknown generator strategy ID (ARCHITECTURE.md registry-contract audit)', () => {
    it('throws instead of silently falling back to BSP for a misspelled floorGenerators entry', () => {
      const brokenQuestArc: Partial<QuestArcDefinition> = {
        id: 'broken_arc',
        name: 'Broken Arc',
        maxFloor: 5,
        floorGenerators: {
          2: 'cvaern', // typo of 'cavern'
        },
      };

      expect(() => DungeonArc.generateFloor(2, 1111, brokenQuestArc as QuestArcDefinition)).toThrow(
        'cvaern'
      );
    });

    it('throws instead of silently falling back to BSP for a misspelled defaultGenerator', () => {
      const brokenQuestArc: Partial<QuestArcDefinition> = {
        id: 'broken_arc_2',
        name: 'Broken Arc 2',
        maxFloor: 5,
        defaultGenerator: 'bsp_typo',
      };

      expect(() => DungeonArc.generateFloor(1, 1111, brokenQuestArc as QuestArcDefinition)).toThrow(
        'bsp_typo'
      );
    });

    it('still generates normally when floorGenerators/defaultGenerator are omitted (implicit bsp default)', () => {
      const floor1 = DungeonArc.generateFloor(1, 1111);
      expect(floor1.map).toBeDefined();
      expect(floor1.stairsDown).toBeDefined();
    });
  });
});

describe('DungeonArc.createBoss', () => {
  it('keeps the definition hooks, tags and targeting mode', () => {
    const def = COTW_MONSTERS.find((d) => d.hooks?.length && d.tags?.length)!;
    const boss = DungeonArc.createBoss(1, 1, 10, { ...def, targetingMode: 'nearest_hostile' }, 'boss-x');

    expect(boss.hooks).toEqual(def.hooks);
    expect(boss.tags).toEqual(def.tags);
    expect(boss.targetingMode).toBe('nearest_hostile');
  });
});

describe('the boss hoard', () => {
  it('fills the hoard chest', () => {
    const result = DungeonArc.generateBossLair(5, undefined, { items: COTW_ITEMS } as any);

    const chest = result.map.getItemsAt(22, 5).find((i) => i.id === 'boss-chest-1') as Container;
    expect(chest).toBeInstanceOf(Container);
    expect(chest.getItems().length).toBeGreaterThan(0);
  });
});
