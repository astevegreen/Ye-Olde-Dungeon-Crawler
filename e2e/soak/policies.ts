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

export async function decidePlayerAction(ctx: PolicyContext): Promise<DispatchedAction> {
  const { page, prng } = ctx;

  const info = await page.evaluate(() => {
    const w = window as any;
    const e = w.__cotwEngine;
    if (!e || !e.player) return null;
    const p = e.player;
    const stack = w.__cotwInputHandler?.modalStack?.getStackIds() ?? [];
    const isRaid = Boolean(e.getWorldFlag('cotw_prologue_started')) && !e.getWorldFlag('cotw_prologue_ended');

    const cued = document.querySelector('.potion-slot.hud-cue');
    const cuedSlot = cued?.parentElement ? [...cued.parentElement.children].indexOf(cued) + 1 : null;

    const hostile = (ent: any) => ent && ent.isAlive?.() && ent !== p && ent.faction !== 'player' && ent.faction !== 'neutral' && typeof ent.attack === 'number';
    const dirs = [
      { key: 'ArrowUp', dx: 0, dy: -1 },
      { key: 'ArrowDown', dx: 0, dy: 1 },
      { key: 'ArrowLeft', dx: -1, dy: 0 },
      { key: 'ArrowRight', dx: 1, dy: 0 },
    ].map((d) => {
      const ent = e.map.getEntityAt(p.x + d.dx, p.y + d.dy);
      return { ...d, passable: Boolean(e.map.getTile(p.x + d.dx, p.y + d.dy)?.passable), entity: ent?.id as string | undefined, hostile: hostile(ent) };
    });
    const visibleHostiles = e.map
      .getAllEntities()
      .filter((m: any) => hostile(m) && e.fov.getVisibility(m.x, m.y) === 2).length;

    return {
      hp: p.hp,
      maxHp: p.maxHp,
      stack,
      isRaid,
      cuedSlot,
      dirs,
      visibleHostiles,
      onStairsDown: e.map.getTile(p.x, p.y)?.type === 'stairs_down',
    };
  });

  if (!info) return { type: 'key', key: 'Space' };
  if (info.stack.length > 0) return { type: 'key', key: 'Enter' };
  if (info.isRaid && info.cuedSlot !== null) return { type: 'key', key: `Shift+Digit${info.cuedSlot}` };

  const attack = info.dirs.find((d) => d.hostile);
  if (attack) return { type: 'key', key: attack.key };
  // Bump a held villager to free them.
  const villager = info.dirs.find((d) => d.entity && ['prologue-eir', 'prologue-sigrun', 'prologue-brandr'].includes(d.entity));
  if (villager) return { type: 'key', key: villager.key };

  if (info.onStairsDown && !info.isRaid) return { type: 'key', key: 'Enter' };
  if (!info.isRaid && info.hp < info.maxHp * 0.5 && info.visibleHostiles === 0) return { type: 'key', key: 'KeyR' };

  // A-player replaces this wander with goal-seeking (see .prompts/raidbot.ts).
  const open = info.dirs.filter((d) => d.passable && !d.entity);
  return { type: 'key', key: open.length > 0 ? prng.pick(open).key : prng.pick([...ARROWS, 'Space']) };
}
