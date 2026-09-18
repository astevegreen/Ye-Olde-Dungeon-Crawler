import { describe, it, expect } from 'vitest';
import {
  COTW_ROSTER_37,
  COTW_ROSTER_BESTIARY,
  COTW_BESTIARY,
  COTW_MONSTERS,
  RIME_HOLLOWS_MONSTERS,
  DWARVEN_WORKS_MONSTERS,
  OBSIDIAN_SIPHON_MONSTERS,
  FOLKLORE_DETOUR_MONSTERS,
  SILVER_VEINS_MONSTERS,
  WORLD_BARK_MONSTERS,
  MAW_OF_MALICE_MONSTERS,
  BOSS_MONSTERS,
} from '../monsters';
import { AIRegistry } from '../../../engine/ai/aiRegistry';
import { MonsterRegistry } from '../../../engine';

describe('Castle of the Winds Monster Roster (37 entries)', () => {
  it('contains exactly 37 total entries in the canonical roster', () => {
    expect(COTW_ROSTER_37).toHaveLength(37);
    expect(Object.keys(COTW_ROSTER_BESTIARY)).toHaveLength(37);
  });

  it('partitions into 7 zone bands of 5 encounters plus 2 boss encounters', () => {
    expect(RIME_HOLLOWS_MONSTERS).toHaveLength(5);
    expect(DWARVEN_WORKS_MONSTERS).toHaveLength(5);
    expect(OBSIDIAN_SIPHON_MONSTERS).toHaveLength(5);
    expect(FOLKLORE_DETOUR_MONSTERS).toHaveLength(5);
    expect(SILVER_VEINS_MONSTERS).toHaveLength(5);
    expect(WORLD_BARK_MONSTERS).toHaveLength(5);
    expect(MAW_OF_MALICE_MONSTERS).toHaveLength(5);
    expect(BOSS_MONSTERS).toHaveLength(2);

    const totalZoneEntries =
      RIME_HOLLOWS_MONSTERS.length +
      DWARVEN_WORKS_MONSTERS.length +
      OBSIDIAN_SIPHON_MONSTERS.length +
      FOLKLORE_DETOUR_MONSTERS.length +
      SILVER_VEINS_MONSTERS.length +
      WORLD_BARK_MONSTERS.length +
      MAW_OF_MALICE_MONSTERS.length +
      BOSS_MONSTERS.length;

    expect(totalZoneEntries).toBe(37);
  });

  it('guarantees unique IDs across all 37 entries', () => {
    const ids = COTW_ROSTER_37.map((m) => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(37);
  });

  it('validates schema contracts and stat boundaries for every roster entry', () => {
    const mockRng = () => 0.5;

    for (const monster of COTW_ROSTER_37) {
      expect(monster.id).toBeTruthy();
      expect(monster.name).toBeTruthy();
      expect(monster.stats.hp).toBeGreaterThan(0);
      expect(monster.stats.maxHp).toBe(monster.stats.hp);
      expect(monster.stats.attack).toBeGreaterThan(0);
      expect(monster.stats.defense).toBeGreaterThanOrEqual(0);
      expect(monster.speed).toBeGreaterThan(0);
      expect(monster.minFloor).toBeGreaterThanOrEqual(1);
      expect(monster.xpValue).toBeGreaterThan(0);
      expect(monster.fleeHealthPercent).toBeGreaterThanOrEqual(0);
      expect(monster.fleeHealthPercent).toBeLessThanOrEqual(1);

      // Verify AI type resolves in registry
      expect(AIRegistry.has(monster.aiType)).toBe(true);

      // Verify loot rules execute without error with PRNG
      for (const rule of monster.lootTable) {
        expect(rule.chance).toBeGreaterThan(0);
        expect(rule.chance).toBeLessThanOrEqual(1);
        const item = rule.generate(`test-loot-${monster.id}`, mockRng);
        expect(item).toBeDefined();
        expect(item.id).toBe(`test-loot-${monster.id}`);
        expect(item.name).toBeTruthy();
      }

      // Verify telegraphed ability integrity if present
      if (monster.telegraphedAbility) {
        const ability = monster.telegraphedAbility;
        expect(ability.name).toBeTruthy();
        expect(ability.requiresSpellId).toBeTruthy();
        expect(ability.range).toBeGreaterThan(0);
        expect(ability.multiplier).toBeGreaterThan(0);
        expect(['single', 'line', 'cross', 'blast', 'cone']).toContain(ability.pattern);
      }
    }

    expect(COTW_MONSTERS.length).toBeGreaterThanOrEqual(37);
  });

  it('verifies all specified named entries exist in the roster bestiary', () => {
    // Rime Hollows
    expect(COTW_ROSTER_BESTIARY.hoarfrost_skraeling.name).toBe('Hoarfrost Skraeling');
    expect(COTW_ROSTER_BESTIARY.brim_howler.name).toBe('Brim-Howler');
    expect(COTW_ROSTER_BESTIARY.glacier_borer.name).toBe('Glacier-Borer');
    expect(COTW_ROSTER_BESTIARY.skratti.name).toBe('Skratti');
    expect(COTW_ROSTER_BESTIARY.winter_hag.name).toBe('Winter Hag (Vetrarkona)');

    // Abandoned Dwarven Works
    expect(COTW_ROSTER_BESTIARY.cinder_gilded_duergar.name).toBe('Cinder-Gilded Duergar');
    expect(COTW_ROSTER_BESTIARY.bellows_automaton.name).toBe('Bellows-Automaton');
    expect(COTW_ROSTER_BESTIARY.slag_amorphous.name).toBe('Slag Amorphous');
    expect(COTW_ROSTER_BESTIARY.haugbui.name).toBe('Haugbui');
    expect(COTW_ROSTER_BESTIARY.forge_wretch.name).toBe('Forge Wretch');

    // Obsidian Siphon
    expect(COTW_ROSTER_BESTIARY.sol_brand_zealot.name).toBe('Sól-Brand Zealot');
    expect(COTW_ROSTER_BESTIARY.ironwood_troll_wife.name).toBe('Ironwood Troll-Wife');
    expect(COTW_ROSTER_BESTIARY.prismatic_mirror_skulker.name).toBe('Prismatic Mirror-Skulker');
    expect(COTW_ROSTER_BESTIARY.captive_of_the_chariot.name).toBe('Captive of the Chariot');
    expect(COTW_ROSTER_BESTIARY.glod.name).toBe('Glóð');

    // Folklore Detour
    expect(COTW_ROSTER_BESTIARY.huldra_hollow_back.name).toBe('Huldra Hollow-Back');
    expect(COTW_ROSTER_BESTIARY.kirkegrim.name).toBe('Kirkegrim (Tomb-Vættir)');
    expect(COTW_ROSTER_BESTIARY.myling.name).toBe('Myling');
    expect(COTW_ROSTER_BESTIARY.fylgja.name).toBe('Fylgja');
    expect(COTW_ROSTER_BESTIARY.nacken.name).toBe('Näcken');

    // Tarnished Silver Veins
    expect(COTW_ROSTER_BESTIARY.quicksilver_leech.name).toBe('Quicksilver Leech');
    expect(COTW_ROSTER_BESTIARY.choke_damp_phantasm.name).toBe('Choke-Damp Phantasm');
    expect(COTW_ROSTER_BESTIARY.deep_lode_pit_draugr.name).toBe('Deep-Lode Pit-Draugr');
    expect(COTW_ROSTER_BESTIARY.silver_wight.name).toBe('Silver Wight');
    expect(COTW_ROSTER_BESTIARY.nar.name).toBe('Nár');

    // World-Bark Descent
    expect(COTW_ROSTER_BESTIARY.amber_sap_weeper.name).toBe('Amber Sap-Weeper');
    expect(COTW_ROSTER_BESTIARY.yggdrasil_parasite.name).toBe('Yggdrasil Parasite');
    expect(COTW_ROSTER_BESTIARY.root_bound_berserker.name).toBe('Root-Bound Berserker');
    expect(COTW_ROSTER_BESTIARY.rotwood_crawler.name).toBe('Rotwood Crawler');
    expect(COTW_ROSTER_BESTIARY.ividja.name).toBe('Iviðja');

    // Maw of Malice
    expect(COTW_ROSTER_BESTIARY.grave_wyrmling.name).toBe("Grave-Wyrmling (Níðhögg's Brood)");
    expect(COTW_ROSTER_BESTIARY.nastrond_feaster.name).toBe('Náströnd Feaster');
    expect(COTW_ROSTER_BESTIARY.malice_weaver.name).toBe('Malice-Weaver');
    expect(COTW_ROSTER_BESTIARY.garmling.name).toBe('Garmling');
    expect(COTW_ROSTER_BESTIARY.hel_warden.name).toBe('Hel Warden');

    // Bosses
    expect(COTW_ROSTER_BESTIARY.sun_chariot_warden.name).toBe('The Sun-Chariot Warden');
    expect(COTW_ROSTER_BESTIARY.nidhogg.name).toBe('Níðhögg, the Root-Gnawer');
  });

  it('preserves legacy templates and aliases in COTW_BESTIARY for test backward compatibility', () => {
    expect(COTW_BESTIARY.ogre).toBeDefined();
    expect(COTW_BESTIARY.ogre.stats.hp).toBe(50);
    expect(COTW_BESTIARY.kobold).toBeDefined();
    expect(COTW_BESTIARY.giant_rat).toBeDefined();
    expect(COTW_BESTIARY.boss_hrungnir).toBeDefined();
    expect(COTW_BESTIARY.troll_wife_warlock).toBeDefined();
    expect(COTW_BESTIARY.huldra).toBeDefined();
  });

  it('registers roster monsters in the global MonsterRegistry', () => {
    expect(MonsterRegistry.get('glod')).toBeDefined();
    expect(MonsterRegistry.get('sun_chariot_warden')).toBeDefined();
    expect(MonsterRegistry.get('nidhogg')).toBeDefined();
    expect(MonsterRegistry.get('hoarfrost_skraeling')).toBeDefined();
  });
});
