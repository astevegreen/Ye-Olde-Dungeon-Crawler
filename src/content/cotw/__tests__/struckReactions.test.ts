import { describe, it, expect } from 'vitest';
import { cotwManifest } from '../index';
import { GameEngine, GameMap, Player, Monster, MeleeAttackAction, createScaledItem } from '../../../engine';
import { TILES } from '../../../engine/grid/tile';

/**
 * Whole-codebase review, 2026-10-06, area 3 (R-cmbt-12 / R-pipe-12): regression guards.
 * Armour that promised a reaction when its wearer is struck hooked `onHit`, which
 * `HookDispatcher` collects from the attacker only, so it fired on the wearer's own blows.
 * It now hooks `onDamageTaken`. These tests guard that the Bellows-Plate Shield and the
 * Níð-Dripping Hauberk hook a defender event, and that the Hauberk burns whoever strikes the
 * hero, never the hero's own target.
 */

type Def = { id: string; description?: string; hooks?: Array<{ event: string }> };
const def = (id: string): Def => (cotwManifest.items as Def[]).find((i) => i.id === id)!;

describe('R-cmbt-12 · armour described as reacting "when struck" reacts to being struck', () => {
  it('bellows_plate_shield ("when struck") hooks a defender event', () => {
    const d = def('bellows_plate_shield');
    expect(d.description).toContain('when struck'); // the promise
    expect(d.hooks?.map((h) => h.event)).toContain('onDamageTaken');
  });

  it('the Hauberk burns whoever strikes the hero, and never the hero’s own target', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({ id: 'hero', position: { x: 3, y: 3 }, stats: { hp: 5000, maxHp: 5000, attack: 1, defense: 0 } });
    const engine = new GameEngine({ map, player, manifest: cotwManifest, seed: 2 });
    const hauberk = createScaledItem(def('nid_dripping_hauberk') as never, 'hauberk', 1, engine.rng);
    player.inventory.primaryPack.addItem(hauberk);
    player.inventory.equipFromPack(hauberk.id);
    const ogre = new Monster({ id: 'ogre', name: 'Ogre', position: { x: 4, y: 3 }, stats: { hp: 100000, maxHp: 100000, attack: 20, defense: 0 }, definitionId: 'ogre', aiType: 'melee' });
    engine.addEntity(ogre);
    const burns = () => engine.messages.filter((m) => m.includes('Níð-Dripping Hauberk')).length;

    for (let i = 0; i < 20; i++) new MeleeAttackAction(player, ogre).perform(engine);
    expect(burns()).toBe(0);

    for (let i = 0; i < 20; i++) new MeleeAttackAction(ogre, player).perform(engine);
    expect(burns()).toBeGreaterThan(0);
  });

  it('nid_dripping_hauberk ("whoever strikes its wearer") hooks a defender event', () => {
    const d = def('nid_dripping_hauberk');
    expect(d.description).toContain('whoever strikes its wearer'); // the promise
    expect(d.hooks?.map((h) => h.event)).toContain('onDamageTaken');
  });
});
