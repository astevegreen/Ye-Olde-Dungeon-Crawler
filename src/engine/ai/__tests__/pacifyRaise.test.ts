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
import { MonsterAI } from '../behaviorTree';
import { WaitAction } from '../../actions/wait';

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

const cast = (engine: GameEngine, target: Monster, statusId: string, duration: number, potency?: number) =>
  SpellPipeline.applyStatusEffect(engine, engine.player, target, { type: 'applyStatus', statusId, duration, potency });

const living = (engine: GameEngine) => engine.map.getAllEntities().filter((e) => e instanceof Monster) as Monster[];

describe('pacify: a foe lays down its arms (P-31)', () => {
  it('a pacified foe beside the hero holds, and never strikes', () => {
    const { engine, hero } = scene();
    const raider = spawn(engine, 'raider', 6, 5);
    cast(engine, raider, 'pacified', 6);

    expect(MonsterAI.decideAction(raider, engine)).toBeInstanceOf(WaitAction);
    for (let i = 0; i < 4; i++) raider.takeTurn(engine);
    expect(hero.hp).toBe(hero.maxHp);
  });

  it('fights again when its turns run out', () => {
    const { engine } = scene();
    const raider = spawn(engine, 'raider', 6, 5);
    cast(engine, raider, 'pacified', 1);

    raider.statusManager.tick(raider, engine);

    expect(raider.statusManager.hasStatus('pacified')).toBe(false);
    expect(MonsterAI.decideAction(raider, engine)).not.toBeInstanceOf(WaitAction);
  });

  it('a blow on it ends the peace', () => {
    const { engine, hero } = scene();
    const raider = spawn(engine, 'raider', 6, 5);
    raider.hp = raider.maxHp = 500;
    cast(engine, raider, 'pacified', 20);

    for (let i = 0; i < 30 && raider.hp === raider.maxHp; i++) new MeleeAttackAction(hero, raider).perform(engine);

    expect(raider.hp).toBeLessThan(raider.maxHp);
    expect(raider.statusManager.hasStatus('pacified')).toBe(false);
    expect(engine.messages).toContain('Raider takes up arms again!');
  });

  it('the hero\'s summons leave a pacified foe be', () => {
    const { engine } = scene();
    const raider = spawn(engine, 'raider', 9, 5);
    cast(engine, raider, 'pacified', 50);
    SpellPipeline.executeSummonEffect(engine, engine.player, { type: 'summon', monsterId: 'raider', duration: 50, friendly: true });
    const ally = living(engine).find((m) => m.faction === 'player')!;
    engine.map.moveEntity(ally, 8, 5);

    for (let i = 0; i < 10; i++) ally.takeTurn(engine);

    expect(raider.hp).toBe(raider.maxHp);
  });

  it('a boss resists', () => {
    const { engine } = scene();
    const warlord = spawn(engine, 'warlord', 6, 5);

    cast(engine, warlord, 'pacified', 6);

    expect(warlord.statusManager.hasStatus('pacified')).toBe(false);
  });
});

describe('raising the slain: a cursed foe rises on the hero\'s side (P-31)', () => {
  it('a foe slain under the curse rises where it fell, for the curse\'s turns', () => {
    const { engine, hero } = scene();
    const raider = spawn(engine, 'raider', 6, 5);
    cast(engine, raider, 'rises_when_slain', 5, 12);

    DeathResolver.resolveDeath(engine, hero, raider);

    const risen = living(engine).find((m) => m.faction === 'player');
    expect(risen).toBeDefined();
    expect(risen!.definitionId).toBe('raider');
    expect({ x: risen!.x, y: risen!.y }).toEqual({ x: 6, y: 5 });
    expect(risen!.statusManager.getStatus('risen')?.duration).toBe(12);
    expect(risen!.lootTable).toEqual([]);
    expect(engine.messages.some((m) => m.startsWith('Raider is slain!'))).toBe(true);
  });

  it('and crumbles when they run out', () => {
    const { engine, hero } = scene();
    const raider = spawn(engine, 'raider', 6, 5);
    cast(engine, raider, 'rises_when_slain', 5, 1);
    DeathResolver.resolveDeath(engine, hero, raider);
    const risen = living(engine).find((m) => m.faction === 'player')!;

    risen.statusManager.tick(risen, engine);

    expect(engine.map.getEntityById(risen.id)).toBeNull();
    expect(engine.messages).toContain('Raider crumbles to dust.');
  });

  it('a foe that dies after the curse lifts stays dead', () => {
    const { engine, hero } = scene();
    const raider = spawn(engine, 'raider', 6, 5);
    cast(engine, raider, 'rises_when_slain', 1);
    raider.statusManager.tick(raider, engine);

    DeathResolver.resolveDeath(engine, hero, raider);

    expect(living(engine)).toEqual([]);
  });

  it('a boss resists the curse, and the quest\'s boss never rises', () => {
    const { engine, hero } = scene();
    const warlord = spawn(engine, 'warlord', 6, 5);
    cast(engine, warlord, 'rises_when_slain', 5);
    expect(warlord.statusManager.hasStatus('rises_when_slain')).toBe(false);

    warlord.statusManager.applyStatus({ type: 'rises_when_slain', duration: 5 });
    DeathResolver.resolveDeath(engine, hero, warlord);

    expect(living(engine)).toEqual([]);
  });
});
