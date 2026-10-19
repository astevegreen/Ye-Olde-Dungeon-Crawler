import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameEngine,
  GameMap,
  TILES,
  Player,
  NPC,
  MovementAction,
  WaitAction,
  evaluatePredicate,
  endingNarrative,
  getItemBuyPrice,
  getTileDefinition,
} from '../../../engine';
import { DungeonArc } from '../../../engine/quest/dungeonArc';
import {
  altarMark,
  rescueCaptiveVillager,
  sacrificeCaptiveVillager,
  HOSTAGE_VILLAGERS,
  SIPHON_ALTAR_TILE,
  SIPHON_RITUAL_FLOOR,
} from '../hostageRitual';
import { cotwManifest } from '../index';
import { COTW_QUEST } from '../quest';
import { createGuntherArmory } from './townMerchants';

/**
 * The live hostage-ritual path: captives are spawned by the manifest's scripted vault
 * placement, rescued by bumping into them (a MovementAction pre-hook), settled at the
 * Siphon Altar tile choice, or lost to the warlocks when the countdown expires — and every
 * route funnels into the same trade.
 */
describe('Hostage Ritual (Siphon Altar of Járnviðr)', () => {
  let engine: GameEngine;
  let player: Player;
  let map: GameMap;

  const pricing = cotwManifest.merchantPricing;

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
      manifest: cotwManifest,
      worldState: { flags: {}, counters: {}, factions: { townsfolk: 0 } },
    });
  });

  describe('the trade', () => {
    /** Settles the captives in roster order: the first `rescued` saved, the rest sacrificed. */
    function settle(rescued: number): void {
      HOSTAGE_VILLAGERS.forEach((v, i) =>
        i < rescued ? rescueCaptiveVillager(engine, v.id) : sacrificeCaptiveVillager(engine, v.id)
      );
    }

    /** The picks the trade owes, opened on the hero's next moves, each answered with `pick`. */
    function takeGifts(pick: Record<string, string>): string[] {
      const opened: string[] = [];
      engine.onChoiceInteract = (choice, onSelect) => {
        opened.push(choice.id);
        onSelect(pick[choice.id]);
      };
      for (let step = 0; step < 4; step++) {
        engine.handlePlayerAction(new MovementAction(player, 0, step % 2 === 0 ? 1 : -1));
      }
      return opened;
    }

    const ALTAR_SPELLS = ['grith', 'disir', 'blood_reap', 'draugr_call'];
    const altarSpellsKnown = (): string[] => player.spellsKnown.filter((id) => ALTAR_SPELLS.includes(id));

    it('does not resolve until all four captives are accounted for', () => {
      rescueCaptiveVillager(engine, HOSTAGE_VILLAGERS[0].id);
      sacrificeCaptiveVillager(engine, HOSTAGE_VILLAGERS[1].id);
      expect(engine.getWorldFlag('siphon_ritual_resolved')).toBe(false);
    });

    it('states the town prices the outcome really leaves, not a fixed markup', () => {
      settle(0); // townsfolk 0 → -10
      expect(engine.messages.some((m) => m.includes('town prices: 15% dearer'))).toBe(true);
    });

    it('says prices are unchanged when the raid’s goodwill absorbs the loss', () => {
      engine.worldState.factions.townsfolk = 22; // three villagers freed in the raid
      settle(1); // → 17
      expect(engine.messages.some((m) => m.includes('town prices: unchanged'))).toBe(true);
      expect(engine.messages.some((m) => m.includes('Markup'))).toBe(false);
    });

    it('ignores a captive already accounted for', () => {
      expect(rescueCaptiveVillager(engine, HOSTAGE_VILLAGERS[0].id)).toBe(true);
      expect(sacrificeCaptiveVillager(engine, HOSTAGE_VILLAGERS[0].id)).toBe(false);
      expect(engine.getWorldCounter('hostages_rescued')).toBe(1);
      expect(engine.getWorldCounter('hostages_sacrificed')).toBe(0);
    });

    it('offers "Take Only What Was Offered" only while one who offered is still bound', () => {
      const balance = cotwManifest.choices!['blood_altar_ritual'].options.find((o) => o.id === 'balance_path')!;
      const offered = () => evaluatePredicate(balance.predicate!, engine.worldState);
      expect(offered()).toBe(true);
      rescueCaptiveVillager(engine, 'captive_villager_1'); // Ingrid offered herself
      expect(offered()).toBe(true);
      rescueCaptiveVillager(engine, 'captive_villager_3'); // and so did Sigrid
      expect(offered()).toBe(false);
    });

    it('4 saved: savior, +10 town, +25 temple, both frith spells, no mark', () => {
      settle(4);
      expect(engine.getWorldFlag('siphon_ritual_resolved')).toBe(true);
      expect(engine.getWorldFlag('savior_of_jarnvidr')).toBe(true);
      expect(engine.getFactionStanding('townsfolk')).toBe(10);
      expect(engine.getFactionStanding('temple_standing')).toBe(25);
      expect(altarSpellsKnown()).toEqual(['grith', 'disir']);
      expect(altarMark(engine)).toBe('none');
      expect(takeGifts({})).toEqual([]);
      // Saving no longer also wins on shop prices.
      const sword = testSword();
      expect(getItemBuyPrice(sword, engine.worldState, pricing)).toBe(getItemBuyPrice(sword));
    });

    it('3 saved, 1 sacrificed: +5/+12, one frith spell of the hero\'s pick, half the mark', () => {
      settle(3);
      expect(engine.getFactionStanding('townsfolk')).toBe(5);
      expect(engine.getFactionStanding('temple_standing')).toBe(12);
      expect(altarSpellsKnown()).toEqual([]);
      expect(altarMark(engine)).toBe('half');

      expect(takeGifts({ siphon_frith_gift: 'disir' })).toEqual(['siphon_frith_gift']);
      expect(altarSpellsKnown()).toEqual(['disir']);
    });

    it('2 and 2: no standing change, one pick of each kind, half the mark', () => {
      settle(2);
      expect(engine.getFactionStanding('townsfolk')).toBe(0);
      expect(engine.getFactionStanding('temple_standing')).toBe(0);
      expect(altarMark(engine)).toBe('half');

      const opened = takeGifts({ siphon_frith_gift: 'grith', siphon_blood_gift: 'draugr_call' });
      expect(opened.sort()).toEqual(['siphon_blood_gift', 'siphon_frith_gift']);
      expect(altarSpellsKnown().sort()).toEqual(['draugr_call', 'grith']);
    });

    it('1 saved, 3 sacrificed: -5/-12, one blood spell of the hero\'s pick, the odd captive buys none', () => {
      settle(1);
      expect(engine.getFactionStanding('townsfolk')).toBe(-5);
      expect(engine.getFactionStanding('temple_standing')).toBe(-12);
      expect(takeGifts({ siphon_blood_gift: 'blood_reap' })).toEqual(['siphon_blood_gift']);
      expect(altarSpellsKnown()).toEqual(['blood_reap']);
    });

    it('4 sacrificed: blood-tainted, -10/-25, both blood spells, the full mark, hero armor withheld', () => {
      settle(0);
      expect(engine.getWorldFlag('blood_tainted_hero')).toBe(true);
      expect(engine.getFactionStanding('townsfolk')).toBe(-10);
      expect(engine.getFactionStanding('temple_standing')).toBe(-25);
      expect(altarSpellsKnown()).toEqual(['blood_reap', 'draugr_call']);
      expect(altarMark(engine)).toBe('full');
      const sword = testSword();
      expect(getItemBuyPrice(sword, engine.worldState, pricing)).toBe(Math.floor(getItemBuyPrice(sword) * 1.15));

      const stock = createGuntherArmory().getAvailableStock(engine.worldState);
      expect(stock.find((item) => item.id === 'gunther-hero-armor')).toBeUndefined();
    });

    it('the endings tell the mark before their last paragraph, half and full apart', () => {
      const sealed = COTW_QUEST.endings!.sealed;
      // No Great Thaw in this state, so the hearths are told as burning low; no mark adds nothing else.
      expect(endingNarrative(sealed, engine.worldState)).toHaveLength(3);

      settle(2);
      const half = endingNarrative(sealed, engine.worldState);
      expect(half).toHaveLength(4);
      expect(half[2]).toContain('the ones who did not');

      const full = endingNarrative(COTW_QUEST.endings!.ragnarok, { ...engine.worldState, counters: { hostages_sacrificed: 4 } });
      expect(full[2]).toContain('the child among them');
      expect(full.some((p) => p.includes('Whether the blood you gave'))).toBe(false);
    });

    it('shows the mark among the hero\'s conditions, half and full apart', () => {
      const shown = (): string[] =>
        (cotwManifest.heroMarks ?? []).filter((m) => evaluatePredicate(m.when, engine.worldState)).map((m) => m.id);
      expect(shown()).toEqual([]);
      sacrificeCaptiveVillager(engine, HOSTAGE_VILLAGERS[0].id);
      expect(shown()).toEqual(['altar_mark_half']);
      HOSTAGE_VILLAGERS.slice(1).forEach((v) => sacrificeCaptiveVillager(engine, v.id));
      expect(shown()).toEqual(['altar_mark_full']);
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

    it('rescuing all four by bumping resolves the ritual as the savior', () => {
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
      // The altar's choice is answered; the frith pick it opens straight after is left open.
      const opened: string[] = [];
      engine.onChoiceInteract = (choice, onSelect) => {
        opened.push(choice.id);
        if (choice.id === 'blood_altar_ritual') onSelect('balance_path');
      };
      player.setPosition(5, 7);
      engine.handlePlayerAction(new MovementAction(player, 0, 1));
      expect(opened).toEqual(['blood_altar_ritual', 'siphon_frith_gift']);

      // Ingrid, who offered herself, was cut loose by hand; of the 3 remaining, balance gives
      // the altar only Sigrid, the other willing one: 3 to 1, a frith pick owed.
      expect(engine.getWorldCounter('hostages_rescued')).toBe(3);
      expect(engine.getWorldCounter('hostages_sacrificed')).toBe(1);
      expect(engine.getWorldFlag(`${HOSTAGE_VILLAGERS[2].id}_sacrificed`)).toBe(true);
      expect(engine.getWorldFlag('siphon_ritual_resolved')).toBe(true);
      expect(engine.getWorldFlag('siphon_frith_gift_owed')).toBe(true);
      expect(engine.getWorldFlag('siphon_blood_gift_owed')).toBe(false);
      expect(HOSTAGE_VILLAGERS.every((v) => map.getEntityById(v.id) === null)).toBe(true);
    });

    /** Walks the hero onto the altar and answers its choice with `optionId`. */
    function useAltar(optionId: string): void {
      map.setTile(5, 8, getTileDefinition(SIPHON_ALTAR_TILE));
      engine.onChoiceInteract = (_choice, onSelect) => onSelect(optionId);
      player.setPosition(5, 7);
      engine.handlePlayerAction(new MovementAction(player, 0, 1));
    }

    it('taking only what was offered gives the altar the two willing, never the child', () => {
      placeCaptives();
      useAltar('balance_path');

      const sacrificed = HOSTAGE_VILLAGERS.filter((v) => engine.getWorldFlag(`${v.id}_sacrificed`)).map((v) => v.name);
      expect(sacrificed).toEqual(['Ingrid of the Mill', 'Sigrid the Weaver']);
      expect(engine.getWorldFlag(`${HOSTAGE_VILLAGERS[3].id}_rescued`)).toBe(true);
    });

    it('the captives speak their offers when the rite begins, and her words come back to a hero who heard them', () => {
      const lines = engine.messages;
      engine.setWorldFlag('zealot_claim_heard', true);
      placeCaptives();
      engine.handlePlayerAction(new WaitAction(player)); // captives in sight: the rite begins

      const ingrid = lines.findIndex((l) => l.includes('Let it be me, and let the others go'));
      const leif = lines.findIndex((l) => l.includes('Young Leif says nothing'));
      expect(ingrid).toBeGreaterThan(-1);
      expect(leif).toBeGreaterThan(ingrid); // the willing speak first
      expect(lines.some((l) => l.includes('Vigdís’s last words come back to you'))).toBe(true);
    });

    it('a hero who never heard her is not reminded of her words', () => {
      const lines = engine.messages;
      placeCaptives();
      engine.handlePlayerAction(new WaitAction(player));
      useAltar('harvest_all');

      expect(lines.some((l) => l.includes('Vigdís'))).toBe(false);
    });

    it('each altar option answers her claim', () => {
      const lines = engine.messages;
      engine.setWorldFlag('zealot_claim_heard', true);
      placeCaptives();
      useAltar('harvest_all');

      expect(lines.some((l) => l.includes('You take her at her word'))).toBe(true);
    });

    it('the countdown starts in sight of a captive and the warlocks take the rest on expiry, buying nothing', () => {
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
      expect(engine.getWorldCounter('hostages_sacrificed')).toBe(0);
      expect(engine.getWorldCounter('hostages_lost')).toBe(3);
      // One saved buys nothing alone, the lost buy nothing at all, and the hero is unmarked.
      expect(engine.getWorldFlag('siphon_frith_gift_owed') || engine.getWorldFlag('siphon_blood_gift_owed')).toBe(false);
      expect(altarMark(engine)).toBe('none');
      expect(engine.getFactionStanding('temple_standing')).toBe(6);
    });

    describe('once the countdown has run out', () => {
      function waitUntilExpired(): void {
        for (let turn = 0; turn < 40 && !engine.getWorldFlag('siphon_ritual_expired'); turn++) {
          engine.handlePlayerAction(new WaitAction(player));
        }
        expect(engine.getWorldFlag('siphon_ritual_expired')).toBe(true);
      }

      it('the next bump frees no one: the last captive is lost, not saved', () => {
        const captives = placeCaptives();
        for (const captive of captives.slice(0, 3)) {
          player.setPosition(captive.x - 1, captive.y);
          engine.handlePlayerAction(new MovementAction(player, 1, 0));
        }
        waitUntilExpired();

        const last = captives[3];
        player.setPosition(last.x - 1, last.y);
        const result = engine.handlePlayerAction(new MovementAction(player, 1, 0));

        expect(result.message ?? '').not.toContain('Freed');
        expect(engine.getWorldCounter('hostages_rescued')).toBe(3);
        expect(engine.getWorldCounter('hostages_lost')).toBe(1);
        expect(engine.getWorldFlag('savior_of_jarnvidr')).toBe(false);
      });

      it('the altar settles no one the warlocks took', () => {
        const [first] = placeCaptives();
        player.setPosition(first.x - 1, first.y);
        engine.handlePlayerAction(new MovementAction(player, 1, 0));
        waitUntilExpired();

        map.setTile(5, 8, getTileDefinition(SIPHON_ALTAR_TILE));
        engine.onChoiceInteract = (choice, onSelect) => {
          if (choice.id === 'blood_altar_ritual') onSelect('balance_path');
        };
        player.setPosition(5, 7);
        engine.handlePlayerAction(new MovementAction(player, 0, 1));

        expect(engine.getWorldCounter('hostages_rescued')).toBe(1);
        expect(engine.getWorldCounter('hostages_sacrificed')).toBe(0);
        expect(engine.getWorldCounter('hostages_lost')).toBe(3);
      });
    });

    it('captives sacrificed while the hero was off the floor are gone when the hero comes back (R-cotw-16)', () => {
      // The countdown ran out elsewhere: the sacrifice could not reach the stored floor 22,
      // where all four still stand when the hero returns.
      HOSTAGE_VILLAGERS.forEach((v) => sacrificeCaptiveVillager(engine, v.id));
      expect(engine.getWorldFlag('siphon_ritual_resolved')).toBe(true);
      placeCaptives();

      engine.handlePlayerAction(new WaitAction(player));

      expect(HOSTAGE_VILLAGERS.every((v) => map.getEntityById(v.id) === null)).toBe(true);
    });

    it('bumping a captive already sacrificed frees no one (R-cotw-16)', () => {
      sacrificeCaptiveVillager(engine, HOSTAGE_VILLAGERS[0].id);
      const [first] = placeCaptives();
      player.setPosition(first.x - 1, first.y);

      const result = engine.handlePlayerAction(new MovementAction(player, 1, 0));

      expect(result.message ?? '').not.toContain('Freed');
      expect(engine.getWorldCounter('hostages_rescued')).toBe(0);
      expect(map.getEntityById(first.id)).toBeNull();
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

  describe('the raid’s taken villagers', () => {
    it('are among the captives: whoever the coven dragged down in the raid is bound at the altar', () => {
      engine.setWorldFlag('prologue-eir_taken', true);
      engine.setWorldFlag('prologue-brandr_taken', true);
      placeCaptives();
      engine.handlePlayerAction(new WaitAction(player));

      const names = HOSTAGE_VILLAGERS.map((v) => map.getEntityById(v.id)!.name);
      expect(names).toEqual(['Eir the Acolyte', 'Torstein the Cooper', 'Brandr the Apprentice', 'Young Leif']);
      // Each wears their own drawing, though the captive's id stays for the flags.
      const looks = HOSTAGE_VILLAGERS.map((v) => (map.getEntityById(v.id) as NPC).spriteKey ?? v.id);
      expect(looks).toEqual(['prologue-eir', 'captive_villager_2', 'prologue-brandr', 'captive_villager_4']);
    });

    it('are named when rescued', () => {
      engine.setWorldFlag('prologue-sigrun_taken', true);
      const captives = placeCaptives();
      engine.handlePlayerAction(new WaitAction(player));
      player.setPosition(captives[1].x - 1, captives[1].y);
      engine.handlePlayerAction(new MovementAction(player, 1, 0));
      expect(engine.messages.some((m) => m.includes('Sigrun'))).toBe(true);
    });

    it('leave the four strangers in their places when the raid took no one, none of them a second Astrid', () => {
      placeCaptives();
      engine.handlePlayerAction(new WaitAction(player));
      const names = HOSTAGE_VILLAGERS.map((v) => map.getEntityById(v.id)!.name);
      expect(names).toEqual(HOSTAGE_VILLAGERS.map((v) => v.name));
      expect(names.join()).not.toMatch(/Astrid/);
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
        const floor = DungeonArc.generateFloor(SIPHON_RITUAL_FLOOR, seed, COTW_QUEST, cotwManifest, 1, undefined, engine.registries);
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
          const floor = DungeonArc.generateFloor(floorNumber, seed, COTW_QUEST, cotwManifest, 1, undefined, engine.registries);
          expect(tilesOfType(floor.map, SIPHON_ALTAR_TILE)).toBe(0);
          expect(floor.map.getEntityById(HOSTAGE_VILLAGERS[0].id)).toBeNull();
        }
      }
    });
  });
});
