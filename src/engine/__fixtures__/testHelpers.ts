import { Monster } from '../entities/monster';
import { Item } from '../items/item';
import { ItemFactory } from '../items/factory';
import type { Position } from '../types';
import { getMonsterDefinition } from '../bestiary/monsterDefinitions';

export function createTestKobold(id: string, position: Position): Monster {
  const def = getMonsterDefinition('kobold');
  if (def) return Monster.createFromDefinition('kobold', id, position);
  return new Monster({
    id,
    name: 'Kobold',
    position,
    stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 },
    speed: 110,
    definitionId: 'kobold',
    aiType: 'coward',
    resistances: { cold: 'weak' },
    fleeHealthPercent: 0.25,
    xpValue: 15,
    lootTable: [],
  });
}

export function createTestGoblin(id: string, position: Position): Monster {
  const def = getMonsterDefinition('goblin');
  if (def) return Monster.createFromDefinition('goblin', id, position);
  return new Monster({
    id,
    name: 'Goblin',
    position,
    stats: { hp: 16, maxHp: 16, attack: 5, defense: 2 },
    speed: 105,
    definitionId: 'goblin',
    aiType: 'melee',
    resistances: { fire: 'neutral' },
    fleeHealthPercent: 0.2,
    xpValue: 25,
    lootTable: [],
  });
}

export function createTestSkeleton(id: string, position: Position): Monster {
  const def = getMonsterDefinition('skeleton');
  if (def) return Monster.createFromDefinition('skeleton', id, position);
  return new Monster({
    id,
    name: 'Skeleton',
    position,
    stats: { hp: 18, maxHp: 18, attack: 7, defense: 3 },
    speed: 90,
    definitionId: 'skeleton',
    aiType: 'melee',
    resistances: { cold: 'resistant', fire: 'weak' },
    statusImmunities: ['poison'],
    fleeHealthPercent: 0.0,
    xpValue: 35,
    lootTable: [],
  });
}

export function createTestGiantRat(id: string, position: Position): Monster {
  const def = getMonsterDefinition('giant_rat');
  if (def) return Monster.createFromDefinition('giant_rat', id, position);
  return new Monster({
    id,
    name: 'Giant Rat',
    position,
    stats: { hp: 8, maxHp: 8, attack: 4, defense: 1 },
    speed: 120,
    definitionId: 'giant_rat',
    aiType: 'melee',
    resistances: { fire: 'weak', lightning: 'weak' },
    onHitAffliction: {
      type: 'poison',
      chance: 0.25,
      duration: 4,
      potency: 2,
    },
    fleeHealthPercent: 0.0,
    xpValue: 10,
    lootTable: [],
  });
}

export function createTestKoboldShaman(id: string, position: Position): Monster {
  const def = getMonsterDefinition('kobold_shaman');
  if (def) return Monster.createFromDefinition('kobold_shaman', id, position);
  return new Monster({
    id,
    name: 'Kobold Shaman',
    position,
    stats: { hp: 14, maxHp: 14, attack: 3, defense: 1 },
    speed: 100,
    definitionId: 'kobold_shaman',
    aiType: 'caster',
    resistances: { cold: 'weak' },
    spells: ['firebolt', 'slow'],
    fleeHealthPercent: 0.3,
    xpValue: 50,
    lootTable: [],
  });
}

export function createTestOgre(id: string, position: Position): Monster {
  const def = getMonsterDefinition('ogre');
  if (def) return Monster.createFromDefinition('ogre', id, position);
  return new Monster({
    id,
    name: 'Ogre',
    position,
    stats: { hp: 50, maxHp: 50, attack: 12, defense: 4 },
    speed: 75,
    definitionId: 'ogre',
    aiType: 'brute',
    statusImmunities: ['paralysis'],
    fleeHealthPercent: 0.0,
    xpValue: 120,
    lootTable: [
      {
        chance: 1.0,
        generate: (lootId) => ItemFactory.createGoldCoins(lootId, 40),
      },
    ],
  });
}

export function createTestOrc(id: string, position: Position): Monster {
  const def = getMonsterDefinition('orc');
  if (def) return Monster.createFromDefinition('orc', id, position);
  return new Monster({
    id,
    name: 'Orc Warrior',
    position,
    stats: { hp: 28, maxHp: 28, attack: 8, defense: 3 },
    speed: 85,
    definitionId: 'orc',
    aiType: 'melee',
    xpValue: 45,
    resistances: { lightning: 'neutral' },
    lootTable: [],
  });
}

export function createTestSunStone(id = 'sun-stone-freyr'): Item {
  return ItemFactory.createQuestRelic(
    id,
    'The Sun-Stone of Freyr',
    'The ancient radiant relic of Freyr, warm to the touch. Returning it to town will bring lasting peace and light.'
  );
}
