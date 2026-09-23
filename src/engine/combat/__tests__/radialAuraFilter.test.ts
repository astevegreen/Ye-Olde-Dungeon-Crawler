import { describe, it, expect } from 'vitest';
import { findTaggedEntitiesInRadius } from '../radialAuraFilter';
import { HookDispatcher } from '../../hooks/hookDispatcher';
import { DrinkPotionAction } from '../../actions/spell-actions';
import { PotionItem } from '../../items/consumables';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';

function buildEngine(): { engine: GameEngine; player: Player } {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 } });
  const engine = new GameEngine({ map, player });
  return { engine, player };
}

function buildMonster(id: string, x: number, y: number, tags: string[] = []): Monster {
  return new Monster({
    id,
    name: id,
    position: { x, y },
    stats: { hp: 20, maxHp: 20, attack: 5, defense: 1 },
    speed: 100,
    definitionId: 'test-monster',
    aiType: 'melee',
    fleeHealthPercent: 0,
    xpValue: 1,
    lootTable: [],
    tags,
  });
}

describe('Tag-Filtered Radial Auras', () => {
  describe('findTaggedEntitiesInRadius', () => {
    it('finds only living entities within radius that match a given tag', () => {
      const { engine } = buildEngine();
      const near = buildMonster('near-undead', 11, 10, ['undead']);
      const far = buildMonster('far-undead', 19, 19, ['undead']); // out of radius
      const wrongTag = buildMonster('nearby-goblin', 9, 10, ['beast']);
      engine.map.addEntity(near);
      engine.map.addEntity(far);
      engine.map.addEntity(wrongTag);

      const matches = findTaggedEntitiesInRadius(engine, { x: 10, y: 10 }, 4, ['undead']);

      expect(matches.map((e) => e.id)).toEqual(['near-undead']);
    });

    it('excludes dead entities and matches any of several tags (OR semantics)', () => {
      const { engine } = buildEngine();
      const aberration = buildMonster('aberration-1', 12, 10, ['aberration']);
      const deadUndead = buildMonster('dead-undead', 10, 12, ['undead']);
      deadUndead.hp = 0;
      engine.map.addEntity(aberration);
      engine.map.addEntity(deadUndead);

      const matches = findTaggedEntitiesInRadius(engine, { x: 10, y: 10 }, 5, ['undead', 'aberration']);

      expect(matches.map((e) => e.id)).toEqual(['aberration-1']);
    });

    it('also matches via faction/type fallback since hasTag() checks those too', () => {
      const { engine } = buildEngine();
      const hostile = buildMonster('any-hostile', 11, 11); // no explicit tags
      engine.map.addEntity(hostile);

      const matches = findTaggedEntitiesInRadius(engine, { x: 10, y: 10 }, 3, ['hostile']);

      expect(matches.map((e) => e.id)).toEqual(['any-hostile']);
    });

    it('returns nothing for a non-positive radius or an empty tag list', () => {
      const { engine } = buildEngine();
      engine.map.addEntity(buildMonster('u1', 10, 11, ['undead']));

      expect(findTaggedEntitiesInRadius(engine, { x: 10, y: 10 }, 0, ['undead'])).toEqual([]);
      expect(findTaggedEntitiesInRadius(engine, { x: 10, y: 10 }, 5, [])).toEqual([]);
    });
  });

  describe('HookDispatcher radialAuraFilter primitive', () => {
    it('applies a nested primitive to every tag-matching entity in radius', () => {
      const { engine } = buildEngine();
      const undead1 = buildMonster('undead-1', 11, 10, ['undead']);
      const undead2 = buildMonster('undead-2', 10, 11, ['undead']);
      const beast = buildMonster('beast-1', 9, 10, ['beast']);
      engine.map.addEntity(undead1);
      engine.map.addEntity(undead2);
      engine.map.addEntity(beast);

      const result = {
        executedHooks: 0,
        bonusDamage: 0,
        messages: [] as string[],
      };

      HookDispatcher.executePrimitive(
        {
          type: 'radialAuraFilter',
          radius: 4,
          tags: ['undead'],
          apply: { type: 'applyStatus', status: 'blindness', duration: 3 },
        },
        { engine, position: { x: 10, y: 10 } },
        engine.player,
        undefined,
        result,
        'Test Aura'
      );

      expect(undead1.statusManager.hasStatus('blindness')).toBe(true);
      expect(undead2.statusManager.hasStatus('blindness')).toBe(true);
      expect(beast.statusManager.hasStatus('blindness')).toBe(false);
    });
  });

  describe('DrinkPotionAction radial_status effect', () => {
    it('applies a status to nearby tagged entities but not the drinker', () => {
      const { engine, player } = buildEngine();
      const undead = buildMonster('undead-nearby', 11, 10, ['undead']);
      engine.map.addEntity(undead);

      const torch = new PotionItem({
        id: 'holy-torch-test',
        name: 'Holy Torch',
        effects: [{ type: 'radial_status', radius: 4, tags: ['undead'], status: 'blindness', duration: 3 }],
      });
      player.addItem(torch);

      const result = new DrinkPotionAction(player, torch).perform(engine);

      expect(result.success).toBe(true);
      expect(undead.statusManager.hasStatus('blindness')).toBe(true);
      expect(player.statusManager.hasStatus('blindness')).toBe(false);
    });
  });
});
