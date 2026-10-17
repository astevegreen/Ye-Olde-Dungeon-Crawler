/**
 * The `test` and `expect` every spec imports. A test fails on a game error it would otherwise
 * pass over, in three forms:
 * - an uncaught exception (`pageerror`);
 * - a `console.error`, where the render-loop guard and a failed save report;
 * - an error the engine caught and played on past (ARCHITECTURE.md §4), which the player sees
 *   at most as a toast, read through `engine.diagnostics.recordedErrors()`.
 * A test that causes one on purpose calls `gameErrors.allow(/what it expects/)` first.
 */
import { test as base, expect, type Page } from '@playwright/test';

export interface GameErrors {
  /** Lets errors matching `pattern` through, for this test only. */
  allow(pattern: RegExp): void;
}

/**
 * Allowed in every test. WebKit's GPU process sometimes stalls a pixel readback past its timeout
 * (playwright.config.ts); the sprite atlas records it and keeps the pixels as drawn.
 */
const ALWAYS_ALLOWED: RegExp[] = [/The object is in an invalid state/];

async function engineErrors(page: Page): Promise<string[]> {
  const recorded = await page
    .evaluate(() => window.__cotwEngine?.diagnostics.recordedErrors() ?? null)
    .catch(() => null); // the page closed, or never reached the game
  if (!recorded || recorded.count === 0) return [];
  const listed = recorded.recent.slice(-recorded.count).map((summary) => `engine caught: ${summary}`);
  const unlisted = recorded.count - listed.length;
  return unlisted > 0 ? [...listed, `engine caught ${unlisted} more, no longer in its log`] : listed;
}

export const test = base.extend<{ gameErrors: GameErrors }>({
  gameErrors: [
    async ({ page }, use) => {
      const seen: string[] = [];
      const allowed = [...ALWAYS_ALLOWED];
      page.on('pageerror', (err) => seen.push(`uncaught: ${err.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error') seen.push(`console.error: ${msg.text()}`);
      });
      await use({ allow: (pattern) => allowed.push(pattern) });
      seen.push(...(await engineErrors(page)));
      const unexpected = seen.filter((error) => !allowed.some((pattern) => pattern.test(error)));
      expect(unexpected, 'game errors during the test (gameErrors.allow() lets an expected one through)').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
