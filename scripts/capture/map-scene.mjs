// Map rendering check: builds one fixed scene (terrain kinds, every surface and gas,
// loot piles, a portal and an altar) on three cotw floors, freezes the clock, and
// screenshots the map canvas. Run before and after a change and compare with diff.mjs.
// Needs the dev server (it imports /src/engine/index.ts), so URL=dist doesn't work here.
// Usage: [URL=…] [OUT=…] node scripts/capture/map-scene.mjs
import { chromium } from 'playwright';
import { pinCreationClock, startRun, GAME_URL as URL, outDir } from './play.mjs';

const OUT = outDir('map-scene');

async function buildScene(page, floor, { noTerrain = false } = {}) {
  return page.evaluate(async ({ floor, noTerrain }) => {
    const eng = await import('/src/engine/index.ts');
    const e = window.__cotwEngine;
    const r = window.__cotwRenderer;
    const w = (ms) => new Promise((res) => setTimeout(res, ms));
    if (!e.player.isInvulnerable) e.diagnostics.toggleGodMode();
    e.diagnostics.jumpToFloor(floor);
    await w(400);
    const map = e.map;
    const T = eng.TILES;
    const PX = 25, PY = 15;
    // Clear the area: monsters, items, traps, surfaces.
    for (const ent of map.getAllEntities()) {
      if (ent !== e.player && ent.x >= 4 && ent.x <= 46 && ent.y >= 2 && ent.y <= 28) e.removeEntity(ent);
    }
    for (const g of map.getAllGroundItems()) {
      if (g.x >= 4 && g.x <= 46 && g.y >= 2 && g.y <= 28) for (const it of [...g.items]) map.removeItemAt(g.x, g.y, it.id);
    }
    for (const t of map.getAllTraps()) if (t.x >= 4 && t.x <= 46 && t.y >= 2 && t.y <= 28) map.removeTrapAt(t.x, t.y);
    e.surfaces.clear();
    // Walls, then a room.
    for (let y = 2; y <= 28; y++) for (let x = 4; x <= 46; x++) map.setTile(x, y, T.WALL);
    for (let y = 7; y <= 22; y++) for (let x = 11; x <= 38; x++) map.setTile(x, y, T.FLOOR);
    // Terrain kinds: a pool, a pit, bars, pillars.
    for (const [x, y] of [[13, 8], [14, 8], [13, 9], [14, 9], [15, 9]]) map.setTile(x, y, T.SHALLOW_WATER);
    for (const [x, y] of [[18, 8], [19, 8], [18, 9], [19, 9], [20, 9]]) map.setTile(x, y, T.CHASM);
    map.setTile(23, 8, T.IRON_BARS);
    map.setTile(24, 8, T.IRON_BARS);
    map.setTile(27, 9, T.PILLAR);
    map.setTile(31, 9, T.PILLAR);
    // A wall line with a closed door and an open door, and a secret door.
    for (let x = 11; x <= 38; x++) map.setTile(x, 20, T.WALL);
    map.setTile(18, 20, T.DOOR_CLOSED);
    map.setTile(22, 20, T.DOOR_OPEN);
    map.setTile(26, 20, T.SECRET_DOOR);
    // Every surface and gas, plus a type no pack draws.
    const surfaces = ['oil_slick', 'acid_pool', 'ice_sheet', 'water', 'mud', 'fire', 'brimstone'];
    surfaces.forEach((s, i) => e.surfaces.setSurface(13 + i * 2, 12, s, 50));
    const gases = ['fire_storm', 'poison_cloud', 'dense_steam', 'miasma'];
    gases.forEach((g, i) => e.surfaces.setGas(13 + i * 2, 16, g, 50));
    // A surface with a gas over it.
    e.surfaces.setSurface(22, 16, 'water', 50);
    e.surfaces.setGas(22, 16, 'dense_steam', 50);
    // Portal and altar fixtures.
    const tiles = e.manifest.tiles ?? [];
    const portal = tiles.find((t) => t.visual === 'portal');
    const altar = tiles.find((t) => t.visual === 'altar' && t.glyph);
    if (portal) map.setTile(33, 17, portal);
    if (altar) map.setTile(35, 17, altar);
    // Loot: a 3-item pile, a single item, a pile with a chest, a lone unopened chest, a 12-item pile.
    let n = 0;
    const item = (name) => new eng.Item({ id: `r18-${n++}`, definitionId: 'dagger', name, category: 'weapon', weight: 500, bulk: 500, identified: true });
    const chest = () => {
      const c = new eng.Container({ id: `r18-c${n++}`, name: 'Ironbound Chest', category: 'container', containerType: 'chest', weight: 8000, bulk: 12000, maxWeightCapacity: 50000, maxBulkCapacity: 35000 });
      c.addItem?.(item('Gem'));
      return c;
    };
    for (let i = 0; i < 3; i++) map.addItemAt(30, 13, item('Dagger'));
    map.addItemAt(32, 13, item('Dagger'));
    map.addItemAt(34, 13, item('Dagger'));
    map.addItemAt(34, 13, chest());
    map.addItemAt(36, 13, chest());
    for (let i = 0; i < 12; i++) map.addItemAt(36, 11, item('Dagger'));
    // The hero, and a fresh fog: explored from two corners, then seen from the hero.
    map.moveEntity(e.player, PX, PY);
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) e.fov.setVisibility(x, y, 0);
    e.fov.update(map, 14, 10, 9);
    e.fov.update(map, 35, 18, 9);
    e.fov.update(map, 30, 21, 6);
    e.fov.update(map, PX, PY, 8);
    if (noTerrain) {
      window.__r18Terrain = e.manifest.atlas.terrain;
      e.manifest.atlas.terrain = undefined;
    }
    // A fixed clock, so flicker and bubbles land on the same phase every run.
    if (!window.__r18Now) {
      window.__r18Now = Date.now;
      Date.now = () => 1_700_000_000_000;
    }
    r.render();
    return { portal: portal?.type, altar: altar?.type, zone: e.manifest.atlas.tileZoneBands?.find((b) => floor >= b.floor)?.zoneKey };
  }, { floor, noTerrain });
}

async function restoreTerrain(page) {
  await page.evaluate(() => {
    const e = window.__cotwEngine;
    if (window.__r18Terrain) e.manifest.atlas.terrain = window.__r18Terrain;
    window.__r18Terrain = undefined;
  });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
await pinCreationClock(page);
page.on('pageerror', (err) => console.log('pageerror', err.message));
await page.goto(URL);
await startRun(page);
await page.waitForFunction(() => !!window.__cotwEngine?.player);
await page.waitForTimeout(500);
const scenes = [
  ['f03-rime', 3, {}],
  ['f12-dwarven', 12, {}],
  ['f20-obsidian', 20, {}],
  ['f03-noterrain', 3, { noTerrain: true }],
];
for (const [name, floor, opts] of scenes) {
  const info = await buildScene(page, floor, opts);
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__cotwRenderer.render());
  await page.locator('#game-canvas').screenshot({ path: `${OUT}/${name}.png` });
  console.log(name, JSON.stringify(info));
  if (opts.noTerrain) await restoreTerrain(page);
}
await browser.close();
console.log('done');
