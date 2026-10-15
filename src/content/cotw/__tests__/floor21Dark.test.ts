import { describe, expect, it } from 'vitest';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { WaitAction } from '../../../engine/actions/wait';
import { ExecuteChoiceAction } from '../../../engine/actions/choiceAction';
import { cotwManifest } from '..';
import { COTW_CHOICES } from '../choices';
import { DARKNESS_STATUS } from '../darkness';
import { SIPHON_CORE_TILE, FLOOR21_RELIT_FLAG, ZEALOT_CLAIM_HEARD_FLAG } from '../siphonPylon';
import { Monster } from '../../../engine';

function onFloor21(seed: number) {
  const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Lamp', { seed });
  engine.changeFloor(21);
  return engine;
}

function coreTiles(engine: ReturnType<typeof onFloor21>) {
  const found: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < engine.map.height; y++) {
    for (let x = 0; x < engine.map.width; x++) if (engine.map.getTile(x, y)?.type === SIPHON_CORE_TILE) found.push({ x, y });
  }
  return found;
}

describe('floor 21: the Siphon Pylon drinks the light', () => {
  it('every floor 21 has the pylon with one core', () => {
    for (let seed = 1; seed <= 8; seed++) expect(coreTiles(onFloor21(seed))).toHaveLength(1);
  });

  it('is dark on arrival, and says where the core is', () => {
    const engine = onFloor21(3);
    engine.handlePlayerAction(new WaitAction(engine.player));

    expect(engine.player.statusManager.hasStatus(DARKNESS_STATUS)).toBe(true);
    expect(engine.messages.some((m) => /core throbs somewhere to the (north|south|east|west)/.test(m))).toBe(true);
  });

  it('is relit for good by shattering the core', () => {
    const engine = onFloor21(3);
    const p = engine.player;
    engine.handlePlayerAction(new WaitAction(p));

    engine.handlePlayerAction(new ExecuteChoiceAction(p, COTW_CHOICES.siphon_core, 'shatter'));
    engine.handlePlayerAction(new WaitAction(p));
    engine.handlePlayerAction(new WaitAction(p));

    expect(engine.getWorldFlag(FLOOR21_RELIT_FLAG)).toBe(true);
    expect(p.statusManager.hasStatus(DARKNESS_STATUS)).toBe(false);
  });

  it('a floor 21 made before the dark (an older save, no core) keeps its light', () => {
    const engine = onFloor21(3);
    const [core] = coreTiles(engine);
    engine.map.setTile(core.x, core.y, engine.map.getTile(core.x - 1, core.y)!);
    engine.handlePlayerAction(new WaitAction(engine.player));

    expect(engine.player.statusManager.hasStatus(DARKNESS_STATUS)).toBe(false);
  });

  it('the neighbouring rift floors keep their light and their usual pylon', () => {
    const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Lamp', { seed: 3 });
    engine.changeFloor(20);
    engine.handlePlayerAction(new WaitAction(engine.player));

    expect(engine.player.statusManager.hasStatus(DARKNESS_STATUS)).toBe(false);
    expect(coreTiles(engine)).toHaveLength(0);
  });
});

describe('floor 21: the pylon’s keeper, Vigdís of the Sól-Brand', () => {
  it('guards the pylon on every floor 21', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const keepers = onFloor21(seed)
        .map.getAllEntities()
        .filter((e) => e instanceof Monster && e.definitionId === 'miniboss_zealot_leader');
      expect(keepers).toHaveLength(1);
    }
  });

  it('dies with the coven’s claim, which the hero keeps', () => {
    const engine = onFloor21(2);
    expect(cotwManifest.storyChoiceTriggers?.find((t) => t.monsterDefinitionId === 'miniboss_zealot_leader')?.choiceId).toBe(
      'zealot_leader_last_words'
    );
    const lastWords = COTW_CHOICES.zealot_leader_last_words;
    expect(lastWords.description).toContain('Only blood will.');

    engine.handlePlayerAction(new ExecuteChoiceAction(engine.player, lastWords, 'close_her_eyes'));

    expect(engine.getWorldFlag(ZEALOT_CLAIM_HEARD_FLAG)).toBe(true);
  });
});
