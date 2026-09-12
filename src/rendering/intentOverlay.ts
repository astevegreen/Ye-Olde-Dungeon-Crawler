import type { GameEngine } from '../engine';
import type { Camera } from './camera';
import type { Monster } from '../engine';
import { Visibility } from '../engine';
import type { Position } from '../engine';

export class IntentOverlay {
  /**
   * Renders telegraph danger tiles and visual reticles for monsters winding up heavy attacks.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number
  ): void {
    const monsters = engine.map
      .getAllEntities()
      .filter((e) => e.type === 'monster' && e.isAlive()) as Monster[];

    const windingMonsters = monsters.filter((m) => m.intent?.type === 'windup');
    if (windingMonsters.length === 0) return;

    ctx.save();

    const now = Date.now();
    const pulse = 0.5 + 0.5 * Math.sin(now / 160); // 0.0 to 1.0
    const alpha = 0.25 + 0.25 * pulse; // 0.25 to 0.50

    for (const monster of windingMonsters) {
      const intent = monster.intent;
      if (!intent) continue;

      const rawTiles = intent.targetTiles && intent.targetTiles.length > 0
        ? intent.targetTiles
        : (intent.targetTile ? [intent.targetTile] : []);

      const targetTiles = rawTiles.filter(
        (t): t is Position => Boolean(t && typeof t.x === 'number' && typeof t.y === 'number')
      );

      if (targetTiles.length === 0) continue;

      // Draw danger zone tiles
      for (const tile of targetTiles) {
        // Only render if explored or visible
        const vis = engine.fov.getVisibility(tile.x, tile.y);
        if (vis === Visibility.Unexplored) continue;

        const screenPos = camera.worldToScreen(tile.x, tile.y, cellSize, offsetX, offsetY);
        if (!screenPos) continue;

        const { x: px, y: py } = screenPos;

        // 1. Semi-transparent danger fill
        ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.fillRect(px, py, cellSize, cellSize);

        // 2. Checkerboard / hazard hatch overlay
        ctx.strokeStyle = `rgba(254, 202, 202, ${alpha * 0.7})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py + cellSize);
        ctx.lineTo(px + cellSize, py);
        ctx.stroke();

        // 3. Danger border
        ctx.strokeStyle = `rgba(220, 38, 38, ${0.6 + 0.4 * pulse})`;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
      }

      // Render primary reticle and ability banner on the primary target tile
      const candidateTile = intent.targetTile ?? targetTiles[0];
      if (!candidateTile || typeof candidateTile.x !== 'number' || typeof candidateTile.y !== 'number') {
        continue;
      }
      const primaryTile = candidateTile;
      const primaryScreen = camera.worldToScreen(primaryTile.x, primaryTile.y, cellSize, offsetX, offsetY);

      if (primaryScreen) {
        const cx = primaryScreen.x + cellSize / 2;
        const cy = primaryScreen.y + cellSize / 2;

        // Draw animated target reticle
        const reticleRadius = (cellSize * 0.42) + (pulse * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 + 0.3 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, reticleRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(cx - reticleRadius - 3, cy);
        ctx.lineTo(cx + reticleRadius + 3, cy);
        ctx.moveTo(cx, cy - reticleRadius - 3);
        ctx.lineTo(cx, cy + reticleRadius + 3);
        ctx.stroke();

        // Warning Icon / Ability Banner
        const ability = intent.abilityName ?? 'Heavy Strike';
        ctx.font = 'bold 10px "Courier New", Courier, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        const textMetrics = ctx.measureText(`⚠️ ${ability}`);
        const bannerW = textMetrics.width + 8;
        const bannerH = 14;
        const bannerX = cx - bannerW / 2;
        const bannerY = primaryScreen.y - 4;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(bannerX, bannerY - bannerH, bannerW, bannerH);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.strokeRect(bannerX, bannerY - bannerH, bannerW, bannerH);

        ctx.fillStyle = '#fca5a5';
        ctx.fillText(`⚠️ ${ability}`, cx, bannerY - 2);
      }
    }

    ctx.restore();
  }

  /**
   * Renders ground surfaces (water, oil slick, acid, ice) and atmospheric gasses.
   */
  public renderSurfaces(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number
  ): void {
    if (!engine.surfaces) return;
    const activeCells = engine.surfaces.getAllActiveCells();
    if (activeCells.length === 0) return;

    ctx.save();
    const now = Date.now();

    for (const item of activeCells) {
      if (!item || typeof item.x !== 'number' || typeof item.y !== 'number' || !item.cell) continue;
      const { x, y, cell } = item;
      const vis = engine.fov.getVisibility(x, y);
      if (vis === Visibility.Unexplored) continue;

      const screenPos = camera.worldToScreen(x, y, cellSize, offsetX, offsetY);
      if (!screenPos) continue;
      const { x: px, y: py } = screenPos;
      const cx = px + cellSize / 2;
      const cy = py + cellSize / 2;

      // ── Ground Surface Rendering ──
      if (cell.surface) {
        switch (cell.surface.type) {
          case 'oil_slick': {
            // Iridescent dark purplish-amber sheen
            ctx.fillStyle = 'rgba(49, 46, 129, 0.55)';
            ctx.fillRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
            ctx.strokeStyle = 'rgba(217, 119, 6, 0.7)';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 3, py + 3, cellSize - 6, cellSize - 6);
            break;
          }

          case 'acid_pool': {
            // Toxic vibrant bubbling green
            const bubble = Math.sin(now / 200 + x * 3 + y) * 2;
            ctx.fillStyle = 'rgba(34, 197, 94, 0.6)';
            ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
            ctx.fillStyle = '#86efac';
            ctx.beginPath();
            ctx.arc(cx - 3, cy - 2 + bubble, 2.5, 0, Math.PI * 2);
            ctx.arc(cx + 4, cy + 3 - bubble, 2, 0, Math.PI * 2);
            ctx.fill();
            break;
          }

          case 'ice_sheet': {
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
            break;
          }

          case 'water': {
            // Azure rippling pool
            ctx.fillStyle = 'rgba(56, 189, 248, 0.5)';
            ctx.fillRect(px, py, cellSize, cellSize);
            break;
          }

          case 'mud': {
            // Thick viscous brown mud slowing passage
            ctx.fillStyle = 'rgba(120, 53, 15, 0.65)';
            ctx.fillRect(px, py, cellSize, cellSize);
            ctx.strokeStyle = 'rgba(180, 83, 9, 0.8)';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
            break;
          }

          case 'fire': {
            // Searing flickering ground fire
            const flicker = (Math.sin(now / 80 + x * 5) + 1) / 2;
            ctx.fillStyle = `rgba(239, 68, 68, ${0.5 + 0.25 * flicker})`;
            ctx.fillRect(px, py, cellSize, cellSize);
            ctx.fillStyle = `rgba(245, 158, 11, ${0.7 + 0.3 * (1 - flicker)})`;
            ctx.beginPath();
            ctx.arc(cx, cy, (cellSize * 0.3) + flicker * 2, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
        }
      }

      // ── Overhead Gas Rendering ──
      if (cell.gas) {
        switch (cell.gas.type) {
          case 'fire_storm': {
            // Roaring animated orange-red inferno
            const flicker = (Math.sin(now / 80 + x * 5) + 1) / 2;
            ctx.fillStyle = `rgba(239, 68, 68, ${0.45 + 0.25 * flicker})`;
            ctx.fillRect(px, py, cellSize, cellSize);
            ctx.fillStyle = `rgba(251, 191, 36, ${0.6 + 0.3 * (1 - flicker)})`;
            ctx.beginPath();
            ctx.arc(cx, cy, (cellSize * 0.35) + flicker * 3, 0, Math.PI * 2);
            ctx.fill();
            break;
          }

          case 'poison_cloud': {
            // Noxious swirling sickly green mist
            const swirl = Math.sin(now / 300 + x * 2 + y * 2) * 2;
            ctx.fillStyle = 'rgba(132, 204, 22, 0.45)';
            ctx.beginPath();
            ctx.arc(cx + swirl, cy - swirl, cellSize * 0.45, 0, Math.PI * 2);
            ctx.fill();
            break;
          }

          case 'dense_steam': {
            // Billowing thick white vapor (blocks LOS)
            const puff = Math.cos(now / 250 + x + y) * 2;
            ctx.fillStyle = 'rgba(241, 245, 249, 0.75)';
            ctx.beginPath();
            ctx.arc(cx + puff, cy + puff, cellSize * 0.48, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
        }
      }
    }

    ctx.restore();
  }
}
