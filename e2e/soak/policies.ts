import type { Page } from '@playwright/test';
import type { SoakPrng } from './prng';

export type DispatchedAction =
  | { type: 'key'; key: string; secondaryKey?: string }
  | { type: 'click'; x: number; y: number; selector?: string };

export interface PolicyContext {
  page: Page;
  prng: SoakPrng;
  actionIndex: number;
}

export async function decideChaosAction(ctx: PolicyContext): Promise<DispatchedAction> {
  const { page, prng } = ctx;

  const stack = await page.evaluate(() => window.__cotwInputHandler?.modalStack?.getStackIds() ?? []);

  // 1. If a modal is open, navigate or confirm/dismiss it
  if (stack.length > 0) {
    const key = prng.weightedPick([
      { item: 'ArrowDown', weight: 25 },
      { item: 'ArrowUp', weight: 15 },
      { item: 'Enter', weight: 35 },
      { item: 'Escape', weight: 15 },
      { item: 'Tab', weight: 5 },
      { item: 'Space', weight: 5 },
    ]);
    return { type: 'key', key };
  }

  // 2. Check targeting overlay
  const isTargeting = await page.evaluate(() => Boolean(window.__cotwRenderer?.targetingOverlay?.isOpen));
  if (isTargeting) {
    const key = prng.weightedPick([
      { item: 'ArrowRight', weight: 20 },
      { item: 'ArrowLeft', weight: 20 },
      { item: 'ArrowUp', weight: 20 },
      { item: 'ArrowDown', weight: 20 },
      { item: 'Enter', weight: 15 },
      { item: 'Escape', weight: 5 },
    ]);
    return { type: 'key', key };
  }

  // 3. Regular gameplay action
  const actionType = prng.weightedPick([
    { item: 'move', weight: 50 },
    { item: 'diag_move', weight: 10 },
    { item: 'wait', weight: 8 },
    { item: 'rest', weight: 5 },
    { item: 'search', weight: 5 },
    { item: 'stairs', weight: 4 },
    { item: 'quickslot', weight: 6 },
    { item: 'potion', weight: 6 },
    { item: 'menu', weight: 6 },
  ]);

  let primaryKey = 'Space';

  switch (actionType) {
    case 'move':
      primaryKey = prng.pick(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
      break;
    case 'diag_move':
      primaryKey = prng.pick(['Home', 'End', 'PageUp', 'PageDown', 'Numpad7', 'Numpad1', 'Numpad9', 'Numpad3']);
      break;
    case 'wait':
      primaryKey = 'Space';
      break;
    case 'rest':
      primaryKey = 'KeyR';
      break;
    case 'search':
      primaryKey = 'KeyS';
      break;
    case 'stairs':
      primaryKey = prng.pick(['Shift+Period', 'Shift+Comma']);
      break;
    case 'quickslot':
      primaryKey = prng.pick(['Digit1', 'Digit2', 'Digit3', 'Digit4']);
      break;
    case 'potion':
      primaryKey = prng.pick(['Shift+Digit1', 'Shift+Digit2', 'Shift+Digit3', 'Shift+Digit4']);
      break;
    case 'menu':
      primaryKey = prng.pick(['KeyC', 'KeyI', 'KeyP', 'KeyM', 'Escape']);
      break;
  }

  // Switch keys mid-animation (~10% chance)
  let secondaryKey: string | undefined;
  if (prng.next() < 0.1) {
    secondaryKey = prng.pick(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
  }

  return { type: 'key', key: primaryKey, secondaryKey };
}

export async function decidePlayerAction(ctx: PolicyContext): Promise<DispatchedAction> {
  const { page, prng } = ctx;

  const info = await page.evaluate(() => {
    const w = window as any;
    const e = w.__cotwEngine;
    if (!e || !e.player) return null;
    const p = e.player;
    const stack = w.__cotwInputHandler?.modalStack?.getStackIds() ?? [];

    const isRaid = e.currentFloor === 0 && !e.getWorldFlag('cotw_prologue_ended');
    const cued = document.querySelector('.potion-slot.hud-cue');
    let cuedSlot: number | null = null;
    if (cued && cued.parentElement) {
      cuedSlot = [...cued.parentElement.children].indexOf(cued) + 1;
    }

    const allEntities = e.map.getAllEntities();
    const adjacentDirs: Array<{ key: string; dx: number; dy: number; entity?: string; passable: boolean }> = [
      { key: 'ArrowUp', dx: 0, dy: -1, passable: false },
      { key: 'ArrowDown', dx: 0, dy: 1, passable: false },
      { key: 'ArrowLeft', dx: -1, dy: 0, passable: false },
      { key: 'ArrowRight', dx: 1, dy: 0, passable: false },
    ];

    for (const d of adjacentDirs) {
      const tx = p.x + d.dx;
      const ty = p.y + d.dy;
      const t = e.map.getTile(tx, ty);
      d.passable = t ? t.passable : false;
      const ent = e.map.getEntityAt(tx, ty);
      if (ent) {
        d.entity = ent.id;
      }
    }

    // Check for visible hostiles
    const visibleMonsters = allEntities.filter(
      (m: any) => m.isAlive && m.isAlive() && m.faction === 'monster' && e.map.isInFov(m.x, m.y)
    );

    // Check if on stairs
    const currentTile = e.map.getTile(p.x, p.y);
    const isOnStairsDown = currentTile && (currentTile.type === 'stairs_down' || currentTile.type === 'staircase_down');

    return {
      hp: p.hp,
      maxHp: p.maxHp,
      stack,
      isRaid,
      cuedSlot,
      adjacentDirs,
      visibleMonstersCount: visibleMonsters.length,
      isOnStairsDown,
      currentFloor: e.currentFloor,
    };
  });

  if (!info) return { type: 'key', key: 'Space' };

  // 1. Modals
  if (info.stack.length > 0) {
    return { type: 'key', key: 'Enter' };
  }

  // 2. Raid drink cue
  if (info.isRaid && info.cuedSlot !== null) {
    return { type: 'key', key: `Shift+Digit${info.cuedSlot}` };
  }

  // 3. Attack adjacent hostile
  const adjAttack = info.adjacentDirs.find((d) => d.entity && (d.entity.startsWith('prologue-monster') || d.entity.startsWith('monster')));
  if (adjAttack) {
    return { type: 'key', key: adjAttack.key };
  }

  // 4. Walk into adjacent NPC (e.g. freeing villager or talking to Hallvard)
  const adjNpc = info.adjacentDirs.find((d) => d.entity && d.entity.startsWith('prologue-'));
  if (adjNpc) {
    return { type: 'key', key: adjNpc.key };
  }

  // 5. On stairs down in dungeon
  if (info.isOnStairsDown && !info.isRaid) {
    return { type: 'key', key: 'Shift+Period' };
  }

  // 6. Rest when hurt and safe
  if (!info.isRaid && info.hp < info.maxHp * 0.5 && info.visibleMonstersCount === 0) {
    return { type: 'key', key: 'KeyR' };
  }

  // 7. Walk passable direction
  const passable = info.adjacentDirs.filter((d) => d.passable && !d.entity);
  if (passable.length > 0) {
    return { type: 'key', key: prng.pick(passable).key };
  }

  return { type: 'key', key: prng.pick(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']) };
}
