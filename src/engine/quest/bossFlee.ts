import type { GameEngine } from '../engine';
import { Monster } from '../entities/monster';
import { getTileDefinition } from '../grid/tile';

/**
 * "Driven off" boss resolution (`GameContentManifest.bossFleeResolutions`): converts
 * sustained fleeing (the existing fleeHealthPercent mechanic) into a concluded encounter,
 * since nothing else does. Run once per hero turn, whatever the hero did with it: a hero
 * who stays the blade and waits drives the boss off as surely as one who chases it.
 */
export function tickBossFleeResolutions(engine: GameEngine): void {
  for (const watcher of engine.manifest?.bossFleeResolutions ?? []) {
    if (engine.getWorldFlag(watcher.sealedFlag)) continue;
    const boss = engine.map
      .getAllEntities()
      .find((e): e is Monster => e instanceof Monster && e.definitionId === watcher.monsterDefinitionId && e.isAlive());
    if (!boss || boss.aiState !== 'fleeing') continue;
    const turnsFled = engine.modifyWorldCounter(`boss_flee_turns:${watcher.monsterDefinitionId}`, 1);
    if (turnsFled === 1 && watcher.fleeBeginMessage) engine.log(watcher.fleeBeginMessage);
    if (turnsFled < watcher.fleeTurnsRequired) continue;
    engine.setWorldFlag(watcher.sealedFlag, true);
    const portal = watcher.portalTileId ? getTileDefinition(watcher.portalTileId) : undefined;
    if (portal) {
      engine.map.setTile(boss.x, boss.y, portal);
      if (watcher.portalMessage) engine.log(watcher.portalMessage);
    }
    engine.removeEntity(boss);
    engine.log(`${boss.name} flees into the dark, driven off for good!`);
  }
}
