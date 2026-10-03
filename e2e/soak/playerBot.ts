import type { Page } from '@playwright/test';
import type { SoakPrng } from './prng';
import type { BoundKeys } from './oracles';
import type { DispatchedAction } from './policies';

/**
 * State of the player bot across action decisions.
 * Maintained hermetically on page.__playerBotState.
 */
export interface PlayerBotState {
  lastPos: string;
  lastTurn: number;
  lastFloor: number;
  stuckDecisions: number;
  unstickStepsRemaining: number;
  stuckEpisodes: number;
  floorEnteredTurn: number;
  lastFloorSeen: number;
  lastRestAttemptTurn: number;
  lastPickupTurn: number;
  lastPickupPos: string;
}

export function getBotState(page: Page, actionIndex: number): PlayerBotState {
  const p = page as any;
  if (actionIndex === 0 || !p.__playerBotState) {
    p.__playerBotState = {
      lastPos: '',
      lastTurn: -1,
      lastFloor: -1,
      stuckDecisions: 0,
      unstickStepsRemaining: 0,
      stuckEpisodes: 0,
      floorEnteredTurn: 0,
      lastFloorSeen: -1,
      lastRestAttemptTurn: -1,
      lastPickupTurn: -1,
      lastPickupPos: '',
    };
  }
  return p.__playerBotState;
}

export interface PlayerDecisionContext {
  page: Page;
  prng: SoakPrng;
  actionIndex: number;
  boundKeys: BoundKeys;
  canvas: { x: number; y: number; width: number; height: number } | null;
  inDialog: boolean;
}

/**
 * Decides the next action for the goal-seeking player bot.
 * Performs exactly one page.evaluate call per decision to inspect state and plan paths.
 */
export async function decidePlayerAction(ctx: PlayerDecisionContext): Promise<DispatchedAction> {
  const { page, prng, actionIndex, inDialog } = ctx;
  const state = getBotState(page, actionIndex);

  // If in unstick mode, take a seeded random step
  if (state.unstickStepsRemaining > 0) {
    state.unstickStepsRemaining--;
    const key = prng.pick(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    return { type: 'key', key };
  }

  const evalResult = await page.evaluate(
    (args: {
      inDialog: boolean;
      floorEnteredTurn: number;
      lastRestAttemptTurn: number;
      lastPickupPos: string;
      lastPickupTurn: number;
    }) => {
      const w = window as any;
      const e = w.__cotwEngine;
      const h = w.__cotwInputHandler;
      const r = w.__cotwRenderer;

      if (!e || !e.player) {
        return {
          action: { type: 'key' as const, key: 'Space' },
          curPos: '0,0',
          curTurn: -1,
          curFloor: -1,
        };
      }

      const p = e.player;
      const curPos = `${p.x},${p.y}`;
      const curTurn = e.turnCount as number;
      const curFloor = (e.currentFloor ?? 0) as number;
      const stack: string[] = h?.modalStack?.getStackIds?.() ?? [];
      const openModes = [
        h?.inspectOverlay?.isOpen && 'inspect',
        h?.mapOverlay?.isOpen && 'map',
        h?.shopOverlay?.isOpen && 'shop',
        h?.contextHelp?.isOpen && 'help',
      ].filter(Boolean) as string[];

      const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

      const stepToKey = (dx: number, dy: number): string => {
        if (dx === 0 && dy === -1) return 'ArrowUp';
        if (dx === 0 && dy === 1) return 'ArrowDown';
        if (dx === -1 && dy === 0) return 'ArrowLeft';
        if (dx === 1 && dy === 0) return 'ArrowRight';
        if (dx === -1 && dy === -1) return 'Numpad7';
        if (dx === 1 && dy === -1) return 'Numpad9';
        if (dx === -1 && dy === 1) return 'Numpad1';
        if (dx === 1 && dy === 1) return 'Numpad3';
        return 'Space';
      };

      const hostiles = e.map
        .getAllEntities()
        .filter(
          (m: any) =>
            m &&
            m !== p &&
            m.isAlive?.() &&
            p.isHostileTo?.(m)
        );

      // --- 1. Dialogs and modes first -----------------------------------------
      const picker = document.querySelector('.potion-picker');
      if (picker && (stack.includes('potion-picker') || h?.modalStack?.has?.('potion-picker'))) {
        const row = picker.querySelector('.potion-picker-row:not(.potion-picker-clear)') as HTMLElement;
        if (row) {
          const rect = row.getBoundingClientRect();
          return {
            action: {
              type: 'click' as const,
              x: Math.round(rect.left + rect.width / 2),
              y: Math.round(rect.top + rect.height / 2),
            },
            curPos,
            curTurn,
            curFloor,
          };
        }
        return { action: { type: 'key' as const, key: 'Escape' }, curPos, curTurn, curFloor };
      }

      const targetingOpen = stack.includes('targeting') || Boolean(r?.targetingOverlay?.isOpen);
      if (targetingOpen) {
        const t = r?.targetingOverlay;
        const aimX = t?.reticleX ?? p.x + 1;
        const aimY = t?.reticleY ?? p.y;

        const snipeCandidates = hostiles
          .filter(
            (m: any) =>
              e.fov.isVisible(m.x, m.y) &&
              cheb(m, p) >= 2 &&
              cheb(m, p) <= 6 &&
              (m.aiState === 'fleeing' || m.hp <= m.maxHp / 2)
          )
          .sort((a: any, b: any) => a.hp - b.hp || a.y - b.y || a.x - b.x || String(a.id).localeCompare(String(b.id)));

        const target = snipeCandidates[0];
        if (target) {
          if (aimX === target.x && aimY === target.y) {
            return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor };
          }
          const rdx = Math.sign(target.x - aimX);
          const rdy = Math.sign(target.y - aimY);
          if (rdx !== 0) return { action: { type: 'key' as const, key: rdx > 0 ? 'ArrowRight' : 'ArrowLeft' }, curPos, curTurn, curFloor };
          if (rdy !== 0) return { action: { type: 'key' as const, key: rdy > 0 ? 'ArrowDown' : 'ArrowUp' }, curPos, curTurn, curFloor };
        }

        const hostileAtAim = hostiles.find((m: any) => m.x === aimX && m.y === aimY && e.fov.isVisible(m.x, m.y));
        if (hostileAtAim) {
          return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor };
        }
        return { action: { type: 'key' as const, key: 'Escape' }, curPos, curTurn, curFloor };
      }

      const controlsPrimer = document.getElementById('controls-primer');
      if ((controlsPrimer && window.getComputedStyle(controlsPrimer).display !== 'none') || stack.includes('controls-primer')) {
        return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor };
      }

      if (stack.includes('choice')) {
        const choiceOverlay = document.getElementById('choice-modal-overlay');
        const focused = choiceOverlay?.querySelector('.ui-option.is-focused');
        if (!focused) {
          return { action: { type: 'key' as const, key: 'ArrowDown', secondaryKey: 'Enter' }, curPos, curTurn, curFloor };
        }
        return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor };
      }

      if (stack.includes('shop') || openModes.includes('shop') || h?.shopOverlay?.isOpen) {
        return { action: { type: 'key' as const, key: 'Escape' }, curPos, curTurn, curFloor };
      }

      if (stack.length > 0 || (args.inDialog && openModes.length > 0)) {
        return { action: { type: 'key' as const, key: 'Escape' }, curPos, curTurn, curFloor };
      }

      // --- Helpers for map action choices --------------------------------------
      const findHealingPotionKey = (): string | null => {
        const cue = document.querySelector('.potion-slot.hud-cue');
        if (cue && cue.parentElement) {
          const slotIdx = [...cue.parentElement.children].indexOf(cue) + 1;
          if (slotIdx >= 1 && slotIdx <= 4) return `Shift+Digit${slotIdx}`;
        }

        const slots = document.querySelectorAll('.potion-slot');
        for (let i = 0; i < Math.min(slots.length, 4); i++) {
          const slotEl = slots[i];
          if (slotEl.classList.contains('potion-slot-empty') || slotEl.classList.contains('potion-slot-out')) continue;
          return `Shift+Digit${i + 1}`;
        }

        // If slots are out/dimmed (e.g. serialize bug dropped definitionId),
        // pressing Shift+Digit2 opens potion-picker to re-pin it if potions are carried:
        const carriedPotions = p.inventory.getAllCarriedItems().filter(
          (it: any) => it && (it.potionType === 'health' || it.effects?.some((f: any) => f.type === 'restore_hp'))
        );
        if (carriedPotions.length > 0) {
          return 'Shift+Digit2';
        }
        return null;
      };

      const adjHostiles = hostiles
        .filter((m: any) => cheb(m, p) === 1)
        .sort((a: any, b: any) => a.hp - b.hp || a.y - b.y || a.x - b.x || String(a.id).localeCompare(String(b.id)));

      const canCast = p.mana >= 3 && (p.spellsKnown?.includes('magic_arrow') || p.quickSpells?.[0] === 'magic_arrow');
      const snipeCandidates = canCast
        ? hostiles
            .filter(
              (m: any) =>
                e.fov.isVisible(m.x, m.y) &&
                cheb(m, p) >= 2 &&
                cheb(m, p) <= 6 &&
                (m.aiState === 'fleeing' || m.hp <= m.maxHp / 2)
            )
            .sort((a: any, b: any) => a.hp - b.hp || cheb(a, p) - cheb(b, p) || String(a.id).localeCompare(String(b.id)))
        : [];
      const snipeTarget = snipeCandidates[0];

      let snipeAction: { type: 'key'; key: string; secondaryKey?: string } | null = null;
      if (snipeTarget) {
        const visibleEnemies = e.map
          .getAllEntities()
          .filter((ent: any) => ent && ent.isAlive?.() && ent.isHostileTo?.(p) && e.fov.isVisible(ent.x, ent.y));
        const autoTargetsDirectly = visibleEnemies[0]?.id === snipeTarget.id;
        snipeAction = { type: 'key', key: 'Digit1', secondaryKey: autoTargetsDirectly ? 'Enter' : undefined };
      }

      const bfsStepToGoal = (
        start: { x: number; y: number },
        goal: { x: number; y: number },
        isDungeonFloor: boolean
      ): { x: number; y: number } | null => {
        if (cheb(start, goal) === 1) return goal;
        const width = e.map.width;
        const height = e.map.height;
        const key = (x: number, y: number) => y * width + x;
        const startKey = key(start.x, start.y);
        const goalKey = key(goal.x, goal.y);
        const cameFrom = new Int32Array(width * height).fill(-2);
        const queue: number[] = [startKey];
        cameFrom[startKey] = -1;
        let qHead = 0;

        const DIRS8 = [
          [0, -1], [1, 0], [0, 1], [-1, 0],
          [1, -1], [1, 1], [-1, 1], [-1, -1],
        ];

        while (qHead < queue.length) {
          const curKey = queue[qHead++];
          if (curKey === goalKey) {
            let k = curKey;
            let last = k;
            while (cameFrom[k] !== startKey && cameFrom[k] !== -1) {
              last = k;
              k = cameFrom[k];
            }
            const stepKey = cameFrom[k] === -1 ? last : k;
            return { x: stepKey % width, y: Math.floor(stepKey / width) };
          }

          const cx = curKey % width;
          const cy = Math.floor(curKey / width);

          for (let i = 0; i < 8; i++) {
            const nx = cx + DIRS8[i][0];
            const ny = cy + DIRS8[i][1];
            if (!e.map.inBounds(nx, ny)) continue;
            const nKey = ny * width + nx;
            if (cameFrom[nKey] !== -2) continue;

            const tile = e.map.getTile(nx, ny);
            const isDest = nKey === goalKey;

            if (!isDest) {
              if (isDungeonFloor) {
                const passable =
                  tile &&
                  (tile.passable ||
                    tile.isClosedDoor ||
                    tile.isOpenDoor ||
                    tile.type === 'door_closed' ||
                    tile.type === 'door_open');
                if (!passable) continue;
              } else {
                if (!tile || !tile.passable || tile.isClosedDoor || tile.isOpenDoor) continue;
                const ent = e.map.getEntityAt(nx, ny);
                if (ent && ent.type === 'npc') continue;
              }
            }

            cameFrom[nKey] = curKey;
            queue.push(nKey);
          }
        }
        return null;
      };

      const bfsStepToFrontier = (start: { x: number; y: number }): { x: number; y: number } | null => {
        const width = e.map.width;
        const height = e.map.height;
        const key = (x: number, y: number) => y * width + x;
        const startKey = key(start.x, start.y);
        const cameFrom = new Int32Array(width * height).fill(-2);
        const queue: number[] = [startKey];
        cameFrom[startKey] = -1;
        let qHead = 0;

        const DIRS8 = [
          [0, -1], [1, 0], [0, 1], [-1, 0],
          [1, -1], [1, 1], [-1, 1], [-1, -1],
        ];

        const isFrontier = (x: number, y: number): boolean => {
          if (e.fov.getVisibility(x, y) === 0) return false;
          const t = e.map.getTile(x, y);
          if (
            !t ||
            (!t.passable && !t.isClosedDoor && !t.isOpenDoor && t.type !== 'door_closed' && t.type !== 'door_open')
          ) {
            return false;
          }

          for (let i = 0; i < 8; i++) {
            const nx = x + DIRS8[i][0];
            const ny = y + DIRS8[i][1];
            if (!e.map.inBounds(nx, ny)) continue;
            if (e.fov.getVisibility(nx, ny) === 0) {
              const nt = e.map.getTile(nx, ny);
              if (
                nt &&
                (nt.passable || nt.isClosedDoor || nt.isOpenDoor || nt.type === 'door_closed' || nt.type === 'door_open')
              ) {
                return true;
              }
            }
          }
          return false;
        };

        while (qHead < queue.length) {
          const curKey = queue[qHead++];
          const cx = curKey % width;
          const cy = Math.floor(curKey / width);

          if (curKey !== startKey && isFrontier(cx, cy)) {
            let k = curKey;
            let last = k;
            while (cameFrom[k] !== startKey && cameFrom[k] !== -1) {
              last = k;
              k = cameFrom[k];
            }
            const stepKey = cameFrom[k] === -1 ? last : k;
            return { x: stepKey % width, y: Math.floor(stepKey / width) };
          }

          for (let i = 0; i < 8; i++) {
            const nx = cx + DIRS8[i][0];
            const ny = cy + DIRS8[i][1];
            if (!e.map.inBounds(nx, ny)) continue;
            const nKey = ny * width + nx;
            if (cameFrom[nKey] !== -2) continue;

            const tile = e.map.getTile(nx, ny);
            const passable =
              tile &&
              (tile.passable ||
                tile.isClosedDoor ||
                tile.isOpenDoor ||
                tile.type === 'door_closed' ||
                tile.type === 'door_open');
            if (!passable) continue;

            cameFrom[nKey] = curKey;
            queue.push(nKey);
          }
        }
        return null;
      };

      // --- 2. The Raid Phase ---------------------------------------------------
      const isRaid = Boolean(e.getWorldFlag('cotw_prologue_started')) && !e.getWorldFlag('cotw_prologue_ended');
      if (isRaid) {
        if (p.hp <= Math.max(p.maxHp * 0.45, 12)) {
          const potKey = findHealingPotionKey();
          if (potKey) return { action: { type: 'key' as const, key: potKey }, curPos, curTurn, curFloor };
        }

        if (adjHostiles.length > 0) {
          const m = adjHostiles[0];
          return { action: { type: 'key' as const, key: stepToKey(m.x - p.x, m.y - p.y) }, curPos, curTurn, curFloor };
        }

        if (snipeAction) {
          return { action: snipeAction, curPos, curTurn, curFloor };
        }

        const VILLAGER_IDS = ['prologue-eir', 'prologue-sigrun', 'prologue-brandr'];
        const remainingVillagers = VILLAGER_IDS.filter((id) => !e.getWorldFlag(`${id}_saved`))
          .map((id) => e.map.getEntityById(id))
          .filter(Boolean);

        let goal: any = null;
        if (remainingVillagers.length > 0) {
          const ordered = remainingVillagers.sort(
            (a: any, b: any) => cheb(a, p) - cheb(b, p) || String(a.id).localeCompare(String(b.id))
          );
          const v = ordered[0];
          const captor = hostiles
            .filter((m: any) => cheb(m, v) <= 1)
            .sort((a: any, b: any) => a.hp - b.hp || String(a.id).localeCompare(String(b.id)))[0];
          goal = captor ?? v;
        } else {
          const warlocks = hostiles
            .filter((m: any) => m.definitionId === 'prologue_coven_warlock')
            .sort((a: any, b: any) => cheb(a, p) - cheb(b, p) || String(a.id).localeCompare(String(b.id)));
          goal =
            warlocks[0] ??
            hostiles.sort((a: any, b: any) => cheb(a, p) - cheb(b, p) || String(a.id).localeCompare(String(b.id)))[0];
        }

        if (goal) {
          if (cheb(p, goal) === 1) {
            return { action: { type: 'key' as const, key: stepToKey(goal.x - p.x, goal.y - p.y) }, curPos, curTurn, curFloor };
          }
          const step = bfsStepToGoal(p, goal, false);
          if (step) {
            return { action: { type: 'key' as const, key: stepToKey(step.x - p.x, step.y - p.y) }, curPos, curTurn, curFloor };
          }
        }

        return { action: { type: 'key' as const, key: 'Space' }, curPos, curTurn, curFloor };
      }

      // --- 3. The town after the raid ------------------------------------------
      const isTown = curFloor === 0 && Boolean(e.getWorldFlag('cotw_prologue_ended'));
      if (isTown) {
        const hallvardHeard = Boolean(e.getWorldFlag('cotw_prologue_gateward_heard'));
        if (!hallvardHeard) {
          const hallvard = e.map.getEntityById('prologue-hallvard') ?? { x: 31, y: 9 };
          if (cheb(p, hallvard) === 1) {
            return { action: { type: 'key' as const, key: stepToKey(hallvard.x - p.x, hallvard.y - p.y) }, curPos, curTurn, curFloor };
          }
          const step = bfsStepToGoal(p, hallvard, false);
          if (step) {
            return { action: { type: 'key' as const, key: stepToKey(step.x - p.x, step.y - p.y) }, curPos, curTurn, curFloor };
          }
        } else {
          // Walk to cellar stairs at (31, 7) or tile with isStairsDown
          let stairs = { x: 31, y: 7 };
          for (let y = 0; y < e.map.height; y++) {
            for (let x = 0; x < e.map.width; x++) {
              const t = e.map.getTile(x, y);
              if (t && (t.isStairsDown || t.type === 'stairs_down')) {
                stairs = { x, y };
                break;
              }
            }
          }

          if (p.x === stairs.x && p.y === stairs.y) {
            return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor };
          }
          if (cheb(p, stairs) === 1) {
            return { action: { type: 'key' as const, key: stepToKey(stairs.x - p.x, stairs.y - p.y) }, curPos, curTurn, curFloor };
          }
          const step = bfsStepToGoal(p, stairs, false);
          if (step) {
            return { action: { type: 'key' as const, key: stepToKey(step.x - p.x, step.y - p.y) }, curPos, curTurn, curFloor };
          }
        }
        return { action: { type: 'key' as const, key: 'Space' }, curPos, curTurn, curFloor };
      }

      // --- 4. A dungeon floor --------------------------------------------------
      if (curFloor > 0) {
        if (p.hp <= Math.max(p.maxHp * 0.45, 12)) {
          const potKey = findHealingPotionKey();
          if (potKey) return { action: { type: 'key' as const, key: potKey }, curPos, curTurn, curFloor };
        }

        if (adjHostiles.length > 0) {
          const m = adjHostiles[0];
          return { action: { type: 'key' as const, key: stepToKey(m.x - p.x, m.y - p.y) }, curPos, curTurn, curFloor };
        }

        if (snipeAction) {
          return { action: snipeAction, curPos, curTurn, curFloor };
        }

        const visibleHostiles = hostiles.filter((m: any) => e.fov.isVisible(m.x, m.y));
        if (p.hp < p.maxHp * 0.6 && visibleHostiles.length === 0) {
          if (args.lastRestAttemptTurn !== curTurn) {
            return { action: { type: 'key' as const, key: 'KeyR' }, curPos, curTurn, curFloor, restAttempted: true };
          }
        }

        const itemsHere = e.map.getItemsAt(p.x, p.y);
        if (itemsHere.length > 0) {
          if (args.lastPickupPos !== curPos || args.lastPickupTurn !== curTurn) {
            return { action: { type: 'key' as const, key: 'KeyG' }, curPos, curTurn, curFloor, pickupAttempted: true };
          }
        }

        let seenStairsDown: { x: number; y: number } | null = null;
        for (let y = 0; y < e.map.height; y++) {
          for (let x = 0; x < e.map.width; x++) {
            const t = e.map.getTile(x, y);
            if (t && (t.isStairsDown || t.type === 'stairs_down') && e.fov.isExplored(x, y)) {
              seenStairsDown = { x, y };
              break;
            }
          }
        }

        const turnsOnFloor = curTurn - args.floorEnteredTurn;
        const timeout = turnsOnFloor >= 400;
        const frontierStep = bfsStepToFrontier(p);

        if ((!frontierStep || timeout) && seenStairsDown) {
          if (p.x === seenStairsDown.x && p.y === seenStairsDown.y) {
            return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor };
          }
          const step = bfsStepToGoal(p, seenStairsDown, true);
          if (step) {
            return { action: { type: 'key' as const, key: stepToKey(step.x - p.x, step.y - p.y) }, curPos, curTurn, curFloor };
          }
        }

        if (frontierStep) {
          return { action: { type: 'key' as const, key: stepToKey(frontierStep.x - p.x, frontierStep.y - p.y) }, curPos, curTurn, curFloor };
        }

        if (seenStairsDown) {
          if (p.x === seenStairsDown.x && p.y === seenStairsDown.y) {
            return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor };
          }
          const step = bfsStepToGoal(p, seenStairsDown, true);
          if (step) {
            return { action: { type: 'key' as const, key: stepToKey(step.x - p.x, step.y - p.y) }, curPos, curTurn, curFloor };
          }
        }

        return { action: { type: 'key' as const, key: 'KeyS' }, curPos, curTurn, curFloor };
      }

      return { action: { type: 'key' as const, key: 'Space' }, curPos, curTurn, curFloor };
    },
    {
      inDialog,
      floorEnteredTurn: state.floorEnteredTurn,
      lastRestAttemptTurn: state.lastRestAttemptTurn,
      lastPickupPos: state.lastPickupPos,
      lastPickupTurn: state.lastPickupTurn,
    }
  );

  // Update bot state tracking in Node
  const { action, curPos, curTurn, curFloor, restAttempted, pickupAttempted } = evalResult;

  if (curFloor !== state.lastFloorSeen) {
    state.lastFloorSeen = curFloor;
    state.floorEnteredTurn = curTurn;
  }

  if (restAttempted) {
    state.lastRestAttemptTurn = curTurn;
  }
  if (pickupAttempted) {
    state.lastPickupPos = curPos;
    state.lastPickupTurn = curTurn;
  }

  // --- 5. Stuck handling ----------------------------------------------------
  const sameState = curPos === state.lastPos && curTurn === state.lastTurn && curFloor === state.lastFloor;
  state.lastPos = curPos;
  state.lastTurn = curTurn;
  state.lastFloor = curFloor;

  if (sameState) {
    state.stuckDecisions++;
    if (state.stuckDecisions >= 15) {
      state.stuckEpisodes++;
      state.unstickStepsRemaining = 5;
      state.stuckDecisions = 0;
      console.log(
        `[soak:player] Stuck episode #${state.stuckEpisodes} at ${curPos}, floor ${curFloor}, turn ${curTurn} (15 unchanged decisions). Taking 5 seeded random steps.`
      );
    }
  } else {
    state.stuckDecisions = 0;
  }

  (page as any).__playerStuckEpisodes = state.stuckEpisodes;

  return action;
}
