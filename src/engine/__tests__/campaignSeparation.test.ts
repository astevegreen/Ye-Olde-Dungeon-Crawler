import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { Player } from '../entities/player';
import { DungeonArc } from '../quest/dungeonArc';
import { DeathResolver } from '../combat/deathResolver';
import { Monster } from '../entities/monster';
import * as fs from 'fs';
import * as path from 'path';

describe('Campaign Separation (P-03 Stage 2)', () => {
  it('does not fire campaign-specific hooks or placement when manifest leaves new fields unset', () => {
    const blankManifest: any = {
      id: 'blank',
      name: 'Blank Manifest',
      monsters: [],
      items: [],
      spells: [],
      town: {
        name: 'Empty Town',
        width: 30,
        height: 30,
        playerSpawn: { x: 5, y: 5 },
        stairsDown: { x: 15, y: 15 },
        buildings: [],
        npcs: [],
      },
      quest: {
        id: 'blank_quest',
        name: 'Blank Quest',
        maxFloor: 5,
        bossFloor: 5,
        bossMonsterId: 'blank_boss',
        relicItemId: 'blank_relic',
        victoryNpcId: 'blank_npc',
        victoryFloor: 0,
        victoryDialogue: 'Victory',
        victoryScoreBonus: 100,
        bossFloorLayout: {
          width: 20,
          height: 20,
          playerSpawn: { x: 5, y: 5 },
          stairsUp: { x: 5, y: 6 },
          bossSpawn: { x: 10, y: 10 },
        },
        floorEncounters: {},
      },
      atlas: { themeId: 'blank' },
      starterKit: { weaponItemId: 'club' },
    };

    // 1. Floor 3: no fixed tile placements (no Altar of Tyr)
    const floor3 = DungeonArc.generateFloor(3, 42, blankManifest.quest, blankManifest);
    let foundAltar = false;
    for (let y = 0; y < floor3.map.height; y++) {
      for (let x = 0; x < floor3.map.width; x++) {
        const tile = floor3.map.getTile(x, y);
        if (tile?.type === 'altar_tyr') {
          foundAltar = true;
        }
      }
    }
    expect(foundAltar).toBe(false);

    // 2. Floor 5: no rune of return acquisition
    const floor5 = DungeonArc.generateFloor(5, 42, blankManifest.quest, blankManifest);
    const groundItems = floor5.map.getAllGroundItems();
    const hasRune = groundItems.some((pile) =>
      pile.items.some((it) => it.name.toLowerCase().includes('rune of return') || it.id.includes('rune-of-return'))
    );
    expect(hasRune).toBe(false);

    // 3. Slaying boss without victoryPortalTileId does not spawn portal
    const player = new Player({ position: { x: 5, y: 5 } });
    const engine = new GameEngine({
      map: floor5.map,
      player,
      floor: 5,
      manifest: blankManifest,
    });
    const boss = new Monster({
      id: 'blank-boss-1',
      name: 'Blank Boss',
      position: { x: 10, y: 10 },
      definitionId: 'blank_boss',
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
    });
    floor5.map.addEntity(boss);

    DeathResolver.resolveDeath(engine, player, boss);

    const tileAtBoss = floor5.map.getTile(10, 10);
    expect(tileAtBoss?.type).not.toBe('gateway_valhalla');
    expect(tileAtBoss?.interactionHandlerId).not.toBe('quest_victory_portal');
  });

  it('verifies src/engine production code contains no tyr|valhalla|hrungnir except allowed legacy/storage tokens', () => {
    const engineDir = path.resolve(__dirname, '..');
    const allowedExceptionsRegex = /ValhallaEntry|cotw_valhalla/g;

    // In Step 2, tile.ts, types.ts, and compaction.ts still declare the legacy tile definitions until Step 4 moves them.
    // hallOfFame/ defines ValhallaEntry and the cotw_valhalla leaderboard system.
    const step4ExemptFiles = new Set(['tile.ts', 'types.ts', 'compaction.ts', 'leaderboard.ts']);

    function scanDir(dir: string): { file: string; match: string; line: number }[] {
      const violations: { file: string; match: string; line: number }[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Exclude __tests__ directories
          if (entry.name !== '__tests__' && entry.name !== 'node_modules') {
            violations.push(...scanDir(fullPath));
          }
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          if (step4ExemptFiles.has(entry.name)) {
            continue;
          }
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            // Strip permitted exceptions
            const sanitized = line.replace(allowedExceptionsRegex, '');
            const match = sanitized.match(/\b(tyr|valhalla|hrungnir)\b/i);
            if (match) {
              violations.push({
                file: path.relative(engineDir, fullPath),
                match: match[0],
                line: idx + 1,
              });
            }
          });
        }
      }
      return violations;
    }

    const violations = scanDir(engineDir);
    expect(violations, `Found campaign term leaks in engine production code: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
  });
});
