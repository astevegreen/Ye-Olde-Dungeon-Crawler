import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { MonsterRegistry } from '../../bestiary/monsterDefinitions';
import { MonsterAI } from '../behaviorTree';
import type { MonsterDefinition } from '../../bestiary/monsterDefinitions';

/**
 * The caster AI used to name 'firebolt', 'slow', and "Hellfire Surge" directly
 * (ARCHITECTURE.md §3, No Engine Creep). Telegraphed abilities and spell preference are
 * content data now; the engine only supplies the mechanism.
 */
const casterDef = (overrides: Partial<MonsterDefinition> = {}): MonsterDefinition =>
  ({
    id: 'test_caster',
    name: 'Test Caster',
    stats: { hp: 20, maxHp: 20, attack: 2, defense: 0 },
    speed: 100,
    aiType: 'caster',
    xpValue: 5,
    fleeHealthPercent: 0,
    lootTable: [],
    spells: ['bolt_a', 'bolt_b'],
    ...overrides,
  }) as MonsterDefinition;

function setup(def: MonsterDefinition) {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 }, stats: { hp: 99, maxHp: 99, attack: 1, defense: 0 } });
  const engine = new GameEngine({ map, player, seed: 4 });
  // Register after construction: the facade writes into the active engine store, and a new
   // engine seeds only from the process default (docs/architecture/content-extensibility.md, Content Registries) — seeding from the active store would
   // re-create the cross-engine leak that item fixed.
  MonsterRegistry.register(def);
  const monster = new Monster({
    id: 'caster-1',
    name: 'Test Caster',
    position: { x: 8, y: 5 },
    stats: { hp: 20, maxHp: 20, attack: 2, defense: 0 },
    speed: 100,
    definitionId: def.id,
    aiType: 'caster',
    aiState: 'hunting',
    fleeHealthPercent: 0,
    xpValue: 5,
    lootTable: [],
    spells: def.spells,
  });
  engine.addEntity(monster);
  return { engine, monster };
}

describe('Data-driven caster abilities', () => {
  beforeEach(() => MonsterRegistry.clear());

  it('telegraphs a content-declared ability, using its own name and flavour', () => {
    const def = casterDef({
      telegraphedAbility: {
        requiresSpellId: 'bolt_a',
        name: 'Glacial Lance',
        message: 'The {monster} draws frost into a lance!',
        pattern: 'blast',
        range: 6,
        radius: 1,
        multiplier: 2,
        element: 'cold',
        chance: 1,
        cooldown: 3,
      },
    });
    const { engine, monster } = setup(def);

    const action = MonsterAI.decideAction(monster, engine) as unknown as { abilityName?: string; warningMessage?: string };

    expect(action.abilityName).toBe('Glacial Lance');
    expect(action.warningMessage).toBe('The Test Caster draws frost into a lance!');
  });

  it('does not telegraph when the monster lacks the required spell', () => {
    const def = casterDef({
      spells: ['bolt_b'],
      telegraphedAbility: {
        requiresSpellId: 'bolt_a',
        name: 'Glacial Lance',
        message: 'The {monster} draws frost!',
        pattern: 'blast',
        range: 6,
        radius: 1,
        multiplier: 2,
        element: 'cold',
        chance: 1,
        cooldown: 3,
      },
    });
    const { engine, monster } = setup(def);

    const action = MonsterAI.decideAction(monster, engine) as unknown as { abilityName?: string };

    expect(action.abilityName).toBeUndefined();
  });

  it('follows declared spell preference and skips a redundant status', () => {
    const def = casterDef({
      spellPreferences: [
        { spellId: 'bolt_b', skipIfTargetHasStatus: 'slow', chance: 1 },
        { spellId: 'bolt_a' },
      ],
    });
    const { engine, monster } = setup(def);

    const chosen = JSON.stringify(MonsterAI.decideAction(monster, engine));

    expect(chosen).toContain('bolt_b');
  });

  it('leaves no campaign spell ids in the engine AI', async () => {
    const fsMod = await import('node:fs');
    const source =
      fsMod.readFileSync('src/engine/ai/behaviorTree.ts', 'utf8') +
      fsMod.readFileSync('src/engine/ai/aiRegistry.ts', 'utf8');

    expect(source).not.toContain("'firebolt'");
    expect(source).not.toContain('Hellfire Surge');
  });
});
