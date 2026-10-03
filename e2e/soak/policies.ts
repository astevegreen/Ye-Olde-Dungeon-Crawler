import type { Page } from '@playwright/test';
import type { SoakPrng } from './prng';
import type { BoundKeys } from './oracles';

export type DispatchedAction =
  | { type: 'key'; key: string; secondaryKey?: string }
  | { type: 'click'; x: number; y: number };

export interface PolicyContext {
  page: Page;
  prng: SoakPrng;
  actionIndex: number;
  boundKeys: BoundKeys;
  /** The game canvas's box in page pixels, read once when the run starts. */
  canvas: { x: number; y: number; width: number; height: number } | null;
  /** A dialog or a keyboard-owning mode (look, map, shop, help) is open. */
  inDialog: boolean;
}

const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export async function decideChaosAction(ctx: PolicyContext): Promise<DispatchedAction> {
  const { prng } = ctx;

  // In a dialog or mode: move through it, confirm, back out, or tab (Tab is how focus escapes).
  if (ctx.inDialog) {
    const key = prng.weightedPick([
      { item: 'ArrowDown', weight: 22 },
      { item: 'ArrowUp', weight: 12 },
      { item: 'ArrowRight', weight: 6 },
      { item: 'Enter', weight: 30 },
      { item: 'Escape', weight: 15 },
      { item: 'Tab', weight: 5 },
      { item: 'Space', weight: 5 },
      { item: 'Digit1', weight: 5 },
    ]);
    return { type: 'key', key };
  }

  const actionType = prng.weightedPick([
    { item: 'move', weight: 45 },
    { item: 'diag_move', weight: 10 },
    { item: 'wait', weight: 6 },
    { item: 'bound', weight: 18 },
    { item: 'stairs', weight: 4 },
    { item: 'click', weight: 7 },
    { item: 'unbound', weight: 2 },
  ]);

  if (actionType === 'click' && ctx.canvas) {
    const { x, y, width, height } = ctx.canvas;
    return { type: 'click', x: Math.round(x + prng.next() * width), y: Math.round(y + prng.next() * height) };
  }

  let key: string;
  switch (actionType) {
    case 'move':
      key = prng.pick(ARROWS);
      break;
    case 'diag_move':
      key = prng.pick(['Numpad7', 'Numpad9', 'Numpad1', 'Numpad3']);
      break;
    case 'wait':
      key = 'Space';
      break;
    case 'stairs':
      key = prng.pick(['Enter', 'KeyF']); // `stairs` and `context_action`
      break;
    case 'unbound':
      // Keys a player might try that the game doesn't bind; never counted as dead keys.
      key = prng.pick(['Home', 'End', 'PageUp', 'PageDown', 'Shift+Period', 'Backquote']);
      break;
    default: {
      // Any bound key, so menus, spells, potions, search and rest all get pressed.
      const bound = [...ctx.boundKeys.all];
      key = bound.length > 0 ? prng.pick(bound) : 'Space';
    }
  }

  // Now and then a second key straight after, while the first one's effect may still play.
  const secondaryKey = prng.next() < 0.1 ? prng.pick([...ARROWS, 'Space']) : undefined;
  return { type: 'key', key, secondaryKey };
}

import { decidePlayerAction as decidePlayerActionImpl } from './playerBot';

export async function decidePlayerAction(ctx: PolicyContext): Promise<DispatchedAction> {
  return decidePlayerActionImpl(ctx);
}

