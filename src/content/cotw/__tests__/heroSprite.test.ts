import { describe, it, expect } from 'vitest';
import type { EquipmentSlot, HeroGear, Item } from '../../../engine';
import { ItemFactory } from '../../../engine/items/factory';
import { makeShopItem } from '../items/makeItem';
import { COTW_HERO_SPRITE, heroLook, parseHeroLook } from '../sprites/heroLook';
import { COTW_ITEMS } from '../items';

function gear(worn: Partial<Record<EquipmentSlot, Item>>, gender: HeroGear['gender'] = 'male'): HeroGear {
  return { gender, equipped: (slot) => worn[slot] ?? null };
}
const item = (id: string): Item => makeShopItem(id, `${id}-1`);

describe('the cotw hero sprite reads the gear the hero wears', () => {
  it('names each catalogue weapon by the kind it is drawn as', () => {
    const expected: Record<string, string> = {
      dagger: 'dagger',
      tarnished_quicksilver_stiletto: 'dagger',
      rime_bit_chisel: 'dagger',
      shortsword: 'sword',
      broadsword: 'sword',
      frost_blade: 'sword',
      cinder_edge_shortsword: 'sword',
      heartwood_longsword: 'sword',
      mythril_longsword: 'sword',
      two_handed_sword: 'sword',
      adamantine_greatsword: 'sword',
      nidhogg_fang: 'sword',
      battleaxe: 'axe',
      rot_porous_cleaver: 'axe',
      cursed_mace: 'mace',
      morningstar: 'mace',
      mammut_bone_cudgel: 'mace',
      forge_tongue_hammer: 'hammer',
      pit_draugr_pick: 'hammer',
      duergar_slag_tongs: 'hammer',
      skraeling_ice_spear: 'spear',
      sol_brand_glaive: 'spear',
      ironwood_bough_stave: 'staff',
    };
    const weapons = COTW_ITEMS.filter((def) => def.category === 'weapon').map((def) => def.id);
    expect(weapons.sort()).toEqual(Object.keys(expected).sort());
    for (const id of weapons) {
      expect([id, heroLook(gear({ mainHand: item(id) })).weapon]).toEqual([id, expected[id]]);
    }
  });

  it('draws the starter dagger, which has no definition id, as a dagger', () => {
    expect(heroLook(gear({ mainHand: ItemFactory.createDagger() })).weapon).toBe('dagger');
  });

  it('bands body armour by weight: hide and mail shirts light, hauberks medium, plate heavy', () => {
    const band = (id: string) => heroLook(gear({ torso: item(id) })).armor;
    expect(band('layered_fur_jerkin')).toBe('light');
    expect(band('leather_armor')).toBe('light');
    expect(band('mammut_hide_brigandine')).toBe('light');
    expect(band('cinder_quenched_hauberk')).toBe('medium');
    expect(band('chainmail')).toBe('medium');
    expect(band('obsidian_scale_cuirass')).toBe('heavy');
    expect(band('plate_armor')).toBe('heavy');
    expect(heroLook(gear({})).armor).toBe('none');
  });

  it('carries a torch, a round shield or a tower shield in the off hand, and no prism focus', () => {
    const off = (id: string) => heroLook(gear({ offHand: item(id) })).off;
    expect(off('wooden_torch')).toBe('torch');
    expect(off('wooden_shield')).toBe('round');
    expect(off('aegis_shield')).toBe('round');
    expect(off('steel_tower_shield')).toBe('tower');
    expect(off('petrified_world_bark_tower_shield')).toBe('tower');
    expect(off('sol_shard_focus')).toBe('none');
  });

  it('keys a look so it reads back, and reads an unknown key as the bare hero', () => {
    const worn = gear({ mainHand: item('battleaxe'), torso: item('chainmail'), offHand: item('iron_shield') }, 'female');
    const key = COTW_HERO_SPRITE.lookKey(worn);
    expect(key).toBe('f|medium|axe|round');
    expect(parseHeroLook(key)).toEqual(heroLook(worn));
    expect(parseHeroLook('x|gold|lute')).toEqual({ g: 'm', armor: 'none', weapon: 'none', off: 'none' });
  });
});

describe('the cotw hero sprite draws its own pixels', () => {
  const sprite = COTW_HERO_SPRITE.sprite('m|light|sword|round');
  const frame0 = sprite.render(0, 64);

  it('bakes four idle frames of 64 × 64 straight-alpha pixels, the same every time', () => {
    expect(sprite.frames).toBe(4);
    expect(frame0.length).toBe(64 * 64 * 4);
    expect(sprite.render(0, 64)).toEqual(frame0);
  });

  it('leaves the corners clear and puts the figure in the middle', () => {
    const alpha = (x: number, y: number) => frame0[(y * 64 + x) * 4 + 3];
    expect([alpha(0, 0), alpha(63, 0), alpha(0, 63), alpha(63, 63)]).toEqual([0, 0, 0, 0]);
    expect(alpha(32, 32)).toBe(255);
  });

  it('moves between idle frames and changes with the gear', () => {
    expect(sprite.render(2, 64)).not.toEqual(frame0);
    expect(COTW_HERO_SPRITE.sprite('m|heavy|hammer|tower').render(0, 64)).not.toEqual(frame0);
  });
});
