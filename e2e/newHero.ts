import { expect, type Page } from '@playwright/test';

/**
 * A new hero opens on the controls note and then the pack's night raid (the prologue).
 * Specs about what comes after call this right after Embark: it begins from the note,
 * as a player would, then ends the raid from the F2 triage API, as they set every other
 * scene (prologue.spec.ts plays the raid itself), and stands the hero where a hero who
 * starts without one does: the town's own spawn.
 */
export async function pastTheOpening(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => Boolean(window.__cotwEngine?.player))).toBe(true);
  await page.locator('#controls-primer-begin').click();
  await page.evaluate(() => {
    const e = window.__cotwEngine!;
    e.diagnostics.endPrologue();
    const spawn = e.manifest.town?.playerSpawn;
    if (spawn) e.map.moveEntity(e.player, spawn.x, spawn.y);
    e.updateFov();
    window.__cotwRenderer?.render();
  });
}
