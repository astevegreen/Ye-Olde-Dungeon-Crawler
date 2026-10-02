import { Monster, type GameEngine } from '../../engine';
import { escapeHtml } from '../html';
import type { DiagnosticTabContext } from './types';
import { kvList } from './markup';

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
    <div class="diag-banner">
      <div><span class="diag-banner-title">Floor ${engine.currentFloor}</span> <span class="ui-muted">${engine.currentFloor === 0 ? 'Town' : 'Dungeon'}</span></div>
      <div class="diag-row-wrap">
        <span class="diag-tag${map.isCleared ? ' is-good' : ''}">${map.isCleared ? 'Cleared' : 'Not cleared'}</span>
        <span class="ui-muted">Plane: <b>${escapeHtml(p?.planeId ?? 'physical')}</b></span>
      </div>
    </div>
    <div class="diag-grid">
      <div class="ui-card">
        <div class="ui-h">World and turns</div>
        ${kvList([
          ['Floor size', `${map.width} × ${map.height}`],
          ['Floor turns', `${map.floorTurnCount ?? 0}`],
          ['Engine turns', `${engine.turnCount}`],
          ['Last respawn turn', `${map.lastRespawnTurn ?? 'None'}`],
          ['Ground items', `${groundItemCount}`],
        ])}
      </div>
      <div class="ui-card">
        <div class="ui-h">Entities and AI</div>
        ${kvList([
          ['Living', `<span class="diag-v is-good">${living.length}</span> / ${allEntities.length}`],
          ['Monsters', `${monsters.length} (NPCs ${npcs.length})`],
          ['Sleeping', `<span class="diag-v is-info">${sleepingCount}</span>`],
          ['Hunting', `<span class="diag-v is-bad">${huntingCount}</span>`],
          ['In combat', `<span class="diag-v is-bad">${combatCount}</span>`],
          ['Fleeing', `<span class="diag-v is-warn">${fleeingCount}</span>`],
        ])}
      </div>
      <div class="ui-card">
        <div class="ui-h">Field of view</div>
        ${kvList([
          ['Hero at', p ? `${p.x}, ${p.y}` : 'N/A'],
          ['FOV radius', `${engine.fovRadius} tiles`],
          ['Visible', `${visibleTiles} (${visiblePct}%)`],
          ['Explored', `${exploredTiles} / ${totalTiles} (${exploredPct}%)`],
        ])}
      </div>
      <div class="ui-card">
        <div class="ui-h">Spatial index and grids</div>
        ${kvList([
          ['Index entries', `${spatialIndexCount}`],
          ['Entity buckets', `${bucketCount}`],
          ['Surface tiles', `${surfaceTiles}`],
          ['Substance tiles', `${substanceTiles}`],
        ])}
      </div>
    </div>`;
}
