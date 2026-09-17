export interface UIModal {
  readonly id: string;
  isOpen: boolean;
  handleKeyDown(e: KeyboardEvent): boolean;
  open?(...args: any[]): void;
  close(): void;
  onPush?(): void;
  onPop?(): void;
}

export type ModalPauseCallback = (paused: boolean) => void;

export class ModalStackManager {
  private stack: UIModal[] = [];
  private onPauseChange?: ModalPauseCallback;

  constructor(onPauseChange?: ModalPauseCallback) {
    this.onPauseChange = onPauseChange;
  }

  public setPauseHandler(handler: ModalPauseCallback): void {
    this.onPauseChange = handler;
  }

  public get size(): number {
    return this.stack.length;
  }

  public isEmpty(): boolean {
    return this.stack.length === 0;
  }

  public top(): UIModal | undefined {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : undefined;
  }

  public has(modalId: string): boolean {
    return this.stack.some((m) => m.id === modalId);
  }

  public getStackIds(): string[] {
    return this.stack.map((m) => m.id);
  }

  /**
   * Pushes a modal onto the top of the stack.
   * Halts the action scheduler / sets active input trap.
   */
  public push(modal: UIModal): void {
    // If modal already in stack, remove prior occurrence to move it to the top
    const existingIdx = this.stack.findIndex((m) => m.id === modal.id);
    if (existingIdx >= 0) {
      this.stack.splice(existingIdx, 1);
    }

    const wasEmpty = this.stack.length === 0;
    this.stack.push(modal);
    modal.isOpen = true;

    if (modal.onPush) {
      modal.onPush();
    }

    if (wasEmpty && this.onPauseChange) {
      this.onPauseChange(true);
    }
  }

  /**
   * Closes and pops the top modal.
   * Resumes the scheduler only when the stack is completely empty.
   */
  public pop(): UIModal | undefined {
    if (this.stack.length === 0) {
      return undefined;
    }

    const topModal = this.stack.pop()!;
    topModal.isOpen = false;
    topModal.close();

    if (topModal.onPop) {
      topModal.onPop();
    }

    if (this.stack.length === 0 && this.onPauseChange) {
      this.onPauseChange(false);
    }

    return topModal;
  }

  /**
   * Closes a specific modal by ID if present in the stack.
   */
  public remove(modalId: string): boolean {
    const idx = this.stack.findIndex((m) => m.id === modalId);
    if (idx === -1) return false;

    const modal = this.stack.splice(idx, 1)[0];
    modal.isOpen = false;
    modal.close();
    if (modal.onPop) {
      modal.onPop();
    }

    if (this.stack.length === 0 && this.onPauseChange) {
      this.onPauseChange(false);
    }

    return true;
  }

  /**
   * Closes all open modals and clears the stack in LIFO order.
   */
  public closeAll(): void {
    while (this.stack.length > 0) {
      this.pop();
    }
  }

  /**
   * Traps keystrokes and routes them exclusively to the top active modal.
   * If top modal does not handle 'Escape', the stack automatically pops the modal.
   */
  public handleKeyDown(e: KeyboardEvent): boolean {
    // Purge any modals that are already closed from the top of the stack
    while (this.stack.length > 0 && !this.stack[this.stack.length - 1].isOpen) {
      this.pop();
    }

    const active = this.top();
    if (!active) {
      return false;
    }

    const handled = active.handleKeyDown(e);
    // If the modal closed itself as a result of handling the key event, purge it immediately
    if (!active.isOpen) {
      this.remove(active.id);
    }

    if (handled) {
      return true;
    }

    // Default modal behavior: Escape closes the active top modal
    if (e.code === 'Escape' || e.key === 'Escape') {
      this.pop();
      return true;
    }

    // Modal traps all inputs to prevent gameplay leak
    return true;
  }
}

export const defaultModalStack = new ModalStackManager();
