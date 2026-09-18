import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../../engine';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { Player } from '../../../engine/entities/player';
import { Monster } from '../../../engine/entities/monster';
import { MovementAction } from '../../../engine/actions/movement';
import { MeleeAttackAction } from '../../../engine/actions/combat';
import { serializeGame, deserializeGame } from '../../../engine/storage/serializer';
import { cotwManifest } from '../index';
import { OATH_WARLOCKS_REQUIRED } from '../oath';
import type { CharacterProfile } from '../../../engine/storage/types';

/**
 * Verifies the campaign's branching save-states round-trip correctly
 * (serializeGame -> JSON -> deserializeGame), using the real `cotwManifest` end to
 * end rather than synthetic fixtures — the specific check requested alongside the
 * new engine capability: "run sim specifically against the new branching
 * save-states (oath choice, two Act 2 endings)".
 */
function buildRealEngine(floor = 1) {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({
    id: 'saga-hero',
    name: 'Sven',
    position: { x: 3, y: 3 },
    stats: { hp: 300, maxHp: 300, attack: 100, defense: 20 },
  });
  const engine = new GameEngine({ map, player, floor, manifest: cotwManifest });
  return { engine, player, map };
}

function makeProfile(engine: GameEngine): CharacterProfile {
  return {
    id: engine.player.id,
    name: engine.player.name,
    level: engine.player.level,
    floor: engine.currentFloor,
    lastSaved: Date.now(),
    hp: engine.player.hp,
    maxHp: engine.player.maxHp,
    strength: engine.player.strength,
  };
}

function roundTrip(engine: GameEngine) {
  const saved = serializeGame(engine, makeProfile(engine));
  const json = JSON.parse(JSON.stringify(saved));
  // deserializeGame's manifest parameter is optional and defaults to the engine's
  // generic built-in manifest (no endings/companions/etc.) if omitted — main.ts
  // resolves the real one from saveData.contentManifestId, so tests must too.
  return deserializeGame(json, cotwManifest);
}

function slayWarlocks(engine: GameEngine, map: GameMap, optionId: 'honor' | 'break') {
  let onOptionSelected: ((id: string) => void) | undefined;
  engine.onChoiceInteract = (_choice, cb) => {
    onOptionSelected = cb;
  };
  let toggle = 1;
  for (let i = 0; i < OATH_WARLOCKS_REQUIRED; i++) {
    const warlock = new Monster({
      id: `warlock-${i}`,
      name: 'Troll-Wife Warlock',
      definitionId: 'troll_wife_warlock',
      position: { x: engine.player.x + 1, y: engine.player.y },
      stats: { hp: 1, maxHp: 1, attack: 1, defense: 0 },
    });
    map.addEntity(warlock);
    engine.handlePlayerAction(new MeleeAttackAction(engine.player, warlock));
    engine.handlePlayerAction(new MovementAction(engine.player, 0, toggle));
    toggle = -toggle;
  }
  expect(onOptionSelected).toBeDefined();
  onOptionSelected!(optionId);
}

describe('Branching save-states — the Oath (real cotwManifest)', () => {
  it('honoring the oath persists across a save/load round-trip', () => {
    const { engine, player, map } = buildRealEngine();
    const baseAttack = player.baseAttackValue;
    const baseDefense = player.baseDefenseValue;

    slayWarlocks(engine, map, 'honor');
    expect(engine.getWorldFlag('blood_oath_honored')).toBe(true);

    const restored = roundTrip(engine);
    expect(restored.engine.getWorldFlag('blood_oath_honored')).toBe(true);
    expect(restored.engine.getWorldFlag('oath_resolved')).toBe(true);
    expect(restored.engine.player.baseAttackValue).toBe(baseAttack - 2);
    expect(restored.engine.player.baseDefenseValue).toBe(baseDefense + 3);
  });

  it('breaking the oath persists across a save/load round-trip', () => {
    const { engine, player, map } = buildRealEngine();
    const baseAttack = player.baseAttackValue;
    const baseDefense = player.baseDefenseValue;

    slayWarlocks(engine, map, 'break');
    expect(engine.getWorldFlag('blood_oath_broken')).toBe(true);

    const restored = roundTrip(engine);
    expect(restored.engine.getWorldFlag('blood_oath_broken')).toBe(true);
    expect(restored.engine.player.baseAttackValue).toBe(baseAttack + 3);
    expect(restored.engine.player.baseDefenseValue).toBe(baseDefense - 2);
  });
});

describe('Branching save-states — Níðhögg’s two endings (real cotwManifest)', () => {
  it('the Ragnarök ending (Níðhögg slain) is eligible after a save/load round-trip', () => {
    const { engine, map } = buildRealEngine(50);
    const nidhogg = new Monster({
      id: 'nidhogg-1',
      name: 'Níðhögg, the Root-Gnawer',
      definitionId: 'nidhogg',
      position: { x: engine.player.x + 1, y: engine.player.y },
      stats: { hp: 1, maxHp: 400, attack: 30, defense: 14 },
    });
    map.addEntity(nidhogg);
    engine.handlePlayerAction(new MeleeAttackAction(engine.player, nidhogg));
    expect(engine.compendium.getEntry('nidhogg').kills).toBe(1);

    // Return to town, matching the base game's existing relic-return flow.
    engine.changeFloor(0);
    const restored = roundTrip(engine);
    expect(restored.engine.currentFloor).toBe(0);

    const eligibleEnding = restored.engine.gameState.checkVictoryEligible(restored.engine);
    expect(eligibleEnding).toBe('ragnarok');
  });

  it('the sealed ending (Níðhögg driven off) is eligible after a save/load round-trip', () => {
    const { engine, player, map } = buildRealEngine(50);
    const nidhogg = new Monster({
      id: 'nidhogg-2',
      name: 'Níðhögg, the Root-Gnawer',
      definitionId: 'nidhogg',
      position: { x: player.x + 1, y: player.y },
      stats: { hp: 400, maxHp: 400, attack: 30, defense: 14 },
      fleeHealthPercent: 0.9,
      aiState: 'fleeing',
    });
    map.addEntity(nidhogg);

    // Sustain the flee for fleeTurnsRequired turns (see cotw/index.ts's
    // bossFleeResolutions), each tick re-checked via any player move.
    let toggle = 1;
    for (let i = 0; i < 6; i++) {
      engine.handlePlayerAction(new MovementAction(player, 0, toggle));
      toggle = -toggle;
    }
    expect(engine.getWorldFlag('nidhogg_root_sealed')).toBe(true);
    expect(engine.compendium.getEntry('nidhogg').kills).toBe(0); // never actually killed

    engine.changeFloor(0);
    const restored = roundTrip(engine);

    const eligibleEnding = restored.engine.gameState.checkVictoryEligible(restored.engine);
    expect(eligibleEnding).toBe('sealed');
  });

  it('the two endings are mutually exclusive: sealed does not also satisfy ragnarok', () => {
    const { engine, player, map } = buildRealEngine(50);
    const nidhogg = new Monster({
      id: 'nidhogg-3',
      name: 'Níðhögg, the Root-Gnawer',
      definitionId: 'nidhogg',
      position: { x: player.x + 1, y: player.y },
      stats: { hp: 400, maxHp: 400, attack: 30, defense: 14 },
      fleeHealthPercent: 0.9,
      aiState: 'fleeing',
    });
    map.addEntity(nidhogg);
    for (let i = 0; i < 6; i++) {
      engine.handlePlayerAction(new MovementAction(player, 0, i % 2 === 0 ? 1 : -1));
    }
    engine.changeFloor(0);

    expect(engine.gameState.checkVictoryEligible(engine)).toBe('sealed');
    expect(engine.getWorldFlag('nidhogg_slain')).toBe(false);
  });
});
