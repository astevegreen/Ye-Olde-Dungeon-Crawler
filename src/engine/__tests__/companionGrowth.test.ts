import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import type { Companion, CompanionDefinition } from '../entities/companion';
import { serializeGame, deserializeGame } from '../storage/serializer';
import { awardPlayerXp } from '../combat/deathResolver';
import { MonsterAI } from '../ai/behaviorTree';
import type { GameContentManifest, PerkDefinition } from '../types/manifest';

/**
 * R-cotw-18: companions never scaled, so a floor-25 reward hound was a one-hit kill. A
 * companion definition may now declare `growthPerLevel`: its HP, attack and defense are the
 * definition's plus that growth for each hero level past the first, recomputed when the
 * hero levels and right after a load.
 */
const GROWING: CompanionDefinition = {
  id: 'growing_hound',
  name: 'Growing Hound',
  stats: { hp: 20, maxHp: 20, attack: 5, defense: 1 },
  speed: 100,
  packWeightCapacity: 1000,
  packBulkCapacity: 1000,
  growthPerLevel: { hp: 4, attack: 0.5, defense: 0.25 },
};
const FIXED: CompanionDefinition = { ...GROWING, id: 'fixed_hound', name: 'Fixed Hound', growthPerLevel: undefined };

function build(): { engine: GameEngine; player: Player; manifest: GameContentManifest } {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 } });
  map.addEntity(player);
  const manifest = { id: 'test', name: 'Test', monsters: [], items: [], companions: [GROWING, FIXED] } as unknown as GameContentManifest;
  const engine = new GameEngine({ map, player, manifest });
  engine.setWorldFlag(GameEngine.COMPANION_BONDED_FLAG, true);
  return { engine, player, manifest };
}

function levelTo(engine: GameEngine, level: number): void {
  while (engine.player.level < level) awardPlayerXp(engine, Math.max(1, engine.player.xpToNextLevel - engine.player.xp));
  expect(engine.player.level).toBe(level);
}

const grown = (level: number) => ({
  maxHp: 20 + 4 * (level - 1),
  attack: Math.round(5 + 0.5 * (level - 1)),
  defense: Math.round(1 + 0.25 * (level - 1)),
});

describe('companion growth with the hero’s level (R-cotw-18)', () => {
  it('a companion without growthPerLevel keeps its definition’s stats at any level', () => {
    const { engine } = build();
    const hound = engine.summonCompanion('fixed_hound')!;
    levelTo(engine, 6);
    MonsterAI.decideAction(hound, engine);
    expect({ maxHp: hound.maxHp, attack: hound.attack, defense: hound.defense }).toEqual({ maxHp: 20, attack: 5, defense: 1 });
  });

  it('grows the moment the hero levels, and keeps its wound: the HP the level adds is added to what it has', () => {
    const { engine } = build();
    const hound = engine.summonCompanion('growing_hound')!;
    expect({ maxHp: hound.maxHp, attack: hound.attack, defense: hound.defense }).toEqual(grown(1));
    hound.takeDamage(6);
    levelTo(engine, 9);
    expect({ maxHp: hound.maxHp, attack: hound.attack, defense: hound.defense }).toEqual(grown(9));
    expect(hound.hp).toBe(14 + 4 * 8);
  });

  it('a companion summoned by a hero of level 12 answers grown to it', () => {
    const { engine } = build();
    levelTo(engine, 12);
    const hound = engine.summonCompanion('growing_hound')!;
    MonsterAI.decideAction(hound, engine);
    expect({ maxHp: hound.maxHp, attack: hound.attack, defense: hound.defense }).toEqual(grown(12));
    expect(hound.hp).toBe(hound.maxHp);
  });

  it('is the same after a save and load, and a save from before growth loads grown', () => {
    const { engine, manifest } = build();
    const hound = engine.summonCompanion('growing_hound')!;
    levelTo(engine, 7);
    const save = JSON.parse(JSON.stringify(serializeGame(engine)));
    const loaded = deserializeGame(save, manifest).engine.companion!;
    expect({ maxHp: loaded.maxHp, attack: loaded.attack, defense: loaded.defense, hp: loaded.hp }).toEqual({ ...grown(7), hp: hound.hp });

    // An older save: the companion still at its definition's numbers, the hero at level 7.
    Object.assign(save.companion, { hp: 20, maxHp: 20, attack: 5, defense: 1 });
    const old = deserializeGame(save, manifest).engine.companion!;
    expect({ maxHp: old.maxHp, attack: old.attack, defense: old.defense, hp: old.hp }).toEqual({ ...grown(7), hp: grown(7).maxHp });
  });

  it('Beast-Friend’s multiplier applies to the grown HP and attack, before and after a level', () => {
    const { engine, player } = build();
    const friend: PerkDefinition = { id: 'friend', name: 'friend', description: 'friend', source: 'saga', effects: { companionStatMultiplier: 1.5 } };
    const hound = engine.summonCompanion('growing_hound') as Companion;
    levelTo(engine, 5);
    player.grantPerk(friend);
    MonsterAI.decideAction(hound, engine);
    expect(hound.maxHp).toBe(Math.round(grown(5).maxHp * 1.5));
    expect(hound.attack).toBe(Math.round(grown(5).attack * 1.5));
    levelTo(engine, 9);
    MonsterAI.decideAction(hound, engine);
    expect(hound.maxHp).toBe(Math.round(grown(9).maxHp * 1.5));
    expect(hound.attack).toBe(Math.round((5 + 0.5 * 8) * 1.5));
    expect(hound.defense).toBe(grown(9).defense);
  });
});
