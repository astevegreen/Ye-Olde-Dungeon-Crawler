import { describe, expect, it } from 'vitest';
import { fixtureManifest } from '../../../../tests/fixtures/fixture-pack';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { SpellPipeline } from '../../magic/spellPipeline';
import { DeathResolver } from '../deathResolver';

function scene(): { engine: GameEngine; hero: Player } {
  const map = new GameMap(16, 12, TILES.FLOOR);
  const hero = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
  const engine = new GameEngine({ map, player: hero, manifest: fixtureManifest });
  return { engine, hero };
}

function spawn(engine: GameEngine, defId: string, x: number, y: number): Monster {
  const m = Monster.createFromDefinition(defId, `${defId}_${x}_${y}`, { x, y }, engine.registries);
  m.aiState = 'hunting';
  engine.addEntity(m);
  return m;
}

const allies = (engine: GameEngine) =>
  engine.map.getAllEntities().filter((e): e is Monster => e instanceof Monster && e.faction === 'player');

const kills = (engine: GameEngine, defId: string) => engine.compendium.getEntry(defId).kills;

describe('the death of one of the hero\'s own allies is not a hero kill', () => {
  it('a risen ally struck down by the hero\'s own blast pays no kill heal and counts no kill', () => {
    const { engine, hero } = scene();
    hero.maxHp = 100;
    hero.hp = 50;
    hero.grantPerk({ id: 'bloodthirst_test', name: 'Bloodthirst', description: '', source: 'saga', effects: { killHealPercent: 0.1 } });
    const raider = spawn(engine, 'raider', 6, 5);
    SpellPipeline.applyStatusEffect(engine, hero, raider, { type: 'applyStatus', statusId: 'rises_when_slain', duration: 5, potency: 12 });

    raider.takeDamage(9999);
    DeathResolver.resolveDeath(engine, hero, raider);
    // The real foe's death: one kill, one heal.
    expect(hero.hp).toBe(60);
    expect(kills(engine, 'raider')).toBe(1);

    const risen = allies(engine)[0];
    expect(risen).toBeDefined();
    // The hero's Fireball catches the ally (spellPipeline.applyDamageEffect names the caster as killer).
    risen.takeDamage(9999);
    DeathResolver.resolveDeath(engine, hero, risen, { damageElement: 'fire' });

    expect({ heroHp: hero.hp, raiderKills: kills(engine, 'raider') }).toEqual({ heroHp: 60, raiderKills: 1 });
  });

  it('a friendly summon that dies of poison on its own turn adds no bestiary kill', () => {
    const { engine } = scene();
    SpellPipeline.executeSummonEffect(engine, engine.player, { type: 'summon', monsterId: 'raider', duration: 50, friendly: true });
    const ally = allies(engine)[0];
    expect(ally).toBeDefined();
    ally.hp = 1;
    ally.statusManager.applyStatus({ type: 'poison', duration: 5, potency: 50 });

    ally.takeTurn(engine);

    expect(ally.isAlive()).toBe(false);
    expect(kills(engine, 'raider')).toBe(0);
  });
});
