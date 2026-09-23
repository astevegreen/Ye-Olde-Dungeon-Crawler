import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameEngine,
  GameMap,
  TILES,
  Player,
  NPC,
  MovementAction,
  WaitAction,
  getItemBuyPrice,
  getTileDefinition,
} from '../../../engine';
import { DungeonArc } from '../../../engine/quest/dungeonArc';
import {
  rescueCaptiveVillager,
  sacrificeCaptiveVillager,
  HOSTAGE_VILLAGERS,
  SIPHON_ALTAR_TILE,
  SIPHON_RITUAL_FLOOR,
} from '../hostageRitual';
import { COTW_MANIFEST } from '../index';
import { COTW_QUEST } from '../quest';
import { createGuntherArmory } from '../town';

/**
 * The live hostage-ritual path: captives are spawned by the manifest's scripted vault
 * placement, rescued by bumping into them (a MovementAction pre-hook), settled at the
 * Siphon Altar tile choice, or sacrificed when the countdown expires — and every route
 * funnels into the same five-tier resolution.
 */
describe('Hostage Ritual (Siphon Altar of Járnviðr)', () => {
  let engine: GameEngine;
  let player: Player;
  let map: GameMap;

  const pricing = COTW_MANIFEST.merchantPricing;

  function testSword() {
    return createGuntherArmory().stock.find((i) => i.category === 'weapon')!;
  }

  /** Places all four captives in a row east of the player, at (7..10, 5). */
  function placeCaptives(): NPC[] {
    return HOSTAGE_VILLAGERS.map((v, i) => {
      const npc = new NPC({ id: v.id, name: v.name, role: 'villager', position: { x: 7 + i, y: 5 }, isStationary: true });
      engine.addEntity(npc);
      return npc;
    });
  }

  beforeEach(() => {
    map = new GameMap(20, 20, TILES.FLOOR);
    player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 40, maxHp: 40, attack: 8, defense: 3 },
    });
    map.addEntity(player);

    engine = new GameEngine({
      map,
      player,
      floor: SIPHON_RITUAL_FLOOR,
      manifest: COTW_MANIFEST,
      worldState: { flags: {}, counters: {}, factions: { townsfolk: 0 } },
    });
  });

  describe('five-tier resolution', () => {
    function settle(rescued: number): void {
      HOSTAGE_VILLAGERS.forEach((v, i) =>
        i < rescued ? rescueCaptiveVillager(engine, v.id) : sacrificeCaptiveVillager(engine, v.id)
      );
    }

    it('does not resolve until all four captives are accounted for', () => {
      rescueCaptiveVillager(engine, HOSTAGE_VILLAGERS[0].id);
      sacrificeCaptiveVillager(engine, HOSTAGE_VILLAGERS[1].id);
      expect(engine.getWorldFlag('siphon_ritual_resolved')).toBe(false);
    });

    it('ignores a captive already accounted for', () => {
      expect(rescueCaptiveVillager(engine, HOSTAGE_VILLAGERS[0].id)).toBe(true);
      expect(sacrificeCaptiveVillager(engine, HOSTAGE_VILLAGERS[0].id)).toBe(false);
      expect(engine.getWorldCounter('hostages_rescued')).toBe(1);
      expect(engine.getWorldCounter('hostages_sacrificed')).toBe(0);
    });

    it('Tier 1 (4 rescued): savior, +30/+15 standing, 25% discount, no dark magic', () => {
      settle(4);
      expect(engine.getWorldFlag('siphon_ritual_resolved')).toBe(true);
      expect(engine.getWorldFlag('savior_of_jarnvidr')).toBe(true);
      expect(engine.getFactionStanding('townsfolk')).toBe(30);
      expect(engine.getFactionStanding('temple_standing')).toBe(15);
      expect(player.hasEnergyModel()).toBe(false);
      const sword = testSword();
      expect(getItemBuyPrice(sword, engine.worldState, pricing)).toBe(Math.floor(getItemBuyPrice(sword) * 0.75));
    });

    it('Tier 2 (3 rescued): +15/+5 standing, Blood Reap and Blood Tap', () => {
      settle(3);
      expect(engine.getFactionStanding('townsfolk')).toBe(15);
      expect(engine.getFactionStanding('temple_standing')).toBe(5);
      expect(player.hasEnergyModel()).toBe(true);
      expect(player.spellsKnown).toEqual(expect.arrayContaining(['blood_reap', 'blood_tap']));
      expect(player.spellsKnown).not.toContain('crimson_ward');
    });

    it('Tier 3 (2 rescued): no standing change, flat prices, three blood spells', () => {
      settle(2);
      expect(engine.getFactionStanding('townsfolk')).toBe(0);
      expect(player.spellsKnown).toEqual(expect.arrayContaining(['blood_reap', 'blood_tap', 'crimson_ward']));
      const sword = testSword();
      expect(getItemBuyPrice(sword, engine.worldState, pricing)).toBe(getItemBuyPrice(sword));
    });

    it('Tier 4 (1 rescued): -15/-10 standing, 15% markup, four blood spells', () => {
      settle(1);
      expect(engine.getFactionStanding('townsfolk')).toBe(-15);
      expect(engine.getFactionStanding('temple_standing')).toBe(-10);
      expect(player.spellsKnown).toEqual(
        expect.arrayContaining(['blood_reap', 'blood_tap', 'crimson_ward', 'blood_spear'])
      );
      const sword = testSword();
      expect(getItemBuyPrice(sword, engine.worldState, pricing)).toBe(Math.floor(getItemBuyPrice(sword) * 1.15));
    });

    it('Tier 5 (0 rescued): blood-tainted, -30/-25 standing, 30% markup, full grimoire, hero armor withheld', () => {
      settle(0);
      expect(engine.getWorldFlag('blood_tainted_hero')).toBe(true);
      expect(engine.getFactionStanding('townsfolk')).toBe(-30);
      expect(engine.getFactionStanding('temple_standing')).toBe(-25);
      expect(player.spellsKnown).toContain('exsanguinate');
      expect(player.energyModel!.maxVolatileEnergy).toBe(100);
      const sword = testSword();
      expect(getItemBuyPrice(sword, engine.worldState, pricing)).toBe(Math.floor(getItemBuyPrice(sword) * 1.3));

      const stock = createGuntherArmory().getAvailableStock(engine.worldState);
      expect(stock.find((item) => item.id === 'gunther-hero-armor')).toBeUndefined();
    });
  });

  describe('live interaction path', () => {
    it('bumping into a captive rescues them instead of opening NPC dialogue', () => {
      const [first] = placeCaptives();
      let dialogOpened = false;
      engine.onNpcInteract = () => {
        dialogOpened = true;
      };
      player.setPosition(first.x - 1, first.y);

      const result = engine.handlePlayerAction(new MovementAction(player, 1, 0));

      expect(result.success).toBe(true);
      expect(dialogOpened).toBe(false);
      expect(engine.getWorldFlag(`${first.id}_rescued`)).toBe(true);
      expect(engine.getWorldCounter('hostages_rescued')).toBe(1);
      expect(map.getEntityById(first.id)).toBeNull();
      expect(player.x).toBe(first.x - 1); // rescuing does not move the player
    });

    it('rescuing all four by bumping resolves the ritual at Tier 1', () => {
      const captives = placeCaptives();
      for (const captive of captives) {
        player.setPosition(captive.x - 1, captive.y);
        engine.handlePlayerAction(new MovementAction(player, 1, 0));
      }
      expect(engine.getWorldFlag('siphon_ritual_resolved')).toBe(true);
      expect(engine.getWorldFlag('savior_of_jarnvidr')).toBe(true);
    });

    it('the Siphon Altar choice settles the remaining captives (balance path)', () => {
      const [first] = placeCaptives();
      player.setPosition(first.x - 1, first.y);
      engine.handlePlayerAction(new MovementAction(player, 1, 0)); // 1 rescued by hand

      map.setTile(5, 8, getTileDefinition(SIPHON_ALTAR_TILE));
      engine.onChoiceInteract = (choice, onSelect) => {
        expect(choice.id).toBe('blood_altar_ritual');
        onSelect('balance_path');
      };
      player.setPosition(5, 7);
      engine.handlePlayerAction(new MovementAction(player, 0, 1));

      // Of the 3 remaining, balance frees 2 and sacrifices 1: 3 rescued total (Tier 2).
      expect(engine.getWorldCounter('hostages_rescued')).toBe(3);
      expect(engine.getWorldCounter('hostages_sacrificed')).toBe(1);
      expect(engine.getWorldFlag('siphon_ritual_resolved')).toBe(true);
      expect(player.spellsKnown).toContain('blood_reap');
      expect(HOSTAGE_VILLAGERS.every((v) => map.getEntityById(v.id) === null)).toBe(true);
    });

    it('the countdown starts in sight of a captive and sacrifices the rest on expiry', () => {
      const [first] = placeCaptives();
      player.setPosition(first.x - 1, first.y);
      engine.handlePlayerAction(new MovementAction(player, 1, 0)); // rescue one; captives in sight
      expect(engine.getWorldFlag('siphon_ritual_started')).toBe(true);

      for (let turn = 0; turn < 30 && !engine.getWorldFlag('siphon_ritual_resolved'); turn++) {
        engine.handlePlayerAction(new WaitAction(player));
      }

      expect(engine.getWorldFlag('siphon_ritual_expired')).toBe(true);
      expect(engine.getWorldFlag('siphon_ritual_resolved')).toBe(true);
      expect(engine.getWorldCounter('hostages_rescued')).toBe(1);
      expect(engine.getWorldCounter('hostages_sacrificed')).toBe(3);
      expect(player.spellsKnown).toContain('blood_spear'); // Tier 4
    });

    it('the countdown does not fire once the ritual is resolved', () => {
      const captives = placeCaptives();
      for (const captive of captives) {
        player.setPosition(captive.x - 1, captive.y);
        engine.handlePlayerAction(new MovementAction(player, 1, 0));
      }
      for (let turn = 0; turn < 30; turn++) {
        engine.handlePlayerAction(new WaitAction(player));
      }
      expect(engine.getWorldFlag('siphon_ritual_expired')).toBe(false);
      expect(engine.getWorldCounter('hostages_sacrificed')).toBe(0);
    });
  });

  describe('floor generation', () => {
    function tilesOfType(floorMap: GameMap, type: string): number {
      let count = 0;
      for (let y = 0; y < floorMap.height; y++) {
        for (let x = 0; x < floorMap.width; x++) {
          if (floorMap.getTile(x, y)?.type === type) count++;
        }
      }
      return count;
    }

    it('stamps the siphon vault with its altar and four captives on the scripted floor', () => {
      for (let seed = 1; seed <= 5; seed++) {
        const floor = DungeonArc.generateFloor(SIPHON_RITUAL_FLOOR, seed, COTW_QUEST, COTW_MANIFEST, 1, undefined, engine.registries);
        expect(tilesOfType(floor.map, SIPHON_ALTAR_TILE)).toBe(1);
        for (const v of HOSTAGE_VILLAGERS) {
          const npc = floor.map.getEntityById(v.id);
          expect(npc).toBeInstanceOf(NPC);
          expect(npc!.name).toBe(v.name);
        }
      }
    });

    it('never stamps the scripted-only vault on neighbouring floors', () => {
      for (const floorNumber of [SIPHON_RITUAL_FLOOR - 1, SIPHON_RITUAL_FLOOR + 1]) {
        for (let seed = 1; seed <= 5; seed++) {
          const floor = DungeonArc.generateFloor(floorNumber, seed, COTW_QUEST, COTW_MANIFEST, 1, undefined, engine.registries);
          expect(tilesOfType(floor.map, SIPHON_ALTAR_TILE)).toBe(0);
          expect(floor.map.getEntityById(HOSTAGE_VILLAGERS[0].id)).toBeNull();
        }
      }
    });
  });
});
