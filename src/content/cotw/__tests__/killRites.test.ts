import { describe, it, expect } from 'vitest';
import type { KillRiteDefinition, MonsterDefinition, SpellDefinition } from '../../../engine';
import { COTW_KILL_RITES } from '../killRites';
import { COTW_MONSTERS, COTW_BESTIARY, SUMMONED_MONSTERS } from '../monsters';
import { COTW_SPELLS } from '../spells';
import { COTW_ITEMS } from '../items';
import { COTW_STARTER_KIT } from '../character';
import { COTW_MAGIC } from '../magic';
import { COTW_TABLET_STOCK } from '../spellTablets';
import { COTW_PROLOGUE } from '../prologue';
import { COTW_LEARNING_STONES } from '../learningStones';

const spellById = new Map(COTW_SPELLS.map((s) => [s.id, s]));
/** Spells rites and tablets teach: all but the altar's blood and frith and the tablet-only "learn_*" spells. */
// Scroll spells (Remove Curse) are only ever read from a scroll, never learned.
const CORE_SPELLS = COTW_SPELLS.filter((s) => !['BloodMagic', 'Frith', 'Lore', 'Scroll'].includes(String(s.school))).map((s) => s.id);

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

/**
 * Floors at which each monster's rite first becomes meetable, for a hero who learns every
 * spell of a zone as soon as the zone's floors begin (stones teach; rites no longer do).
 */
function simulateDescent(): { meetableOn: Map<string, number> } {
  const known = new Set(COTW_STARTER_KIT.spellsKnown ?? []);
  const meetableOn = new Map<string, number>();
  const monsters = COTW_MONSTERS.filter((m) => m.killRite);
  for (let floor = 1; floor <= 50; floor++) {
    for (const zone of COTW_LEARNING_STONES.zones) {
      if (zone.minFloor <= floor) zone.spellIds.forEach((id) => known.add(id));
    }
    for (const m of monsters) {
      if ((m.minFloor ?? 1) > floor || !canMeet(m.killRite!, known)) continue;
      if (!meetableOn.has(m.id)) meetableOn.set(m.id, floor);
    }
  }
  return { meetableOn };
}

describe('cotw kill rites (Galdr of the Slain)', () => {
  // The night raid's creatures meet the hero only before fire is in reach, then leave.
  // A summon is never the hero's kill.
  const neverHunted = new Set([...(COTW_PROLOGUE.monsters ?? []).map((p) => p.definitionId), ...SUMMONED_MONSTERS.map((m) => m.id)]);
  const everyMonster: MonsterDefinition[] = [...COTW_MONSTERS, ...Object.values(COTW_BESTIARY)].filter((m) => !neverHunted.has(m.id));

  it('gives every monster a rite with a hint, and names no unknown monster', () => {
    for (const m of everyMonster) {
      expect(m.killRite, m.id).toBeDefined();
      expect(m.killRite!.hintVerse.length, m.id).toBeGreaterThan(10);
    }
    const ids = new Set(everyMonster.map((m) => m.id));
    for (const id of Object.keys(COTW_KILL_RITES)) expect(ids.has(id), id).toBe(true);
  });

  it('asks no rite of the night raid, which could never be met', () => {
    expect(neverHunted.size).toBeGreaterThan(0);
    for (const id of neverHunted) expect(COTW_KILL_RITES[id], id).toBeUndefined();
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

  it('starts the hero with only Magic Arrow and Heal', () => {
    expect(COTW_STARTER_KIT.spellsKnown).toEqual(['magic_arrow', 'heal_spell']);
  });

  it('keeps every other rite meetable within ten floors of the monster appearing', () => {
    const { meetableOn } = simulateDescent();
    for (const m of everyMonster) {
      const floor = meetableOn.get(m.id);
      expect(floor, m.id).toBeDefined();
      expect(floor! - (m.minFloor ?? 1), m.id).toBeLessThanOrEqual(10);
    }
  });

  it('teaches no spell by rite: stones do', () => {
    expect(Object.values(COTW_KILL_RITES).filter((r) => (r as { teachesSpellId?: string }).teachesSpellId)).toEqual([]);
  });

  it('names real carriers, each with a rite, and every zone holds one any hero can meet', () => {
    const starter = new Set(COTW_STARTER_KIT.spellsKnown ?? []);
    const byId = new Map(everyMonster.map((m) => [m.id, m]));
    for (const zone of COTW_LEARNING_STONES.zones) {
      for (const id of zone.carrierIds) {
        expect(byId.get(id)?.killRite, id).toBeDefined();
      }
      const open = zone.carrierIds.filter((id) => canMeet(byId.get(id)!.killRite!, starter));
      expect(open.length, `zone ${zone.minFloor}-${zone.maxFloor}`).toBeGreaterThan(0);
    }
    for (const stone of COTW_LEARNING_STONES.stones) {
      if (stone.carrierId) expect(byId.get(stone.carrierId)?.killRite, stone.carrierId).toBeDefined();
    }
  });

  it('sells a catch-up tablet for every spell a stone shows', () => {
    const tablets = new Set(COTW_TABLET_STOCK.map((t) => t.itemId.replace(/^tablet_/, '')));
    for (const zone of COTW_LEARNING_STONES.zones) {
      for (const spellId of zone.spellIds) expect(tablets.has(spellId), spellId).toBe(true);
    }
  });
});
