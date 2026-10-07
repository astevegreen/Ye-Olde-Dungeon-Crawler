import { describe, it, expect } from 'vitest';
import { Companion, GameEngine, GameMap, Player, type GameContentManifest } from '../../engine';
import { companionWheelSlots } from '../companionWheel';

function engineWith(trainerSkills: { id: string; name: string; description: string }[] = []): GameEngine {
  const engine = new GameEngine({ map: new GameMap(12, 12), player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }) });
  (engine.manifest as GameContentManifest).town = { ...(engine.manifest.town ?? {}), services: { trainerSkills } } as GameContentManifest['town'];
  return engine;
}

function hound(): Companion {
  return new Companion({
    id: 'hound', name: 'Hound', position: { x: 6, y: 5 }, stats: { hp: 20, maxHp: 20, attack: 3, defense: 1 },
    speed: 100, companionDefinitionId: 'test_hound', packWeightCapacity: 10000, packBulkCapacity: 10000,
  });
}

describe('the companion wheel: the radial menu is the companion\'s', () => {
  it('has nothing to show a hero who never bonded', () => {
    expect(companionWheelSlots(engineWith())).toBeNull();
  });

  it('offers a bonded hero whose companion is away only the call', () => {
    const engine = engineWith();
    engine.setWorldFlag(GameEngine.COMPANION_BONDED_FLAG, true);
    expect(companionWheelSlots(engine)!.filter(Boolean)).toEqual([{ label: 'Call', action: { kind: 'call' } }]);
  });

  it('lays out send-away, up to three learned skills by the pack\'s names, and the pack on fixed wedges', () => {
    const engine = engineWith([
      { id: 'howl', name: 'Rally Howl', description: '' },
      { id: 'guard', name: 'Guard', description: '' },
    ]);
    const companion = hound();
    companion.unlockedSkills.push('howl', 'guard', 'third', 'fourth');
    engine.companion = companion;

    const slots = companionWheelSlots(engine)!;
    expect(slots.map((s) => s?.label ?? null)).toEqual([
      'Send away', // N
      'Rally Howl', // NE
      'Guard', // E
      'third', // SE: a skill the pack doesn't name shows its id
      'Pack', // S
      null, // SW, W, NW: kept for orders
      null,
      null,
    ]);
    expect(slots[1]!.action).toEqual({ kind: 'skill', skillId: 'howl' });
    expect(slots[4]!.action).toEqual({ kind: 'pack' });
  });
});
