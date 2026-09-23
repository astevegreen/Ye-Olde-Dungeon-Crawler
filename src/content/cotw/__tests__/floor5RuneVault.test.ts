import { describe, it, expect } from 'vitest';
import { DungeonArc } from '../../../engine/quest/dungeonArc';
import { COTW_QUEST } from '../quest';
import { cotwManifest } from '../index';
import { Container } from '../../../engine/items/container';
import { RuneOfReturnItem } from '../../../engine/magic/runeOfReturn';
import { Monster } from '../../../engine/entities/monster';
import { COTW_STARTER_KIT } from '../character';

/**
 * The Rune of Return moved from a free starter-kit item to a floor-5 discovery,
 * guarded by several monsters in a hand-placed vault room (dungeonArc.ts's
 * FLOOR5_RUNE_VAULT_ID, forced via dungeon-generator.ts's forcedVaultId).
 */
describe('Floor 5: guaranteed Rune of Return vault', () => {
  it('is no longer part of the starter kit', () => {
    expect(COTW_STARTER_KIT.packItemIds).not.toContain('rune_of_return');
  });

  function findRuneOfReturn(seed: number) {
    const floor5 = DungeonArc.generateFloor(5, seed, COTW_QUEST, cotwManifest);
    for (const pile of floor5.map.getAllGroundItems()) {
      for (const item of pile.items) {
        if (item instanceof RuneOfReturnItem) {
          return { floor5, rune: item, position: { x: pile.x, y: pile.y } };
        }
        if (item instanceof Container) {
          const inner = item.getItems().find((i) => i instanceof RuneOfReturnItem);
          if (inner) {
            return { floor5, rune: inner as RuneOfReturnItem, position: { x: pile.x, y: pile.y } };
          }
        }
      }
    }
    return { floor5, rune: undefined, position: undefined };
  }

  it('always places a Rune of Return on floor 5, across many seeds', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { rune } = findRuneOfReturn(seed);
      expect(rune, `seed ${seed} produced no Rune of Return on floor 5`).toBeDefined();
    }
  });

  it('guards the reward with several nearby monsters', () => {
    const { floor5, position } = findRuneOfReturn(7);
    expect(position).toBeDefined();

    const nearbyMonsters = floor5.map
      .getAllEntities()
      .filter((e) => e instanceof Monster && Math.hypot(e.x - position!.x, e.y - position!.y) <= 6);
    expect(nearbyMonsters.length).toBeGreaterThanOrEqual(2);

    const frostWarden = nearbyMonsters.find(
      (e) => (e as Monster).definitionId === 'miniboss_frost_warden' || (e as Monster).name.includes('Gálmr')
    );
    expect(frostWarden).toBeDefined();
  });

  it('never spawns the player inside the guarded vault', () => {
    // The forced vault is the generator's first room; spawn and stairs used to be
    // placed at rooms[0]'s center, i.e. inside the vault beside its miniboss.
    for (let seed = 1; seed <= 20; seed++) {
      const { floor5, position } = findRuneOfReturn(seed);
      const spawn = floor5.playerSpawn;
      const distance = Math.max(Math.abs(spawn.x - position!.x), Math.abs(spawn.y - position!.y));
      expect(distance, `seed ${seed} spawned the player in the rune vault`).toBeGreaterThan(6);
    }
  });
});
