import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChordBuffer } from '../input/chordBuffer';

/**
 * Releasing an arrow before the chord window closes dispatches the pending step at once
 * (ARCHITECTURE.md §6). Waiting out the debounce after the key is already up is latency
 * the player can feel on every single step.
 */
function makeBuffer(bufferMs = 40) {
  const onMove = vi.fn();
  const buffer = new ChordBuffer({ onMove, isEnabled: () => true, getBufferMs: () => bufferMs });
  return { buffer, onMove };
}

describe('ChordBuffer keyup flush', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('dispatches the pending step immediately on release', () => {
    const { buffer, onMove } = makeBuffer();

    buffer.handleKeyDown('ArrowRight');
    expect(onMove).not.toHaveBeenCalled(); // still inside the chord window

    buffer.handleKeyUp('ArrowRight');

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith(1, 0);
  });

  it('does not dispatch the step twice when the timer would also have fired', () => {
    const { buffer, onMove } = makeBuffer();

    buffer.handleKeyDown('ArrowLeft');
    buffer.handleKeyUp('ArrowLeft');
    vi.advanceTimersByTime(200);

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith(-1, 0);
  });

  it('still forms a diagonal when the second key arrives before release', () => {
    const { buffer, onMove } = makeBuffer();

    buffer.handleKeyDown('ArrowUp');
    buffer.handleKeyDown('ArrowRight');

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith(1, -1);

    // Releasing afterwards must not emit a second, cardinal step.
    onMove.mockClear();
    buffer.handleKeyUp('ArrowUp');
    buffer.handleKeyUp('ArrowRight');
    vi.advanceTimersByTime(200);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('ignores the release of a key that never had a pending step', () => {
    const { buffer, onMove } = makeBuffer();

    buffer.handleKeyUp('ArrowDown');
    vi.advanceTimersByTime(200);

    expect(onMove).not.toHaveBeenCalled();
  });

  it('leaves the timer path intact when the key is held past the window', () => {
    const { buffer, onMove } = makeBuffer();

    buffer.handleKeyDown('ArrowDown');
    vi.advanceTimersByTime(200);

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith(0, 1);
  });
});
