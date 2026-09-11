import { describe, it, expect, beforeEach } from 'vitest';
import { DepositToVaultAction, WithdrawFromVaultAction } from '../vaultActions';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Item } from '../../items/item';
import { getVaultItems } from '../../state/worldState';

describe('Generic Remote Vault Actions (vaultActions.ts)', () => {
  let engine: GameEngine;
  let player: Player;

  beforeEach(() => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    player = new Player({
      id: 'vault-tester',
      name: 'Vault Tester',
      position: { x: 5, y: 5 },
    });
    engine = new GameEngine({ map, player });
  });

  it('deposits an item from carried inventory into remote vault partitioned by ID', () => {
    const gem = new Item({
      id: 'rare-gem',
      name: 'Star Sapphire',
      category: 'misc',
      weight: 100,
      bulk: 50,
      value: 1000,
    });
    player.inventory.primaryPack.addItem(gem);
    expect(player.inventory.primaryPack.hasItem(gem.id)).toBe(true);

    const depositAction = new DepositToVaultAction(player, gem, 'town_bank');
    const result = depositAction.perform(engine);

    expect(result.success).toBe(true);
    // Removed from player inventory
    expect(player.inventory.primaryPack.hasItem(gem.id)).toBe(false);

    // Stored in remote vault 'town_bank'
    const bankItems = getVaultItems(engine.worldState, 'town_bank');
    expect(bankItems.length).toBe(1);
    expect(bankItems[0].id).toBe('rare-gem');
    expect(bankItems[0].value).toBe(1000);
  });

  it('withdraws an item from remote vault back into player inventory', () => {
    const relic = new Item({
      id: 'ancient-relic',
      name: 'Ancient Relic',
      category: 'quest',
      weight: 500,
      bulk: 250,
    });
    // Manually seed vault 'dimensional_rift'
    const depositAction = new DepositToVaultAction(player, relic, 'dimensional_rift');
    player.inventory.primaryPack.addItem(relic);
    depositAction.perform(engine);

    expect(getVaultItems(engine.worldState, 'dimensional_rift').length).toBe(1);

    // Withdraw action
    const withdrawAction = new WithdrawFromVaultAction(player, 'ancient-relic', 'dimensional_rift');
    const withdrawResult = withdrawAction.perform(engine);

    expect(withdrawResult.success).toBe(true);
    expect(getVaultItems(engine.worldState, 'dimensional_rift').length).toBe(0);
    expect(player.inventory.primaryPack.hasItem('ancient-relic')).toBe(true);
  });

  it('fails gracefully when attempting to withdraw non-existent item', () => {
    const withdrawAction = new WithdrawFromVaultAction(player, 'ghost-item', 'empty_vault');
    const result = withdrawAction.perform(engine);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Item not found in vault');
  });
});
