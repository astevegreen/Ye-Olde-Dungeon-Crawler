import { describe, it, expect, afterAll } from 'vitest';
import { GameEngine, GameMap, TILES, Player } from '../../../engine';
import { WaitAction } from '../../../engine/actions/wait';
import { COTW_PROGRESSION } from '../character';
import { JARNVIDR_EXPOSURE_STATUS, jarnvidrExposureHandler, JARNVIDR_HAZARD_BOOTSTRAP_HOOK } from '../hazards';
import { StatusHandlerRegistry } from '../../../engine/status/statusHandlers';

function buildEngine(floor: number) {
  StatusHandlerRegistry.register(JARNVIDR_EXPOSURE_STATUS, jarnvidrExposureHandler);
  const map = new GameMap(10, 10, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 3, y: 3 },
    stats: { hp: 200, maxHp: 200, attack: 10, defense: 5 },
    level: 1,
  });
  const engine = new GameEngine({ map, player, floor });
  (engine.manifest as any).progressionConfig = COTW_PROGRESSION;
  engine.actionPipeline.registerHook(JARNVIDR_HAZARD_BOOTSTRAP_HOOK);
  return { engine, player };
}

describe('Járnviðr temperature exposure (Act 1 hazard)', () => {
  afterAll(() => {
    StatusHandlerRegistry.resetToDefaults();
  });

  it('applies itself to the player on the first action and never re-applies', () => {
    const { engine, player } = buildEngine(3);
    expect(player.statusManager.hasStatus(JARNVIDR_EXPOSURE_STATUS)).toBe(false);

    engine.handlePlayerAction(new WaitAction(player));
    expect(player.statusManager.hasStatus(JARNVIDR_EXPOSURE_STATUS)).toBe(true);
    const effect = player.statusManager.getStatus(JARNVIDR_EXPOSURE_STATUS)!;

    engine.handlePlayerAction(new WaitAction(player));
    // Still exactly one instance (applyStatus on an existing effect just extends
    // duration; the ambient hazard never naturally expires either way).
    expect(player.statusManager.getAll().filter((e) => e.type === JARNVIDR_EXPOSURE_STATUS)).toHaveLength(1);
    expect(effect.duration).toBeGreaterThan(0);
  });

  it('deals cold damage on permafrost floors (1-12), mitigated by the level-1 cold curve (50%)', () => {
    const { engine, player } = buildEngine(3);
    engine.handlePlayerAction(new WaitAction(player)); // bootstrap + first tick
    const hpAfterFirstTick = player.hp;
    engine.handlePlayerAction(new WaitAction(player));
    // Base 4 cold damage * (1 - 0.5 resistance) = 2
    expect(hpAfterFirstTick - player.hp).toBe(2);
  });

  it('deals fire damage on obsidian floors (13-25), amplified by the level-1 fire vulnerability (-10%)', () => {
    const { engine, player } = buildEngine(15);
    engine.handlePlayerAction(new WaitAction(player));
    const hpAfterFirstTick = player.hp;
    engine.handlePlayerAction(new WaitAction(player));
    // Base 5 fire damage * (1 - (-0.1)) = 5.5 -> rounds to 6
    expect(hpAfterFirstTick - player.hp).toBe(6);
  });

  it('deals no exposure damage in town or on Act 2 floors (26+)', () => {
    const { engine: townEngine, player: townPlayer } = buildEngine(0);
    townEngine.handlePlayerAction(new WaitAction(townPlayer));
    const townHp = townPlayer.hp;
    townEngine.handlePlayerAction(new WaitAction(townPlayer));
    expect(townPlayer.hp).toBe(townHp);

    const { engine: act2Engine, player: act2Player } = buildEngine(30);
    act2Engine.handlePlayerAction(new WaitAction(act2Player));
    const act2Hp = act2Player.hp;
    act2Engine.handlePlayerAction(new WaitAction(act2Player));
    expect(act2Player.hp).toBe(act2Hp);
  });

  it('the level-20 cold curve mitigates more (75%) than level 1 (50%)', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const highLevelPlayer = new Player({
      id: 'hero2',
      name: 'Veteran',
      position: { x: 3, y: 3 },
      stats: { hp: 500, maxHp: 500, attack: 10, defense: 5 },
      level: 20,
    });
    const engine = new GameEngine({ map, player: highLevelPlayer, floor: 3 });
    (engine.manifest as any).progressionConfig = COTW_PROGRESSION;
    engine.actionPipeline.registerHook(JARNVIDR_HAZARD_BOOTSTRAP_HOOK);
    StatusHandlerRegistry.register(JARNVIDR_EXPOSURE_STATUS, jarnvidrExposureHandler);

    engine.handlePlayerAction(new WaitAction(highLevelPlayer));
    const hpAfterFirst = highLevelPlayer.hp;
    engine.handlePlayerAction(new WaitAction(highLevelPlayer));
    // Base 4 cold damage * (1 - 0.75) = 1
    expect(hpAfterFirst - highLevelPlayer.hp).toBe(1);
  });
});
