import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pastTheOpening } from './newHero';

// Plays the shipped bundle, not the source: minification and bundling have broken
// behavior that every unit test passed (class names hooks match on, input routing).
const BUNDLE = resolve(process.cwd(), 'dist', 'index.html');

const state = (page: Page) =>
  page.evaluate(() => {
    const e = window.__cotwEngine!;
    return { turn: e.turnCount, x: e.player.x, y: e.player.y, lastAction: e.lastActionName };
  });

const stackIds = (page: Page) => page.evaluate(() => window.__cotwInputHandler!.modalStack.getStackIds());

/** Names of the CSS animations running on `selector` or inside it. */
const runningAnimations = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const root = document.querySelector(sel);
    return document
      .getAnimations()
      .filter((a) => a.playState === 'running')
      .filter((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        return !!root && !!target && root.contains(target);
      })
      .map((a) => (a as CSSAnimation).animationName ?? 'animation');
  }, selector);

async function embarkNewHero(page: Page): Promise<void> {
  expect(existsSync(BUNDLE), `${BUNDLE} is missing; run \`npm run build\` first`).toBe(true);
  await page.goto(pathToFileURL(BUNDLE).href);
  await page.locator('#btn-menu-new-game').click();
  // No roll reaches an attribute milestone (the cap is 16, the first tier 20), so the
  // first step never opens a choice modal over the keyboard.
  await page.locator('#btn-create-embark').click();
  await pastTheOpening(page);
}

test('a new hero moves, the map owns the keyboard, and save & continue restores the run', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await embarkNewHero(page);

  // Moving spends a turn, and the pipeline sees the real class name (esbuild keepNames).
  const start = await state(page);
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await state(page)).turn).toBeGreaterThan(start.turn);
  const moved = await state(page);
  expect(moved.x).toBe(start.x + 1);
  expect(moved.lastAction).toBe('MovementAction');

  // With the map open, movement keys don't reach the simulation, and Escape closes the map.
  await page.keyboard.press('KeyM');
  await expect.poll(() => page.evaluate(() => window.__cotwRenderer?.mapOverlay.isOpen)).toBe(true);
  await page.keyboard.press('ArrowRight');
  expect(await state(page)).toMatchObject({ turn: moved.turn, x: moved.x });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__cotwRenderer?.mapOverlay.isOpen)).toBe(false);
  await expect(page.locator('#save-quit-modal')).toBeHidden();

  // Save & exit, then Continue resumes exactly where the hero stood.
  await page.keyboard.press('Escape');
  await page.locator('#btn-savequit-save-exit').click();
  await expect(page.locator('#btn-menu-continue')).toBeEnabled();
  await page.locator('#btn-menu-continue').click();
  await expect.poll(async () => (await state(page)).turn).toBe(moved.turn);
  expect(await state(page)).toMatchObject({ x: moved.x, y: moved.y });

  expect(pageErrors).toEqual([]);
});

// A full spell belt stays inside its column: at 1366x768 seven spells ran over the
// context button and the pact chip (tracker 0.18). Playwright's 1280x720 is narrower.
test('a full spell belt keeps clear of the context button and the tray', async ({ page }) => {
  await embarkNewHero(page);
  await page.evaluate(() => {
    const e = window.__cotwEngine!;
    for (const id of ['firebolt', 'cold_ray', 'lightning_bolt', 'fireball', 'slow', 'phase_door', 'detect_monsters', 'light']) {
      e.player.learnSpell(id);
    }
  });
  await page.keyboard.press('Space'); // a turn, so the HUD redraws
  await expect.poll(() => page.locator('#quick-spells-bar .quick-spell-slot:not([hidden])').count()).toBe(10);
  const clashes = await page.evaluate(() => {
    const box = (el: Element) => el.getBoundingClientRect();
    const meets = (a: DOMRect, b: DOMRect) => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
    const slots = [...document.querySelectorAll('#quick-spells-bar .quick-spell-slot')].filter((s) => !(s as HTMLElement).hidden);
    const cluster = box(document.querySelector('.console-center-cluster')!);
    const neighbours = ['#context-action', '#console-tray', '#hud-health-orb', '#hud-mana-orb']
      .map((sel) => document.querySelector(sel))
      .filter((el): el is HTMLElement => !!el && el.offsetParent !== null);
    return slots.flatMap((s, i) => {
      const b = box(s);
      const out = b.left < cluster.left - 0.5 || b.right > cluster.right + 0.5 ? [`slot ${i} outside the centre column`] : [];
      return [...out, ...neighbours.filter((n) => meets(b, box(n))).map((n) => `slot ${i} over #${n.id}`)];
    });
  });
  expect(clashes).toEqual([]);
});

// Each belt slot holds its key, rune, cost and name (tracker 4.6): with short names in one
// row a slot stayed at its minimum while "1 5 Seiðr" above the name needed more, and ran
// into the next slot (the crowding 0.18 left).
test('every belt slot holds what it shows, at 1366 and 1920 wide', async ({ page }) => {
  await embarkNewHero(page);
  await page.evaluate(() => {
    const e = window.__cotwEngine!;
    for (const id of ['firebolt', 'cold_ray', 'lightning_bolt']) e.player.learnSpell(id);
  });
  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await page.keyboard.press('Space');
    const spill = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('#quick-spells-bar .quick-spell-slot')]
        .filter((s) => !s.hidden)
        .map((s) => s.scrollWidth - s.clientWidth)
    );
    expect(spill.length, `slots at ${width}`).toBeGreaterThan(3);
    expect(Math.max(...spill), `overflow at ${width}`).toBeLessThanOrEqual(1);
    const runes = await page.locator('#quick-spells-bar .spell-rune').evaluateAll((els) => els.filter((el) => getComputedStyle(el).display !== 'none').length);
    expect(runes, 'a rune on every spell').toBe(spill.length - 1);
  }
});

// On a very wide window the map stays inside its column: a 2400px CSS cap on the column
// fought the width ViewportManager sets, and at 3840x2160 the canvas ran 320px past
// the header and under the sidebar (tracker 0.19).
test('the map stays inside its column on a very wide window', async ({ page }) => {
  await page.setViewportSize({ width: 3840, height: 2160 });
  await embarkNewHero(page);
  await page.keyboard.press('Space');
  const fit = await page.evaluate(() => {
    const box = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
    const canvas = box('#game-canvas');
    const column = box('#game-container');
    const sidebar = document.querySelector('#combat-sidebar');
    const side = sidebar ? sidebar.getBoundingClientRect() : null;
    return {
      inColumn: canvas.left >= column.left - 0.5 && canvas.right <= column.right + 0.5,
      clearOfSidebar: !side || side.width === 0 || canvas.right <= side.left + 0.5,
    };
  });
  expect(fit).toEqual({ inColumn: true, clearOfSidebar: true });
});

// Planning a point redraws the Character tab; its scrolled columns stay where they were
// (each + jumped them back to the top, tracker 0.21).
test('planning a point keeps the Character tab where it was scrolled', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await embarkNewHero(page);
  await page.evaluate(() => {
    const e = window.__cotwEngine!;
    e.diagnostics.grantLevel();
    e.diagnostics.grantLevel();
  });
  await page.keyboard.press('e');
  const add = page.locator('#character-menu-tab-content .ch-pm.is-add[data-plan="dexterity"]');
  await expect(add).toBeVisible();
  const cols = '#character-menu-tab-content .ch-grid > .ui-col';
  const before = await page.evaluate((sel) => {
    const all = [...document.querySelectorAll<HTMLElement>(sel)];
    all.forEach((c) => (c.scrollTop = 60));
    return all.map((c) => c.scrollTop);
  }, cols);
  expect(before.some((t) => t > 0), 'a column must scroll at this height').toBe(true);
  await add.evaluate((b: HTMLElement) => b.click());
  const after = await page.evaluate((sel) => [...document.querySelectorAll<HTMLElement>(sel)].map((c) => c.scrollTop), cols);
  expect(after).toEqual(before);
});

// The open map (M) redraws when the window changes size: its backing store was set once
// per floor shown, so the floor stayed squashed until reopened (tracker 0.22).
test('the open map redraws to fit when the window is resized', async ({ page }) => {
  await embarkNewHero(page);
  await page.keyboard.press('KeyM');
  const canvas = page.locator('#map-viewer-canvas');
  await expect(canvas).toBeVisible();
  const fit = () =>
    canvas.evaluate((c: HTMLCanvasElement) => {
      const dpr = window.devicePixelRatio || 1;
      return { backing: [c.width, c.height], css: [Math.floor(c.clientWidth * dpr), Math.floor(c.clientHeight * dpr)] };
    });
  await page.setViewportSize({ width: 1280, height: 560 });
  await expect.poll(async () => {
    const f = await fit();
    return f.backing.join('x') === f.css.join('x');
  }).toBe(true);
});

// The map (M) fills most of the window: it was a 760 px dialog with a 420 px canvas, 10 px a
// tile on every screen from 1920 up (N4, tracker 4.3).
test('the map fills most of the window, and its tiles grow with it', async ({ page }) => {
  await embarkNewHero(page);
  await page.keyboard.press('KeyM');
  const canvas = page.locator('#map-viewer-canvas');
  await expect(canvas).toBeVisible();
  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(async () => (await canvas.boundingBox())?.width ?? 0, `canvas width at ${width}x${height}`).toBeGreaterThan(width * 0.85);
    const b = (await canvas.boundingBox())!;
    expect(b.height, `canvas height at ${width}x${height}`).toBeGreaterThan(height * 0.55);
  }
});

// Aiming follows the mouse and a click fires (N23, tracker 4.4); with the setting off the
// mouse leaves the reticle alone, as before.
test('while aiming, the reticle follows the mouse and a click fires the spell', async ({ page }) => {
  await embarkNewHero(page);
  const setup = await page.evaluate(async () => {
    const e = window.__cotwEngine!;
    const d = e.diagnostics;
    d.toggleGodMode();
    d.jumpToFloor(2);
    await new Promise((r) => setTimeout(r, 300));
    e.updateFov();
    d.killVisibleMonsters();
    const p = e.player;
    for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, 2], [2, -2], [-2, -2], [2, 0], [0, 2], [-2, 0], [0, -2]]) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (e.map.isPassable(x, y) && !e.map.getEntityAt(x, y) && e.fov.isVisible(x, y)) {
        const m = d.spawnMonster('kobold', { position: { x, y }, aiState: 'idle' });
        if (m) {
          e.updateFov();
          window.__cotwRenderer!.render();
          return { hero: [p.x, p.y], monster: [x, y] };
        }
      }
    }
    return null;
  });
  expect(setup, 'a kobold in sight').not.toBeNull();
  const tileCenter = (x: number, y: number) =>
    page.evaluate(({ x, y }) => {
      const r = window.__cotwRenderer as any;
      const s = r.camera.worldToScreen(x, y, r.cellSize, r.offsetX, r.offsetY);
      return r.viewport.virtualToClient(s.x + r.cellSize / 2, s.y + r.cellSize / 2) as { x: number; y: number };
    }, { x, y });
  const aim = () =>
    page.evaluate(() => {
      const t = window.__cotwRenderer!.targetingOverlay;
      const e = window.__cotwEngine!;
      return { open: t.isOpen, reticle: [t.reticleX, t.reticleY], turn: e.turnCount, stack: window.__cotwInputHandler!.modalStack.getStackIds() };
    });

  // Keyboard-first players can turn it off: the mouse then moves nothing.
  await page.evaluate(() => (window.__cotwRenderer as any).mouseAimEnabled = false);
  await page.keyboard.press('Digit1');
  await expect.poll(async () => (await aim()).open).toBe(true);
  const start = (await aim()).reticle;
  const [hx, hy] = setup!.hero;
  const beside = await tileCenter(hx, hy + 1);
  await page.mouse.move(beside.x, beside.y);
  expect((await aim()).reticle).toEqual(start);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await aim()).open).toBe(false);

  await page.evaluate(() => (window.__cotwRenderer as any).mouseAimEnabled = true);
  await page.keyboard.press('Digit1');
  await expect.poll(async () => (await aim()).open).toBe(true);
  await page.mouse.move(beside.x, beside.y);
  await expect.poll(async () => (await aim()).reticle).toEqual([hx, hy + 1]);
  const [mx, my] = setup!.monster;
  const onMonster = await tileCenter(mx, my);
  await page.mouse.move(onMonster.x, onMonster.y);
  await expect.poll(async () => (await aim()).reticle).toEqual([mx, my]);
  const turn = (await aim()).turn;
  await page.mouse.click(onMonster.x, onMonster.y);
  await expect.poll(async () => (await aim()).open).toBe(false);
  const after = await aim();
  expect(after.turn).toBeGreaterThan(turn);
  expect(after.stack).not.toContain('targeting');
  // Once its projectile has played, the next key acts again.
  await expect.poll(() => page.evaluate(() => window.__cotwInputHandler!.isInputLocked)).toBe(false);
  const before = await state(page);
  await page.keyboard.press('Space');
  await expect
    .poll(async () => {
      const s = await state(page);
      return s.turn > before.turn ? 'acted' : JSON.stringify({ ...s, stack: await stackIds(page), focus: await page.evaluate(() => document.activeElement?.id) });
    })
    .toBe('acted');
});

// UI scale (N8, tracker 4.5): Auto grows the bars, sidebar and dialogs with a large window,
// the map still fits beside and between them, and Settings can fix the size.
test('the interface grows with a large window, and Settings can fix its size', async ({ page }) => {
  // How much bigger an element draws than it lays out.
  const zoomOf = (sel: string) =>
    page.locator(sel).first().evaluate((el: HTMLElement) => {
      const root = (el.closest('.ui-dialog') as HTMLElement | null) ?? el;
      return Math.round((root.getBoundingClientRect().width / root.offsetWidth) * 100) / 100;
    });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await embarkNewHero(page);
  expect(await zoomOf('#game-header-bar')).toBe(1.25);
  expect(await zoomOf('#combat-sidebar')).toBe(1.25);
  const fits = await page.evaluate(() =>
    ['game-canvas', 'game-header-bar', 'gothic-action-console', 'game-full-width-log', 'combat-sidebar'].every((id) => {
      const r = document.getElementById(id)!.getBoundingClientRect();
      return r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
    })
  );
  expect(fits, 'every bar and the map inside the window').toBe(true);

  await page.setViewportSize({ width: 1280, height: 720 });
  await expect.poll(() => zoomOf('#game-header-bar')).toBe(1);

  // The title screen's Settings: a fixed 150% holds at any window.
  await page.goto(pathToFileURL(BUNDLE).href);
  await page.locator('#btn-menu-settings').click();
  await page.locator('#sel-ui-scale').selectOption('1.5');
  await expect.poll(() => zoomOf('#sel-ui-scale')).toBe(1.5);
  await page.locator('#sel-ui-scale').selectOption('auto');
  await expect.poll(() => zoomOf('#sel-ui-scale')).toBe(1);
});

// The sidebar's "here" line shows all of a long prompt: on the stairs it was cut off at
// "…to a" with no ellipsis (tracker 0.23).
test("the sidebar's ground line shows the whole stairs prompt", async ({ page }) => {
  await embarkNewHero(page);
  await page.evaluate(async () => {
    const e = window.__cotwEngine!;
    e.diagnostics.jumpToFloor(2);
    await new Promise((r) => setTimeout(r, 300));
    e.diagnostics.teleportToStairs('up');
  });
  await page.keyboard.press('Space');
  const here = page.locator('#combat-sidebar .sb-here');
  await expect(here).toContainText('to ascend');
  const fits = await here.evaluate((el) =>
    [el, ...el.querySelectorAll('*')].every((n) => n.scrollWidth <= Math.ceil(n.getBoundingClientRect().width) + 1)
  );
  expect(fits).toBe(true);
});

// Auto-pickup (tracker 2.5): stepping onto a scroll picks it up by default, a potion marked
// junk stays on the ground.
test('stepping onto a scroll picks it up, and junk stays where it lies', async ({ page }) => {
  await embarkNewHero(page);
  const placed = await page.evaluate(() => {
    const e = window.__cotwEngine!;
    const pack = e.player.inventory.primaryPack;
    const scroll = pack.getItems().find((i) => i.constructor.name === 'ScrollItem');
    const potion = pack.getItems().find((i) => i.constructor.name === 'PotionItem');
    if (!scroll || !potion) return null;
    pack.removeItem(scroll.id);
    pack.removeItem(potion.id);
    potion.junk = true;
    e.map.addItemAt(e.player.x + 1, e.player.y, scroll);
    e.map.addItemAt(e.player.x + 1, e.player.y, potion);
    return { scroll: scroll.id, potion: potion.id, x: e.player.x + 1, y: e.player.y };
  });
  expect(placed).not.toBeNull();
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => page.evaluate((id) => !!window.__cotwEngine!.player.inventory.findItemById(id), placed!.scroll))
    .toBe(true);
  const ground = await page.evaluate(({ x, y }) => window.__cotwEngine!.map.getItemsAt(x, y).map((i) => i.id), placed!);
  expect(ground).toEqual([placed!.potion]);
});

// Save & quit and choices take keys only through the modal stack, as one entry each: a
// second window listener delivered every key twice, and the choice's stack entry let
// Escape dismiss a choice that cannot be cancelled.
test('save & quit and choices take each key once, through one modal-stack entry', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await embarkNewHero(page);
  const start = await state(page);

  // Save & quit: gameplay keys are held back, one Escape closes it.
  await page.keyboard.press('Escape');
  await expect(page.locator('#save-quit-modal')).toBeVisible();
  expect(await stackIds(page)).toEqual(['save-quit']);
  await page.keyboard.press('ArrowRight');
  expect(await state(page)).toMatchObject({ turn: start.turn, x: start.x });
  await page.keyboard.press('Escape');
  await expect(page.locator('#save-quit-modal')).toBeHidden();
  expect(await stackIds(page)).toEqual([]);

  // Offer the pack's own choices the way movement does, recording what the modal reports.
  const offer = (choiceId: string) =>
    page.evaluate((id) => {
      const w = window as unknown as { __picked: string[]; __cancelled: number };
      w.__picked = [];
      w.__cancelled = 0;
      const engine = window.__cotwEngine!;
      engine.onChoiceInteract!(
        engine.manifest!.choices![id],
        (optionId) => w.__picked.push(optionId),
        () => (w.__cancelled += 1)
      );
    }, choiceId);
  const outcome = () =>
    page.evaluate(() => {
      const w = window as unknown as { __picked: string[]; __cancelled: number };
      return { picked: w.__picked, cancelled: w.__cancelled };
    });
  const choiceOverlay = page.locator('#choice-modal-overlay');

  // The Oath climax cannot be cancelled: Escape leaves it open. Number keys never pick
  // (number-pad movement must not choose by accident); arrows highlight, Enter picks once.
  await offer('oath_hearth');
  await expect(choiceOverlay).toBeVisible();
  expect(await stackIds(page)).toEqual(['choice']);
  await page.waitForTimeout(250); // past the modal's open debounce
  await page.keyboard.press('Escape');
  await expect(choiceOverlay).toBeVisible();
  expect(await stackIds(page)).toEqual(['choice']);
  await page.keyboard.press('Digit2');
  await page.keyboard.press('Enter'); // nothing highlighted yet
  await expect(choiceOverlay).toBeVisible();
  expect(await outcome()).toEqual({ picked: [], cancelled: 0 });
  await page.keyboard.press('ArrowDown');
  // A highlight redraws the frame in place: the entrance fade, long finished, doesn't
  // replay (it blanked the window on every highlight, N9).
  expect(await runningAnimations(page, '#choice-modal-overlay')).toEqual([]);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(choiceOverlay).toBeHidden();
  expect(await outcome()).toEqual({ picked: ['break'], cancelled: 0 });
  expect(await stackIds(page)).toEqual([]);

  // A cancelable choice: Escape cancels it once, through the pack's onCancel.
  await offer('altar_tyr');
  await expect(choiceOverlay).toBeVisible();
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await expect(choiceOverlay).toBeHidden();
  expect(await outcome()).toEqual({ picked: [], cancelled: 1 });
  expect(await stackIds(page)).toEqual([]);

  expect(await state(page)).toMatchObject({ turn: start.turn, x: start.x, y: start.y });
  expect(pageErrors).toEqual([]);
});

// The soak's chaos runs found keyboard focus left on a HUD button behind an open dialog, and
// Tab walking out of the dialog onto the HUD (ARCHITECTURE.md §6, the modal stack).
test('an open dialog holds keyboard focus, keeps Tab inside, and gives focus back on close', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await embarkNewHero(page);

  /** Where focus is: inside `selector`, on body, or the focused element's id or tag. */
  const focus = (selector: string) =>
    page.evaluate((sel) => {
      const active = document.activeElement;
      if (!active || active === document.body) return 'body';
      if (document.querySelector(sel)?.contains(active)) return 'inside';
      return active.id || active.tagName;
    }, selector);
  const tabTen = async (selector: string) => {
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab');
      expect(await focus(selector), `Tab ${i + 1}`).toBe('inside');
    }
  };

  // The Bestiary button keeps focus after the click that opens the character menu.
  await page.locator('#btn-compendium').click();
  await expect(page.locator('#character-menu-modal')).toBeVisible();
  await expect.poll(() => focus('#character-menu-modal')).toBe('inside');
  await tabTen('#character-menu-modal');
  // Escape backs out of whatever the tabbing selected before it closes the menu.
  for (let i = 0; i < 4 && (await page.locator('#character-menu-modal').isVisible()); i++) await page.keyboard.press('Escape');
  await expect(page.locator('#character-menu-modal')).toBeHidden();
  expect(await stackIds(page)).toEqual([]);
  // Back on the button that opened it, or on the page in WebKit, which doesn't focus a
  // clicked button; never left on the hidden menu.
  expect(['btn-compendium', 'body']).toContain(await focus('#character-menu-modal'));

  // The potion picker opens inside the potion row, beside the slot buttons Tab used to reach.
  await page.locator('.potion-slot').first().click({ button: 'right' });
  await expect(page.locator('.potion-picker')).toBeVisible();
  await expect.poll(() => focus('.potion-picker')).toBe('inside');
  await tabTen('.potion-picker');
  await page.keyboard.press('Escape');
  await expect(page.locator('.potion-picker')).toHaveCount(0);

  // The developer diagnostics: pushed before they draw.
  await page.keyboard.press('F2');
  await expect(page.locator('#diagnostic-modal')).toBeVisible();
  await expect.poll(() => focus('#diagnostic-modal')).toBe('inside');
  await tabTen('#diagnostic-modal');
  await page.keyboard.press('F2');
  await expect(page.locator('#diagnostic-modal')).toBeHidden();

  // A choice the pack offers mid-move.
  await page.evaluate(() => {
    const engine = window.__cotwEngine!;
    engine.onChoiceInteract!(engine.manifest!.choices!['altar_tyr'], () => undefined, () => undefined);
  });
  await expect(page.locator('#choice-modal-overlay')).toBeVisible();
  await expect.poll(() => focus('#choice-modal-overlay')).toBe('inside');
  await tabTen('#choice-modal-overlay');
  await page.waitForTimeout(250); // past the choice's open debounce
  await page.keyboard.press('Escape');
  await expect(page.locator('#choice-modal-overlay')).toBeHidden();

  expect(await stackIds(page)).toEqual([]);
  expect(pageErrors).toEqual([]);
});

// Save & quit's Settings, Help, and Save Code buttons open windows that must each take the
// one modal-stack entry save & quit gives up; with none, the game took their keys.
test('windows opened from save & quit each hold one stack entry and keep keys from the game', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await embarkNewHero(page);
  const start = await state(page);
  const heldBack = async () => {
    await page.keyboard.press('ArrowRight');
    expect(await state(page)).toMatchObject({ turn: start.turn, x: start.x });
  };

  // Settings, including a rebind to a key InputHandler would otherwise claim (F2 toggles
  // diagnostics), pressed right after the keybind list re-renders.
  const settings = page.locator('#settings-keybind-modal');
  await page.keyboard.press('Escape');
  await page.locator('#btn-savequit-settings').click();
  await expect(settings).toBeVisible();
  expect(await stackIds(page)).toEqual(['settings']);
  await heldBack();
  await settings.locator('#settings-keybind-list button').first().click();
  await expect(page.locator('#settings-status')).toContainText('Press a key for');
  // F2 opens Diagnostics before the game reads bindings: Settings refuses it, and it
  // doesn't leak to the game either. Then V, which the game would also claim, binds.
  await page.keyboard.press('F2');
  await expect(page.locator('#settings-status')).toContainText('F2 opens Diagnostics');
  expect(await stackIds(page)).toEqual(['settings']);
  await page.keyboard.press('KeyV');
  await expect(page.locator('#settings-status')).toContainText('Moved V from "Open Radial Action Menu" to "Move North"');
  expect(await stackIds(page)).toEqual(['settings']);
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  expect(await stackIds(page)).toEqual([]);

  // Help: the F1 help card, as on every other path to it.
  const helpCard = page.locator('#context-help-overlay');
  await page.keyboard.press('Escape');
  await page.locator('#btn-savequit-help').click();
  await expect(helpCard).toBeVisible();
  expect(await stackIds(page)).toEqual(['context_help']);
  await heldBack();
  await page.keyboard.press('Escape');
  await expect(helpCard).toBeHidden();
  expect(await stackIds(page)).toEqual([]);

  // Save code.
  const saveCode = page.locator('#save-code-modal');
  await page.keyboard.press('Escape');
  await page.locator('#btn-savequit-copy-code').click();
  await expect(saveCode).toBeVisible();
  expect(await stackIds(page)).toEqual(['save-code']);
  await heldBack();
  await page.keyboard.press('Escape');
  await expect(saveCode).toBeHidden();
  expect(await stackIds(page)).toEqual([]);

  expect(pageErrors).toEqual([]);
});

// A save from another pack dropped onto the game in play asks first; until it is
// answered, the warning holds the keyboard, so the hero doesn't move behind it.
test('the other-pack save warning holds the keys until answered', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await embarkNewHero(page);
  const start = await state(page);

  const migrator = readFileSync(resolve(process.cwd(), 'src', 'engine', 'storage', 'migrator.ts'), 'utf8');
  const schemaVersion = Number(/CURRENT_SCHEMA_VERSION = (\d+)/.exec(migrator)![1]);
  const save = JSON.stringify({
    schemaVersion,
    contentManifestId: 'other_pack',
    timestamp: 0,
    data: { profile: { id: 'stranger', name: 'Stranger' }, player: {}, map: {} },
  });
  await page.evaluate((content) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([content], 'stranger.json', { type: 'application/json' }));
    document.getElementById('game-container')!.dispatchEvent(
      new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true })
    );
  }, save);

  const warning = page.locator('#manifest-mismatch-modal');
  await expect(warning).toBeVisible();
  expect(await stackIds(page)).toEqual(['manifest-mismatch']);
  await page.keyboard.press('ArrowRight');
  expect(await state(page)).toMatchObject({ turn: start.turn, x: start.x });

  // Escape cancels the import, as the Cancel button does, with no browser alert.
  const alerts: string[] = [];
  page.on('dialog', (d) => {
    alerts.push(d.message());
    void d.dismiss();
  });
  await page.keyboard.press('Escape');
  await expect(warning).toBeHidden();
  expect(await stackIds(page)).toEqual([]);
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await state(page)).x).toBe(start.x + 1);
  expect(alerts).toEqual([]);

  // The same warning from the save-code window joins the stack above it: Escape turns
  // down the import and leaves the save-code window open.
  const saveCode = page.locator('#save-code-modal');
  await page.keyboard.press('Escape');
  await page.locator('#btn-savequit-copy-code').click();
  await expect(saveCode).toBeVisible();
  await page.locator('#tab-savecode-paste').click();
  await page.locator('#savecode-paste-text').fill(Buffer.from(save).toString('base64'));
  await page.locator('#btn-savecode-restore-action').click();
  await expect(warning).toBeVisible();
  expect(await stackIds(page)).toEqual(['save-code', 'manifest-mismatch']);
  await page.keyboard.press('Escape');
  await expect(warning).toBeHidden();
  await expect(saveCode).toBeVisible();
  expect(await stackIds(page)).toEqual(['save-code']);
  await page.keyboard.press('Escape');
  await expect(saveCode).toBeHidden();
  expect(await stackIds(page)).toEqual([]);

  expect(pageErrors).toEqual([]);
});

// On the main menu InputHandler is disabled, so settings takes keys only through its own
// focus-holding overlay: rebinding by keyboard and Escape must work with no game running.
test('settings on the main menu rebinds and closes by keyboard', async ({ page }) => {
  expect(existsSync(BUNDLE), `${BUNDLE} is missing; run \`npm run build\` first`).toBe(true);
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.goto(pathToFileURL(BUNDLE).href);

  const settings = page.locator('#settings-keybind-modal');
  await page.locator('#btn-menu-settings').click();
  await expect(settings).toBeVisible();
  await settings.locator('#settings-keybind-list button').first().click();
  // G picks up, which the game answers before bindings: Settings refuses it, then takes ;.
  await page.keyboard.press('KeyG');
  await expect(page.locator('#settings-status')).toContainText('G picks up');
  await page.keyboard.press('Semicolon');
  await expect(page.locator('#settings-status')).toContainText('Bound ; to "Move North"');
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();

  expect(pageErrors).toEqual([]);
});

// No game runs on the menus, so the hall of fame and the saga exchange take their own
// keys: Escape closes the saga exchange over the hall, then the hall.
test('the hall of fame and the saga exchange close on Escape from the menu', async ({ page }) => {
  expect(existsSync(BUNDLE), `${BUNDLE} is missing; run \`npm run build\` first`).toBe(true);
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.goto(pathToFileURL(BUNDLE).href);

  const hall = page.locator('#valhalla-modal');
  const saga = page.locator('#saga-share-modal');
  await page.locator('#btn-menu-valhalla').click();
  await expect(hall).toBeVisible();
  await page.locator('#btn-valhalla-import').click();
  await expect(saga).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(saga).toBeHidden();
  await expect(hall).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(hall).toBeHidden();

  expect(pageErrors).toEqual([]);
});

// Load a saved game opens from the main menu, with InputHandler off: it takes its own keys,
// and deleting a save asks in the dialog frame, never with the browser's confirm().
test('load a saved game closes on Escape, and its delete asks in the dialog frame', async ({ page }) => {
  const pageErrors: string[] = [];
  const alerts: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('dialog', (d) => {
    alerts.push(d.message());
    void d.dismiss();
  });
  await embarkNewHero(page);
  await page.keyboard.press('Escape');
  await page.locator('#btn-savequit-save-exit').click();

  const slots = page.locator('#save-slot-modal');
  const confirmBox = page.locator('#confirm-dialog');
  await page.locator('#btn-menu-load').click();
  await expect(slots).toBeVisible();
  await expect(slots.locator('.btn-delete-profile')).toHaveCount(1);

  // Escape on the question keeps the save and leaves the list open.
  await slots.locator('.btn-delete-profile').click();
  await expect(confirmBox).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirmBox).toBeHidden();
  await expect(slots).toBeVisible();
  await expect(slots.locator('.btn-delete-profile')).toHaveCount(1);

  // Escape closes the list, back to the main menu.
  await page.keyboard.press('Escape');
  await expect(slots).toBeHidden();
  await expect(page.locator('#btn-menu-load')).toBeVisible();

  // Confirming deletes the save, and the list still closes on Escape after its redraw.
  await page.locator('#btn-menu-load').click();
  await slots.locator('.btn-delete-profile').click();
  await confirmBox.locator('#btn-confirm-ok').click();
  await expect(confirmBox).toBeHidden();
  await expect(slots.locator('.btn-delete-profile')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(slots).toBeHidden();

  expect(alerts).toEqual([]);
  expect(pageErrors).toEqual([]);
});

// The log's history (tracker 1.2, Q31): Shift+M or the strip's label opens every line the
// game holds, reading it takes no turn, and the key or Escape closes it.
test("the log's history opens by key or label and spends no turn", async ({ page }) => {
  await embarkNewHero(page);
  await page.keyboard.press('ArrowRight');
  const before = await state(page);
  // One row per line, a line repeated in a row counted once (×N).
  const held = await page.evaluate(() => window.__cotwEngine!.messages.filter((m, i, all) => m !== all[i - 1]).length);

  await page.keyboard.press('Shift+KeyM');
  await expect(page.locator('#message-log-history')).toBeVisible();
  expect(await stackIds(page)).toEqual(['message-log']);
  await expect(page.locator('#message-log-history .log-line')).toHaveCount(held);
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowLeft');
  expect(await state(page)).toMatchObject({ turn: before.turn, x: before.x });
  await page.keyboard.press('Shift+KeyM');
  await expect(page.locator('#message-log-history')).toBeHidden();
  expect(await stackIds(page)).toEqual([]);

  await page.locator('#btn-log-history').click();
  await expect(page.locator('#message-log-history')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#message-log-history')).toBeHidden();
  expect(await stackIds(page)).toEqual([]);
});

// Every way into the help card and the diagnostics registers it on the modal stack and
// every way out takes it off (§6): the HUD Help and Dev buttons, the card's X.
test('the HUD Help and Dev buttons and the help card X keep the modal stack honest', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await embarkNewHero(page);
  const start = await state(page);
  const helpCard = page.locator('#context-help-overlay');

  // The HUD Help button: on the stack, Escape closes it, no Save & Quit behind.
  await page.locator('#btn-help-card').click();
  await expect(helpCard).toBeVisible();
  expect(await stackIds(page)).toEqual(['context_help']);
  await page.keyboard.press('ArrowRight');
  expect(await state(page)).toMatchObject({ turn: start.turn, x: start.x });
  await page.keyboard.press('Escape');
  await expect(helpCard).toBeHidden();
  expect(await stackIds(page)).toEqual([]);
  await expect(page.locator('#save-quit-modal')).toBeHidden();

  // F1, then the card's own X: the entry goes with it, so the world isn't left paused.
  await page.keyboard.press('F1');
  await expect(helpCard).toBeVisible();
  await page.locator('#btn-context-help-close').click();
  await expect(helpCard).toBeHidden();
  expect(await stackIds(page)).toEqual([]);
  expect(await page.evaluate(() => window.__cotwEngine!.isPaused)).toBe(false);

  // The HUD Dev button: on the stack, so a movement key stays in the dialog.
  await page.locator('#btn-dev-diagnostics').click();
  await expect(page.locator('#diagnostic-modal')).toBeVisible();
  expect(await stackIds(page)).toEqual(['diagnostic-modal']);
  await page.keyboard.press('ArrowRight');
  expect(await state(page)).toMatchObject({ turn: start.turn, x: start.x });
  await page.keyboard.press('Escape');
  await expect(page.locator('#diagnostic-modal')).toBeHidden();
  expect(await stackIds(page)).toEqual([]);

  expect(pageErrors).toEqual([]);
});

// A click-to-travel ends as a key press does: auto-pickup takes the coins at the end of the
// walk without another key (R-main-1). And a HUD action button takes no turn while a dialog
// that leaves the HUD clickable (the F1 card) has paused the world (R-ui-3).
test('a click-to-travel auto-picks up where it ends; HUD Wait does nothing under the help card', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await embarkNewHero(page);

  const target = await page.evaluate(() => {
    const e = window.__cotwEngine!;
    const p = e.player;
    const purse = p.inventory.purse;
    const coins = purse?.getItems()[0];
    if (!purse || !coins) return null;
    for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
      const x = p.x + dx, y = p.y + dy;
      const clear = [1, 2, 3].every((k) => {
        const tx = p.x + (dx / 3) * k, ty = p.y + (dy / 3) * k;
        return e.map.isPassable(tx, ty) && !e.map.getEntityAt(tx, ty) && e.map.getItemsAt(tx, ty).length === 0 && e.fov.isVisible(tx, ty);
      });
      if (!clear) continue;
      purse.removeItem(coins.id);
      e.map.addItemAt(x, y, coins);
      window.__cotwRenderer!.render();
      return { x, y, id: coins.id };
    }
    return null;
  });
  expect(target, 'a clear tile three steps away, and coins to put there').not.toBeNull();
  const center = await page.evaluate(({ x, y }) => {
    const r = window.__cotwRenderer as any;
    const s = r.camera.worldToScreen(x, y, r.cellSize, r.offsetX, r.offsetY);
    return r.viewport.virtualToClient(s.x + r.cellSize / 2, s.y + r.cellSize / 2) as { x: number; y: number };
  }, target!);
  await page.mouse.click(center.x, center.y);
  await expect.poll(async () => { const s = await state(page); return [s.x, s.y]; }).toEqual([target!.x, target!.y]);
  await expect
    .poll(() => page.evaluate(({ x, y }) => window.__cotwEngine!.map.getItemsAt(x, y).length, target!))
    .toBe(0);

  // HUD Wait under the F1 card: no turn.
  await page.keyboard.press('F1');
  await expect(page.locator('#context-help-overlay')).toBeVisible();
  const turn = (await state(page)).turn;
  await page.locator('#btn-hud-wait').click();
  await page.waitForTimeout(150);
  expect((await state(page)).turn).toBe(turn);
  await page.keyboard.press('Escape');

  expect(pageErrors).toEqual([]);
});

// Closing the aim any way but its own keys (here the HUD Look and Map buttons) takes its
// stack entry with it, so the world isn't left paused behind a dead entry (R-rend-7).
test('closing the aim with the HUD Look or Map button leaves no targeting entry behind', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await embarkNewHero(page);
  const aiming = () => page.evaluate(() => window.__cotwRenderer!.targetingOverlay.isOpen);

  for (const button of ['#btn-hud-look', '#btn-map']) {
    await page.keyboard.press('Digit1');
    await expect.poll(aiming).toBe(true);
    expect(await stackIds(page)).toContain('targeting');
    await page.locator(button).click();
    await expect.poll(aiming).toBe(false);
    expect(await stackIds(page)).not.toContain('targeting');
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      window.__cotwRenderer!.inspectOverlay.close();
      window.__cotwRenderer!.mapOverlay.close();
      window.__cotwInputHandler!.modalStack.closeAll();
    });
  }
  expect(await page.evaluate(() => window.__cotwEngine!.isPaused)).toBe(false);
  expect(pageErrors).toEqual([]);
});

// Pointing at a monster shows its card with the default settings (mouse vectoring off):
// the hover alone redraws the map (R-rend-6).
test('hovering a monster with the mouse shows its target card', async ({ page }) => {
  await embarkNewHero(page);
  const at = await page.evaluate(async () => {
    const e = window.__cotwEngine!;
    const d = e.diagnostics;
    d.toggleGodMode();
    d.jumpToFloor(2);
    await new Promise((r) => setTimeout(r, 300));
    e.updateFov();
    d.killVisibleMonsters();
    const p = e.player;
    for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, 2], [2, -2], [-2, -2], [2, 0], [0, 2], [-2, 0], [0, -2]]) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (e.map.isPassable(x, y) && !e.map.getEntityAt(x, y) && e.fov.isVisible(x, y)) {
        if (d.spawnMonster('kobold', { position: { x, y }, aiState: 'idle' })) {
          e.updateFov();
          window.__cotwRenderer!.render();
          const r = window.__cotwRenderer as any;
          const s = r.camera.worldToScreen(x, y, r.cellSize, r.offsetX, r.offsetY);
          return r.viewport.virtualToClient(s.x + r.cellSize / 2, s.y + r.cellSize / 2) as { x: number; y: number };
        }
      }
    }
    return null;
  });
  expect(at, 'a kobold in sight').not.toBeNull();
  expect(await page.evaluate(() => (window.__cotwRenderer as any).mouseVectoringEnabled)).toBe(false);
  await expect(page.locator('.mc-target')).toHaveCount(0);
  await page.mouse.move(at!.x, at!.y);
  await expect(page.locator('.mc-target')).toBeVisible();
});

// A dialog that holds no focus of its own names its root, so Tab moves through its
// buttons instead of being trapped on the HUD behind it (R-ui-4).
test('Tab moves within the menu and the save-code window', async ({ page }) => {
  await embarkNewHero(page);
  const focusIn = (id: string) => page.evaluate((root) => Boolean(document.getElementById(root)?.contains(document.activeElement)), id);

  await page.keyboard.press('Escape');
  await expect(page.locator('#save-quit-modal')).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await focusIn('save-quit-modal')).toBe(true);
  await page.keyboard.press('Tab');
  expect(await focusIn('save-quit-modal')).toBe(true);

  await page.locator('#btn-savequit-copy-code').click();
  await expect(page.locator('#save-code-modal')).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await focusIn('save-code-modal')).toBe(true);
});

// The palette's Stairs says why it can't, as the keys do (R-main-14).
test('the palette stairs command off the stairs says there are none', async ({ page }) => {
  await embarkNewHero(page);
  await page.keyboard.press('Control+KeyK');
  await expect(page.locator('#cmd-palette-input')).toBeVisible();
  await page.locator('#cmd-palette-input').fill('stairs');
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(() => window.__cotwEngine!.messages.slice(-3).join(' | ')))
    .toContain('There are no stairs here to climb.');
});
