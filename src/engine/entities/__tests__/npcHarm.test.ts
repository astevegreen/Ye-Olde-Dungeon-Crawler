import { describe, expect, it } from 'vitest';
import { ProfileManager, MemoryStorage } from '../../storage/profile-manager';
import { cotwManifest } from '../../../content/cotw';
import { CastSpellAction } from '../../actions/spell-actions';
import { NPC } from '../npc';

describe('town NPCs and harm', () => {
  it('a spell cast at a townsperson does not hurt them', () => {
    const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Caster', { seed: 9 });
    engine.changeFloor(0);
    const priest = engine.map.getAllEntities().find((e): e is NPC => e instanceof NPC && e.role === 'priest')!;
    const p = engine.player;
    const spot = [[-1, 0], [1, 0], [0, -1], [0, 1]]
      .map(([dx, dy]) => ({ x: priest.x + dx, y: priest.y + dy }))
      .find(({ x, y }) => engine.map.isPassable(x, y) && !engine.map.getEntityAt(x, y))!;
    engine.map.moveEntity(p, spot.x, spot.y);
    p.learnSpell('firebolt');

    for (let i = 0; i < 12; i++) {
      p.mana = p.maxMana;
      new CastSpellAction(p, 'firebolt', priest.x, priest.y).perform(engine);
    }

    expect(priest.hp).toBe(priest.maxHp);
    expect(engine.map.getEntityById(priest.id)).toBe(priest);
  });
});
