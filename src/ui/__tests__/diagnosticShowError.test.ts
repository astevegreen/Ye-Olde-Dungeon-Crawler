import { describe, it, expect, vi, afterEach } from 'vitest';
import { DiagnosticModal } from '../diagnostic-modal';

/**
 * `DiagnosticModal.showError` is how presentation reports an isolated pipeline failure
 * (ARCHITECTURE.md §4, `src/main/turnGate.ts`): an error toast, never a modal that locks
 * the game. Only the toast's few DOM calls are faked here.
 */
class El {
  public children: El[] = [];
  public parentElement: El | null = null;
  public style: Record<string, string> = {};
  public className = '';
  public innerHTML = '';
  public id = '';
  public addEventListener(): void {}
  public appendChild(child: El): void {
    child.parentElement = this;
    this.children.push(child);
  }
  public removeChild(child: El): void {
    this.children = this.children.filter((c) => c !== child);
  }
  public contains(other: El | null): boolean {
    return other === this || this.children.some((c) => c.contains(other));
  }
  public find(id: string): El | null {
    if (this.id === id) return this;
    for (const c of this.children) {
      const hit = c.find(id);
      if (hit) return hit;
    }
    return null;
  }
}

describe('DiagnosticModal.showError', () => {
  afterEach(() => vi.useRealTimers());

  it('shows the message as an error toast, without opening a modal', () => {
    vi.useFakeTimers();
    const body = new El();
    vi.stubGlobal('document', { body, createElement: () => new El(), getElementById: (id: string) => body.find(id) });

    // Its only state is the toast it raises: no dialog element is built or shown.
    DiagnosticModal.prototype.showError.call({} as DiagnosticModal, 'The spell fizzled in the pipeline.');

    const container = body.find('retro-toast-container');
    expect(container).not.toBeNull();
    const toast = container!.children.at(-1)!;
    expect(toast.className).toBe('retro-toast retro-toast-error');
    expect(toast.innerHTML).toContain('The spell fizzled in the pipeline.');

    vi.advanceTimersByTime(5000);
    expect(container!.children).not.toContain(toast);
  });
});
