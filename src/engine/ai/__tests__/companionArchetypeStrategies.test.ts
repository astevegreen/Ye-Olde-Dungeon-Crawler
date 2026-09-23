import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { Companion } from '../../entities/companion';
import { MeleeAttackAction } from '../../actions/combat';
import { MovementAction } from '../../actions/movement';
import { CompanionBodyguardStrategy, CompanionSkirmisherStrategy } from '../aiRegistry';

function buildEngine(): { engine: GameEngine; player: Player } {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 } });
  const engine = new GameEngine({ map, player });
  return { engine, player };
}

function makeCompanion(position: { x: number; y: number }, archetype: 'bodyguard' | 'skirmisher'): Companion {
  const companion = new Companion({
    id: `comp-${archetype}`,
    name: 'Test Hound',
    position,
    stats: { hp: 20, maxHp: 20, attack: 5, defense: 1 },
    speed: 100,
    companionDefinitionId: 'test_hound',
    packWeightCapacity: 10000,
    packBulkCapacity: 8000,
  });
  companion.setArchetype(archetype);
  return companion;
}

function makeHostile(id: string, position: { x: number; y: number }): Monster {
  return new Monster({
    id,
    name: 'Wolf',
    position,
    stats: { hp: 10, maxHp: 10, attack: 2, defense: 0 },
    speed: 100,
    definitionId: 'wolf',
    aiType: 'melee',
    fleeHealthPercent: 0,
    xpValue: 1,
    lootTable: [],
  });
}

describe('CompanionBodyguardStrategy (docs/architecture/content-companions.md Phase 2)', () => {
  const strategy = new CompanionBodyguardStrategy();

  it('attacks an adjacent hostile instead of moving', () => {
    const { engine, player } = buildEngine();
    const companion = makeCompanion({ x: player.x + 1, y: player.y }, 'bodyguard');
    engine.attachCompanion(companion);
    const hostile = makeHostile('wolf-1', { x: companion.x + 1, y: companion.y });
    engine.map.addEntity(hostile);

    const action = strategy.decideAction(companion, engine);

    expect(action).toBeInstanceOf(MeleeAttackAction);
    expect((action as MeleeAttackAction).defender).toBe(hostile);
  });

  it('closes to within 1 tile of the player when farther away (tighter leash than skirmisher)', () => {
    const { engine, player } = buildEngine();
    const companion = makeCompanion({ x: player.x + 3, y: player.y }, 'bodyguard');
    engine.attachCompanion(companion);

    const action = strategy.decideAction(companion, engine);

    expect(action).toBeInstanceOf(MovementAction);
  });

  it('waits when already within follow distance and nothing hostile is adjacent', () => {
    const { engine, player } = buildEngine();
    const companion = makeCompanion({ x: player.x + 1, y: player.y }, 'bodyguard');
    engine.attachCompanion(companion);

    const action = strategy.decideAction(companion, engine);

    expect(action).not.toBeInstanceOf(MovementAction);
    expect(action).not.toBeInstanceOf(MeleeAttackAction);
  });
});

describe('CompanionSkirmisherStrategy (docs/architecture/content-companions.md Phase 2)', () => {
  const strategy = new CompanionSkirmisherStrategy();

  it('attacks an adjacent hostile instead of moving', () => {
    const { engine, player } = buildEngine();
    const companion = makeCompanion({ x: player.x + 1, y: player.y }, 'skirmisher');
    engine.attachCompanion(companion);
    const hostile = makeHostile('wolf-2', { x: companion.x + 1, y: companion.y });
    engine.map.addEntity(hostile);

    const action = strategy.decideAction(companion, engine);

    expect(action).toBeInstanceOf(MeleeAttackAction);
    expect((action as MeleeAttackAction).defender).toBe(hostile);
  });

  it('proactively paths toward a non-adjacent hostile within seek radius, even while within follow distance of the player', () => {
    const { engine, player } = buildEngine();
    const companion = makeCompanion({ x: player.x + 1, y: player.y }, 'skirmisher');
    engine.attachCompanion(companion);
    // Hostile is a few tiles away, well within SEEK_RADIUS (6) and within the
    // 5-tile follow distance too — the point is skirmisher engages instead of idling.
    const hostile = makeHostile('wolf-3', { x: companion.x + 4, y: companion.y });
    engine.map.addEntity(hostile);

    const action = strategy.decideAction(companion, engine);

    expect(action).toBeInstanceOf(MovementAction);
    const move = action as MovementAction;
    // Moving toward the hostile means positive dx (hostile is to the east).
    expect(move.dx).toBeGreaterThan(0);
  });

  it('roams up to 5 tiles from the player (looser leash than bodyguard) when no hostile is present', () => {
    const { engine, player } = buildEngine();
    const companion = makeCompanion({ x: player.x + 5, y: player.y }, 'skirmisher');
    engine.attachCompanion(companion);

    const action = strategy.decideAction(companion, engine);

    expect(action).not.toBeInstanceOf(MovementAction);
  });

  it('returns to the player once beyond the follow distance with no hostile nearby', () => {
    const { engine, player } = buildEngine();
    const companion = makeCompanion({ x: player.x + 8, y: player.y }, 'skirmisher');
    engine.attachCompanion(companion);

    const action = strategy.decideAction(companion, engine);

    expect(action).toBeInstanceOf(MovementAction);
    const move = action as MovementAction;
    expect(move.dx).toBeLessThan(0); // player is to the west
  });
});
