import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { GameEngine } from '../../engine';
import { DeathResolver } from '../../combat/deathResolver';
import { DeathEnvelopeTracker, type DeathEnvelope } from '../deathEnvelope';
import { HookDispatcher } from '../../hooks/hookDispatcher';
import { Item } from '../../items/item';

describe('DeathEnvelope & Run-Failure Telemetry', () => {
  let map: GameMap;
  let player: Player;
  let killer: Monster;
  let engine: GameEngine;

  beforeEach(() => {
    DeathEnvelopeTracker.clearHistory();
    map = new GameMap(10, 10, TILES.FLOOR);
    player = new Player({
      id: 'hero',
      name: 'Ragnar',
      position: { x: 3, y: 3 },
      stats: { hp: 10, maxHp: 30, attack: 5, defense: 2 },
    });
    killer = new Monster({
      id: 'ogre-1',
      name: 'Mountain Ogre',
      definitionId: 'mountain_ogre',
      position: { x: 3, y: 4 },
      stats: { hp: 40, maxHp: 40, attack: 15, defense: 4 },
    });
    map.addEntity(player);
    map.addEntity(killer);
    engine = new GameEngine({ map, player, floor: 5 });
    engine.turnCount = 142;
  });

  it('compiles comprehensive DeathEnvelope upon player death in DeathResolver', () => {
    // Equip items with synergy tags
    const fireSword = new Item({
      id: 'blade',
      name: 'Flame Blade',
      unidentifiedName: 'Sword',
      category: 'weapon',
      weight: 1000,
      bulk: 500,
      quality: 'enchanted',
      identified: true,
      stats: { attackBonus: 5 },
      elementalAffix: { name: 'Flaming', element: 'fire', bonusDamage: 4 },
      aspectState: 'aligned_a',
    });
    player.inventory.paperdoll.equip(fireSword, 'mainHand');
    player.corruptionScore = 35;
    player.planeId = 'liminal';

    // Player takes fatal damage
    DeathResolver.resolveDeath(engine, killer, player);

    const envelope = DeathEnvelopeTracker.getLatestEnvelope();
    expect(envelope).not.toBeNull();
    expect(envelope?.victimName).toBe('Ragnar');
    expect(envelope?.killerArchetypeId).toBe('mountain_ogre');
    expect(envelope?.planeDepth).toBe(5);
    expect(envelope?.activePlaneId).toBe('liminal');
    expect(envelope?.corruptionLevel).toBe(35);
    expect(envelope?.turnsElapsed).toBe(142);
    expect(envelope?.equippedSynergyTags).toContain('element:fire');
    expect(envelope?.equippedSynergyTags).toContain('aspect:aligned_a');
    expect(envelope?.equippedSynergyTags).toContain('category:weapon');
  });

  it('dispatches onPlayerDefeated hook to HookDispatcher and notifies external subscribers', () => {
    const dispatchSpy = vi.spyOn(HookDispatcher, 'dispatch');
    let subscriberEnvelope: DeathEnvelope | null = null;

    const unsubscribe = DeathEnvelopeTracker.subscribe((env) => {
      subscriberEnvelope = env;
    });

    DeathResolver.resolveDeath(engine, killer, player);

    expect(dispatchSpy).toHaveBeenCalledWith(
      'onPlayerDefeated',
      expect.objectContaining({
        attacker: killer,
        defender: player,
      })
    );

    expect(subscriberEnvelope).not.toBeNull();
    expect((subscriberEnvelope as any)?.victimName).toBe('Ragnar');
    expect(DeathEnvelopeTracker.getHistory().length).toBe(1);

    unsubscribe();
    DeathEnvelopeTracker.recordPlayerDeath(engine, killer);
    expect(DeathEnvelopeTracker.getHistory().length).toBe(2);
  });
});
