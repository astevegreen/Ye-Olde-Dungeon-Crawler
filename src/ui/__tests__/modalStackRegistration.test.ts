import { describe, it, expect, vi } from 'vitest';
import { ModalStackManager } from '../modalStack';
import type { UIModal } from '../modalStack';

/**
 * Modals register on the LIFO stack rather than switching the whole InputHandler off
 * (ARCHITECTURE.md §6). These cover the adapter shape main.ts pushes for modal classes
 * that predate UIModal — including one whose isOpen is a method, not a property.
 */
function adapter(
  id: string,
  target: { isOpen: boolean | (() => boolean); handleKeyDown?: (e: KeyboardEvent) => boolean; close: () => void }
): UIModal {
  const openNow = () => (typeof target.isOpen === 'function' ? target.isOpen() : target.isOpen);
  return {
    id,
    get isOpen() {
      return openNow();
    },
    set isOpen(value: boolean) {
      if (!value) target.close();
    },
    handleKeyDown: (e: KeyboardEvent) => (openNow() ? (target.handleKeyDown?.(e) ?? false) : false),
    close: () => target.close(),
  };
}

const keyEvent = (key: string) => ({ key, preventDefault: vi.fn(), stopPropagation: vi.fn() }) as unknown as KeyboardEvent;

describe('Modal stack registration', () => {
  it('pauses the engine while a modal is on the stack and resumes after', () => {
    const paused: boolean[] = [];
    const stack = new ModalStackManager((p) => paused.push(p));
    let open = true;

    stack.push(adapter('winch', { isOpen: () => open, close: () => { open = false; } }));
    expect(paused).toContain(true);

    stack.remove('winch');
    expect(paused[paused.length - 1]).toBe(false);
  });

  it('routes keys to the top modal and traps them from the simulation', () => {
    const stack = new ModalStackManager(() => undefined);
    const handled: string[] = [];
    stack.push(adapter('choice', {
      isOpen: true,
      handleKeyDown: (e) => { handled.push(e.key); return true; },
      close: () => undefined,
    }));

    const trapped = stack.handleKeyDown(keyEvent('a'));

    expect(handled).toEqual(['a']);
    expect(trapped).toBe(true);
  });

  it('supports a modal whose isOpen is a method', () => {
    const stack = new ModalStackManager(() => undefined);
    let closed = false;
    const saveCodeLike = { isOpen: () => !closed, close: () => { closed = true; } };

    stack.push(adapter('save-code', saveCodeLike));
    stack.pop();

    expect(closed).toBe(true);
  });

  it('keeps nested modals in LIFO order', () => {
    const stack = new ModalStackManager(() => undefined);
    const order: string[] = [];
    for (const id of ['save-quit', 'keybinds']) {
      stack.push(adapter(id, { isOpen: true, handleKeyDown: () => { order.push(id); return true; }, close: () => undefined }));
    }

    stack.handleKeyDown(keyEvent('x'));

    expect(order).toEqual(['keybinds']);
  });
});
