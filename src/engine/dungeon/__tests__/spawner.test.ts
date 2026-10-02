import { describe, it, expect } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import type { MonsterDefinition } from '../../bestiary/monsterDefinitions';
import { COTW_BESTIARY as BESTIARY, COTW_MONSTERS } from '../../../content/cotw/monsters';
import {
  selectDungeonMonsterDefinition,
  dungeonSpawnWeight,
  createScaledMonster,
  populateDungeonFloor,
  scaleMonsterStats,
} from '../spawner';
import { Mulberry32 } from '../prng';
import { COTW_MONSTER_SCALING } from '../../../content/cotw/monsterScaling';

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

      const selected = selectDungeonMonsterDefinition([highFloorMonster], 1, () => 0.5);
      expect(selected).toBeNull();
    });

    it('goes by placedOnly, not by what the id says', () => {
      const named: MonsterDefinition = { ...BESTIARY.ogre, id: 'boss_ogre', minFloor: 1 };

      expect(selectDungeonMonsterDefinition([named], 30, () => 0.5)?.id).toBe('boss_ogre');
    });

    it("never draws cotw's bosses or minibosses: content places them", () => {
      const bosses = allCandidates.filter((m) => m.tags?.includes('boss'));
      expect(bosses.length).toBeGreaterThan(5);
      expect(bosses.every((m) => m.placedOnly)).toBe(true);
    });

    it('never draws a placedOnly definition', () => {
      const guardian: MonsterDefinition = { ...BESTIARY.ogre, id: 'forge_guardian', minFloor: 1, placedOnly: true };

      expect(selectDungeonMonsterDefinition([guardian], 30, () => 0.5)).toBeNull();
    });

    it('filters candidates to only those with minFloor <= currentFloor', () => {
      const prng = new Mulberry32(777);
      // On floor 1, only Tier 1 monsters (giant_rat, kobold) should be eligible
      for (let i = 0; i < 20; i++) {
        const selected = selectDungeonMonsterDefinition(allCandidates, 1, () => prng.next());
        expect(selected).not.toBeNull();
        expect(selected!.minFloor ?? 1).toBeLessThanOrEqual(1);
      }
    });

    it('weighs a monster most on the floor it unlocks, half six floors on, and little after', () => {
      const at = (minFloor: number, floor: number) => dungeonSpawnWeight({ ...BESTIARY.ogre, minFloor }, floor);
      expect(at(10, 10)).toBe(1);
      expect(at(10, 16)).toBeCloseTo(0.5);
      expect(at(10, 22)).toBeLessThan(0.12);
      expect(at(10, 13)).toBeGreaterThan(at(10, 16));
    });

    it('walks the weights with one draw: the low end of the roll takes the first eligible', () => {
      const [a, b] = [{ ...BESTIARY.ogre, id: 'a', minFloor: 1 }, { ...BESTIARY.ogre, id: 'b', minFloor: 1 }];
      expect(selectDungeonMonsterDefinition([a, b], 1, () => 0.1)?.id).toBe('a');
      expect(selectDungeonMonsterDefinition([a, b], 1, () => 0.9)?.id).toBe('b');
    });

    // The old draw gave 75% of picks to whichever monsters unlocked last, so a floor where
    // one monster unlocked alone (22-24, 30-33, 40-42, 46-49) was mostly that monster.
    it('lets no one monster take a quarter of the draws on any floor past 4', () => {
      for (let floor = 5; floor <= 49; floor++) {
        const eligible = allCandidates.filter((m) => !m.placedOnly && (m.minFloor ?? 1) <= floor);
        const weights = eligible.map((m) => dungeonSpawnWeight(m, floor));
        const total = weights.reduce((s, w) => s + w, 0);
        const top = Math.max(...weights) / total;
        expect(top, `floor ${floor}`).toBeLessThan(0.25);
      }
    });

    it("draws mostly from the floor's own stretch: on floor 46, three in four unlocked from 40 on", () => {
      const floor = 46;
      const eligible = allCandidates.filter((m) => !m.placedOnly && (m.minFloor ?? 1) <= floor);
      const total = eligible.reduce((s, m) => s + dungeonSpawnWeight(m, floor), 0);
      const fresh = eligible.filter((m) => (m.minFloor ?? 1) >= 40).reduce((s, m) => s + dungeonSpawnWeight(m, floor), 0);
      expect(fresh / total).toBeGreaterThan(0.75);
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

    it('uses the zone-tiered difficulty curve when a MonsterScalingConfig is supplied', () => {
      const kobold = BESTIARY.kobold;
      const pos = { x: 3, y: 3 };
      const floor = 43;

      const monster = createScaledMonster(
        kobold,
        'test-kobold-1',
        pos,
        floor,
        undefined,
        undefined,
        COTW_MONSTER_SCALING,
        'hard'
      );

      const expected = scaleMonsterStats(kobold, floor, undefined, undefined, COTW_MONSTER_SCALING, 'hard');
      expect(monster.hp).toBe(expected.hp);
      expect(monster.attack).toBe(expected.attack);
      expect(monster.defense).toBe(expected.defense);
      expect(monster.xpValue).toBe(expected.xpValue);
      expect(monster.name).toBe(expected.name);
      // Sanity: the new path produces a materially different result from the old
      // smooth curve at the same floor, proving the config actually took effect.
      const oldFormula = scaleMonsterStats(kobold, floor);
      expect(monster.hp).not.toBe(oldFormula.hp);
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

      const prng = new Mulberry32(888);
      populateDungeonFloor(map, rooms, 5, allCandidates, () => prng.next());

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

    it('threads a MonsterScalingConfig + difficulty through to every spawned monster', () => {
      const map = new GameMap(40, 40);
      const rooms = [
        { x1: 2, y1: 2, x2: 8, y2: 8 },
        { x1: 12, y1: 2, x2: 18, y2: 8 },
      ];
      for (const r of rooms) {
        for (let x = r.x1; x <= r.x2; x++) {
          for (let y = r.y1; y <= r.y2; y++) {
            map.setTile(x, y, TILES.FLOOR);
          }
        }
      }

      const prng = new Mulberry32(888);
      populateDungeonFloor(map, rooms, 43, allCandidates, () => prng.next(), 1.0, COTW_MONSTER_SCALING, 'hard');

      const entities = map.getAllEntities();
      expect(entities.length).toBeGreaterThan(0);
      for (const e of entities) {
        expect(e.hp).toBeGreaterThan(0);
        expect(e.attack).toBeGreaterThan(0);
      }
    });
  });
});
