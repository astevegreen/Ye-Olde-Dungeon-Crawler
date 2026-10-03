import { describe, it, expect } from 'vitest';
import { ProfileManager, MemoryStorage } from '../../storage/profile-manager';
import { RestAction } from '../../actions/rest';
import { AutoRestManager } from '../../actions/autoRest';
import { getRunningTimedEvents, getTimedEventCountdowns } from '../timedEvents';
import { cotwManifest } from '../../../content/cotw';

/**
 * Resting advances turns outside the action pipeline, and a timed event's clock counts
 * turns, so a rest used to spend a countdown unseen and let it expire on the next step
 * (cotw's Coven Ritual). The hero can't rest while one runs.
 */
function hurtHeroInTown() {
  const engine = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Hild', { manifest: cotwManifest }).engine;
  engine.player.takeDamage(5);
  return engine;
}

describe('resting while a countdown runs', () => {
  it('is refused during a labelled countdown, naming it, and spends no turns', () => {
    const engine = hurtHeroInTown();
    engine.setWorldFlag('oath_climax_started', true);
    expect(getTimedEventCountdowns(engine).map((c) => c.label)).toEqual(['Coven Ritual']);

    const before = engine.turnCount;
    const result = engine.handlePlayerAction(new RestAction(engine.player));
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/no time to rest with the Coven Ritual under way \(\d+ turns left\)/);
    expect(engine.turnCount).toBe(before);
    expect(engine.getWorldFlag('oath_resolved')).toBe(false);
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
    engine.setWorldFlag('oath_climax_started', true);
    const resolved = cotwManifest.timedEvents!.find((e) => e.id === 'oath_climax')!.resolvedFlag;
    engine.setWorldFlag(resolved, true);
    expect(AutoRestManager.restRefusal(engine)).toBeNull();
    expect(engine.handlePlayerAction(new RestAction(engine.player)).success).toBe(true);
  });
});
