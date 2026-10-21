import { describe, it, expect } from 'vitest';
import { COTW_FIRST_TIME_HINTS } from '../hints';
import { COTW_MAGIC } from '../magic';
import { COTW_TOWN } from '../town';

// Magic text matches today's rules (sprint M1): spells come from learning stones, a rite is
// the carrier's shortcut, a spell casts only from a slot, and Void Debt is said where named.
const sentences = (text: string): number => text.split(/[.!?](?:\s|$)/).filter((s) => s.trim()).length;

describe('magic text', () => {
  it('the kill-rite hint names the stone and its shard, and no "only when slain" rule', () => {
    const text = COTW_FIRST_TIME_HINTS.killRite!.text;
    expect(text).toMatch(/stone/i);
    expect(text).toMatch(/shard/i);
    expect(text).not.toMatch(/only when slain/i);
    expect(text).toContain('{key:compendium}');
  });

  it('the grimoire hint says spells cast only from a slot and the hero picks each axis stat', () => {
    const text = COTW_FIRST_TIME_HINTS.grimoire!.text;
    expect(text).toMatch(/only from a (grimoire )?slot/i);
    expect(text).toMatch(/axis/i);
    expect(text).toMatch(/you pick/i);
    expect(text).toContain('{key:cast_spell}');
    expect(sentences(text)).toBeGreaterThanOrEqual(2);
    expect(sentences(text)).toBeLessThanOrEqual(4);
  });

  it("Hel's Grave-Altar says what Void Debt is wherever it names it", () => {
    const hel = COTW_MAGIC.altars!.find((a) => a.id === 'galdr_altar_hel')!;
    const texts = [hel.description, ...(hel.deeperRites ?? []).map((r) => r.description)];
    expect(texts).toHaveLength(2);
    for (const text of texts) {
      expect(text).toContain('Void Debt');
      expect(text).toMatch(/owed/i);
      expect(text).toMatch(/Seiðr/);
    }
  });

  it('Astrid tells the hero she sells rune tablets', () => {
    const astrid = COTW_TOWN.npcs.find((n) => n.id === 'npc-astrid')!;
    expect(`${astrid.greeting} ${astrid.dialogText}`).toMatch(/rune tablets?/i);
  });
});
