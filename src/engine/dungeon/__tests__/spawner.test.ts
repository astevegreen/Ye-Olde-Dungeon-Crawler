import { describe, it, expect } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import type { MonsterDefinition } from '../../bestiary/monsterDefinitions';
import { COTW_BESTIARY as BESTIARY, COTW_MONSTERS } from '../../../content/cotw/monsters';
import {
  selectDungeonMonsterDefinition,
  createScaledMonster,
  populateDungeonFloor,
  scaleMonsterStats,
} from '../spawner';

describe('Dungeon Spawner - Tiering & Population', () => {
  const allCandidates: MonsterDefinition[] = COTW_MONSTERS;

  describe('selectDungeonMonsterDefinition', () => {
    it('returns null if candidate list is empty or all minFloors exceed current floor', () => {
      const highFloorMonster: MonsterDefinition = {
        id: 'ancient_wyrm',
        name: 'Ancient Wyrm',
        minFloor: 35,
        stats: { hp: 200, maxHp: 200, attack: 35, defense: 20 },
        speed: 100,
        xpValue: 1000,
        aiType: 'melee',
        fleeHealthPercent: 0,
        lootTable: [],
      };

      const selected = selectDungeonMonsterDefinition([highFloorMonster], 1);
      expect(selected).toBeNull();
    });

    it('filters out boss definitions', () => {
      const boss = BESTIARY.boss_hrungnir;
      expect(boss).toBeDefined();

      const selected = selectDungeonMonsterDefinition([boss], 30);
      expect(selected).toBeNull();
    });

    it('filters candidates to only those with minFloor <= currentFloor', () => {
      // On floor 1, only Tier 1 monsters (giant_rat, kobold) should be eligible
      for (let i = 0; i < 20; i++) {
        const selected = selectDungeonMonsterDefinition(allCandidates, 1);
        expect(selected).not.toBeNull();
        expect(selected!.minFloor ?? 1).toBeLessThanOrEqual(1);
      }
    });

    it('selects from recently unlocked tier when rng < 0.75, and lower tier when rng >= 0.75', () => {
      // On floor 6, unlocked monsters include:
      // minFloor 1: giant_rat, kobold
      // minFloor 2: goblin
      // minFloor 5: skeleton
      // minFloor 6: kobold_shaman (maxMinFloor = 6)
      const deterministicRecentRng = () => 0.1; // < 0.75 -> recent group (minFloor 6)
      const selectedRecent = selectDungeonMonsterDefinition(allCandidates, 6, deterministicRecentRng);
      expect(selectedRecent).not.toBeNull();
      expect(selectedRecent!.minFloor).toBe(6);
      expect(selectedRecent!.id).toBe('kobold_shaman');

      const deterministicLowerRng = () => 0.8; // >= 0.75 -> lower tier group (minFloor < 6)
      const selectedLower = selectDungeonMonsterDefinition(allCandidates, 6, deterministicLowerRng);
      expect(selectedLower).not.toBeNull();
      expect(selectedLower!.minFloor).toBeLessThan(6);
    });

    it('selects from recent group if no lower tier exists', () => {
      const tier1Only = allCandidates.filter((m) => (m.minFloor ?? 1) === 1);
      const selected = selectDungeonMonsterDefinition(tier1Only, 1, () => 0.99);
      expect(selected).not.toBeNull();
      expect(selected!.minFloor ?? 1).toBe(1);
    });
  });

  describe('createScaledMonster', () => {
    it('instantiates a runtime Monster instance with scaled stats and correct definitionId', () => {
      const ogre = BESTIARY.ogre;
      const pos = { x: 10, y: 15 };
      const floor = 22; // 22 - 12 = 10 -> Veteran Ogre

      const monster = createScaledMonster(ogre, 'test-ogre-1', pos, floor);

      expect(monster.id).toBe('test-ogre-1');
      expect(monster.name).toBe('Veteran Ogre');
      expect(monster.position).toEqual(pos);
      expect(monster.definitionId).toBe(ogre.id);
      expect(monster.speed).toBe(ogre.speed);
      expect(monster.aiType).toBe(ogre.aiType);

      const expected = scaleMonsterStats(ogre, floor);
      expect(monster.hp).toBe(expected.hp);
      expect(monster.maxHp).toBe(expected.maxHp);
      expect(monster.attack).toBe(expected.attack);
      expect(monster.defense).toBe(expected.defense);
      expect(monster.xpValue).toBe(expected.xpValue);
    });
  });

  describe('populateDungeonFloor', () => {
    it('populates rooms with scaled monsters without occupying room 0', () => {
      const map = new GameMap(40, 40);
      const rooms = [
        { x1: 2, y1: 2, x2: 8, y2: 8 },    // Room 0: Player spawn
        { x1: 12, y1: 2, x2: 18, y2: 8 },  // Room 1
        { x1: 22, y1: 2, x2: 28, y2: 8 },  // Room 2
      ];

      // Carve out floors for rooms
      for (const r of rooms) {
        for (let x = r.x1; x <= r.x2; x++) {
          for (let y = r.y1; y <= r.y2; y++) {
            map.setTile(x, y, TILES.FLOOR);
          }
        }
      }

      populateDungeonFloor(map, rooms, 5, allCandidates);

      const entities = map.getAllEntities();
      expect(entities.length).toBeGreaterThan(0);

      // Verify no monsters are in room 0
      for (const e of entities) {
        const inRoom0 =
          e.x >= rooms[0].x1 &&
          e.x <= rooms[0].x2 &&
          e.y >= rooms[0].y1 &&
          e.y <= rooms[0].y2;
        expect(inRoom0).toBe(false);
      }

      // Verify all spawned monsters are properly scaled for Floor 5
      for (const e of entities) {
        expect(e.hp).toBeGreaterThan(0);
        expect(e.attack).toBeGreaterThan(0);
      }
    });
  });
});
