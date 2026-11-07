import { describe, it, expect, vi } from 'vitest';
import { ModalStackManager } from '../../ui/modalStack';
import { toUIModal as adapter } from '../modalAdapter';

/**
 * Modals register on the LIFO stack rather than switching the whole InputHandler off
 * (ARCHITECTURE.md §6), through the adapter main.ts's pushModal uses for modal classes that
 * predate UIModal, including one whose isOpen is a method, not a property.
 */

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

  it('closes the modal when the stack sets it shut, and forwards its focus root', () => {
    let closed = false;
    const root = {} as HTMLElement;
    const modal = adapter('shop', { isOpen: () => !closed, close: () => { closed = true; }, focusRoot: () => root });

    expect(modal.focusRoot?.()).toBe(root);
    modal.isOpen = false;
    expect(closed).toBe(true);
    expect(modal.isOpen).toBe(false);
  });

  it('sends no key to a modal that has already closed', () => {
    const handled = vi.fn(() => true);
    const modal = adapter('choice', { isOpen: false, handleKeyDown: handled, close: () => undefined });

    expect(modal.handleKeyDown(keyEvent('a'))).toBe(false);
    expect(handled).not.toHaveBeenCalled();
    expect(adapter('plain', { isOpen: true, close: () => undefined }).focusRoot).toBeUndefined();
  });
});
