import { describe, it, expect } from 'vitest';
import { fixtureManifest } from '../../../../tests/fixtures/fixture-pack';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { CastSpellAction } from '../../actions/spell-actions';
import { WaitAction } from '../../actions/wait';
import { StatusManager } from '../../status/statusManager';
import { DELAYED_BLAST_STATUS, pendingBlasts } from '../delayedBlast';

function build() {
  const map = new GameMap(30, 30, TILES.FLOOR);
  const hero = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 10, y: 10 },
    stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 },
    spellsKnown: ['rockslide', 'star_fall'],
  });
  hero.restoreMana(hero.maxMana);
  map.addEntity(hero);
  const engine = new GameEngine({ map, player: hero, floor: 1, manifest: fixtureManifest });
  // Held still, so only the blast changes what they have.
  const foe = (x: number, y: number) => {
    const m = new Monster({ id: `foe_${x}_${y}`, name: 'Foe', position: { x, y }, stats: { hp: 50, maxHp: 50, attack: 1, defense: 0 }, speed: 100, xpValue: 1 });
    map.addEntity(m);
    m.statusManager.applyStatus('paralysis', 99);
    return m;
  };
  const cast = (id: string, x: number, y: number) => engine.handlePlayerAction(new CastSpellAction(hero, id, x, y));
  const wait = () => engine.handlePlayerAction(new WaitAction(hero));
  const marked = () => pendingBlasts(engine).flatMap((b) => b.tiles.map((t) => `${t.x},${t.y}`)).sort();
  return { engine, map, hero, foe, cast, wait, marked };
}

describe('delayed blast', () => {
  it('marks its tiles at the cast and strikes them after the caster’s next action', () => {
    const { foe, cast, wait, marked } = build();
    const inside = foe(15, 10);
    expect(cast('rockslide', 15, 10).success).toBe(true);
    expect(inside.hp).toBe(50);
    expect(marked()).toHaveLength(9);
    expect(marked()).toContain('14,9');
    expect(marked()).toContain('16,11');

    wait();
    expect(inside.hp).toBeLessThan(50);
    expect(marked()).toHaveLength(0);
  });

  it('strikes whoever stands there when it goes off: a foe that stepped out is spared', () => {
    const { map, foe, cast, wait } = build();
    const leaver = foe(15, 10);
    const arriver = foe(20, 20);
    cast('rockslide', 15, 10);
    map.moveEntity(leaver, 18, 10);
    map.moveEntity(arriver, 14, 11);
    wait();
    expect(leaver.hp).toBe(50);
    expect(arriver.hp).toBeLessThan(50);
  });

  it('a second cast while one is pending lands where it was aimed, each its own blast', () => {
    const { foe, cast, wait } = build();
    const first = foe(15, 10);
    const second = foe(10, 15);
    cast('rockslide', 15, 10);
    // The first goes off as this cast's turn ends; the second waits for the next.
    cast('rockslide', 10, 15);
    expect(first.hp).toBeLessThan(50);
    expect(second.hp).toBe(50);
    wait();
    expect(second.hp).toBe(first.hp);
  });

  it('two at once keep their own aims and countdowns', () => {
    const { engine, hero, foe, wait } = build();
    const a = foe(15, 10);
    const b = foe(10, 15);
    const lay = (x: number, duration: number, y = 10) =>
      hero.statusManager.applyStatus({ type: DELAYED_BLAST_STATUS, duration, data: { spell: 'rockslide', x, y, ox: 10, oy: 10, element: 'physical', free: false } });
    lay(15, 1);
    lay(10, 2, 15);
    expect(pendingBlasts(engine)).toHaveLength(2);
    wait();
    expect(a.hp).toBeLessThan(50);
    expect(b.hp).toBe(50);
    wait();
    expect(b.hp).toBe(a.hp);
  });

  it('lays its ground on the tiles it strikes', () => {
    const { engine, cast, wait } = build();
    cast('rockslide', 15, 10);
    expect(engine.surfaces.getSurface(15, 10)).toBeUndefined();
    wait();
    expect(engine.surfaces.getSurface(15, 10)).toBe('water');
    expect(engine.surfaces.getSurface(16, 11)).toBe('water');
  });

  it('covers what it marked from where it was cast, the caster gone elsewhere', () => {
    const { map, hero, foe, cast, wait, marked } = build();
    const target = foe(15, 10);
    cast('star_fall', 15, 10);
    const before = marked();
    map.moveEntity(hero, 3, 3);
    // A foe stepping into the line it was thrown along does not catch it short.
    foe(12, 10);
    expect(marked()).toEqual(before);
    wait();
    expect(target.hp).toBeLessThan(50);
  });

  it('a save keeps both pending blasts', () => {
    const { hero } = build();
    for (const x of [15, 12]) hero.statusManager.applyStatus({ type: DELAYED_BLAST_STATUS, duration: 2, data: { spell: 'rockslide', x, y: 10, ox: 10, oy: 10 } });
    const restored = new StatusManager();
    restored.deserialize(hero.statusManager.serialize());
    expect(restored.getAll().map((b) => b.data?.x)).toEqual([15, 12]);
  });
});
