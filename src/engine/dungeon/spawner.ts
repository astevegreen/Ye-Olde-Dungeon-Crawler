import type { GameMap } from '../grid/map';
import type { Position } from '../types';
import type { MonsterDefinition } from '../bestiary/monsterDefinitions';
import { Monster } from '../entities/monster';

export interface ScaledMonsterStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  xpValue: number;
  name: string;
}

/**
 * Calculates depth-scaled monster combat stats according to the canonical formula:
 * - HP: Math.round(baseHP * (1 + 0.08 * (currentFloor - 1)))
 * - Attack: baseAttack + Math.floor(0.6 * (currentFloor - 1))
 * - Defense: baseDefense + Math.floor(0.4 * (currentFloor - 1))
 * - XP: Math.round(baseXP * (1 + 0.10 * (currentFloor - 1)))
 * - Affix: "Veteran <Name>" if (currentFloor - minFloor) >= 10
 *
 * MonsterDefinition templates remain strictly immutable.
 */
export function scaleMonsterStats(
  def: MonsterDefinition,
  currentFloor: number
): ScaledMonsterStats {
  const floorOffset = Math.max(0, currentFloor - 1);
  const hp = Math.round(def.stats.maxHp * (1 + 0.08 * floorOffset));
  const attack = def.stats.attack + Math.floor(0.6 * floorOffset);
  const defense = def.stats.defense + Math.floor(0.4 * floorOffset);
  const xpValue = Math.round(def.xpValue * (1 + 0.1 * floorOffset));

  const minFloor = def.minFloor ?? 1;
  const isVeteran = currentFloor - minFloor >= 10;
  const name = isVeteran ? `Veteran ${def.name}` : def.name;

  return {
    hp,
    maxHp: hp,
    attack,
    defense,
    xpValue,
    name,
  };
}

/**
 * Selects a monster definition from candidates based on floor depth and tiering:
 * - Filters to non-boss candidates where minFloor <= currentFloor
 * - Separates candidates into "recently unlocked" (highest minFloor) and "lower-tier" groups
 * - 75% chance to draw from recently unlocked group, 25% from lower-tier group
 */
export function selectDungeonMonsterDefinition(
  candidates: MonsterDefinition[],
  currentFloor: number,
  rng: () => number = Math.random
): MonsterDefinition | null {
  const eligible = candidates.filter(
    (m) =>
      !m.id.toLowerCase().includes('boss') &&
      !m.name.toLowerCase().includes('hrungnir') &&
      (m.minFloor ?? 1) <= currentFloor
  );

  if (eligible.length === 0) {
    return null;
  }

  const maxMinFloor = Math.max(...eligible.map((m) => m.minFloor ?? 1));
  const recentGroup = eligible.filter((m) => (m.minFloor ?? 1) === maxMinFloor);
  const lowerGroup = eligible.filter((m) => (m.minFloor ?? 1) < maxMinFloor);

  if (lowerGroup.length > 0) {
    // 75% recently unlocked, 25% lower tier
    if (rng() < 0.75) {
      return recentGroup[Math.floor(rng() * recentGroup.length)];
    } else {
      return lowerGroup[Math.floor(rng() * lowerGroup.length)];
    }
  }

  return recentGroup[Math.floor(rng() * recentGroup.length)];
}

/**
 * Instantiates a runtime Monster from a template with depth-scaled attributes,
 * preserving template immutability.
 */
export function createScaledMonster(
  def: MonsterDefinition,
  id: string,
  position: Position,
  currentFloor: number
): Monster {
  const scaled = scaleMonsterStats(def, currentFloor);

  return new Monster({
    id,
    name: scaled.name,
    position,
    stats: {
      hp: scaled.hp,
      maxHp: scaled.maxHp,
      attack: scaled.attack,
      defense: scaled.defense,
    },
    speed: def.speed,
    resistances: def.resistances,
    statusImmunities: def.statusImmunities,
    definitionId: def.id,
    aiType: def.aiType,
    aiState: 'sleeping',
    spells: def.spells ? [...def.spells] : undefined,
    spellCooldown: def.spellCooldown,
    onHitAffliction: def.onHitAffliction,
    fleeHealthPercent: def.fleeHealthPercent,
    xpValue: scaled.xpValue,
    lootTable: def.lootTable ? [...def.lootTable] : [],
  });
}

/**
 * Populates dungeon rooms with depth-appropriate, scaled monsters.
 */
export function populateDungeonFloor(
  map: GameMap,
  rooms: Array<{ x1: number; y1: number; x2: number; y2: number }>,
  currentFloor: number,
  candidates: MonsterDefinition[],
  rng: () => number = Math.random,
  densityMultiplier = 1.0
): void {
  // Start from room index 1 so room 0 remains player spawn
  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i];
    const baseCount = Math.floor(rng() * 2) + 1; // 1 to 2 monsters per room
    const count = Math.max(1, Math.round(baseCount * densityMultiplier));

    for (let j = 0; j < count; j++) {
      const def = selectDungeonMonsterDefinition(candidates, currentFloor, rng);
      if (!def) continue;

      const mx = room.x1 + 1 + Math.floor(rng() * (room.x2 - room.x1 - 1));
      const my = room.y1 + 1 + Math.floor(rng() * (room.y2 - room.y1 - 1));

      if (map.isPassable(mx, my) && !map.getEntityAt(mx, my)) {
        const uniqueId = `mon-${currentFloor}-${i}-${j}-${Date.now()}-${Math.floor(rng() * 1000)}`;
        const monster = createScaledMonster(def, uniqueId, { x: mx, y: my }, currentFloor);
        map.addEntity(monster);
      }
    }
  }
}
