import { describe, expect, it } from 'vitest';
import { ProfileManager, MemoryStorage } from '../profile-manager';
import { serializeGame, deserializeGame } from '../serializer';
import type { SaveData } from '../types';
import { Monster } from '../../entities/monster';
import { Companion } from '../../entities/companion';
import { Item } from '../../items/item';
import { cotwManifest } from '../../../content/cotw';

/**
 * The fraction of a point a scaled heal carries over (`Actor.healCarry`, Mirror Hide's
 * `healingReceivedMultiplier`) survives a save and load, so a load or a bug-report
 * checkpoint heals as the live run did (ARCHITECTURE.md §2 Bug-Report Replay).
 */
function newHero() {
  const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
  return pm.createCharacter('Mender', { seed: 4 });
}

const roundTrip = (save: SaveData): SaveData => JSON.parse(JSON.stringify(save));

describe('the heal carry across save/load', () => {
  it('a hero in Mirror Hide heals the same after a load as without one', () => {
    const { engine, profile } = newHero();
    const hide = new Item({ id: 'mirror-hide', name: 'Mirror Hide', category: 'helmet', slot: 'head', weight: 100, bulk: 100, identified: true });
    hide.addModifier({ id: 'c-mirror', name: 'Mirror Hide', alignment: 'chaotic', category: 'chaotic', healingReceivedMultiplier: 0.5 });
    engine.player.inventory.paperdoll.equip(hide, 'head');
    engine.player.hp = 10;
    expect(engine.player.heal(1)).toBe(0); // half a point, carried

    const loaded = deserializeGame(roundTrip(serializeGame(engine, profile)), cotwManifest).engine;

    expect(loaded.player.hp).toBe(engine.player.hp);
    const live = engine.player.heal(1);
    const reloaded = loaded.player.heal(1);
    expect(live).toBe(1);
    expect(reloaded).toBe(live);
    expect(loaded.player.hp).toBe(engine.player.hp);
  });

  it('a monster and a companion keep their carry too', () => {
    const { engine, profile } = newHero();
    const foe = new Monster({ id: 'carry-foe', name: 'foe', position: { x: engine.player.x + 3, y: engine.player.y }, stats: { hp: 20, maxHp: 20, attack: 1, defense: 0 } });
    engine.map.addEntity(foe);
    foe.restoreHealCarry(0.25);
    const hound = new Companion({
      id: 'carry-hound',
      name: 'Hound',
      position: { x: engine.player.x + 1, y: engine.player.y },
      stats: { hp: 20, maxHp: 20, attack: 3, defense: 1 },
      speed: 100,
      companionDefinitionId: 'hound',
      packWeightCapacity: 10_000,
      packBulkCapacity: 10_000,
    } as never);
    engine.addEntity(hound);
    engine.companion = hound;
    hound.restoreHealCarry(0.75);

    const save = roundTrip(serializeGame(engine, profile));
    expect(save.map.monsters?.find((m) => m.id === 'carry-foe')?.healCarry).toBe(0.25);
    expect(save.companion?.healCarry).toBe(0.75);

    const loaded = deserializeGame(save, cotwManifest).engine;
    expect((loaded.map.getEntityById('carry-foe') as Monster).healCarryValue).toBe(0.25);
    expect(loaded.companion?.healCarryValue).toBe(0.75);
  });

  it('writes no field for a carry of 0, and a save without one loads with 0', () => {
    const { engine, profile } = newHero();
    const save = roundTrip(serializeGame(engine, profile));
    expect(save.player).not.toHaveProperty('healCarry');
    for (const m of save.map.monsters ?? []) expect(m).not.toHaveProperty('healCarry');

    const loaded = deserializeGame(save, cotwManifest).engine;
    expect(loaded.player.healCarryValue).toBe(0);
  });
});
