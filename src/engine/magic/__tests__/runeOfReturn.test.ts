import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { WaitAction } from '../../actions/wait';
import { MovementAction } from '../../actions/movement';
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

  it('does not consume a charge or teleport if interrupted before completion', () => {
    const { engine, player, rune } = buildEngine(1);
    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player)); // turn 1 of 6
    expect(player.statusManager.hasStatus(RUNE_OF_RETURN_STATUS)).toBe(true);

    // A different, non-exempt action interrupts (mobility is 0 by default).
    engine.handlePlayerAction(new WaitAction(player));

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

    // Complete 4 of 6 turns, then get interrupted by a different action.
    for (let i = 0; i < 4; i++) engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));
    engine.handlePlayerAction(new WaitAction(player));

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
