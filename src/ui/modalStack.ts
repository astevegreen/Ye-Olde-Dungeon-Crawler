export interface UIModal {
  readonly id: string;
  isOpen: boolean;
  handleKeyDown(e: KeyboardEvent): boolean;
  open?(...args: any[]): void;
  close(): void;
  onPush?(): void;
  onPop?(): void;
  /**
   * The dialog's element. While the modal is on top, the stack keeps keyboard focus inside
   * it: focus moves there when it opens, Tab cycles within it, and focus goes back to where
   * it was once the last modal closes. Without it, focus can stay on a HUD button behind the
   * dialog, where a keyboard player can't see it. Modals that hold focus on their own element
   * leave it out.
   */
  focusRoot?(): HTMLElement | null;
}

export type ModalPauseCallback = (paused: boolean) => void;

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function activeElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null);
}

/** Drawn on screen: not detached, and neither it nor an ancestor is `display: none`. */
function isShown(el: HTMLElement): boolean {
  return el.isConnected && el.getClientRects().length > 0;
}

export class ModalStackManager {
  private stack: UIModal[] = [];
  private onPauseChange?: ModalPauseCallback;
  /** What had focus when the first modal opened; it gets focus back when the last one closes. */
  private returnFocus: HTMLElement | null = null;

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
    if (wasEmpty) this.returnFocus = activeElement();
    this.stack.push(modal);
    modal.isOpen = true;

    if (modal.onPush) {
      modal.onPush();
    }

    if (wasEmpty && this.onPauseChange) {
      this.onPauseChange(true);
    }
    this.claimFocus(modal);
  }

  /**
   * Moves focus into the modal's root. Some callers push before they draw the dialog
   * (`push` then `open`), so a root not shown yet is tried again once the caller's code
   * has run.
   */
  private claimFocus(modal: UIModal): void {
    if (this.focusInto(modal)) return;
    queueMicrotask(() => {
      if (this.top() === modal && modal.isOpen) this.focusInto(modal);
    });
  }

  /** False only when the root exists but isn't drawn yet. */
  private focusInto(modal: UIModal): boolean {
    const root = modal.focusRoot?.();
    if (!root) return true;
    const active = activeElement();
    if (active && root.contains(active)) return true;
    if (!isShown(root)) return false;
    if (!root.hasAttribute('tabindex')) {
      root.tabIndex = -1;
      root.style.outline = 'none';
    }
    root.focus({ preventScroll: true });
    return true;
  }

  /**
   * After a modal leaves the stack: the modal now on top takes focus, or, when none is left,
   * focus goes back to what had it before the first one opened. That happens only if focus
   * was lost with the dialog, not if something else has taken it since. With nothing to go
   * back to (WebKit doesn't focus a clicked button), focus leaves the closed dialog for the
   * page, rather than staying on a hidden element.
   */
  private settleFocus(removed: UIModal): void {
    const top = this.top();
    if (top) {
      this.claimFocus(top);
      return;
    }
    const back = this.returnFocus;
    this.returnFocus = null;
    const body = typeof document === 'undefined' ? null : document.body;
    const active = activeElement();
    const inRemoved = Boolean(active && removed.focusRoot?.()?.contains(active));
    const lost = !active || active === body || !active.isConnected || inRemoved;
    if (!lost) return;
    if (back && back !== body && back.isConnected && back !== active) back.focus({ preventScroll: true });
    if (inRemoved && activeElement() === active) active?.blur();
  }

  /** Tab and Shift+Tab move between the root's controls, wrapping at either end. */
  private cycleFocus(modal: UIModal, backwards: boolean): void {
    const root = modal.focusRoot?.();
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isShown);
    if (items.length === 0) {
      root.focus({ preventScroll: true });
      return;
    }
    const at = items.indexOf(activeElement() as HTMLElement);
    const next = backwards ? (at <= 0 ? items.length - 1 : at - 1) : at < 0 || at === items.length - 1 ? 0 : at + 1;
    items[next].focus({ preventScroll: true });
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
    this.settleFocus(topModal);

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
    this.settleFocus(modal);

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

    // Tab never walks out of the dialog onto the HUD behind it. A modal that moves its own
    // focus with Tab (the character menu's tabs and panels) has already called preventDefault.
    if (e.key === 'Tab' && !e.defaultPrevented) {
      e.preventDefault();
      if (active.isOpen) this.cycleFocus(active, e.shiftKey);
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
