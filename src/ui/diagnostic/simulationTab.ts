import { Monster, type GameEngine } from '../../engine';
import type { DiagnosticTabContext } from './types';

export function renderSimulationTab(ctx: DiagnosticTabContext, engine: GameEngine): void {
  const container = ctx.container;
  const map = engine.map;
  const p = engine.player;
  const allEntities = map.getAllEntities();
  const living = allEntities.filter((e) => e.isAlive());
  const monsters = living.filter((e) => e.type === 'monster');
  const npcs = living.filter((e) => e.type === 'npc');

  let sleepingCount = 0;
  let huntingCount = 0;
  let combatCount = 0;
  let fleeingCount = 0;

  for (const m of monsters) {
    if (!(m instanceof Monster)) continue;
    if (m.aiState === 'sleeping') sleepingCount++;
    else if (m.aiState === 'hunting') huntingCount++;
    else if (m.aiState === 'combat') combatCount++;
    else if (m.aiState === 'fleeing') fleeingCount++;
  }

  let visibleTiles = 0;
  let exploredTiles = 0;
  let surfaceTiles = 0;
  let substanceTiles = 0;
  const totalTiles = map.width * map.height;

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (engine.fov.isVisible(x, y)) visibleTiles++;
      if (engine.fov.isExplored(x, y)) exploredTiles++;
      if (engine.surfaces.getSurface(x, y) || engine.surfaces.getGas(x, y)) surfaceTiles++;
      if (engine.substances.getSubstances(x, y) !== 0) substanceTiles++;
    }
  }

  const exploredPct = ((exploredTiles / totalTiles) * 100).toFixed(1);
  const visiblePct = ((visibleTiles / totalTiles) * 100).toFixed(1);

  const { spatialIndexEntries: spatialIndexCount, entityBuckets: bucketCount } = map.getIndexStats();
  const groundItemCount = map.getAllGroundItems().length;

  container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; background: #090d16; color: #e2e8f0; border: 2px inset #ffffff; flex: 1;">
        
        <!-- Floor Header Card -->
        <div style="background: #1e293b; padding: 8px 12px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #38bdf8;">
          <div>
            <span style="font-size: 14px; font-weight: bold; color: #38bdf8;">FLOOR ${engine.currentFloor}</span>
            <span style="color: #94a3b8; margin-left: 8px;">(${engine.currentFloor === 0 ? 'Town' : 'Dungeon Floor'})</span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="background: ${map.isCleared ? '#15803d' : '#475569'}; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">
              ${map.isCleared ? 'CLEARED' : 'UNCLEARED'}
            </span>
            <span style="color: #cbd5e1;">Plane: <strong>${p?.planeId ?? 'physical'}</strong></span>
          </div>
        </div>

        <!-- Metric Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px;">
          
          <!-- World & Turns Card -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              ⏱️ World &amp; Turn Telemetry
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="color: #94a3b8; width: 140px;">Floor Dimensions:</td><td><strong>${map.width} × ${map.height}</strong> tiles</td></tr>
              <tr><td style="color: #94a3b8;">Floor Turn Count:</td><td><strong>${map.floorTurnCount ?? 0}</strong></td></tr>
              <tr><td style="color: #94a3b8;">Engine Turn Count:</td><td><strong>${engine.turnCount}</strong></td></tr>
              <tr><td style="color: #94a3b8;">Last Respawn Turn:</td><td><strong>${map.lastRespawnTurn ?? 'None'}</strong></td></tr>
              <tr><td style="color: #94a3b8;">Ground Items:</td><td><strong>${groundItemCount}</strong></td></tr>
            </table>
          </div>

          <!-- Entities Breakdown Card -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              👾 Entities &amp; AI States
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="color: #94a3b8; width: 140px;">Total Living:</td><td><strong style="color: #4ade80;">${living.length}</strong> / ${allEntities.length}</td></tr>
              <tr><td style="color: #94a3b8;">Monsters:</td><td><strong>${monsters.length}</strong> (NPCs: ${npcs.length})</td></tr>
              <tr><td style="color: #94a3b8;">Sleeping:</td><td><span style="color: #93c5fd;">💤 ${sleepingCount}</span></td></tr>
              <tr><td style="color: #94a3b8;">Hunting / Combat:</td><td><span style="color: #f87171;">🎯 ${huntingCount}</span> | <span style="color: #fb923c;">⚔️ ${combatCount}</span></td></tr>
              <tr><td style="color: #94a3b8;">Fleeing:</td><td><span style="color: #facc15;">🏃 ${fleeingCount}</span></td></tr>
            </table>
          </div>

          <!-- Field of View Card -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              👁️ Field of View (FOV)
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="color: #94a3b8; width: 140px;">Player Position:</td><td><strong>(${p ? `${p.x}, ${p.y}` : 'N/A'})</strong></td></tr>
              <tr><td style="color: #94a3b8;">FOV Radius:</td><td><strong>${engine.fovRadius}</strong> tiles</td></tr>
              <tr><td style="color: #94a3b8;">Currently Visible:</td><td><strong>${visibleTiles}</strong> (${visiblePct}%)</td></tr>
              <tr><td style="color: #94a3b8;">Explored Tiles:</td><td><strong>${exploredTiles}</strong> / ${totalTiles} (${exploredPct}%)</td></tr>
            </table>
          </div>

          <!-- Spatial Partitioning Card -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              📐 Spatial Partition &amp; Grids
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="color: #94a3b8; width: 140px;">Spatial Index Size:</td><td><strong>${spatialIndexCount}</strong> entries</td></tr>
              <tr><td style="color: #94a3b8;">Entity Buckets:</td><td><strong>${bucketCount}</strong> coordinates</td></tr>
              <tr><td style="color: #94a3b8;">Active Surfaces:</td><td><strong>${surfaceTiles}</strong> tiles</td></tr>
              <tr><td style="color: #94a3b8;">Reactive Substances:</td><td><strong>${substanceTiles}</strong> tiles</td></tr>
            </table>
          </div>

        </div>
      </div>
    `;
}
