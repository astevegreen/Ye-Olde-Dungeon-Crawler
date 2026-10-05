import { describe, expect, it } from 'vitest';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { WaitAction } from '../../../engine/actions/wait';
import { Monster } from '../../../engine';
import { cotwManifest } from '..';
import { DARKNESS_STATUS } from '../darkness';
import { FLOOR30_RELIT_FLAG, GLOOM_TARR_ID } from '../bileSump';

function onFloor30(seed: number) {
  const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Lamp', { seed });
  engine.changeFloor(30);
  return engine;
}

const gloomTarr = (engine: ReturnType<typeof onFloor30>) =>
  engine.map.getAllEntities().find((e): e is Monster => e instanceof Monster && e.definitionId === GLOOM_TARR_ID);

describe("floor 30: Gloom-Tarr's breath has snuffed the lamps", () => {
  it('is dark on arrival, and says where the Bile-Drinker is', () => {
    const engine = onFloor30(5);
    engine.handlePlayerAction(new WaitAction(engine.player));

    expect(gloomTarr(engine)).toBeDefined();
    expect(engine.player.statusManager.hasStatus(DARKNESS_STATUS)).toBe(true);
    expect(engine.messages.some((m) => /reek of its bile comes from the (north|south|east|west)/.test(m))).toBe(true);
  });

  it('is relit for good when Gloom-Tarr dies', () => {
    const engine = onFloor30(5);
    const p = engine.player;
    engine.handlePlayerAction(new WaitAction(p));

    const tarr = gloomTarr(engine)!;
    tarr.takeDamage(tarr.hp * 10);
    engine.removeEntity(tarr);
    engine.handlePlayerAction(new WaitAction(p));
    engine.handlePlayerAction(new WaitAction(p));

    expect(engine.getWorldFlag(FLOOR30_RELIT_FLAG)).toBe(true);
    expect(engine.messages.some((m) => m.includes('lamps sputter and catch again'))).toBe(true);
    expect(p.statusManager.hasStatus(DARKNESS_STATUS)).toBe(false);
  });

  it('a floor 30 made before the dark (an older save) keeps its light, and no death is announced', () => {
    const engine = onFloor30(5);
    engine.removeEntity(gloomTarr(engine)!);
    engine.handlePlayerAction(new WaitAction(engine.player));
    engine.handlePlayerAction(new WaitAction(engine.player));

    expect(engine.player.statusManager.hasStatus(DARKNESS_STATUS)).toBe(false);
    expect(engine.messages.some((m) => m.includes('catch again'))).toBe(false);
  });
});
