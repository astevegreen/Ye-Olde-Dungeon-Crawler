// Visits every menu, tab and dialog in the running game and screenshots each at the
// reference sizes, with a few measurements per screen in measure.json. The filter is a
// regex over view names (g00 is the HUD on a staged floor-3 run; see TITLE and GAME).
// Usage: [URL=…] [OUT=…] node scripts/capture/menus.mjs [1440|1366|1920,…] [filter]
import { chromium } from 'playwright';
import { button, pinCreationClock, startRun, GAME_URL as URL, outDir, SIZES } from './play.mjs';
import fs from 'fs';

const OUT = outDir('menus');
const want = (process.argv[2] ?? '1440,1366').split(',').map((s) => SIZES[s]);
const filter = process.argv[3] ? new RegExp(process.argv[3]) : null;

const wait = (page, ms) => page.waitForTimeout(ms);
const key = async (page, k) => { await page.keyboard.press(k); await wait(page, 250); };

// Measurements over what's on screen: rendered text sizes, and the canvas's scale.
async function measure(page) {
  return page.evaluate(() => {
    const sizes = {};
    const colors = new Set();
    let n = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode;
      if (!t.textContent.trim()) continue;
      const el = t.parentElement;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      // Skip text hidden behind a blurred/dimmed backdrop: only count the topmost layer.
      const hit = document.elementFromPoint(Math.min(innerWidth - 1, r.left + 2), Math.min(innerHeight - 1, r.top + r.height / 2));
      if (hit && !el.contains(hit) && !hit.contains(el)) continue;
      const fs = parseFloat(cs.fontSize).toFixed(1);
      sizes[fs] = (sizes[fs] ?? 0) + 1;
      colors.add(cs.color);
      n++;
    }
    const canvas = document.querySelector('#game-canvas, canvas');
    const scale = canvas ? +(canvas.getBoundingClientRect().width / canvas.width).toFixed(3) : null;
    return { textNodes: n, sizes, textColors: colors.size, canvasScale: scale, canvasCss: canvas ? [Math.round(canvas.getBoundingClientRect().width), Math.round(canvas.getBoundingClientRect().height)] : null };
  });
}

async function resetGame(page) {
  await page.evaluate(async () => {
    const ih = window.__cotwInputHandler;
    const r = window.__cotwRenderer;
    for (let i = 0; i < 8 && ih && !ih.modalStack.isEmpty(); i++) {
      const top = ih.modalStack.top() ?? null;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
      await new Promise((res) => setTimeout(res, 80));
      if (top && ih.modalStack.top() === top) { try { top.close?.(); } catch {} ih.modalStack.remove(top.id); }
    }
    for (const o of ['inventoryOverlay', 'targetingOverlay', 'mapOverlay', 'inspectOverlay', 'shopOverlay']) if (r?.[o]?.isOpen) r[o].close();
    document.querySelectorAll('.crash-dialog, #crash-dialog').forEach((d) => d.remove());
    r?.render();
  });
  await wait(page, 150);
}

async function stageRun(page) {
  await page.evaluate(async () => {
    const e = window.__cotwEngine;
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const d = e.diagnostics;
    // A fixed seed, so the floor, the hero's spot and the level-up gains repeat run to run.
    e.prng.setState(1337);
    d.toggleGodMode();
    d.jumpToFloor(3);
    await w(300);
    const p = e.player;
    const W = e.map.width, H = e.map.height;
    const open = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (e.map.isPassable(x, y) && !e.map.getEntityAt(x, y)) open.push([x, y]);
    const visited = open.filter(([x]) => x < W * 0.62).filter((_, i, a) => i % Math.ceil(a.length / 12) === 0);
    for (const [x, y] of visited) e.fov.update(e.map, x, y, 8);
    // Stand on ground loot if any is known, so the inventory's Ground column has something.
    const ground = e.map.getAllGroundItems?.() ?? [];
    const spot = ground.find((g) => e.map.isPassable(g.x, g.y) && !e.map.getEntityAt(g.x, g.y));
    if (spot) p.setPosition(spot.x, spot.y);
    e.fov.update(e.map, p.x, p.y, 8);
    // A few kills for the bestiary and a couple of living monsters nearby.
    const free = (dx, dy) => e.map.isPassable(p.x + dx, p.y + dy) && !e.map.getEntityAt(p.x + dx, p.y + dy);
    for (const id of ['kobold', 'giant_rat', 'wolf', 'goblin']) {
      const s = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]].find(([dx, dy]) => free(dx, dy));
      if (s) d.spawnMonster(id, p.x + s[0], p.y + s[1]);
    }
    e.fov.update(e.map, p.x, p.y, 8);
    d.killVisibleMonsters?.();
    for (const id of ['ogre', 'kobold_shaman']) {
      const s = [[3, 0], [0, 3], [-3, 0], [2, 2]].find(([dx, dy]) => free(dx, dy));
      if (s) d.spawnMonster(id, p.x + s[0], p.y + s[1]);
    }
    e.fov.update(e.map, p.x, p.y, 8);
    d.identifyAll?.();
    try { e.worldState.flags.companion_bonded = true; e.summonCompanion('hearth_frost_hound'); } catch {}
    try { e.pacts.activatePact('pact_blood'); } catch {}
    p.voidDebt = 12;
    p.hasDiscoveredRune = true;
    p.gold = (p.gold ?? 0) + 1500;
    window.__cotwRenderer.render();
  });
  await wait(page, 300);
  // grantLevel only toasts now; reset anyway for the baseline.
  await page.evaluate(() => window.__cotwEngine.diagnostics.grantLevel());
  await wait(page, 300);
  await resetGame(page);
}

async function newGame(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(URL);
  await startRun(page);
  await page.waitForFunction(() => !!window.__cotwEngine?.player);
  await wait(page, 500);
}

const TITLE = [
  ['t01-main-menu', async () => {}],
  ['t02-new-game', async (pg) => { await button(pg, /New Game/i).click(); }],
  ['t03-load-saved', async (pg) => { await button(pg, /Load Saved|Load a saved/i).click(); }],
  ['t04-settings', async (pg) => { await button(pg, /Settings/i).click(); }],
  ['t05-help', async (pg) => { await button(pg, /^Help/i).click(); }],
  ['t06-feedback', async (pg) => { await button(pg, /Feedback/i).click(); }],
  ['t07-hall', async (pg) => { await pg.locator('#btn-menu-valhalla').click(); }],
];

const ev = (fn) => async (pg) => { await pg.evaluate(fn); await wait(pg, 350); };
const GAME = [
  ['g00-hud', async () => {}],
  ['g01-inventory', async (pg) => { await key(pg, 'i'); }],
  ['g01b-inventory-item', async (pg) => { await key(pg, 'i'); await key(pg, 'Tab'); await key(pg, 'ArrowDown'); }],
  ['g02-character', async (pg) => { await key(pg, 'e'); }],
  ['g03-spellbook-tab', ev(() => { const ih = window.__cotwInputHandler; ih.toggleCharacterMenu('spellbook'); })],
  ['g04-cast-z', async (pg) => { await key(pg, 'z'); }],
  ['g05-bestiary', async (pg) => { await key(pg, 'b'); }],
  ['g06-pacts', async (pg) => { await key(pg, 'p'); }],
  ['g07-story', ev(() => { window.__cotwInputHandler.toggleCharacterMenu('story'); })],
  ['g08-levelup', ev(() => { window.__cotwEngine.diagnostics.grantLevel(); window.__cotwInputHandler.toggleCharacterMenu('character'); })],
  ['g09-map', async (pg) => { await key(pg, 'm'); }],
  ['g09b-aim', async (pg) => { await key(pg, '1'); }],
  ['g10-look', async (pg) => { await key(pg, 'x'); await key(pg, 'ArrowRight'); }],
  ['g11-palette', async (pg) => { await key(pg, 'Control+k'); }],
  ['g12-help-f1', async (pg) => { await key(pg, 'F1'); }],
  ['g13-save-quit', async (pg) => { await key(pg, 'Escape'); }],
  ['g14-keybinds', async (pg) => { await key(pg, 'Escape'); await button(pg, /Settings|Keybind/i).first().click(); await wait(pg, 300); }],
  ['g15-save-code', async (pg) => { await key(pg, 'Escape'); await button(pg, /Save Code|Code/i).first().click(); await wait(pg, 300); }],
  ['g16-feedback-f3', async (pg) => { await key(pg, 'F3'); }],
  ['g17-diagnostics-f2', async (pg) => { await key(pg, 'F2'); }],
  ['g18-choice', ev(() => { const e = window.__cotwEngine; const c = e.manifest?.choices?.oath_hearth ?? Object.values(e.manifest?.choices ?? {})[0]; e.onChoiceInteract(c, () => {}, () => {}); })],
  ['g19-altar', ev(() => { const e = window.__cotwEngine; e.onGameEvent({ type: 'altar_reached', turn: e.turnCount, data: { altarId: 'galdr_altar_tyr', x: e.player.x, y: e.player.y } }); })],
  ['g20-rune-discovery', ev(() => { const e = window.__cotwEngine; e.onGameEvent({ type: 'rune_of_return_discovered', turn: e.turnCount, data: {} }); })],
  ['g21-rune-tree', ev(() => { window.dispatchEvent(new Event('open_rune_of_return_tree')); })],
  ['g22-mastery', ev(() => { const e = window.__cotwEngine; e.onGameEvent({ type: 'mastery_unlocked', turn: e.turnCount, scope: 'species', masteryId: 'wolf', name: 'Wolf', kills: 25, data: {} }); })],
];
const CRASH = ['g23-crash', ev(() => { setTimeout(() => { throw new Error('Audit: synthetic crash to show the dialog'); }, 0); })];

// Town services: one screenshot per NPC kind.
async function shopScenes(page, tag) {
  await resetGame(page);
  await page.evaluate(async () => { window.__cotwEngine.diagnostics.jumpToFloor(0); await new Promise((r) => setTimeout(r, 400)); window.__cotwRenderer.render(); });
  await wait(page, 300);
  await page.screenshot({ path: `${OUT}/s00-town-${tag}.png` });
  const npcs = await page.evaluate(() => window.__cotwEngine.map.getAllEntities().filter((x) => x.type === 'npc').map((n, i) => ({ i, name: n.name, role: n.role ?? n.npcType ?? n.shopType ?? n.serviceType ?? '' })));
  console.log('npcs', JSON.stringify(npcs));
  const seen = new Set();
  let k = 1;
  for (const n of npcs) {
    const kind = n.role === 'merchant' ? n.name : (n.role || n.name);
    if (seen.has(kind)) continue;
    seen.add(kind);
    await page.evaluate((i) => { const e = window.__cotwEngine; const npc = e.map.getAllEntities().filter((x) => x.type === 'npc')[i]; e.onNpcInteract(npc); window.__cotwRenderer.render(); }, n.i);
    await wait(page, 350);
    const slug = String(kind).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24);
    await page.screenshot({ path: `${OUT}/s${String(k++).padStart(2, '0')}-${slug}-${tag}.png` });
    await resetGame(page);
  }
}

const browser = await chromium.launch();
const report = {};
for (const [w, h] of want) {
  const tag = `${w}x${h}`;
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await pinCreationClock(page);
  page.on('pageerror', (err) => { if (!/Audit:/.test(err.message)) console.log(`[${tag}] pageerror`, err.message); });
  for (const [name, fn] of TITLE) {
    if (filter && !filter.test(name)) continue;
    await page.goto(URL);
    await wait(page, 400);
    try { await fn(page); await wait(page, 350); } catch (err) { console.log(name, 'failed', err.message.split('\n')[0]); }
    await page.screenshot({ path: `${OUT}/${name}-${tag}.png` });
    report[`${name}-${tag}`] = await measure(page);
  }
  await newGame(page, w, h);
  await stageRun(page);
  for (const [name, fn] of GAME) {
    if (filter && !filter.test(name)) continue;
    await resetGame(page);
    try { await fn(page); await wait(page, 300); } catch (err) { console.log(name, 'failed', err.message.split('\n')[0]); }
    await page.screenshot({ path: `${OUT}/${name}-${tag}.png` });
    report[`${name}-${tag}`] = await measure(page);
  }
  if (!filter || filter.test('shop')) await shopScenes(page, tag);
  if (!filter || filter.test(CRASH[0])) { await resetGame(page); await CRASH[1](page); await wait(page, 300); await page.screenshot({ path: OUT + '/' + CRASH[0] + '-' + tag + '.png' }); }
  await page.close();
}
fs.writeFileSync(`${OUT}/measure.json`, JSON.stringify(report, null, 1));
await browser.close();
console.log('done');
