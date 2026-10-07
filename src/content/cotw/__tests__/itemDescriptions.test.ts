import { describe, it, expect } from 'vitest';
import { COTW_ITEMS } from '../items';
import { cotwManifest } from '../index';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { createScaledItem } from '../../../engine/dungeon/lootSpawner';
import { sumWorn, productWorn } from '../../../engine/items/wornModifiers';

// An item's description says only what the item does (N20): the game has no light
// sources, hunger, bleeding, locks to pick, secret-door sense or disarming, so no
// description promises them.
const PROMISES = /casts? [^.]*light|radiant illumination|illuminates|burns with [^.]*light|secret doors|hidden caches|hollow walls|disarm|rations|hunger|bleeding|unlock|lock-masters|flash-freez|constructs|crossing the barrier|toward [^.]*staircases|lock securely|sears the undead/i;

describe('cotw item descriptions', () => {
  it('promise no effect the game lacks', () => {
    const liars = COTW_ITEMS.filter((d) => PROMISES.test(d.description ?? '')).map(
      (d) => `${d.id}: ${d.description}`
    );
    expect(liars).toEqual([]);
  });

  // Five items promised a resistance or an immunity that item definitions had no way to
  // give (6 Oct); `wornEffects` gives it now, and a new promise must come with one.
  it('that promise a resistance or immunity carry it as a worn effect', () => {
    const PROTECTS = /\b(resistance|immunity|immune|wards against|can blind|can stun)\b/i;
    const empty = COTW_ITEMS.filter((d) => PROTECTS.test(d.description ?? '') && !d.wornEffects).map((d) => d.id);
    expect(empty).toEqual([]);
    const effects = Object.fromEntries(COTW_ITEMS.filter((d) => d.wornEffects).map((d) => [d.id, d.wornEffects]));
    expect(effects).toMatchObject({
      ring_of_the_slag_walker: { resistsElements: ['fire'] },
      zealots_seared_crown: { resistsElements: ['fire'] },
      soot_visored_helm: { grantsStatusImmunities: ['blindness'] },
      rootless_striders: { grantsStatusImmunities: ['paralysis'], trapImmune: true },
      corpse_chieftains_eye_coin: { grantsStatusImmunities: ['stunned'] },
    });
  });

  // Three pieces of armour promised to answer a blow but hooked `onHit`, which fires on the
  // wearer's own blows (R-cmbt-12): a reaction to being struck hooks a defender's event.
  it('that promise a reaction to being struck hook an event the wearer is struck by', () => {
    const STRUCK = /when struck|strikes its (wearer|bearer)|whoever strikes|retaliat|reflects? incoming/i;
    const DEFENDER_EVENTS = new Set(['onDamageTaken', 'onBlock']);
    const wrong = COTW_ITEMS.filter(
      (d) =>
        [d.description, ...(d.hooks ?? []).map((h) => h.description)].some((t) => STRUCK.test(t ?? '')) &&
        !(d.hooks ?? []).some((h) => DEFENDER_EVENTS.has(h.event))
    ).map((d) => d.id);
    expect(wrong).toEqual([]);
    const struck = COTW_ITEMS.filter((d) => (d.hooks ?? []).some((h) => h.event === 'onDamageTaken')).map((d) => d.id);
    expect(struck).toEqual(expect.arrayContaining(['bellows_plate_shield', 'mirror_skulker_facet', 'nid_dripping_hauberk']));
  });

  // About thirty items promised a mechanic with nothing behind it (R-cotw-6/-7, 6 Oct):
  // armour-piercing, spell power, concealment, sensing, regeneration, a drawback. An item
  // whose text makes such a claim must carry something that could honour it.
  it('that claim a mechanic carry a worn effect or a hook for it', () => {
    const CLAIMS = /\b(ignores?|pierc\w*|empower\w*|rebound\w*|reflect\w*|conceal\w*|obscur\w*|heat-resistant|impervious|regenerat\w*|vitality|communion|attun\w*|alerts?|toxic\w*|pulses?|stealing)\b/i;
    const empty = COTW_ITEMS.filter((d) => CLAIMS.test(d.description ?? '') && !d.wornEffects && !(d.hooks ?? []).length && d.category !== 'consumable').map(
      (d) => `${d.id}: ${d.description}`
    );
    expect(empty).toEqual([]);
  });

  // I6 cut six uniques' text down to their stats; the owner chose to give them the stats
  // instead (2026-10-07): small buffs, the original wording restored.
  it('six uniques carry the stats their text promises, and wearing them gives those stats', () => {
    const effects = Object.fromEntries(COTW_ITEMS.filter((d) => d.wornEffects).map((d) => [d.id, d.wornEffects]));
    expect(effects).toMatchObject({
      obsidian_scale_cuirass: { resistsElements: ['fire'] },
      pit_draugr_pick: { defensePenetration: 0.25 },
      tarnished_quicksilver_stiletto: { defensePenetration: 0.15 },
      ironwood_bough_stave: { spellDamageMultiplier: 1.2 },
      amber_heart_drop: { maxHpPercent: 0.1 },
      girdle_of_thryms_line: { carryMultiplier: 1.25 },
    });
    const text = (id: string) => COTW_ITEMS.find((d) => d.id === id)!.description ?? '';
    expect(text('obsidian_scale_cuirass')).toMatch(/searing flame/);
    expect(text('pit_draugr_pick')).toMatch(/armor plating/);
    expect(text('tarnished_quicksilver_stiletto')).toMatch(/dense armor/);
    expect(text('ironwood_bough_stave')).toMatch(/spell damage/);
    expect(text('amber_heart_drop')).toMatch(/vitality/);
    expect(text('girdle_of_thryms_line')).toMatch(/load-bearing/);

    const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Wear', { seed: 5 });
    const p = engine.player;
    const wear = (id: string) => {
      const def = COTW_ITEMS.find((d) => d.id === id)!;
      expect(p.inventory.paperdoll.equip(createScaledItem(def, id, def.minFloor ?? 1, () => 0.5), def.slot as never).success, id).toBe(true);
    };
    const fireBefore = p.affinityTo('fire');
    const hpBefore = p.maxHp;
    const carryBefore = p.carryStrength;
    wear('obsidian_scale_cuirass');
    expect(fireBefore).toBe('neutral');
    expect(p.affinityTo('fire')).toBe('resistant');
    wear('pit_draugr_pick');
    expect(sumWorn(p, 'defensePenetration')).toBeCloseTo(0.25);
    wear('tarnished_quicksilver_stiletto');
    expect(sumWorn(p, 'defensePenetration')).toBeCloseTo(0.15);
    wear('ironwood_bough_stave');
    expect(productWorn(p, 'spellDamageMultiplier')).toBeCloseTo(1.2);
    wear('amber_heart_drop');
    expect(Math.abs(p.maxHp - hpBefore * 1.1)).toBeLessThan(1);
    wear('girdle_of_thryms_line');
    expect(p.carryStrength).toBe(Math.round(p.strength * 1.25));
    expect(p.carryStrength).toBeGreaterThan(carryBefore);
  });

  it('promise no cure for a curse: only the temple lifts one', () => {
    const LIFTS_CURSES = /(purg|lift|break|remov|cleans|dispel)\w*[^.]*\bcurses?\b/i;
    const liars = COTW_ITEMS.filter((d) => LIFTS_CURSES.test(d.description ?? '')).map((d) => `${d.id}: ${d.description}`);
    expect(liars).toEqual([]);
  });
});
