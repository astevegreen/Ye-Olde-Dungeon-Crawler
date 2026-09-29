import { describe, it, expect } from 'vitest';
import type { KillRiteDefinition, MonsterDefinition, SpellDefinition } from '../../../engine';
import { COTW_KILL_RITES } from '../killRites';
import { COTW_MONSTERS, COTW_BESTIARY } from '../monsters';
import { COTW_SPELLS } from '../spells';
import { COTW_ITEMS } from '../items';
import { COTW_STARTER_KIT } from '../character';
import { COTW_MAGIC } from '../magic';
import { COTW_TABLET_STOCK } from '../spellTablets';

const spellById = new Map(COTW_SPELLS.map((s) => [s.id, s]));
/** Spells rites and tablets are meant to teach: everything but Blood Magic and the tablet-only "learn_*" spells. */
const CORE_SPELLS = COTW_SPELLS.filter((s) => s.school !== 'BloodMagic' && s.school !== 'Lore').map((s) => s.id);

/** What a known spell lets the hero do to meet a rite: its damage element and inflicted status. */
function grants(spell: SpellDefinition): { elements: string[]; statuses: string[] } {
  const effects = (spell.effects ?? []) as Array<{ type: string; element?: string; statusId?: string }>;
  const elements = effects.filter((e) => e.type === 'damage').map((e) => String(e.element));
  const statuses = effects.filter((e) => e.type === 'applyStatus').map((e) => String(e.statusId));
  return { elements, statuses };
}

function canMeet(rite: KillRiteDefinition, known: Set<string>): boolean {
  const elements = new Set<string>(['physical']); // any weapon
  const statuses = new Set<string>();
  for (const id of known) {
    const spell = spellById.get(id);
    if (!spell) continue;
    const g = grants(spell);
    g.elements.forEach((e) => elements.add(e));
    g.statuses.forEach((s) => statuses.add(s));
  }
  if (rite.requiredDamageElement && !elements.has(rite.requiredDamageElement)) return false;
  if (rite.requiredVictimStatus && !statuses.has(rite.requiredVictimStatus)) return false;
  return true; // overkill, debt and low HP are always within the hero's reach
}

/** Floor at which the hero, performing every rite as soon as possible, has learned each spell. */
function simulateDescent(): { learnedOn: Map<string, number>; meetableOn: Map<string, number> } {
  const known = new Set(COTW_STARTER_KIT.spellsKnown ?? []);
  const learnedOn = new Map<string, number>([...known].map((id) => [id, 0]));
  const meetableOn = new Map<string, number>();
  const monsters = COTW_MONSTERS.filter((m) => m.killRite);
  for (let floor = 1; floor <= 50; floor++) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const m of monsters) {
        if ((m.minFloor ?? 1) > floor || !canMeet(m.killRite!, known)) continue;
        if (!meetableOn.has(m.id)) meetableOn.set(m.id, floor);
        const teaches = m.killRite!.teachesSpellId;
        if (teaches && !known.has(teaches)) {
          known.add(teaches);
          learnedOn.set(teaches, floor);
          changed = true;
        }
      }
    }
  }
  return { learnedOn, meetableOn };
}

describe('cotw kill rites (Galdr of the Slain)', () => {
  const everyMonster: MonsterDefinition[] = [...COTW_MONSTERS, ...Object.values(COTW_BESTIARY)];

  it('gives every monster a rite with a hint, and names no unknown monster', () => {
    for (const m of everyMonster) {
      expect(m.killRite, m.id).toBeDefined();
      expect(m.killRite!.hintVerse.length, m.id).toBeGreaterThan(10);
    }
    const ids = new Set(everyMonster.map((m) => m.id));
    for (const id of Object.keys(COTW_KILL_RITES)) expect(ids.has(id), id).toBe(true);
  });

  it('teaches real spells and yields real essences', () => {
    const itemIds = new Set(COTW_ITEMS.map((i) => i.id));
    for (const [id, rite] of Object.entries(COTW_KILL_RITES)) {
      if (rite.teachesSpellId) expect(CORE_SPELLS, id).toContain(rite.teachesSpellId);
      const essenceId = COTW_MAGIC.killRites!.essenceItems[rite.essenceElement];
      expect(essenceId, id).toBeDefined();
      expect(itemIds.has(essenceId), id).toBe(true);
    }
  });

  it('never asks for a status the monster is immune to', () => {
    for (const m of everyMonster) {
      const status = m.killRite?.requiredVictimStatus;
      if (status) expect(m.statusImmunities ?? [], m.id).not.toContain(status);
    }
  });

  it('starts the hero with only Magic Arrow and Heal Minor Wounds', () => {
    expect(COTW_STARTER_KIT.spellsKnown).toEqual(['magic_arrow', 'heal_minor']);
  });

  it('lets a hero learn every core spell by rites alone, each teaching rite meetable on its first floor', () => {
    const { learnedOn, meetableOn } = simulateDescent();
    for (const spellId of CORE_SPELLS) expect(learnedOn.has(spellId), spellId).toBe(true);
    for (const m of COTW_MONSTERS) {
      if (m.killRite?.teachesSpellId) expect(meetableOn.get(m.id), m.id).toBe(m.minFloor ?? 1);
    }
    // The core set is complete by the end of the Tarnished Silver Veins.
    expect(Math.max(...CORE_SPELLS.map((id) => learnedOn.get(id)!))).toBeLessThanOrEqual(33);
  });

  it('keeps every other rite meetable within ten floors of the monster appearing', () => {
    const { meetableOn } = simulateDescent();
    for (const m of COTW_MONSTERS) {
      const floor = meetableOn.get(m.id);
      expect(floor, m.id).toBeDefined();
      expect(floor! - (m.minFloor ?? 1), m.id).toBeLessThanOrEqual(10);
    }
  });

  it('sells a catch-up tablet for every spell a rite teaches', () => {
    const taught = new Set(Object.values(COTW_KILL_RITES).map((r) => r.teachesSpellId).filter(Boolean));
    const tablets = new Set(COTW_TABLET_STOCK.map((t) => t.itemId.replace(/^tablet_/, '')));
    for (const spellId of taught) expect(tablets.has(spellId!), spellId!).toBe(true);
  });
});
