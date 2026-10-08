// The header bar of a fresh run in town, cropped to the element: a small image for checking
// a header change. For the whole in-game screen on a staged run, use menus.mjs <size> g00.
// Usage: [URL=…|dist] [OUT=…] node scripts/capture/hud.mjs [1440|1366|1920,…]
import { chromium } from 'playwright';
import { pinCreationClock, startRun, GAME_URL, outDir, SIZES } from './play.mjs';

const OUT = outDir('hud');
const browser = await chromium.launch();
for (const s of (process.argv[2] ?? '1366').split(',')) {
  const [width, height] = SIZES[s];
  const page = await browser.newPage({ viewport: { width, height } });
  await pinCreationClock(page);
  page.on('pageerror', (err) => console.log('pageerror', err.message));
  await page.goto(GAME_URL);
  await startRun(page);
  await page.locator('#game-header-bar').screenshot({ path: `${OUT}/header-${width}x${height}.png` });
  await page.close();
}
await browser.close();
console.log('done', OUT);
