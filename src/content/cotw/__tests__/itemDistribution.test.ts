import { describe, it, expect } from 'vitest';
import { COTW_STARTER_KIT } from '../character';
import { COTW_TOWN } from '../town';
import { COTW_VAULTS } from '../vaults';
import { MINIBOSS_MONSTERS } from '../monsters/minibosses';
import { COTW_MONSTERS } from '../monsters';
import { COTW_ITEMS } from '../items';
import { Player } from '../../../engine/entities/player';
import { CharacterRoller } from '../../../engine/character/characterRoller';
import { getItemBuyPrice, getItemSellPrice } from '../../../engine/economy/merchant';
import { COIN_VALUES } from '../../../engine/economy/types';
import { CoinItem } from '../../../engine/economy/currency';

describe('CotW Item Distribution & Economic Integration', () => {
  it('equips authentic CotW starter items on new character roll', () => {
    const player = new Player({
      id: 'test-hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      level: 1,
    });

    CharacterRoller.equipStartingKit(
      player,
      'test-hero',
      COTW_STARTER_KIT,
      COTW_ITEMS,
      () => 0.5
    );

    // Main hand weapon
    const weapon = player.inventory.paperdoll.getItem('mainHand');
    expect(weapon).toBeDefined();
    expect(weapon?.definitionId).toBe('mammut_bone_cudgel');

    // Torso armor
    const armor = player.inventory.paperdoll.getItem('torso');
    expect(armor).toBeDefined();
    expect(armor?.definitionId).toBe('layered_fur_jerkin');

    // Feet boots
    const boots = player.inventory.paperdoll.getItem('feet');
    expect(boots).toBeDefined();
    expect(boots?.definitionId).toBe('bound_hide_wrappings');

    // Purse container
    const purse = player.inventory.paperdoll.getItem('purse');
    expect(purse).toBeDefined();
    expect(purse?.definitionId).toBe('leather_coin_pouch');

    // Waist belt container
    const belt = player.inventory.paperdoll.getItem('waist');
    expect(belt).toBeDefined();
    expect(belt?.definitionId).toBe('braided_sinew_cord');

    // Pack consumables
    const packItems = player.inventory.primaryPack.getItems();
    const packItemKeys = packItems.map((i) => i.definitionId ?? i.id);
    expect(packItemKeys.some((id) => id.includes('travel_bread'))).toBe(true);
    expect(packItemKeys.some((id) => id.includes('hearth_broth_flask'))).toBe(true);
    expect(packItemKeys.some((id) => id.includes('birch_tar_poultice'))).toBe(true);
    expect(packItemKeys.some((id) => id.includes('scroll_phase_door'))).toBe(true);
  });

  it('populates Olaf the Chandler with packs, cords, wraps, and sustenance', () => {
    const olaf = COTW_TOWN.npcs.find((n) => n.id === 'npc-olaf');
    expect(olaf?.merchantConfig).toBeDefined();
    const stock = olaf!.merchantConfig!.initialInventory;
    const stockKeys = stock.map((i) => i.definitionId ?? i.id);

    expect(stockKeys.some((id) => id.includes('sealskin_rucksack'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('leather_coin_pouch'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('braided_sinew_cord'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('tattered_travelers_wrap'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('bound_hide_wrappings'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('hearth_broth_flask'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('birch_tar_poultice'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('bread'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('torch'))).toBe(true);
  });

  it('populates Gunther the Smith with Norse arms, armor, and forge implements', () => {
    const gunther = COTW_TOWN.npcs.find((n) => n.id === 'npc-gunther');
    expect(gunther?.merchantConfig).toBeDefined();
    const stock = gunther!.merchantConfig!.initialInventory;
    const stockKeys = stock.map((i) => i.definitionId ?? i.id);

    expect(stockKeys.some((id) => id.includes('mammut_bone_cudgel'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('rime_bit_chisel'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('cinder_edge_shortsword'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('forge_tongue_hammer'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('lashed_driftwood_buckler'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('bellows_plate_shield'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('layered_fur_jerkin'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('mammut_hide_brigandine'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('cinder_quenched_hauberk'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('skraeling_bone_circlet'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('soot_visored_helm'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('crampon_nailed_boots'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('duergar_forge_gauntlets'))).toBe(true);
  });

  it('populates Astrid the Alchemist with herbal curatives and tactical tools', () => {
    const astrid = COTW_TOWN.npcs.find((n) => n.id === 'npc-astrid');
    expect(astrid?.merchantConfig).toBeDefined();
    const stock = astrid!.merchantConfig!.initialInventory;
    const stockKeys = stock.map((i) => i.definitionId ?? i.id);

    expect(stockKeys.some((id) => id.includes('hearth_broth_flask'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('birch_tar_poultice'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('bog_myrtle_tonic'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('bog_iron_whetstone'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('bellows_skin_canteen'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('ice_stave_rune_tablet'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('rune_scratched_bark_map'))).toBe(true);
    expect(stockKeys.some((id) => id.includes('charm_watchful_eye'))).toBe(true);
  });

  it('prices every town item on the same copper scale as the starting purse', () => {
    // Engine ItemFactory builders carry legacy prices ~100x the pack's scale; a
    // playtest found 20 GP bread against a 3.5 GP starting purse.
    const startingPurseCp = COTW_STARTER_KIT.coins!.reduce(
      (sum, c) => sum + c.count * COIN_VALUES[c.denomination],
      0
    );
    for (const npc of COTW_TOWN.npcs) {
      for (const item of npc.merchantConfig?.initialInventory ?? []) {
        expect(getItemBuyPrice(item), `${npc.name}: ${item.name}`).toBeLessThanOrEqual(startingPurseCp);
      }
    }
  });

  it('guarantees Níðhögg’s Fang drop from level 45 miniboss Víðnir', () => {
    const herald = MINIBOSS_MONSTERS.find((m) => m.id === 'miniboss_maw_herald');
    expect(herald).toBeDefined();
    expect(herald!.minFloor).toBe(45);
    expect(herald!.tags).toContain('miniboss');

    const fangRule = herald!.lootTable?.find((r) => {
      const item = r.generate('test-drop', () => 0.5);
      return item.id === 'nidhogg_fang' || item.definitionId === 'nidhogg_fang';
    });
    expect(fangRule).toBeDefined();
    expect(fangRule!.chance).toBe(1.0);
  });

  it('places level 45 vault holding Víðnir and the Dragon Maw', () => {
    const vault = COTW_VAULTS.find((v) => v.id === 'floor45_fang_vault');
    expect(vault).toBeDefined();
    expect(vault!.minFloor).toBe(45);
    expect(vault!.maxFloor).toBe(45);
    expect(vault!.minibossId).toBe('miniboss_maw_herald');
    expect(vault!.layout.some((row) => row.includes('K'))).toBe(true);
  });

  it('guarantees corrupted item drops from zone minibosses', () => {
    // 1. Gálmr (Floor 5) -> Brim-Wolf Pelt Hood
    const galmr = MINIBOSS_MONSTERS.find((m) => m.id === 'miniboss_frost_warden')!;
    const hoodDrop = galmr.lootTable?.some((r) => {
      const item = r.generate('test-hood', () => 0.5);
      return item.id === 'brim_wolf_pelt_hood' || item.definitionId === 'brim_wolf_pelt_hood';
    });
    expect(hoodDrop).toBe(true);

    // 2. Svartr (Floor 36) -> Rot-Porous Cleaver (Corrupted)
    const rotMatriarch = MINIBOSS_MONSTERS.find((m) => m.id === 'miniboss_rot_matriarch')!;
    expect(rotMatriarch.minFloor).toBe(36);
    const cleaverDrop = rotMatriarch.lootTable?.some((r) => {
      const item = r.generate('test-cleaver', () => 0.5);
      return (item.id === 'rot_porous_cleaver' || item.definitionId === 'rot_porous_cleaver') && item.quality === 'cursed';
    });
    expect(cleaverDrop).toBe(true);

    // 3. Gloom-Tarr (Floor 44) -> Níð-Dripping Hauberk (Corrupted)
    const tarAbomination = MINIBOSS_MONSTERS.find((m) => m.id === 'miniboss_tar_abomination')!;
    expect(tarAbomination.minFloor).toBe(44);
    const hauberkDrop = tarAbomination.lootTable?.some((r) => {
      const item = r.generate('test-hauberk', () => 0.5);
      return (item.id === 'nid_dripping_hauberk' || item.definitionId === 'nid_dripping_hauberk') && item.quality === 'cursed';
    });
    expect(hauberkDrop).toBe(true);

    // 4. Sköll (Floor 47) -> Marrow-Gnawed Ring (Corrupted)
    const marrowEater = MINIBOSS_MONSTERS.find((m) => m.id === 'miniboss_marrow_eater')!;
    expect(marrowEater.minFloor).toBe(47);
    const ringDrop = marrowEater.lootTable?.some((r) => {
      const item = r.generate('test-ring', () => 0.5);
      return (item.id === 'marrow_gnawed_ring' || item.definitionId === 'marrow_gnawed_ring') && item.quality === 'cursed';
    });
    expect(ringDrop).toBe(true);
  });

  it('ensures every monster loot drop uses pack definitions and pack price scale', () => {
    const cotwItemMap = new Map(COTW_ITEMS.map((i) => [i.id, i]));
    for (const monster of COTW_MONSTERS) {
      for (const rule of monster.lootTable ?? []) {
        const item = rule.generate('probe', () => 0.5);
        if (item instanceof CoinItem) continue;
        expect(
          item.definitionId,
          `${monster.name} (${monster.id}) generated item without definitionId: ${item.name}`
        ).toBeDefined();
        const def = cotwItemMap.get(item.definitionId!);
        expect(def, `${monster.id} generated unknown definition ${item.definitionId}`).toBeDefined();
        expect(getItemSellPrice(item), `${monster.id}: ${item.name}`).toBeLessThanOrEqual(def!.value ?? 0);
      }
    }
  });
});

