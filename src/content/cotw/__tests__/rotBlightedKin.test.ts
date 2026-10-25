import { describe, it, expect } from 'vitest';
import { COTW_KILL_RITES } from '../killRites';
import { COTW_MONSTER_CATEGORIES } from '../monsterCategories';

/**
 * Act II (sprint L7): the root-creatures of floors 26-49 read as kin the Rot has turned,
 * while each verse still names how to meet its rite.
 */
const VERSES_BEFORE_L7: Record<string, string> = {
  root_wraith: 'Slow the wraith in its roots, then set them alight.',
  bark_husk_miner: 'Hold the husk rigid and still, then burn the bark from its bones.',
  amber_sap_weeper: 'Warm the weeping amber with fire until its healing sap runs free.',
  root_bound_berserker: 'Nothing binds a berserker; only rage answers rage.\nFell it with iron while your own life runs below half.',
  rotwood_crawler: 'Slow the crawler in the rotwood, then burn it.',
};

/** Each verse must still name its rite: every group needs one of its words, whole. */
const RITE_WORDS: Record<string, RegExp[]> = {
  root_wraith: [/\bslow\b/i, /\b(fire|burn)\b/i],
  rotwood_crawler: [/\bslow\b/i, /\b(fire|burn)\b/i],
  bark_husk_miner: [/\b(hold|paralysis)\b/i, /\b(fire|burn)\b/i],
  amber_sap_weeper: [/\b(fire|burn)\b/i],
  root_bound_berserker: [/\b(iron|steel)\b/i, /\bbelow half\b/i],
};

const RITE_FIELDS_BEFORE_L7: Record<string, Record<string, unknown>> = {
  root_wraith: { essenceElement: 'shadow', requiredDamageElement: 'fire', requiredVictimStatus: 'slow' },
  bark_husk_miner: { essenceElement: 'physical', requiredDamageElement: 'fire', requiredVictimStatus: 'paralysis' },
  amber_sap_weeper: { essenceElement: 'healing', requiredDamageElement: 'fire' },
  root_bound_berserker: { essenceElement: 'physical', requiredDamageElement: 'physical', maxCasterHpPercent: 50 },
  rotwood_crawler: { essenceElement: 'healing', requiredDamageElement: 'fire', requiredVictimStatus: 'slow' },
};

const FAMILY_NOUNS: Record<string, RegExp> = {
  cotw_undead: /\bdraugr\b/i,
  cotw_beasts: /\bwolves\b/i,
  cotw_constructs: /\bautomatons\b/i,
};

describe('Act II: the root-creatures as Rot-blighted kin', () => {
  const ids = Object.keys(VERSES_BEFORE_L7);

  it('names the Rot or the blight in each of the five verses, each rewritten', () => {
    for (const id of ids) {
      const verse = COTW_KILL_RITES[id]?.hintVerse;
      expect(verse, id).toBeDefined();
      expect(verse, id).toMatch(/\b(rot|blight|blighted)\b/i);
      expect(verse, id).not.toBe(VERSES_BEFORE_L7[id]);
    }
  });

  it('still names how to meet each rite', () => {
    for (const id of ids) {
      for (const word of RITE_WORDS[id]) expect(COTW_KILL_RITES[id].hintVerse, `${id} ${word}`).toMatch(word);
    }
  });

  it('changes no rite field but the verse', () => {
    for (const id of ids) {
      const fields = Object.fromEntries(Object.entries(COTW_KILL_RITES[id]).filter(([key]) => key !== 'hintVerse'));
      expect(fields, id).toEqual(RITE_FIELDS_BEFORE_L7[id]);
    }
  });

  it('adds the root-blight to the three families, each still one sentence naming its creatures', () => {
    for (const [familyId, noun] of Object.entries(FAMILY_NOUNS)) {
      const description = COTW_MONSTER_CATEGORIES.find((c) => c.id === familyId)?.description;
      expect(description, familyId).toBeDefined();
      expect(description, familyId).toMatch(/\bblight\b/i);
      expect(description, familyId).toMatch(noun);
      expect(description!.split('.').length - 1, familyId).toBe(1);
      expect(description!.trimEnd().endsWith('.'), familyId).toBe(true);
    }
  });
});
