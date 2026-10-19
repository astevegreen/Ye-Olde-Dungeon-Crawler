import { describe, it, expect } from 'vitest';
import { FIXTURE_GRIMOIRES, FIXTURE_LENDING } from '../../../../tests/fixtures/fixture-pack';
import { DEFAULT_AFFINITY_MATRIX } from '../elements';
import { createGrimoireState, type GrimoireSlotRef } from '../grimoires';
import { resolveAllCasts, type ResolvedCast } from '../neighbourLending';
import type { GrimoireSystemConfig, NeighbourLendingConfig, SpellType } from '../magicConfig';
import type { SpellDefinition } from '../types';

/*
 * The magic plan's floor-50 grimoire (runestone dry run, 15 Oct), resolved slot by slot on
 * stand-in spells, so the lending rules can be read as one table before cotw takes them.
 * `MAGIC_DRY_RUN=1 npx vitest run <this file>` prints the table.
 */

/** A stand-in spell: only what lending and the slot stats read. */
function spell(id: string, element: string, spellType: SpellType | undefined, extra: Partial<SpellDefinition> = {}): SpellDefinition {
  const damages = spellType === 'damage';
  return {
    id,
    name: id,
    school: 'Combat',
    manaCost: 5,
    element,
    range: 6,
    basePower: 10,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'ray',
    description: id,
    effects: damages ? [{ type: 'damage', amount: 10, element }] : [],
    spellType,
    ...extra,
  };
}

const SPELLS: SpellDefinition[] = [
  spell('Magic Arrow', 'arcane', 'damage'),
  spell('Firebolt', 'fire', 'damage'),
  spell('Heal', 'healing', 'heal'),
  spell('Fylgja', 'shadow', 'summon'),
  spell('Thunderclap', 'lightning', 'damage', { areaOfEffect: 1 }),
  spell('Rime-Thurs', 'cold', 'summon'),
  spell('Phase Door', 'arcane', 'movement', { school: 'Movement' }),
  spell('Mire', 'poison', 'terrain', { areaOfEffect: 1 }),
  spell('Cold Ray', 'cold', 'damage'),
  spell('Paralyze', 'arcane', 'control', { school: 'Enchantment' }),
  spell('Loki’s Switch', 'arcane', 'control', { school: 'Movement' }),
  spell('Hliðskjálf', 'arcane', undefined, { school: 'Divination' }),
  spell('Hammer-Throw', 'lightning', 'damage'),
  spell('Rime Floor', 'cold', 'terrain', { areaOfEffect: 1 }),
  spell('Grið', 'healing', 'control', { lends: ['healing'] }),
  spell('Rockfall', 'physical', 'damage', { areaOfEffect: 1 }),
  spell('Raise Cairn', 'physical', 'terrain'),
  spell('Fireball', 'fire', 'damage', { areaOfEffect: 1 }),
  spell('the Dísir', 'healing', 'summon', { lends: ['healing'] }),
];

/** The fixture's flavours, plus the rule page's poison, shadow, Divination and Magic Arrow lends. */
const LENDING: NeighbourLendingConfig = {
  ...FIXTURE_LENDING,
  flavours: [
    ...FIXTURE_LENDING.flavours.filter((f) => f.id !== 'lightning'),
    { id: 'lightning', name: 'Leaping', effects: [], doubled: { name: 'Forked', effects: [] } },
    { id: 'poison', name: 'Poison 2', effects: [], doubled: { name: 'Fáfnir’s venom', effects: [] } },
    { id: 'shadow', name: 'Drain 3', effects: [], doubled: { name: 'Drain 6', effects: [] } },
    { id: 'arcane:Divination', name: 'Mark', effects: [], doubled: { name: 'Mark 20', effects: [] } },
    { id: 'arcane:Combat', name: 'Piercing', effects: [], doubled: { name: 'Double pierce', effects: [] } },
  ],
};
const CONFIG: GrimoireSystemConfig = { ...FIXTURE_GRIMOIRES, lending: LENDING };

const slot = (grimoireId: string, x: number, y: number): GrimoireSlotRef => ({ grimoireId, x, y });
const GRIMOIRE_NAME: Record<string, string> = { row: 'Máni', star: 'Sól', grid: 'Yggdrasil' };

function floor50() {
  const state = createGrimoireState();
  state.opened = ['row', 'star', 'grid'];
  const place = (grimoireId: string, x: number, y: number, spellId: string) => state.placements.push({ grimoireId, x, y, spellId });
  place('row', -1, 0, 'Magic Arrow');
  place('row', 0, 0, 'Firebolt');
  place('row', 1, 0, 'Heal');
  place('row', 0, 1, 'Fylgja');
  place('star', 0, 0, 'Thunderclap');
  place('star', -1, 0, 'Rime-Thurs');
  place('star', 1, 0, 'Cold Ray');
  place('star', 0, -1, 'Phase Door');
  place('star', 0, 1, 'Mire');
  place('star', 2, 0, 'Paralyze');
  place('grid', 0, 0, 'Loki’s Switch');
  place('grid', 0, -1, 'Hliðskjálf');
  place('grid', 0, 1, 'Rime Floor');
  place('grid', -1, 0, 'Hammer-Throw');
  place('grid', 1, 0, 'Grið');
  place('grid', -1, -1, 'Rockfall');
  place('grid', 1, -1, 'Raise Cairn');
  place('grid', -1, 1, 'Fireball');
  place('grid', 1, 1, 'the Dísir');
  state.extraSlots = [slot('row', 0, 1), slot('star', 2, 0)];
  state.statPicks = [
    { grimoireId: 'row', axis: 'x', statId: 'power' },
    { grimoireId: 'row', axis: 'y', statId: 'duration' },
    { grimoireId: 'star', axis: 'x', statId: 'swift' },
    { grimoireId: 'star', axis: 'y', statId: 'thrift' },
    { grimoireId: 'grid', axis: 'x', statId: 'range' },
    { grimoireId: 'grid', axis: 'y', statId: 'area' },
  ];
  state.doubledSlots = [slot('row', 0, 0), slot('star', 0, 0), slot('grid', -1, 0)];
  state.forged = [
    { spellId: 'Cold Ray', element: 'fire' },
    { spellId: 'Thunderclap', element: 'fire' },
    { spellId: 'Thunderclap', element: 'healing' },
  ];
  const spellOf = (id: string) => SPELLS.find((s) => s.id === id);
  return resolveAllCasts(CONFIG, state, spellOf, (e) => DEFAULT_AFFINITY_MATRIX.getOpposite(e));
}

function statsLine(c: ResolvedCast): string {
  const s = c.stats;
  const parts: string[] = [];
  if (s.powerMultiplier !== 1) parts.push(`power ×${+s.powerMultiplier.toFixed(2)}`);
  if (s.costMultiplier !== 1) parts.push(`cost ×${+s.costMultiplier.toFixed(2)}`);
  if (s.rangeBonus) parts.push(`range +${s.rangeBonus}`);
  if (s.areaBonus) parts.push(`area +${s.areaBonus}`);
  if (s.durationMultiplier !== 1) parts.push(`duration ×${s.durationMultiplier}`);
  if (s.castTimeFraction !== 1) parts.push(`${+s.castTimeFraction.toFixed(2)} turn`);
  return parts.join(', ') || '—';
}

const lendsLine = (c: ResolvedCast) => c.lends.map((l) => (l.doubled ? `${l.name}*` : l.name)).join(', ') || '—';

describe('the floor-50 grimoire, resolved (dry run)', () => {
  const casts = floor50();
  const of = (id: string) => casts.find((c) => c.spellId === id)!;

  it('resolves all 19 slots', () => {
    expect(casts).toHaveLength(19);
    if (process.env.MAGIC_DRY_RUN) {
      const rows = casts.map((c) =>
        [
          `${GRIMOIRE_NAME[c.slot.grimoireId]} (${c.slot.x},${c.slot.y})`,
          c.spellId,
          c.spellType ?? 'no type',
          statsLine(c),
          lendsLine(c),
          c.lentPowerMultiplier !== 1 ? `×${c.lentPowerMultiplier}` : '—',
          c.lentHpCost ? `${c.lentHpCost} HP` : '—',
        ].join(' | ')
      );
      console.log(['slot | spell | type | own stats | borrows (* doubled) | power from borrowing | HP a cast', ...rows].join('\n'));
    }
  });

  it('Tyr’s doubled Firebolt burns Magic Arrow and Heal blue (F4)', () => {
    expect(of('Magic Arrow').lends.find((l) => l.flavourId === 'fire')).toMatchObject({ doubled: true, name: 'Blue fire' });
    expect(of('Heal').lends.find((l) => l.flavourId === 'fire')).toMatchObject({ doubled: true, name: 'Blue fire' });
  });

  // The dry-run page says half a turn; the stat catalog's ¾ → ⅔ → ½ gives ⅔ at two steps.
  it('Paralyze, two steps out, casts in ⅔ of a turn and borrows only from Cold Ray (F43)', () => {
    expect(of('Paralyze').stats.castTimeFraction).toBeCloseTo(2 / 3);
    expect(of('Paralyze').lends.every((l) => l.from.length === 1 && l.from[0].x === 1)).toBe(true);
  });

  it('steam-forged Cold Ray takes the opposite bonus on its own', () => {
    expect(of('Cold Ray').elements).toEqual(['cold', 'fire']);
    expect(of('Cold Ray').lentPowerMultiplier).toBeGreaterThanOrEqual(1.25);
  });
});
