import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BUNDLE = resolve(process.cwd(), 'dist', 'index.html');

// Replaces window.open with a counter, so a submit is observable without a popup.
const stubWindowOpen = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __opened: number };
    w.__opened = 0;
    window.open = () => {
      w.__opened += 1;
      return null;
    };
  });
const openedCount = (page: Page) => page.evaluate(() => (window as unknown as { __opened: number }).__opened);

const getEngineState = (page: Page) =>
  page.evaluate(() => {
    const e = window.__cotwEngine;
    if (!e) return null;
    return { turn: e.turnCount, x: e.player.x, y: e.player.y };
  });

test.describe('Developer Diagnostics & Feedback Systems', () => {
  test('main menu feedback, in-game header button, F3 shortcut, mode switching, and keyboard trap work cleanly over file://', async ({ page }) => {
    expect(existsSync(BUNDLE), `${BUNDLE} is missing; run \`npm run build\` first`).toBe(true);

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(pathToFileURL(BUNDLE).href);

    // 1. Verify main menu has "Send Feedback & Bug Report" button
    const menuFeedbackBtn = page.locator('#btn-menu-feedback');
    await expect(menuFeedbackBtn).toBeVisible();
    await menuFeedbackBtn.click();

    const feedbackModal = page.locator('#feedback-modal');
    await expect(feedbackModal).toBeVisible();

    // Verify mode switching
    const tabFeature = page.locator('#btn-feedback-tab-feature');
    const tabBug = page.locator('#btn-feedback-tab-bug');
    const telemetryPanel = page.locator('#feedback-telemetry-panel');

    await tabFeature.click();
    await expect(telemetryPanel).toBeHidden();

    await tabBug.click();
    await expect(telemetryPanel).toBeVisible();

    // Close via Escape
    await page.keyboard.press('Escape');
    await expect(feedbackModal).toBeHidden();

    // Ctrl+Enter submits exactly once on the main menu, where InputHandler is disabled
    await stubWindowOpen(page);
    await menuFeedbackBtn.click();
    await expect(feedbackModal).toBeVisible();
    await page.locator('#feedback-input-title').fill('Menu submit');
    await page.keyboard.press('Control+Enter');
    await expect(feedbackModal).toBeHidden();
    expect(await openedCount(page)).toBe(1);

    // 2. Start new game and embark
    await page.locator('#btn-menu-new-game').click();
    for (const attr of ['str', 'dex', 'con', 'int']) {
      for (let i = 0; i < 6; i++) await page.locator(`#btn-dec-${attr}`).click();
    }
    await page.locator('#btn-create-embark').click();
    await expect.poll(() => page.evaluate(() => Boolean(window.__cotwEngine))).toBe(true);

    // 3. Now in-game: verify header feedback button is visible and works
    const headerFeedbackBtn = page.locator('#btn-feedback');
    await expect(headerFeedbackBtn).toBeVisible();
    await headerFeedbackBtn.click();
    await expect(feedbackModal).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(feedbackModal).toBeHidden();

    const stateBefore = await getEngineState(page);
    expect(stateBefore).not.toBeNull();

    // 4. Open Feedback modal via F3 keybinding
    await page.keyboard.press('F3');
    await expect(feedbackModal).toBeVisible();

    // Verify typing letters (w, a, s, d, i, z) traps keys and does NOT advance engine turn or move player
    await page.locator('#feedback-textarea-desc').fill('Testing feedback typing with wasd keys');
    await page.keyboard.type(' wasd i z');

    const stateDuring = await getEngineState(page);
    expect(stateDuring?.turn).toBe(stateBefore?.turn);
    expect(stateDuring?.x).toBe(stateBefore?.x);
    expect(stateDuring?.y).toBe(stateBefore?.y);

    // Close via cancel button
    await page.locator('#btn-feedback-cancel').click();
    await expect(feedbackModal).toBeHidden();

    // In game, with focus on a button rather than a text field (InputHandler's stack routing
    // would see the key too), Ctrl+Enter still submits exactly once.
    await stubWindowOpen(page);
    await page.keyboard.press('F3');
    await expect(feedbackModal).toBeVisible();
    await page.locator('#btn-feedback-tab-bug').click();
    await page.keyboard.press('Control+Enter');
    await expect(feedbackModal).toBeHidden();
    expect(await openedCount(page)).toBe(1);

    // 5. Test Developer Diagnostics (F2) and Triage Tab hook
    await page.keyboard.press('F2');
    const diagModal = page.locator('#diagnostic-modal');
    await expect(diagModal).toBeVisible();

    // Switch to Tab 4 (Triage)
    const triageTabBtn = page.locator('#tab-btn-triage');
    await triageTabBtn.click();

    // Open Feedback from within Triage tab
    const triageFeedbackBtn = page.locator('#btn-diag-open-feedback');
    await expect(triageFeedbackBtn).toBeVisible();
    await triageFeedbackBtn.click();

    await expect(feedbackModal).toBeVisible();

    // Close feedback modal, then diagnostics
    await page.keyboard.press('Escape');
    await expect(feedbackModal).toBeHidden();

    await page.locator('#btn-diag-close').click();
    await expect(diagModal).toBeHidden();

    // Verify 0 uncaught page errors
    expect(pageErrors).toEqual([]);
  });
});
