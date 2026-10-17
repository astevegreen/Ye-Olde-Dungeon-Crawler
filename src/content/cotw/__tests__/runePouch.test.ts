import { describe, it, expect } from 'vitest';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { serializeGame } from '../../../engine/storage/serializer';
import { deserializeSaveData } from '../../../engine/__fixtures__/testHelpers';
import { Container } from '../../../engine/items/container';
import { createScaledItem } from '../../../engine/dungeon/lootSpawner';
import { cotwManifest } from '../index';

/** Owner, 12 Oct: runes get "a separate storage area (kind of like the purse for coins)". */
describe('the rune pouch', () => {
  const newHero = () => new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Pouch', { seed: 812 }).engine;
  const make = (id: string, n: number) => {
    const def = cotwManifest.items!.find((i) => i.id === id)!;
    return createScaledItem(def, `${id}-${n}`, 1, () => 0.5);
  };
  const pouchOf = (engine: ReturnType<typeof newHero>) => engine.player.inventory.paperdoll.getItem('runes') as Container;

  it('is worn in its own slot by a new hero', () => {
    const pouch = pouchOf(newHero());
    expect(pouch).toBeInstanceOf(Container);
    expect(pouch.definitionId).toBe('rune_pouch');
  });

  it('takes every essence-rune picked up, and nothing else', () => {
    const engine = newHero();
    expect(engine.player.inventory.storeItem(make('essence_isa', 1)).destination).toBe('runes');
    expect(engine.player.inventory.storeItem(make('essence_berkano', 1)).destination).toBe('runes');
    expect(engine.player.inventory.storeItem(make('scroll_phase_door', 1)).destination).not.toBe('runes');
    expect(pouchOf(engine).getItems().map((i) => i.definitionId).sort()).toEqual(['essence_berkano', 'essence_isa']);
  });

  it('holds 210 runes, then the pack takes the rest', () => {
    const engine = newHero();
    const destinations = Array.from({ length: 211 }, (_, n) => engine.player.inventory.storeItem(make('essence_kenaz', n)).destination);
    expect(destinations.slice(0, 210).every((d) => d === 'runes')).toBe(true);
    expect(destinations[210]).toBe('pack');
  });

  it('keeps its runes and its filter through a save', () => {
    const engine = newHero();
    engine.player.inventory.storeItem(make('essence_uruz', 1));
    const loaded = deserializeSaveData(JSON.parse(JSON.stringify(serializeGame(engine))), cotwManifest);
    const pouch = pouchOf(loaded);
    expect(pouch.getItems().map((i) => i.definitionId)).toEqual(['essence_uruz']);
    expect(loaded.player.inventory.storeItem(make('essence_ansuz', 1)).destination).toBe('runes');
  });
});
