import type { CellOverlayArt } from '../../../engine';
import type { Pen } from './pen';

/**
 * cotw's art for what covers a cell (`atlas.overlays`, ARCHITECTURE.md §3): ground surfaces
 * and gases, drawn over the terrain every frame, in canvas units at the cell's place on
 * screen. Fire flickers, acid bubbles and gas drifts with the clock the renderer passes in.
 */
type Overlay = CellOverlayArt<Pen>;

const oilSlick: Overlay = (ctx, px, py, cellSize) => {
  // Iridescent dark purplish-amber sheen
  ctx.fillStyle = 'rgba(49, 46, 129, 0.55)';
  ctx.fillRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 3, py + 3, cellSize - 6, cellSize - 6);
};

const acidPool: Overlay = (ctx, px, py, cellSize, { x, y, now }) => {
  // Toxic vibrant bubbling green
  const cx = px + cellSize / 2;
  const cy = py + cellSize / 2;
  const bubble = Math.sin(now / 200 + x * 3 + y) * 2;
  ctx.fillStyle = 'rgba(34, 197, 94, 0.6)';
  ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
  ctx.fillStyle = '#86efac';
  ctx.beginPath();
  ctx.arc(cx - 3, cy - 2 + bubble, 2.5, 0, Math.PI * 2);
  ctx.arc(cx + 4, cy + 3 - bubble, 2, 0, Math.PI * 2);
  ctx.fill();
};

const iceSheet: Overlay = (ctx, px, py, cellSize) => {
  // Frosty cyan crystalline sheet
  ctx.fillStyle = 'rgba(186, 230, 253, 0.65)';
  ctx.fillRect(px, py, cellSize, cellSize);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + 2, py + 4);
  ctx.lineTo(px + cellSize - 3, py + cellSize - 3);
  ctx.moveTo(px + cellSize - 4, py + 3);
  ctx.lineTo(px + 3, py + cellSize - 4);
  ctx.stroke();
};

const water: Overlay = (ctx, px, py, cellSize) => {
  // Azure rippling pool
  ctx.fillStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.fillRect(px, py, cellSize, cellSize);
};

const mud: Overlay = (ctx, px, py, cellSize) => {
  // Thick viscous brown mud slowing passage
  ctx.fillStyle = 'rgba(120, 53, 15, 0.65)';
  ctx.fillRect(px, py, cellSize, cellSize);
  ctx.strokeStyle = 'rgba(180, 83, 9, 0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
};

const fire: Overlay = (ctx, px, py, cellSize, { x, now }) => {
  // Searing flickering ground fire
  const cx = px + cellSize / 2;
  const cy = py + cellSize / 2;
  const flicker = (Math.sin(now / 80 + x * 5) + 1) / 2;
  ctx.fillStyle = `rgba(239, 68, 68, ${0.5 + 0.25 * flicker})`;
  ctx.fillRect(px, py, cellSize, cellSize);
  ctx.fillStyle = `rgba(245, 158, 11, ${0.7 + 0.3 * (1 - flicker)})`;
  ctx.beginPath();
  ctx.arc(cx, cy, (cellSize * 0.3) + flicker * 2, 0, Math.PI * 2);
  ctx.fill();
};

const fireStorm: Overlay = (ctx, px, py, cellSize, { x, now }) => {
  // Roaring animated orange-red inferno
  const cx = px + cellSize / 2;
  const cy = py + cellSize / 2;
  const flicker = (Math.sin(now / 80 + x * 5) + 1) / 2;
  ctx.fillStyle = `rgba(239, 68, 68, ${0.45 + 0.25 * flicker})`;
  ctx.fillRect(px, py, cellSize, cellSize);
  ctx.fillStyle = `rgba(251, 191, 36, ${0.6 + 0.3 * (1 - flicker)})`;
  ctx.beginPath();
  ctx.arc(cx, cy, (cellSize * 0.35) + flicker * 3, 0, Math.PI * 2);
  ctx.fill();
};

const poisonCloud: Overlay = (ctx, px, py, cellSize, { x, y, now }) => {
  // Noxious swirling sickly green mist
  const cx = px + cellSize / 2;
  const cy = py + cellSize / 2;
  const swirl = Math.sin(now / 300 + x * 2 + y * 2) * 2;
  ctx.fillStyle = 'rgba(132, 204, 22, 0.45)';
  ctx.beginPath();
  ctx.arc(cx + swirl, cy - swirl, cellSize * 0.45, 0, Math.PI * 2);
  ctx.fill();
};

const denseSteam: Overlay = (ctx, px, py, cellSize, { x, y, now }) => {
  // Billowing thick white vapor (blocks LOS)
  const cx = px + cellSize / 2;
  const cy = py + cellSize / 2;
  const puff = Math.cos(now / 250 + x + y) * 2;
  ctx.fillStyle = 'rgba(241, 245, 249, 0.75)';
  ctx.beginPath();
  ctx.arc(cx + puff, cy + puff, cellSize * 0.48, 0, Math.PI * 2);
  ctx.fill();
};

export const COTW_CELL_OVERLAYS: Record<string, CellOverlayArt> = {
  'surface~oil_slick': oilSlick,
  'surface~acid_pool': acidPool,
  'surface~ice_sheet': iceSheet,
  'surface~water': water,
  'surface~mud': mud,
  'surface~fire': fire,
  'gas~fire_storm': fireStorm,
  'gas~poison_cloud': poisonCloud,
  'gas~dense_steam': denseSteam,
};
