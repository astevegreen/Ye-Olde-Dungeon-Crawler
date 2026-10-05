import { describe, expect, it } from 'vitest';
import { ProfileManager, MemoryStorage } from '../profile-manager';
import { serializeGame, deserializeGame } from '../serializer';
import { cotwManifest } from '../../../content/cotw';
import { Item } from '../../items/item';
import type { GameContentManifest } from '../../types/manifest';

/** The cotw pack with an off hand that also takes a category no default slot takes. */
const manifest: GameContentManifest = {
  ...cotwManifest,
  equipmentSlots: cotwManifest.equipmentSlots!.map((slot) =>
    slot.id === 'offHand' ? { ...slot, acceptedCategories: [...slot.acceptedCategories, 'lantern'] } : slot
  ),
};

const lantern = () => new Item({ id: 'lantern-1', name: 'Lantern', category: 'lantern', weight: 500, bulk: 400 });

describe("a hero's paperdoll", () => {
  it("takes the pack's slots when the hero is created, as it does when loaded", () => {
    const { engine, profile } = new ProfileManager(new MemoryStorage(), manifest).createCharacter('Fresh', { manifest });

    expect(engine.player.inventory.paperdoll.canEquip(lantern(), 'offHand').allowed).toBe(true);

    const loaded = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine, profile))), manifest).engine;
    expect(loaded.player.inventory.paperdoll.canEquip(lantern(), 'offHand').allowed).toBe(true);
  });
});
