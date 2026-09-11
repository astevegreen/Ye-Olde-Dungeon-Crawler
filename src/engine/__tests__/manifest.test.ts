import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { NPC } from '../entities/npc';
import { cotwManifest } from '../../content/cotw';
import type { GameContentManifest } from '../types/manifest';
import { Item } from '../items/item';

describe('GameContentManifest Decoupling', () => {
  it('defaults to an agnostic generic manifest when no manifest is provided to GameEngine', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({
      id: 'p1',
      name: 'Hero',
      position: { x: 2, y: 2 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
    });

    const engine = new GameEngine({ map, player });
    expect(engine.manifest).toBeDefined();
    expect(engine.manifest.id).toBe('generic');
    expect(engine.manifest.name).toBe('Generic Dungeon');

    // And accepts cotwManifest via dependency injection
    const cotwEngine = new GameEngine({ map, player, manifest: cotwManifest });
    expect(cotwEngine.manifest.id).toBe('cotw');
    expect(cotwEngine.manifest.name).toBe('Castle of the Winds');
    expect(cotwEngine.manifest.monsters.length).toBeGreaterThan(0);
    expect(cotwEngine.manifest.items.length).toBeGreaterThan(0);
    expect(cotwEngine.manifest.spells.length).toBeGreaterThan(0);
  });

  it('allows full customization with a custom manifest and custom victory NPC', () => {
    const customManifest: GameContentManifest = {
      id: 'scifi-outpost',
      name: 'Deep Space Outpost',
      description: 'Futuristic survival horror in an abandoned station.',
      monsters: [
        {
          id: 'alien-drone',
          name: 'Xenomorph Drone',
          stats: { hp: 20, maxHp: 20, attack: 8, defense: 3 },
          speed: 100,
          aiType: 'melee',
          fleeHealthPercent: 0.15,
          lootTable: [],
          xpValue: 30,
        },
      ],
      items: [
        {
          id: 'plasma-rifle',
          name: 'Plasma Rifle',
          category: 'weapon',
          weight: 4000,
          bulk: 2500,
          quality: 'enchanted',
          stats: { attackBonus: 12 },
          description: 'A military-grade energy rifle.',
        },
      ],
      spells: [],
      town: {
        name: 'Command Deck',
        width: 30,
        height: 20,
        playerSpawn: { x: 5, y: 5 },
        stairsDown: { x: 25, y: 15 },
        buildings: [],
        npcs: [
          {
            id: 'npc-admiral',
            name: 'Admiral Vance',
            role: 'villager',
            position: { x: 10, y: 10 },
            greeting: 'Did you recover the hyperdrive core, soldier?',
          },
        ],
      },
      quest: {
        id: 'quest-scifi',
        name: 'Save the Fleet',
        maxFloor: 3,
        bossFloor: 3,
        bossMonsterId: 'alien-queen',
        relicItemId: 'hyperdrive-core',
        victoryNpcId: 'npc-admiral',
        victoryFloor: 0,
        victoryDialogue: 'Well done soldier!',
        victoryScoreBonus: 5000,
        bossFloorLayout: {
          width: 20,
          height: 20,
          playerSpawn: { x: 1, y: 1 },
          stairsUp: { x: 1, y: 1 },
          bossSpawn: { x: 10, y: 10 },
        },
        floorEncounters: {},
      },
      atlas: {
        themeId: 'scifi',
        palette: { wall: '#222233', floor: '#111122' },
      },
      starterKit: {
        weaponItemId: 'plasma-rifle',
        coins: [{ denomination: 'gold', count: 10 }],
      },
    };

    const map = new GameMap(20, 20, TILES.FLOOR);
    const player = new Player({
      id: 'pilot-1',
      name: 'Ripley',
      position: { x: 5, y: 5 },
      stats: { hp: 40, maxHp: 40, attack: 6, defense: 3 },
    });

    const engine = new GameEngine({
      map,
      player,
      manifest: customManifest,
      floor: 0,
    });

    expect(engine.manifest.id).toBe('scifi-outpost');
    expect(engine.manifest.quest.victoryNpcId).toBe('npc-admiral');

    // Create Admiral NPC on map
    const admiralNpc = new NPC({
      id: 'npc-admiral',
      name: 'Admiral Vance',
      role: 'villager',
      position: { x: 6, y: 5 },
      greeting: 'Did you recover the hyperdrive core, soldier?',
    });
    engine.map.addEntity(admiralNpc);

    // Without victory item or boss killed, talking doesn't trigger victory
    engine.interactWithNpc(admiralNpc);
    expect(engine.gameState.runStatus).toBe('active');

    // Give relic
    const relic = new Item({
      id: 'hyperdrive-core',
      name: 'Hyperdrive Core',
      category: 'quest',
      weight: 1000,
      bulk: 500,
      quality: 'artifact',
      stats: {},
    });
    player.inventory.primaryPack.addItem(relic);

    // Now talking to Admiral triggers victory!
    engine.interactWithNpc(admiralNpc);
    expect(engine.gameState.runStatus).toBe('victorious');
  });
});
