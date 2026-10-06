import { describe, it, expect } from 'vitest';
import { ProfileManager, MemoryStorage } from '../../storage/profile-manager';
import { AutoRestManager, RestTurnAction } from '../../actions/autoRest';
import { getRunningTimedEvents, getTimedEventCountdowns } from '../timedEvents';
import type { GameContentManifest, TimedEventDefinition } from '../../types/manifest';
import { cotwManifest } from '../../../content/cotw';

/**
 * A rest runs up to a hundred turns at a stroke, and a timed event's clock counts turns, so
 * a rest would spend a countdown before the hero could react. The hero can't rest while one
 * runs: every rest turn is refused.
 */
const LABELLED_RITE: TimedEventDefinition = {
  id: 'test_labelled_rite',
  label: 'Test Rite',
  startFlag: 'test_rite_started',
  turnLimit: 50,
  resolvedFlag: 'test_rite_resolved',
  expireConsequences: [],
};

const manifest: GameContentManifest = {
  ...cotwManifest,
  timedEvents: [...(cotwManifest.timedEvents ?? []), LABELLED_RITE],
};

function hurtHeroInTown() {
  const engine = new ProfileManager(new MemoryStorage(), manifest).createCharacter('Hild', { manifest }).engine;
  engine.player.takeDamage(5);
  return engine;
}

describe('resting while a countdown runs', () => {
  it('is refused during a labelled countdown, naming it, and spends no turns', () => {
    const engine = hurtHeroInTown();
    engine.setWorldFlag('test_rite_started', true);
    expect(getTimedEventCountdowns(engine).map((c) => c.label)).toEqual(['Test Rite']);

    const before = engine.turnCount;
    const result = engine.handlePlayerAction(new RestTurnAction(engine.player));
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/no time to rest with the Test Rite under way \(\d+ turns left\)/);
    expect(engine.turnCount).toBe(before);
    expect(engine.getWorldFlag('test_rite_resolved')).toBe(false);
  });

  it('is refused during an unlabelled countdown too', () => {
    const engine = hurtHeroInTown();
    engine.setWorldFlag('siphon_ritual_started', true);
    expect(getTimedEventCountdowns(engine)).toEqual([]);
    expect(getRunningTimedEvents(engine).map((e) => e.id)).toEqual(['siphon_ritual_timer']);
    expect(AutoRestManager.restRefusal(engine)).toBe('There is no time to rest now.');
  });

  it('is allowed again once the countdown is resolved', () => {
    const engine = hurtHeroInTown();
    engine.setWorldFlag('test_rite_started', true);
    engine.setWorldFlag(LABELLED_RITE.resolvedFlag, true);
    expect(AutoRestManager.restRefusal(engine)).toBeNull();
    expect(engine.handlePlayerAction(new RestTurnAction(engine.player)).success).toBe(true);
  });
});
