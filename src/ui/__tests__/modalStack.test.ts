import { describe, it, expect, beforeEach } from 'vitest';
import { ModalStackManager, type UIModal } from '../modalStack';

class MockModal implements UIModal {
  public id: string;
  public isOpen = false;
  public pushCount = 0;
  public popCount = 0;
  public closeCount = 0;
  public handledKeys: string[] = [];

  constructor(id: string) {
    this.id = id;
  }

  public open(): void {
    this.isOpen = true;
  }

  public close(): void {
    this.isOpen = false;
    this.closeCount++;
  }

  public onPush(): void {
    this.pushCount++;
  }

  public onPop(): void {
    this.popCount++;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (e.code === 'KeyZ') {
      this.handledKeys.push(e.code);
      return true;
    }
    return false;
  }
}

describe('Centralized LIFO Modal Stack Manager', () => {
  let modalStack: ModalStackManager;
  let pauseEvents: boolean[];

  beforeEach(() => {
    pauseEvents = [];
    modalStack = new ModalStackManager((paused) => {
      pauseEvents.push(paused);
    });
  });

  describe('Stack Lifecycle and LIFO Ordering', () => {
    it('starts empty', () => {
      expect(modalStack.isEmpty()).toBe(true);
      expect(modalStack.size).toBe(0);
      expect(modalStack.top()).toBeUndefined();
    });

    it('pushes and pops modals in strict LIFO order', () => {
      const modal1 = new MockModal('modal-1');
      const modal2 = new MockModal('modal-2');

      modalStack.push(modal1);
      expect(modalStack.size).toBe(1);
      expect(modalStack.top()?.id).toBe('modal-1');
      expect(modal1.isOpen).toBe(true);
      expect(modal1.pushCount).toBe(1);

      modalStack.push(modal2);
      expect(modalStack.size).toBe(2);
      expect(modalStack.top()?.id).toBe('modal-2');
      expect(modal2.isOpen).toBe(true);

      // Pop modal2
      const popped1 = modalStack.pop();
      expect(popped1?.id).toBe('modal-2');
      expect(modal2.isOpen).toBe(false);
      expect(modal2.popCount).toBe(1);
      expect(modal2.closeCount).toBe(1);
      expect(modalStack.top()?.id).toBe('modal-1');

      // Pop modal1
      const popped2 = modalStack.pop();
      expect(popped2?.id).toBe('modal-1');
      expect(modal1.isOpen).toBe(false);
      expect(modalStack.isEmpty()).toBe(true);
    });

    it('re-orders when pushing an already open modal to top', () => {
      const modalA = new MockModal('modal-a');
      const modalB = new MockModal('modal-b');

      modalStack.push(modalA);
      modalStack.push(modalB);
      expect(modalStack.getStackIds()).toEqual(['modal-a', 'modal-b']);

      // Pushing modalA again moves it to top
      modalStack.push(modalA);
      expect(modalStack.size).toBe(2);
      expect(modalStack.getStackIds()).toEqual(['modal-b', 'modal-a']);
      expect(modalStack.top()?.id).toBe('modal-a');
    });

    it('removes a specific modal by ID', () => {
      const modal1 = new MockModal('m1');
      const modal2 = new MockModal('m2');
      const modal3 = new MockModal('m3');

      modalStack.push(modal1);
      modalStack.push(modal2);
      modalStack.push(modal3);

      const removed = modalStack.remove('m2');
      expect(removed).toBe(true);
      expect(modalStack.getStackIds()).toEqual(['m1', 'm3']);
      expect(modal2.isOpen).toBe(false);
      expect(modal2.closeCount).toBe(1);
    });

    it('closes all modals when closeAll is invoked', () => {
      const modal1 = new MockModal('m1');
      const modal2 = new MockModal('m2');

      modalStack.push(modal1);
      modalStack.push(modal2);

      modalStack.closeAll();
      expect(modalStack.isEmpty()).toBe(true);
      expect(modal1.isOpen).toBe(false);
      expect(modal2.isOpen).toBe(false);
    });
  });

  describe('Zero-Tick Scheduler Pause Guarantees', () => {
    it('notifies pause handler only on 0->1 and 1->0 transitions', () => {
      const modal1 = new MockModal('m1');
      const modal2 = new MockModal('m2');

      // 0 -> 1: Triggers pause(true)
      modalStack.push(modal1);
      expect(pauseEvents).toEqual([true]);

      // 1 -> 2: Stays paused, should not emit another pause event
      modalStack.push(modal2);
      expect(pauseEvents).toEqual([true]);

      // 2 -> 1: Still paused, should not emit unpause event
      modalStack.pop();
      expect(pauseEvents).toEqual([true]);

      // 1 -> 0: Emits pause(false)
      modalStack.pop();
      expect(pauseEvents).toEqual([true, false]);
    });
  });

  describe('Keyboard Routing & Input Trapping', () => {
    it('delegates keystrokes to the top modal', () => {
      const bottom = new MockModal('bottom');
      const top = new MockModal('top');

      modalStack.push(bottom);
      modalStack.push(top);

      const keyEvent = { code: 'KeyZ', key: 'z' } as KeyboardEvent;
      const handled = modalStack.handleKeyDown(keyEvent);

      expect(handled).toBe(true);
      expect(top.handledKeys).toContain('KeyZ');
      expect(bottom.handledKeys).toHaveLength(0);
    });

    it('pops the top modal on Escape when not explicitly consumed', () => {
      const modal1 = new MockModal('m1');
      const modal2 = new MockModal('m2');

      modalStack.push(modal1);
      modalStack.push(modal2);

      const escapeEvent = { code: 'Escape', key: 'Escape' } as KeyboardEvent;

      // 1st Escape pops modal2
      const res1 = modalStack.handleKeyDown(escapeEvent);
      expect(res1).toBe(true);
      expect(modalStack.size).toBe(1);
      expect(modalStack.top()?.id).toBe('m1');

      // 2nd Escape pops modal1
      const res2 = modalStack.handleKeyDown(escapeEvent);
      expect(res2).toBe(true);
      expect(modalStack.isEmpty()).toBe(true);
    });

    it('traps all other unhandled keystrokes while modals are active', () => {
      const modal = new MockModal('m1');
      modalStack.push(modal);

      // Random game key (e.g. movement KeyW)
      const moveEvent = { code: 'KeyW', key: 'w' } as KeyboardEvent;
      const handled = modalStack.handleKeyDown(moveEvent);

      // Handled must be true to trap the input and prevent character movement
      expect(handled).toBe(true);
      expect(modal.isOpen).toBe(true);
    });

    it('returns false when stack is empty to let game input handler process events', () => {
      const moveEvent = { code: 'KeyW', key: 'w' } as KeyboardEvent;
      const handled = modalStack.handleKeyDown(moveEvent);
      expect(handled).toBe(false);
    });

    it('automatically purges modal from stack if handleKeyDown closes it', () => {
      const modal = new MockModal('m-self-closing');
      modalStack.push(modal);
      expect(modalStack.isEmpty()).toBe(false);

      // Mock modal closing itself upon receiving an Enter key
      modal.handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          modal.close();
          return true;
        }
        return false;
      };

      const enterEvent = { key: 'Enter', code: 'Enter' } as KeyboardEvent;
      const handled = modalStack.handleKeyDown(enterEvent);
      expect(handled).toBe(true);
      expect(modal.isOpen).toBe(false);
      expect(modalStack.isEmpty()).toBe(true);
      expect(pauseEvents).toEqual([true, false]);
    });

    it('automatically purges stale closed modals on top of the stack during handleKeyDown', () => {
      const modal = new MockModal('m-stale');
      modalStack.push(modal);
      expect(modalStack.isEmpty()).toBe(false);

      // Modal closed externally (e.g. by direct DOM click without stack pop)
      modal.isOpen = false;

      // When player presses movement key, modalStack cleans up the closed modal and passes control
      const moveEvent = { code: 'KeyW', key: 'w' } as KeyboardEvent;
      const handled = modalStack.handleKeyDown(moveEvent);
      expect(handled).toBe(false); // stack became empty, allowing game movement
      expect(modalStack.isEmpty()).toBe(true);
    });
  });
});
