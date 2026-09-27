import { describe, it, expect } from 'vitest';
import { COTW_MANIFEST } from '../index';
import { WARCRAFT_MANIFEST } from '../../warcraft/index';
import type { GameContentManifest } from '../../../engine';

function checkCategories(manifest: GameContentManifest): void {
  const categories = manifest.monsterCategories ?? [];
  const monsterIds = new Set(manifest.monsters.map((m) => m.id));
  const owner = new Map<string, string>();

  for (const category of categories) {
    expect(category.masteryKills, category.id).toBeGreaterThan(15);
    for (const id of category.members) {
      expect(monsterIds.has(id), `${category.id} lists unknown monster ${id}`).toBe(true);
      expect(owner.get(id), `${id} is in both ${owner.get(id)} and ${category.id}`).toBeUndefined();
      owner.set(id, category.id);
    }
  }

  const uncategorized = [...monsterIds].filter((id) => !owner.has(id));
  expect(uncategorized).toEqual([]);
}

describe('monster categories', () => {
  it('put every CotW monster in exactly one category', () => {
    checkCategories(COTW_MANIFEST);
  });

  it('put every WarCraft monster in exactly one category', () => {
    checkCategories(WARCRAFT_MANIFEST);
  });
});
