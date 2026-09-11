import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChordBuffer } from '../input/chordBuffer';

describe('ChordBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('dispatches immediate cardinal movement with 0ms latency when chording is disabled', () => {
    const onMove = vi.fn();
    const buffer = new ChordBuffer({
      onMove,
      isEnabled: () => false,
      getBufferMs: () => 40,
    });

    buffer.handleKeyDown('ArrowUp');
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith(0, -1);

    buffer.handleKeyDown('ArrowRight');
    expect(onMove).toHaveBeenCalledTimes(2);
    expect(onMove).toHaveBeenLastCalledWith(1, 0);
  });

  it('resolves perpendicular arrow keys pressed within buffer window to diagonal movement', () => {
    const onMove = vi.fn();
    const buffer = new ChordBuffer({
      onMove,
      isEnabled: () => true,
      getBufferMs: () => 40,
    });

    // Press ArrowUp
    buffer.handleKeyDown('ArrowUp');
    expect(onMove).not.toHaveBeenCalled();

    // Advance 15ms and press ArrowRight (within 40ms window)
    vi.advanceTimersByTime(15);
    buffer.handleKeyDown('ArrowRight');

    // Should immediately fire diagonal (1, -1) [Northeast]
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith(1, -1);

    // Advancing timers beyond 40ms should not fire another move
    vi.advanceTimersByTime(50);
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('resolves Northwest (ArrowUp + ArrowLeft) and Southwest (ArrowDown + ArrowLeft)', () => {
    const onMove = vi.fn();
    const buffer = new ChordBuffer({
      onMove,
      isEnabled: () => true,
      getBufferMs: () => 40,
    });

    // ArrowUp + ArrowLeft -> (-1, -1)
    buffer.handleKeyDown('ArrowUp');
    buffer.handleKeyDown('ArrowLeft');
    expect(onMove).toHaveBeenCalledWith(-1, -1);

    buffer.clear();
    onMove.mockClear();

    // ArrowDown + ArrowLeft -> (-1, 1)
    buffer.handleKeyDown('ArrowDown');
    buffer.handleKeyDown('ArrowLeft');
    expect(onMove).toHaveBeenCalledWith(-1, 1);
  });

  it('flushes cardinal move when buffer window expires without second arrow key', () => {
    const onMove = vi.fn();
    const buffer = new ChordBuffer({
      onMove,
      isEnabled: () => true,
      getBufferMs: () => 40,
    });

    buffer.handleKeyDown('ArrowDown');
    expect(onMove).not.toHaveBeenCalled();

    vi.advanceTimersByTime(39);
    expect(onMove).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2); // total 41ms >= 40ms
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith(0, 1);
  });

  it('handles key repeats when a chord is actively held', () => {
    const onMove = vi.fn();
    const buffer = new ChordBuffer({
      onMove,
      isEnabled: () => true,
      getBufferMs: () => 40,
    });

    buffer.handleKeyDown('ArrowUp');
    buffer.handleKeyDown('ArrowRight');
    expect(onMove).toHaveBeenCalledWith(1, -1);

    // OS key repeat event while keys are held
    buffer.handleKeyDown('ArrowUp', true);
    expect(onMove).toHaveBeenCalledTimes(2);
    expect(onMove).toHaveBeenLastCalledWith(1, -1);
  });

  it('cleans up state on handleKeyUp and clear()', () => {
    const onMove = vi.fn();
    const buffer = new ChordBuffer({
      onMove,
      isEnabled: () => true,
      getBufferMs: () => 40,
    });

    buffer.handleKeyDown('ArrowUp');
    buffer.handleKeyUp('ArrowUp');

    vi.advanceTimersByTime(50);
    // Key was released before buffer expired, buffer was cleared
    buffer.clear();
    expect(buffer.isChording()).toBe(false);
  });
});
