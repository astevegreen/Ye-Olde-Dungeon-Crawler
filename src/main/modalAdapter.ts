import type { UIModal } from '../ui/modalStack';

/** A modal class that predates `UIModal`: `isOpen` may be a property or a method. */
export interface LegacyModal {
  isOpen: boolean | (() => boolean);
  handleKeyDown?: (e: KeyboardEvent) => boolean;
  close: () => void;
  focusRoot?: () => HTMLElement | null;
}

/**
 * Adapts a legacy modal to the stack's `UIModal` (ARCHITECTURE.md §6), as `main.ts`'s
 * `pushModal` registers it: keys reach it only while it is open, setting `isOpen` false
 * closes it, and its focus root is forwarded, or Tab is trapped in a dialog it can't move
 * through (R-ui-4).
 */
export function toUIModal(id: string, target: LegacyModal): UIModal {
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
    focusRoot: target.focusRoot ? () => target.focusRoot!() : undefined,
  };
}
