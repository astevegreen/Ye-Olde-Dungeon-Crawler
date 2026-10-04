import { describe, expect, it } from 'vitest';
import { ProfileManager, MemoryStorage } from '../profile-manager';
import { serializeGame, deserializeGame } from '../serializer';
import type { SaveData, SerializedItemNode } from '../types';
import { cotwManifest } from '../../../content/cotw';
import type { GameEngine } from '../../engine';
import { createScaledItem } from '../../dungeon/lootSpawner';
import { PotionItem } from '../../items/consumables';

/**
 * Found by the soak harness: Save and exit -> Continue brought every carried item back
 * without its definitionId (the potion row keys pins by it, so it showed 0 of each) and
 * every stack back as a single item ("Minor Health Potion x4" became one potion).
 */
function newHero() {
  const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
  return pm.createCharacter('Stacker', { manifest: cotwManifest });
}

const carried = (engine: GameEngine) =>
  engine.player.inventory
    .getAllCarriedItems()
    .map((i) => ({ id: i.id, name: i.name, definitionId: i.definitionId, quantity: i.quantity, parentId: i.parentId }))
    .sort((a, b) => a.id.localeCompare(b.id));

const load = (save: SaveData) => deserializeGame(JSON.parse(JSON.stringify(save)), cotwManifest).engine;

describe('carried items across save/load', () => {
  it('keeps definitionId and stack size, in the pack and on the belt', () => {
    const { engine, profile } = newHero();
    const flasks = engine.player.inventory.getAllCarriedItems().filter((i) => i.definitionId === 'hearth_broth_flask');
    // The kit puts one flask in the pack and one on the belt: two stacks of one kind.
    expect(flasks).toHaveLength(2);
    flasks[0].quantity = 4;
    flasks[1].quantity = 2;

    const before = carried(engine);
    const after = carried(load(serializeGame(engine, profile)));

    expect(after).toEqual(before);
    expect(after.filter((i) => i.definitionId === 'hearth_broth_flask').map((i) => i.quantity).sort()).toEqual([2, 4]);
  });

  it('keeps a stack the player split as two stacks in the same container', () => {
    const { engine, profile } = newHero();
    const pack = engine.player.inventory.primaryPack;
    const flask = pack.getItems().find((i) => i.definitionId === 'hearth_broth_flask')!;
    flask.quantity = 4;
    const split = engine.commandBus.dispatch({ type: 'split_stack', payload: { itemId: flask.id, amount: 1 } });
    expect(split.success).toBe(true);

    const flasksIn = (e: GameEngine) =>
      e.player.inventory.primaryPack
        .getItems()
        .filter((i) => i.name === flask.name)
        .map((i) => i.quantity)
        .sort();
    expect(flasksIn(engine)).toEqual([1, 3]);
    expect(flasksIn(load(serializeGame(engine, profile)))).toEqual([1, 3]);
  });

  it('gives back the definition fields a save leaves out, as a new item has them', () => {
    const { engine, profile } = newHero();
    const def = (id: string) => cotwManifest.items.find((d) => d.id === id)!;
    // Two-handed, with reach: lying underfoot, so the pack's capacity doesn't matter.
    const spear = createScaledItem(def('skraeling_ice_spear'), 'spear-1', 1, () => 0.5);
    engine.map.addItemAt(engine.player.x, engine.player.y, spear);
    const signet = createScaledItem(def('rime_signet_of_the_hollows'), 'signet-1', 1, () => 0.5);
    engine.map.addItemAt(engine.player.x, engine.player.y, signet);

    const loaded = load(serializeGame(engine, profile));

    // The kit's poultice has no potionType: rebuilt from that alone, it cured nothing.
    const poultice = loaded.player.inventory.getAllCarriedItems().find((i) => i.definitionId === 'birch_tar_poultice');
    expect(poultice).toBeInstanceOf(PotionItem);
    expect((poultice as PotionItem).effects).toEqual(def('birch_tar_poultice').potionConfig!.effects);

    const loadedSpear = loaded.map.getItemsAt(engine.player.x, engine.player.y).find((i) => i.id === 'spear-1')!;
    expect(loadedSpear.twoHanded).toBe(true);
    expect(loadedSpear.rangedConfig).toEqual(spear.rangedConfig);

    const loadedSignet = loaded.map.getItemsAt(engine.player.x, engine.player.y).find((i) => i.id === 'signet-1')!;
    expect(loadedSignet.hooks).toEqual(def('rime_signet_of_the_hollows').hooks);
  });

  it('gives an item from an older save, written without definitionId, its definition by name', () => {
    const { engine, profile } = newHero();
    const before = carried(engine);
    const save = serializeGame(engine, profile);
    const strip = (node: SerializedItemNode | null) => {
      if (!node) return;
      delete node.definitionId;
      if (node.isContainer) node.items.forEach(strip);
    };
    strip(save.player.inventory.primaryPack);
    Object.values(save.player.inventory.paperdoll).forEach(strip);

    const after = carried(load(save));

    expect(after.map((i) => i.definitionId)).toEqual(before.map((i) => i.definitionId));
    expect(after.some((i) => i.definitionId === 'hearth_broth_flask')).toBe(true);
  });

  it("loads an older save's quality labels as normal, and a cursed relic bound by its family", () => {
    const { engine, profile } = newHero();
    const def = (id: string) => cotwManifest.items.find((d) => d.id === id)!;
    // Underfoot: the cleaver is too heavy for the pack, and the ground is saved the same way.
    const cleaver = createScaledItem(def('rot_porous_cleaver'), 'cleaver-1', 36, () => 0.5);
    cleaver.modifiers = [];
    const spear = createScaledItem(def('skraeling_ice_spear'), 'spear-legacy', 1, () => 0.5);
    engine.map.addItemAt(engine.player.x, engine.player.y, cleaver);
    engine.map.addItemAt(engine.player.x, engine.player.y, spear);
    const save = serializeGame(engine, profile);
    const underfoot = save.map.groundItems.flatMap((tile) => tile.items);
    for (const node of underfoot) {
      if (node.id === 'cleaver-1') {
        node.quality = 'cursed';
        delete node.modifiers;
      }
      if (node.id === 'spear-legacy') node.quality = 'enchanted';
    }

    const loaded = load(save);
    const after = loaded.map.getItemsAt(loaded.player.x, loaded.player.y);
    const loadedCleaver = after.find((i) => i.id === 'cleaver-1')!;
    const loadedSpear = after.find((i) => i.id === 'spear-legacy')!;
    expect(loadedSpear.quality).toBe('normal');
    expect(loadedCleaver.quality).toBe('normal');
    expect(loadedCleaver.modifiers.map((m) => m.name)).toEqual(['Blighted']);
    expect(loadedCleaver.isBound()).toBe(true);
  });
});
