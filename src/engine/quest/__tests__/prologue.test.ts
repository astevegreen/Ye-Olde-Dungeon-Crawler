import { describe, it, expect } from 'vitest';
import { ProfileManager, MemoryStorage } from '../../storage/profile-manager';
import { serializeGame, deserializeSaveData } from '../../storage/serializer';
import type { SaveData } from '../../storage/types';
import type { GameContentManifest, PrologueDefinition } from '../../types/manifest';
import { Monster } from '../../entities/monster';
import { NPC } from '../../entities/npc';
import { getFlag } from '../../state/worldState';
import { concludePrologue, isPrologueRunning } from '../prologue';
import { cotwManifest } from '../../../content/cotw';

/** A test prologue on cotw's town, apart from cotw's own: an orc, a villager, a ward. */
const PROLOGUE: PrologueDefinition = {
  playerSpawn: { x: 22, y: 33 },
  startFlag: 'test_prologue_started',
  endFlag: 'test_prologue_ended',
  openingMessage: 'Smoke over the village.',
  closingMessage: 'Dawn.',
  dark: true,
  heroHpFloor: 1,
  monsters: [{ definitionId: 'orc', position: { x: 22, y: 30 } }],
  npcs: [{ id: 'test-villager', name: 'A villager', position: { x: 24, y: 24 } }],
  aftermathNpcs: [{ id: 'test-warden', name: 'The warden', position: { x: 31, y: 9 } }],
};
const manifest: GameContentManifest = { ...cotwManifest, prologue: PROLOGUE };

function begin() {
  return new ProfileManager(new MemoryStorage(), manifest).createCharacter('Hild', { manifest, prologue: true }).engine;
}

const roundTrip = (engine: ReturnType<typeof begin>) =>
  deserializeSaveData(JSON.parse(JSON.stringify(serializeGame(engine))) as SaveData, manifest);

describe('Prologue (manifest.prologue)', () => {
  it('stages itself on the town when the new run asks for it', () => {
    const engine = begin();
    expect(engine.currentFloor).toBe(0);
    expect({ x: engine.player.x, y: engine.player.y }).toEqual(PROLOGUE.playerSpawn);
    expect(isPrologueRunning(engine.worldState, PROLOGUE)).toBe(true);
    expect(engine.map.lit).toBe(false);
    expect(engine.map.getEntityAt(22, 30)).toBeInstanceOf(Monster);
    expect(engine.map.getEntityById('test-villager')).toBeInstanceOf(NPC);
    expect(engine.messages).toContain('Smoke over the village.');
  });

  it('leaves a run that does not ask for it in the plain town', () => {
    const { engine } = new ProfileManager(new MemoryStorage(), manifest).createCharacter('Hild', { manifest });
    expect(isPrologueRunning(engine.worldState, PROLOGUE)).toBe(false);
    expect(engine.map.lit).toBe(true);
    expect(engine.map.getEntityAt(22, 30)).toBeFalsy();
  });

  it('holds the hero at the HP floor instead of letting them die, and says so', () => {
    const engine = begin();
    const hero = engine.player;
    expect(hero.wasHeldAtHpFloor).toBe(false);
    hero.takeDamage(hero.hp + 50);
    expect(hero.hp).toBe(1);
    expect(hero.isAlive()).toBe(true);
    expect(hero.wasHeldAtHpFloor).toBe(true);
  });

  it('keeps the dark and the ward across a save and load', () => {
    const loaded = roundTrip(begin());
    expect(loaded.map.lit).toBe(false);
    loaded.player.takeDamage(loaded.player.hp + 50);
    expect(loaded.player.hp).toBe(1);
  });

  it('ends: its monsters leave, the town is lit, the ward lifts, the aftermath arrives', () => {
    const engine = begin();
    concludePrologue(engine, PROLOGUE, true);

    expect(getFlag(engine.worldState, PROLOGUE.endFlag)).toBe(true);
    expect(isPrologueRunning(engine.worldState, PROLOGUE)).toBe(false);
    expect(engine.map.getEntityAt(22, 30)).toBeFalsy();
    expect(engine.map.lit).toBe(true);
    expect(engine.map.getEntityById('test-warden')).toBeInstanceOf(NPC);
    expect(engine.messages).toContain('Dawn.');

    engine.player.takeDamage(engine.player.hp + 50);
    expect(engine.player.isAlive()).toBe(false);
  });

  it('stays ended after a load, and ending twice does nothing more', () => {
    const engine = begin();
    concludePrologue(engine, PROLOGUE, true);
    const loaded = roundTrip(engine);
    expect(loaded.map.lit).toBe(true);
    concludePrologue(loaded, PROLOGUE, true);
    expect(loaded.messages.filter((m) => m === 'Dawn.').length).toBeLessThanOrEqual(1);
  });
});
