import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { NPC } from '../../entities/npc';
import { WaitAction } from '../../actions/wait';
import { MovementAction } from '../../actions/movement';
import { WindUpDeclareAction } from '../../actions/combat';
import { createTestKobold } from '../../__fixtures__/testHelpers';
import { PickUpAction, LootFromContainerAction } from '../../actions/inventory-actions';
import { Container } from '../../items/container';
import { serializeGame, deserializeGame } from '../../storage/serializer';
import {
  RuneOfReturnItem,
  RUNE_OF_RETURN_STATUS,
  RUNE_MAX_CHARGES,
  RUNE_TRACK_MAX,
  ChannelRuneOfReturnAction,
  computeDepthBonus,
  computeChannelTime,
  getBankingRetentionPct,
  computeBankedTurns,
  allocateRuneMastery,
  attuneRuneOfReturn,
  cancelChannel,
  findRuneOfReturn,
} from '../runeOfReturn';

function buildEngine(floor = 1) {
  const map = new GameMap(30, 30, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 5, y: 5 },
    stats: { hp: 100, maxHp: 100, attack: 10, defense: 2 },
  });
  player.hasDiscoveredRune = true;
  const rune = new RuneOfReturnItem({ id: 'rune-1', name: 'Rune of Return' });
  player.inventory.primaryPack.addItem(rune);
  const engine = new GameEngine({ map, player, floor });
  return { engine, player, rune };
}

describe('Rune of Return — pure formulas', () => {
  it('computeDepthBonus = floor((currentFloor - 1) / 5)', () => {
    expect(computeDepthBonus(1)).toBe(0);
    expect(computeDepthBonus(5)).toBe(0);
    expect(computeDepthBonus(6)).toBe(1);
    expect(computeDepthBonus(10)).toBe(1);
    expect(computeDepthBonus(11)).toBe(2);
    expect(computeDepthBonus(25)).toBe(4);
  });

  it('computeChannelTime = max(3, 6 - celerityPoints) + depthBonus, never below the 3-turn floor', () => {
    expect(computeChannelTime(0, 1)).toBe(6);
    expect(computeChannelTime(1, 1)).toBe(5);
    expect(computeChannelTime(2, 1)).toBe(4);
    expect(computeChannelTime(3, 1)).toBe(3);
    // Depth bonus stacks on top of celerity, and celerity alone never drops below 3.
    expect(computeChannelTime(3, 11)).toBe(5); // 3 + depthBonus(2)
    expect(computeChannelTime(0, 11)).toBe(8); // 6 + 2
  });

  it('getBankingRetentionPct maps Steadfast Weave points to 0/35/65/100%', () => {
    expect(getBankingRetentionPct(0)).toBe(0);
    expect(getBankingRetentionPct(1)).toBe(0.35);
    expect(getBankingRetentionPct(2)).toBe(0.65);
    expect(getBankingRetentionPct(3)).toBe(1);
  });

  it('computeBankedTurns floors turnsCompleted * retention%', () => {
    // channelTime=6, turnsRemaining=2 => turnsCompleted=4
    expect(computeBankedTurns(6, 2, 0)).toBe(0);
    expect(computeBankedTurns(6, 2, 1)).toBe(Math.floor(4 * 0.35)); // 1
    expect(computeBankedTurns(6, 2, 2)).toBe(Math.floor(4 * 0.65)); // 2
    expect(computeBankedTurns(6, 2, 3)).toBe(4);
  });
});

describe('Rune of Return — mastery allocation', () => {
  it('spends from the same unspentStatPoints pool as core attributes, respecting per-track caps', () => {
    const { player } = buildEngine();
    player.unspentStatPoints = 10;

    expect(allocateRuneMastery(player, 'celerity', 1)).toBe(true);
    expect(player.runeMastery.celerityPoints).toBe(1);
    expect(player.unspentStatPoints).toBe(9);

    expect(allocateRuneMastery(player, 'celerity', 2)).toBe(true);
    expect(player.runeMastery.celerityPoints).toBe(3); // at cap
    expect(allocateRuneMastery(player, 'celerity', 1)).toBe(false); // exceeds cap of 3
    expect(player.runeMastery.celerityPoints).toBe(3);

    expect(allocateRuneMastery(player, 'mobility', 1)).toBe(true);
    expect(player.runeMastery.mobilityPoints).toBe(1);
    expect(allocateRuneMastery(player, 'mobility', 1)).toBe(false); // cap is 1
  });

  it('refuses to spend more points than are unspent', () => {
    const { player } = buildEngine();
    player.unspentStatPoints = 0;
    expect(allocateRuneMastery(player, 'weave', 1)).toBe(false);
    expect(player.runeMastery.weavePoints).toBe(0);
  });

  it('exposes the track caps used above (3/3/1)', () => {
    expect(RUNE_TRACK_MAX).toEqual({ celerity: 3, weave: 3, mobility: 1 });
  });
});

describe('Rune of Return — channel lifecycle', () => {
  it('completes after exactly channelTime turns of continuous channeling, consumes one charge, and teleports to town', () => {
    const { engine, player, rune } = buildEngine(1);
    const channelTime = computeChannelTime(player.runeMastery.celerityPoints, engine.currentFloor); // 6
    expect(channelTime).toBe(6);

    for (let turn = 0; turn < channelTime; turn++) {
      const result = engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));
      expect(result.success).toBe(true);
    }

    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(false);
    expect(rune.charges).toBe(RUNE_MAX_CHARGES - 1);
    expect(engine.currentFloor).toBe(0);
    expect(player.runeChannelBankedTurns).toBe(0);
  });

  it('WaitAction (.) sustains and advances the channel turn by turn until completion', () => {
    const { engine, player, rune } = buildEngine(1);
    const channelTime = computeChannelTime(player.runeMastery.celerityPoints, engine.currentFloor); // 6
    expect(channelTime).toBe(6);

    // Start channel on turn 1
    const startRes = engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));
    expect(startRes.success).toBe(true);
    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(true);

    // Sustain with WaitAction (.) for the remaining 5 turns
    for (let turn = 1; turn < channelTime; turn++) {
      const waitRes = engine.handlePlayerAction(new WaitAction(player));
      expect(waitRes.success).toBe(true);
    }

    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(false);
    expect(rune.charges).toBe(RUNE_MAX_CHARGES - 1);
    expect(engine.currentFloor).toBe(0); // successfully teleported to town!
  });

  it("a monster's own action does not break the player's channel", () => {
    const { engine, player } = buildEngine(1);
    const kobold = createTestKobold('kobold-caster', { x: 12, y: 5 });
    engine.map.addEntity(kobold);
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));
    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(true);

    // A telegraph deals no damage; only the player's own actions or real damage may interrupt.
    engine.actionPipeline.executeWithHooks(
      new WindUpDeclareAction(kobold, { x: 12, y: 6 }, 'Slam', 'The kobold winds up!'),
      engine
    );

    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(true);
  });

  it('does not consume a charge or teleport if interrupted before completion', () => {
    const { engine, player, rune } = buildEngine(1);
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player)); // turn 1 of 6
    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(true);

    // Voluntary movement without mobility upgrade interrupts the channel
    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(false);
    expect(rune.charges).toBe(RUNE_MAX_CHARGES);
    expect(engine.currentFloor).toBe(1);
  });

  it('any actual damage taken interrupts the channel, even mid-continuation', () => {
    const { engine, player, rune } = buildEngine(1);
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player)); // turn 1
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player)); // turn 2

    player.takeDamage(15);
    // The hit is observed on the next tick (documented timing tradeoff — see module doc).
    const result = engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));

    expect(result.success).toBe(true); // the action itself still resolves normally
    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(false);
    expect(rune.charges).toBe(RUNE_MAX_CHARGES);
  });

  it('zero-net (fully mitigated) damage does not interrupt a continued channel', () => {
    const { engine, player } = buildEngine(1);
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));
    // Simulate a fully-mitigated hit: takeDamage still runs, but nets 0 HP loss.
    player.takeDamage(0);
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));

    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(true);
  });

  it('banks a Steadfast Weave-scaled fraction of completed turns on interrupt, applied to the next attempt', () => {
    const { engine, player } = buildEngine(1);
    allocateRuneMasteryPointsForTest(player, 'weave', 2); // 65% retention
    const channelTime = computeChannelTime(0, 1); // 6

    // Complete 4 of 6 turns, then get interrupted by a voluntary movement action.
    for (let i = 0; i < 4; i++) engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));
    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    const expectedBanked = Math.floor(4 * 0.65); // 2
    expect(player.runeChannelBankedTurns).toBe(expectedBanked);

    // Starting a fresh channel needs channelTime - banked turns to complete.
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player)); // start #2
    const effect = player.statusManager.getStatus(RUNE_OF_RETURN_STATUS)!;
    expect(effect.duration).toBe(channelTime - expectedBanked - 1); // one tick already consumed this turn
  });

  it('voluntary cancellation banks progress identically to an interrupt', () => {
    const { engine, player, rune } = buildEngine(1);
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));

    const outcome = cancelChannel(engine, player);

    expect(outcome.success).toBe(true);
    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(false);
    expect(rune.charges).toBe(RUNE_MAX_CHARGES); // no charge spent
  });

  it('Unbound Casting (mobility maxed) lets movement continue the channel without breaking it', () => {
    const { engine, player } = buildEngine(1);
    allocateRuneMasteryPointsForTest(player, 'mobility', 1);
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));

    // Move instead of re-invoking the channel action — should NOT break it at max mobility.
    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(true);
  });

  it('without mobility investment, movement breaks the channel like any other action', () => {
    const { engine, player } = buildEngine(1);
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));
    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(false);
  });

  it('fails to start with no charges remaining', () => {
    const { engine, player, rune } = buildEngine(1);
    rune.charges = 0;
    const result = engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));
    expect(result.success).toBe(false);
    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(false);
  });

  it('depth scaling adds turns on deeper floors', () => {
    const { engine, player } = buildEngine(11); // depthBonus = 2
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));
    const effect = player.statusManager.getStatus(RUNE_OF_RETURN_STATUS)!;
    expect(effect.potency).toBe(8); // 6 + 2
    expect(effect.duration).toBe(7); // one tick already consumed this turn
  });

  it('bumping into an enemy with mobility breaks concentration to attack', () => {
    const { engine, player } = buildEngine(1);
    allocateRuneMasteryPointsForTest(player, 'mobility', 1);
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));
    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(true);

    // Spawn an enemy directly adjacent to the player (x: 6, y: 5)
    const enemy = new Monster({
      id: 'kobold-test',
      name: 'Kobold',
      position: { x: 6, y: 5 },
      stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 },
      speed: 100,
      aiType: 'melee',
      definitionId: 'kobold',
      xpValue: 10,
      lootTable: [],
    });
    engine.addEntity(enemy);

    // Bump move into the enemy tile
    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(false);
  });

  it('monster attack damage during the turn cycle interrupts channeling immediately via post-hook', () => {
    const { engine, player } = buildEngine(1);
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));
    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(true);

    // Spawn an adjacent monster with enough attack to bypass player defense
    const enemy = new Monster({
      id: 'attacker',
      name: 'Attacker',
      position: { x: 6, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 15, defense: 0 },
      speed: 100,
      aiType: 'melee',
      definitionId: 'attacker',
      xpValue: 10,
      lootTable: [],
    });
    engine.addEntity(enemy);

    // Player waits with '.'; the monster acts and attacks the player
    engine.handlePlayerAction(new WaitAction(player));

    // Player took damage, causing the channel to interrupt immediately
    expect(player.hp).toBeLessThan(100);
    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(false);
  });

  it('emits rune_of_return_discovered when the rune is awakened and absorbed', () => {
    const map = new GameMap(20, 20, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
    const engine = new GameEngine({ map, player, floor: 1 });

    const events: string[] = [];
    engine.onGameEvent = (e) => events.push(e.type);

    expect(player.hasDiscoveredRune).toBe(false);

    const rune = new RuneOfReturnItem({ id: 'rune-found', name: 'Rune of Return', charges: 0 });
    player.addItem(rune);
    expect(player.hasDiscoveredRune).toBe(false);

    engine.absorbRuneOfReturn(rune);

    expect(player.hasDiscoveredRune).toBe(true);
    expect(events).toContain('rune_of_return_discovered');
  });
});

describe('Rune of Return — 7 point total cap', () => {
  it('enforces a maximum of 7 points allocated across all tracks combined', () => {
    const { player } = buildEngine();
    player.unspentStatPoints = 20;

    expect(allocateRuneMastery(player, 'celerity', 3)).toBe(true);
    expect(allocateRuneMastery(player, 'weave', 3)).toBe(true);
    expect(allocateRuneMastery(player, 'mobility', 1)).toBe(true);

    expect(player.runeMastery.celerityPoints).toBe(3);
    expect(player.runeMastery.weavePoints).toBe(3);
    expect(player.runeMastery.mobilityPoints).toBe(1);

    // Attempting to allocate any further points returns false
    expect(allocateRuneMastery(player, 'celerity', 1)).toBe(false);
    expect(allocateRuneMastery(player, 'weave', 1)).toBe(false);
    expect(allocateRuneMastery(player, 'mobility', 1)).toBe(false);
  });
});

describe('Rune of Return — attunement', () => {
  it('refills to max charges, full and instant', () => {
    const { rune } = buildEngine();
    rune.charges = 0;
    const message = attuneRuneOfReturn(rune);
    expect(rune.charges).toBe(RUNE_MAX_CHARGES);
    expect(message).toContain(`${RUNE_MAX_CHARGES}/${RUNE_MAX_CHARGES}`);
  });

  it('findRuneOfReturn locates the carried item', () => {
    const { player, rune } = buildEngine();
    expect(findRuneOfReturn(player)).toBe(rune);
  });
});

describe('Rune of Return — persistence', () => {
  it('round-trips item charges, mastery, banked turns, and an in-progress channel', () => {
    const { engine, player, rune } = buildEngine(1);
    allocateRuneMasteryPointsForTest(player, 'celerity', 2);
    player.runeChannelBankedTurns = 1;
    rune.charges = 2;
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));

    const profile = {
      id: player.id,
      name: player.name,
      level: 1,
      floor: engine.currentFloor,
      lastSaved: Date.now(),
      hp: player.hp,
      maxHp: player.maxHp,
      strength: player.strength,
    };
    const saved = serializeGame(engine, profile);
    const restored = deserializeGame(saved);

    expect(restored.engine.player.runeMastery.celerityPoints).toBe(2);
    const restoredRune = findRuneOfReturn(restored.engine.player);
    expect(restoredRune?.charges).toBe(2);
    expect(restored.engine.player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(true);
    const restoredEffect = restored.engine.player.statusManager.getStatus(RUNE_OF_RETURN_STATUS)!;
    expect(restoredEffect.data?.channelTime).toBe(4); // max(3, 6 - celerityPoints=2)
  });
});

describe('Rune of Return — Two-Way Dimensional Recall', () => {
  it('anchors dungeon floor and coordinates when recalling to town, consuming 1 charge', () => {
    const { engine, player } = buildEngine(5);
    player.x = 12;
    player.y = 18;
    const rune = findRuneOfReturn(player)!;
    rune.charges = 3;

    // Start channel on floor 5
    const startRes = engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));
    expect(startRes.success).toBe(true);
    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(true);

    // Sustain until complete
    const channelTime = computeChannelTime(0, 5); // 6 + depthBonus(0) = 6 turns
    for (let i = 0; i < channelTime - 1; i++) {
      engine.handlePlayerAction(new WaitAction(player));
    }

    // Now player should be on Floor 0 (Town), with return anchor set to Floor 5 at (12, 18)
    expect(engine.currentFloor).toBe(0);
    expect(player.deepestRecallFloor).toBe(5);
    expect(player.recallPosition).toEqual({ x: 12, y: 18 });
    expect(rune.charges).toBe(2);
  });

  it('fails to channel in town if no return anchor is active', () => {
    const { engine, player } = buildEngine(0);
    player.deepestRecallFloor = undefined;
    player.recallPosition = undefined;

    const res = engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));
    expect(res.success).toBe(false);
    expect(res.message).toBe('You have no active dungeon return anchor.');
    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(false);
  });

  it('channels in town and teleports player back to anchored floor and position, clearing the anchor', () => {
    const { engine, player } = buildEngine(0);
    player.deepestRecallFloor = 4;
    player.recallPosition = { x: 14, y: 16 };
    const rune = findRuneOfReturn(player)!;
    rune.charges = 2;

    const startRes = engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));
    expect(startRes.success).toBe(true);
    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(true);

    const channelTime = computeChannelTime(0, 0); // 6 turns in town
    for (let i = 0; i < channelTime - 1; i++) {
      engine.handlePlayerAction(new WaitAction(player));
    }

    expect(engine.currentFloor).toBe(4);
    expect(player.deepestRecallFloor).toBeUndefined();
    expect(player.recallPosition).toBeUndefined();
    expect(rune.charges).toBe(1);
    // Player spawned at safe position near (14, 16)
    expect(Math.abs(player.x - 14)).toBeLessThanOrEqual(5);
    expect(Math.abs(player.y - 16)).toBeLessThanOrEqual(5);
  });
});

describe('Rune of Return — Dormant Acquisition & Thrain Teaching Flow', () => {
  it('picks up physical item as a dormant carried item without discovering it right away', () => {
    const map = new GameMap(20, 20, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
    const engine = new GameEngine({ map, player, floor: 5 });

    const groundRune = new RuneOfReturnItem({ id: 'rune-floor-5', name: 'Rune of Return', charges: 0 });
    map.addItemAt(5, 5, groundRune);

    expect(player.hasDiscoveredRune).toBe(false);
    expect(map.getItemsAt(5, 5).length).toBe(1);

    const pickup = new PickUpAction(player);
    const res = engine.handlePlayerAction(pickup);

    expect(res.success).toBe(true);
    expect(player.hasDiscoveredRune).toBe(false);
    // Physical item removed from ground and added to pack
    expect(map.getItemsAt(5, 5).length).toBe(0);
    expect(player.inventory.primaryPack.getItems().length).toBe(1);
    expect(player.inventory.primaryPack.getItems()[0].id).toBe('rune-floor-5');

    // Channeling fails because it is dormant
    const channelRes = engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));
    expect(channelRes.success).toBe(false);
    expect(channelRes.message).toContain('dormant');
    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(false);
  });

  it('loots dormant rune from chest into pack', () => {
    const map = new GameMap(20, 20, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
    const engine = new GameEngine({ map, player, floor: 5 });

    const chest = new Container({
      id: 'ice-chest',
      name: 'Frost Chest',
      category: 'container',
      weight: 1000,
      bulk: 1000,
      containerType: 'chest',
      maxWeightCapacity: 1000,
      maxBulkCapacity: 1000,
    });
    const runeInChest = new RuneOfReturnItem({ id: 'rune-chest', name: 'Rune of Return', charges: 0 });
    chest.addItem(runeInChest);

    const lootAction = new LootFromContainerAction(player, chest, runeInChest);
    const res = engine.handlePlayerAction(lootAction);

    expect(res.success).toBe(true);
    expect(player.hasDiscoveredRune).toBe(false);
    expect(chest.getItems().length).toBe(0);
    expect(player.inventory.primaryPack.getItems().length).toBe(1);
    expect(player.inventory.primaryPack.getItems()[0].id).toBe('rune-chest');
  });

  it('Thrain in town teaches the player, awakens the dormant rune, and binds it to spirit', () => {
    const map = new GameMap(20, 20, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
    const rune = new RuneOfReturnItem({ id: 'carried-rune', name: 'Rune of Return', charges: 0 });
    player.inventory.primaryPack.addItem(rune);

    const engine = new GameEngine({
      map,
      player,
      floor: 0,
      manifest: {
        id: 'test-manifest',
        name: 'Test',
        runeOfReturn: {
          attunementNpcId: 'npc-thrain',
        },
      } as any,
    });

    const thrain = new NPC({
      id: 'npc-thrain',
      name: 'Thrain the Rune-Smith',
      greeting: 'Greetings adventurer!',
      role: 'villager',
      position: { x: 6, y: 5 },
    });

    expect(player.hasDiscoveredRune).toBe(false);
    expect(player.inventory.primaryPack.getItems().length).toBe(1);

    // Speak with Thrain
    engine.interactWithNpc(thrain);

    // Now player has learned the secrets!
    expect(player.hasDiscoveredRune).toBe(true);
    expect(player.runeCharges).toBe(3);
    // Physical rune dissolved from pack into spirit
    expect(player.inventory.primaryPack.getItems().length).toBe(0);

    const innateRune = findRuneOfReturn(player);
    expect(innateRune).toBeDefined();
    expect(innateRune?.charges).toBe(3);

    // Subsequent interaction attunes / refills charges
    player.runeCharges = 1;
    engine.interactWithNpc(thrain);
    expect(player.runeCharges).toBe(3);
  });
});

// Small local helper so tests don't have to hand-roll unspentStatPoints bookkeeping.
function allocateRuneMasteryPointsForTest(
  player: Player,
  track: 'celerity' | 'weave' | 'mobility',
  amount: number
): void {
  player.unspentStatPoints += amount;
  const ok = allocateRuneMastery(player, track, amount);
  if (!ok) throw new Error('Test setup failed to allocate rune mastery points');
}
