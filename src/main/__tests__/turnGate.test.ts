import { describe, it, expect, vi } from 'vitest';
import { canPlayerAct, createPipelineErrorReporter, playEffectBatch } from '../turnGate';
import type { ActionResult, VisualEffectDescriptor } from '../../engine';

describe('canPlayerAct: the gate HUD buttons and the mouse share with the keys', () => {
  const input = (over: Partial<{ enabled: boolean; isInputLocked: boolean; modals: number }> = {}) => ({
    enabled: over.enabled ?? true,
    isInputLocked: over.isInputLocked ?? false,
    modalStack: { size: over.modals ?? 0 },
  });
  const engine = (isPaused = false) => ({ isPaused });

  it('lets the hero act when nothing holds the game', () => {
    expect(canPlayerAct(engine(), input())).toBe(true);
  });

  it.each([
    ['no run is loaded', null, input()],
    ['there is no input handler', engine(), null],
    ['input is disabled', engine(), input({ enabled: false })],
    ['an effect holds input', engine(), input({ isInputLocked: true })],
    ['a dialog is open', engine(), input({ modals: 1 })],
    ['the world is paused', engine(true), input()],
  ])('refuses while %s', (_label, e, i) => {
    expect(canPlayerAct(e, i)).toBe(false);
  });
});

describe('createPipelineErrorReporter: an isolated failure is shown, once', () => {
  const failed = (message?: string): ActionResult => ({ success: false, cost: 0, pipelineError: true, message });

  it('shows a failed result once, however often the HUD refreshes', () => {
    const show = vi.fn();
    const report = createPipelineErrorReporter(show);
    const result = failed('The spell fizzled in the pipeline.');

    report(result);
    report(result);

    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith('The spell fizzled in the pipeline.');
  });

  it('shows the next failure too, with a stock line when it has no message', () => {
    const show = vi.fn();
    const report = createPipelineErrorReporter(show);
    report(failed('first'));
    report(failed());

    expect(show).toHaveBeenLastCalledWith('An unexpected error occurred; the action could not be completed.');
    expect(show).toHaveBeenCalledTimes(2);
  });

  it('ignores a result without a pipeline error, and no result', () => {
    const show = vi.fn();
    const report = createPipelineErrorReporter(show);
    report({ success: false, cost: 0, message: 'You cannot go that way.' });
    report(null);
    report(undefined);
    expect(show).not.toHaveBeenCalled();
  });
});

describe('playEffectBatch: only tactical effects hold input (ARCHITECTURE.md §4)', () => {
  const tactical = { type: 'projectile' } as unknown as VisualEffectDescriptor;
  const ambient = { type: 'projectile', priority: 'ambient' } as unknown as VisualEffectDescriptor;

  it('holds input while a batch with a tactical effect plays, and lets go after', async () => {
    const release = vi.fn();
    const hold = vi.fn(() => release);
    let heldDuringPlay = false;
    await playEffectBatch([ambient, tactical], async () => {
      heldDuringPlay = hold.mock.calls.length === 1 && release.mock.calls.length === 0;
    }, hold);

    expect(heldDuringPlay).toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('lets go even when playback throws', async () => {
    const release = vi.fn();
    await expect(playEffectBatch([tactical], async () => { throw new Error('fx fell over'); }, () => release)).rejects.toThrow('fx fell over');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('plays an ambient-only batch without holding input', async () => {
    const hold = vi.fn(() => () => {});
    const play = vi.fn(async () => {});
    await playEffectBatch([ambient], play, hold);
    expect(play).toHaveBeenCalledWith([ambient]);
    expect(hold).not.toHaveBeenCalled();
  });

  it('does nothing for an empty batch', async () => {
    const play = vi.fn(async () => {});
    await playEffectBatch([], play, () => () => {});
    expect(play).not.toHaveBeenCalled();
  });
});
