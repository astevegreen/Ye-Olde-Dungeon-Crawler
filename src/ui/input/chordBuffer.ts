export interface ChordBufferOptions {
  onMove: (dx: number, dy: number) => void;
  isEnabled?: () => boolean;
  getBufferMs?: () => number;
}

export class ChordBuffer {
  private onMove: (dx: number, dy: number) => void;
  private isEnabledFn: () => boolean;
  private getBufferMsFn: () => number;

  private pressedArrows: Set<string> = new Set();
  private pendingTimer: any = null;
  private pendingMove: { dx: number; dy: number; code: string } | null = null;
  private activeChord: { dx: number; dy: number } | null = null;
  private lastPressedKey: string | null = null;
  private isDestroyed = false;

  constructor(options: ChordBufferOptions) {
    this.onMove = options.onMove;
    this.isEnabledFn = options.isEnabled ?? (() => true);
    this.getBufferMsFn = options.getBufferMs ?? (() => 40);
  }

  public static isArrowKey(code: string): boolean {
    return code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight';
  }

  public handleKeyDown(code: string, isRepeat = false): boolean {
    if (this.isDestroyed || !ChordBuffer.isArrowKey(code)) {
      return false;
    }

    const delta = this.getArrowDelta(code);
    if (!delta) return false;

    // Standard Mode (Chording disabled): 0ms latency immediate cardinal movement
    if (!this.isEnabledFn()) {
      this.clearPending();
      this.onMove(delta.dx, delta.dy);
      return true;
    }

    // Record last pressed key for 180-degree reversal resolution
    this.lastPressedKey = code;

    // If a timer is pending and the user presses an opposing cardinal key,
    // immediately honor the new reversal direction rather than dropping or canceling
    if (this.pendingTimer) {
      if (
        (code === 'ArrowLeft' && this.pressedArrows.has('ArrowRight')) ||
        (code === 'ArrowRight' && this.pressedArrows.has('ArrowLeft')) ||
        (code === 'ArrowUp' && this.pressedArrows.has('ArrowDown')) ||
        (code === 'ArrowDown' && this.pressedArrows.has('ArrowUp'))
      ) {
        this.clearPendingTimer();
        this.pressedArrows.clear();
        this.pressedArrows.add(code);
        this.pendingMove = null;
        this.activeChord = null;
        this.onMove(delta.dx, delta.dy);
        return true;
      }
    }

    // Micro-Debounce Buffer Mode (Arrow-Key Chording enabled)
    this.pressedArrows.add(code);

    // If key repeat while holding an active chord, keep moving diagonally
    if (isRepeat && this.activeChord) {
      this.onMove(this.activeChord.dx, this.activeChord.dy);
      return true;
    }

    // Check if we have two perpendicular arrow keys pressed
    const chord = this.resolveChord(this.pressedArrows);
    if (chord) {
      // Valid diagonal chord formed!
      this.clearPendingTimer();
      this.pendingMove = null;
      this.activeChord = chord;
      this.onMove(chord.dx, chord.dy);
      return true;
    }

    // If key repeat for a single held arrow when not chording, dispatch step
    if (isRepeat && !this.pendingTimer && this.pressedArrows.size === 1) {
      this.onMove(delta.dx, delta.dy);
      return true;
    }

    // First keypress: start micro-debounce window
    if (!this.pendingTimer && this.pressedArrows.size === 1) {
      this.pendingMove = { ...delta, code };
      const bufferMs = Math.max(1, this.getBufferMsFn());
      this.pendingTimer = setTimeout(() => {
        if (this.isDestroyed) return;
        if (this.pendingMove) {
          const move = this.pendingMove;
          this.pendingMove = null;
          this.pendingTimer = null;
          this.onMove(move.dx, move.dy);
        }
      }, bufferMs);
      return true;
    }

    return true;
  }

  public handleKeyUp(code: string): void {
    if (!ChordBuffer.isArrowKey(code)) return;

    this.pressedArrows.delete(code);

    // If all arrow keys are released, reset active chord state
    if (this.pressedArrows.size === 0) {
      this.activeChord = null;
    } else if (this.pressedArrows.size === 1) {
      // One arrow still held; reset diagonal chord state so subsequent repeats are cardinal
      this.activeChord = null;
    }
  }

  public flush(): void {
    if (this.isDestroyed) return;
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    if (this.pendingMove) {
      const move = this.pendingMove;
      this.pendingMove = null;
      this.onMove(move.dx, move.dy);
    }
  }

  public clear(): void {
    this.clearPendingTimer();
    this.pendingMove = null;
    this.pressedArrows.clear();
    this.activeChord = null;
  }

  public clearAllKeys(): void {
    this.clear();
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.clear();
  }

  public isChording(): boolean {
    return this.activeChord !== null || this.pendingMove !== null;
  }

  public getStatus(): {
    enabled: boolean;
    bufferMs: number;
    pressedKeys: string[];
    isChording: boolean;
    hasPendingTimer: boolean;
  } {
    return {
      enabled: this.isEnabledFn(),
      bufferMs: this.getBufferMsFn(),
      pressedKeys: Array.from(this.pressedArrows),
      isChording: this.isChording(),
      hasPendingTimer: this.pendingTimer !== null,
    };
  }

  private clearPendingTimer(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }

  private clearPending(): void {
    this.clearPendingTimer();
    this.pendingMove = null;
    this.activeChord = null;
  }

  private getArrowDelta(code: string): { dx: number; dy: number } | null {
    switch (code) {
      case 'ArrowUp': return { dx: 0, dy: -1 };
      case 'ArrowDown': return { dx: 0, dy: 1 };
      case 'ArrowLeft': return { dx: -1, dy: 0 };
      case 'ArrowRight': return { dx: 1, dy: 0 };
      default: return null;
    }
  }

  private resolveChord(arrows: Set<string>): { dx: number; dy: number } | null {
    let dx = 0;
    let dy = 0;

    if (arrows.has('ArrowLeft') && arrows.has('ArrowRight')) {
      dx = this.lastPressedKey === 'ArrowLeft' ? -1 : 1;
    } else {
      if (arrows.has('ArrowLeft')) dx -= 1;
      if (arrows.has('ArrowRight')) dx += 1;
    }

    if (arrows.has('ArrowUp') && arrows.has('ArrowDown')) {
      dy = this.lastPressedKey === 'ArrowUp' ? -1 : 1;
    } else {
      if (arrows.has('ArrowUp')) dy -= 1;
      if (arrows.has('ArrowDown')) dy += 1;
    }

    // Both dx and dy must be non-zero for a diagonal chord
    if (dx !== 0 && dy !== 0) {
      return { dx, dy };
    }
    return null;
  }
}
