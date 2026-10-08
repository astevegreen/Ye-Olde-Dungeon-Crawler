// Pixel diff of two capture directories (same file names), done in a headless page's canvas.
// Usage: node scripts/capture/diff.mjs <before> <after> [out, default <after>-diff]
// Prints, per PNG, how many pixels differ (any channel), the largest channel difference and
// the bounding box of the change; writes <out>/<name>-diff.png (changes in red).
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const [a, b, out = `${b?.replace(/[\\/]+$/, '')}-diff`] = process.argv.slice(2);
if (!a || !b) { console.log('usage: node scripts/capture/diff.mjs <before> <after> [out]'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const name of fs.readdirSync(a).filter((f) => f.endsWith('.png'))) {
  if (!fs.existsSync(path.join(b, name))) { console.log(name, 'missing in', b); continue; }
  const da = 'data:image/png;base64,' + fs.readFileSync(path.join(a, name)).toString('base64');
  const db = 'data:image/png;base64,' + fs.readFileSync(path.join(b, name)).toString('base64');
  const res = await page.evaluate(async ({ da, db }) => {
    const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const [ia, ib] = await Promise.all([load(da), load(db)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { size: [ia.width, ia.height, ib.width, ib.height] };
    const c = document.createElement('canvas');
    c.width = ia.width; c.height = ia.height;
    const g = c.getContext('2d');
    g.drawImage(ia, 0, 0); const pa = g.getImageData(0, 0, c.width, c.height).data;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(ib, 0, 0); const imgB = g.getImageData(0, 0, c.width, c.height); const pb = imgB.data;
    const diff = g.createImageData(c.width, c.height);
    let n = 0, max = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let i = 0; i < pa.length; i += 4) {
      const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]), Math.abs(pa[i + 3] - pb[i + 3]));
      const p = i / 4, x = p % c.width, y = Math.floor(p / c.width);
      if (d > 0) {
        n++; max = Math.max(max, d);
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        diff.data[i] = 255; diff.data[i + 1] = 0; diff.data[i + 2] = 0; diff.data[i + 3] = 255;
      } else {
        diff.data[i] = pb[i] * 0.3; diff.data[i + 1] = pb[i + 1] * 0.3; diff.data[i + 2] = pb[i + 2] * 0.3; diff.data[i + 3] = 255;
      }
    }
    g.putImageData(diff, 0, 0);
    return { n, max, box: n ? [x0, y0, x1, y1] : null, png: c.toDataURL('image/png') };
  }, { da, db });
  if (res.png) fs.writeFileSync(path.join(out, name.replace('.png', '-diff.png')), Buffer.from(res.png.split(',')[1], 'base64'));
  delete res.png;
  console.log(name, JSON.stringify(res));
}
await browser.close();
