import { describe, expect, it } from 'vitest';
import { fixtureManifest } from '../../../../tests/fixtures/fixture-pack';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { SpellPipeline } from '../../magic/spellPipeline';
import { MeleeAttackAction } from '../../actions/combat';
import { DeathResolver } from '../../combat/deathResolver';
import type { StatusType } from '../types';

function scene(): { engine: GameEngine; hero: Player } {
  const map = new GameMap(16, 12, TILES.FLOOR);
  const hero = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
  const engine = new GameEngine({ map, player: hero, manifest: fixtureManifest });
  return { engine, hero };
}

/** A friendly raider summoned for `duration` turns bearing `bears`, moved to (x, y). */
function summon(engine: GameEngine, x: number, y: number, duration: number, bears: StatusType[] = []): Monster {
  SpellPipeline.executeSummonEffect(engine, engine.player, { type: 'summon', monsterId: 'raider', duration, friendly: true, bears });
  const ally = engine.map.getAllEntities().filter((e) => e instanceof Monster && e.faction === 'player').at(-1) as Monster;
  engine.map.moveEntity(ally, x, y);
  return ally;
}

function foe(engine: GameEngine, x: number, y: number): Monster {
  const raider = Monster.createFromDefinition('raider', `foe_${x}_${y}`, { x, y }, engine.registries);
  engine.addEntity(raider);
  return raider;
}

const onMap = (engine: GameEngine, e: Monster) => engine.map.getEntityById(e.id) === e;

describe('a summon leaves when its lease runs out', () => {
  it('even when the pack words its leaving', () => {
    const { engine } = scene();
    const ally = summon(engine, 8, 5, 1);

    ally.statusManager.tick(ally, engine);

    expect(onMap(engine, ally)).toBe(false);
    expect(engine.messages).toContain('Raider returns to the mist.');
  });
});

describe('endings: a status that goes off as it ends', () => {
  it('a summon shatters on its foes as its lease runs out, sparing the hero', () => {
    const { engine, hero } = scene();
    const ally = summon(engine, 6, 5, 1, ['frost_shatter']);
    const near = foe(engine, 7, 5);
    const far = foe(engine, 12, 9);

    ally.statusManager.tick(ally, engine);

    expect(near.hp).toBeLessThan(near.maxHp);
    expect(far.hp).toBe(far.maxHp);
    expect(hero.hp).toBe(hero.maxHp);
    expect(onMap(engine, ally)).toBe(false);
    expect(engine.messages).toContain('Raider shatters into ice!');
  });

  it('and as it falls', () => {
    const { engine } = scene();
    const ally = summon(engine, 9, 5, 20, ['frost_shatter']);
    const near = foe(engine, 10, 5);

    DeathResolver.resolveDeath(engine, near, ally);

    expect(near.hp).toBeLessThan(near.maxHp);
  });

  it('a summon bursts when struck, once, and is gone', () => {
    const { engine } = scene();
    const ally = summon(engine, 9, 5, 20, ['spirit_burst']);
    const attacker = foe(engine, 10, 5);
    ally.hp = ally.maxHp = 500;

    for (let i = 0; i < 30 && onMap(engine, ally); i++) new MeleeAttackAction(attacker, ally).perform(engine);

    expect(onMap(engine, ally)).toBe(false);
    expect(attacker.hp).toBeLessThan(attacker.maxHp);
    expect(ally.statusManager.hasStatus('spirit_burst')).toBe(false);
  });

  it('a spell strike sets it off too', () => {
    const { engine, hero } = scene();
    const ally = summon(engine, 9, 5, 20, ['spirit_burst']);
    const near = foe(engine, 10, 6);
    ally.hp = ally.maxHp = 500;
    const bolt = { ...fixtureManifest.spells![0], areaOfEffect: 0 };

    SpellPipeline.applyDamageEffect(engine, bolt, hero, ally, { type: 'damage', amount: 3, element: 'physical' });

    expect(onMap(engine, ally)).toBe(false);
    expect(near.hp).toBeLessThan(near.maxHp);
  });

  it('a blast laid on a tile goes off at its own centre when its countdown ends', () => {
    const { engine, hero } = scene();
    const near = foe(engine, 11, 5);
    const far = foe(engine, 2, 2);
    hero.statusManager.applyStatus({ type: 'laid_blast', duration: 1, data: { x: 10, y: 5 } });

    hero.statusManager.tick(hero, engine);

    expect(near.hp).toBeLessThan(near.maxHp);
    expect(far.hp).toBe(far.maxHp);
    expect(hero.hp).toBe(hero.maxHp);
  });
});
