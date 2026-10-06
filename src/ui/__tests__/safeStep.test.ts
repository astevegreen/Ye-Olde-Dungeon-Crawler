import { describe, it, expect, vi } from 'vitest';
import { safely } from '../safeStep';

describe('safely', () => {
  it('runs the step and reports it completed', () => {
    const step = vi.fn();
    const onError = vi.fn();
    expect(safely('hud', step, onError)).toBe(true);
    expect(step).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it('keeps a throwing step from reaching the caller, so the steps after it still run', () => {
    const onError = vi.fn();
    const after = vi.fn();
    const quota = Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
    expect(() => {
      safely('game-over save', () => {
        throw quota;
      }, onError);
      after();
    }).not.toThrow();
    expect(onError).toHaveBeenCalledWith(quota, 'game-over save');
    expect(after).toHaveBeenCalledOnce();
  });

  it('reports a throw that completed nothing as false, and wraps a non-Error throw', () => {
    const onError = vi.fn();
    expect(
      safely('widget', () => {
        throw 'bad state';
      }, onError)
    ).toBe(false);
    const [err, label] = onError.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('bad state');
    expect(label).toBe('widget');
  });
});
