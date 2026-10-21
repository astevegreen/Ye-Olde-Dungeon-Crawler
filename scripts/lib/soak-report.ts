/**
 * The P-36 soak report: reads seed summaries (`e2e/soak/types.ts` `SoakSummary`) and answers
 * the owner's five questions as plain tables, so nobody reads the logs raw. CLI:
 * `scripts/soak-report.ts`; the `soak` skill says when to run it.
 *
 * Only the fields the report reads are typed here: the summaries come from the e2e side,
 * whose types pull in Playwright.
 */

type Source = 'spell' | 'melee' | 'other' | 'world';

interface FloorTally {
  casts: Record<string, number>;
  failed?: Record<string, number>;
  damage: Record<Source, number>;
  kills: Record<Source, number>;
  spellDamage: Record<string, number>;
  spellKills?: Record<string, number>;
  lent?: Record<string, Record<string, number>>;
}

export interface ReportSummary {
  seed: number;
  /** The soak folder the summary was read from: with `seed`, it names the run. Two folders
   *  can both have run seed 3, and those are two runs. */
  folder?: string;
  startFloor: number;
  sha: string;
  partial: boolean;
  endedBy: string;
  deepestFloor: number;
  findings: Record<string, number>;
  bot?: { deathCause?: string };
  magic?: {
    floors: Record<string, FloorTally>;
    learned: Array<{ spellId: string; via: string; floor: number }>;
    spellsKnown: string[];
    stones?: Record<string, string>;
    altars?: Record<string, string>;
    catalog?: Record<string, { type: string; stoneFrom: number | null; ownDamage?: boolean }>;
  };
  pace?: Record<string, { turns: number; actions: number; wallMs: number; visits: number; firstTurn: number; spellsOnEntry: number }>;
  belowTurns?: number;
  hero?: { build: string; runestonePolicy: string; level: number; runestones: Record<string, string> };
}

export interface ReportOptions {
  /** The Hearth-Tear cold's stage thresholds, in turns below town (`hearthCold.ts`). */
  coldStages: number[];
}

const SOURCES: Source[] = ['spell', 'melee', 'other', 'world'];

const median = (xs: number[]): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const quantile = (xs: number[], q: number): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
};
const fmt = (n: number): string => (Number.isNaN(n) ? '-' : Number.isInteger(n) ? String(n) : n.toFixed(1));
const pct = (part: number, whole: number): string => (whole > 0 ? `${Math.round((100 * part) / whole)}%` : '-');
const add = (into: Record<string, number>, key: string, n = 1) => {
  into[key] = (into[key] ?? 0) + n;
};
const tally = (into: Record<string, number>): string =>
  Object.entries(into)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${n}`)
    .join(', ') || '-';

/** Runs grouped by a key, in key order. */
function groupBy(runs: ReportSummary[], key: (s: ReportSummary) => string): Map<string, ReportSummary[]> {
  const groups = new Map<string, ReportSummary[]>();
  for (const s of [...runs].sort((a, b) => key(a).localeCompare(key(b)))) groups.set(key(s), [...(groups.get(key(s)) ?? []), s]);
  return groups;
}

/** A Markdown table: header row, then rows. */
function table(head: string[], rows: Array<Array<string | number>>): string {
  const line = (cells: Array<string | number>) => `| ${cells.map((c) => (typeof c === 'number' ? fmt(c) : c)).join(' | ')} |`;
  return [line(head), line(head.map(() => '---')), ...rows.map(line)].join('\n');
}

/** A finding signature's family: its text up to the first colon (a magic anomaly keeps its
 *  spell), numbers already folded to #. A death line carries the whole log, unique per run. */
const family = (sig: string): string => {
  const [category, text = ''] = sig.split('|');
  return `${category}: ${(text.startsWith('magic:') ? text : text.split(':')[0]).slice(0, 90)}`;
};

const floorsOf = (s: ReportSummary) => Object.keys(s.pace ?? s.magic?.floors ?? {}).map(Number).sort((a, b) => a - b);

export function soakReport(all: ReportSummary[], opts: ReportOptions): string {
  const runs = all.filter((s) => !s.partial);
  const out: string[] = [];
  const shas = [...new Set(runs.map((s) => s.sha))];
  const ended: Record<string, number> = {};
  for (const s of runs) add(ended, s.endedBy);
  out.push(`# Soak report: ${runs.length} finished runs (${all.length - runs.length} still partial), sha ${shas.join(', ') || '-'}`);
  out.push(`Ended by: ${tally(ended)}. Deep starts: ${runs.filter((s) => s.startFloor > 0).length}.`);

  // --- 1. Is magic worth it? ---------------------------------------------------
  out.push('\n## 1. Is magic worth it?');
  out.push('\nDamage and kills by source, per floor (`world`: allies, ground, monsters on monsters).');
  const floorRows: Array<Array<string | number>> = [];
  const allFloors = [...new Set(runs.flatMap((s) => Object.keys(s.magic?.floors ?? {}).map(Number)))].sort((a, b) => a - b);
  for (const f of allFloors) {
    const dmg: Record<string, number> = {};
    const kills: Record<string, number> = {};
    let n = 0;
    for (const s of runs) {
      const t = s.magic?.floors[String(f)];
      if (!t) continue;
      n++;
      for (const src of SOURCES) {
        add(dmg, src, t.damage[src] ?? 0);
        add(kills, src, t.kills[src] ?? 0);
      }
    }
    const dTotal = SOURCES.reduce((a, k) => a + (dmg[k] ?? 0), 0);
    const kTotal = SOURCES.reduce((a, k) => a + (kills[k] ?? 0), 0);
    floorRows.push([f, n, ...SOURCES.map((k) => pct(dmg[k] ?? 0, dTotal)), ...SOURCES.map((k) => `${kills[k] ?? 0}`), kTotal]);
  }
  out.push(table(['floor', 'runs', ...SOURCES.map((k) => `dmg ${k}`), ...SOURCES.map((k) => `kills ${k}`), 'kills'], floorRows));

  out.push('\nBy build and start floor (0: from town): does the caster go deeper or die later?');
  const byBuild = groupBy(runs, (s) => `${s.hero?.build ?? '?'} | ${s.startFloor}`);
  out.push(
    table(
      ['build', 'start', 'runs', 'median deepest', 'best', 'deaths', 'median level', 'median spells known', 'spell share of damage', 'death causes'],
      [...byBuild].map(([key, ss]) => {
        let spell = 0;
        let total = 0;
        const causes: Record<string, number> = {};
        for (const s of ss) {
          for (const t of Object.values(s.magic?.floors ?? {})) {
            spell += t.damage.spell ?? 0;
            total += SOURCES.reduce((a, k) => a + (t.damage[k] ?? 0), 0);
          }
          if (s.endedBy === 'death') add(causes, s.bot?.deathCause ?? 'unknown');
        }
        return [
          ...key.split(' | '),
          ss.length,
          median(ss.map((s) => s.deepestFloor)),
          Math.max(...ss.map((s) => s.deepestFloor)),
          ss.filter((s) => s.endedBy === 'death').length,
          median(ss.map((s) => s.hero?.level ?? 0)),
          median(ss.map((s) => s.magic?.spellsKnown.length ?? 0)),
          pct(spell, total),
          tally(causes),
        ];
      })
    )
  );

  out.push('\nSpells learned in the run against depth (runs from town only).');
  const town = runs.filter((s) => s.startFloor === 0);
  const learnedBuckets = new Map<string, number[]>();
  for (const s of town) {
    const n = s.magic?.learned.length ?? 0;
    const key = n >= 3 ? '3+' : String(n);
    learnedBuckets.set(key, [...(learnedBuckets.get(key) ?? []), s.deepestFloor]);
  }
  out.push(table(['spells learned', 'runs', 'median deepest'], [...learnedBuckets].sort().map(([k, d]) => [k, d.length, median(d)])));

  out.push(
    "\nEvery spell in the pack: who knew it, cast it, and what it did. `stone from`: the first floor a stone teaches it; `borrowed`: casts by what grimoire neighbours lent them, whose damage counts as the cast's."
  );
  const catalog: Record<string, { type: string; stoneFrom: number | null; ownDamage?: boolean }> = {};
  for (const s of runs) Object.assign(catalog, s.magic?.catalog ?? {});
  const spellRows: Array<Array<string | number>> = [];
  const byType: Record<string, { casts: number; kills: number; damage: number }> = {};
  for (const [id, info] of Object.entries(catalog).sort((a, b) => (a[1].stoneFrom ?? 99) - (b[1].stoneFrom ?? 99) || a[0].localeCompare(b[0]))) {
    let casts = 0;
    let failed = 0;
    let damage = 0;
    let kills = 0;
    let known = 0;
    let learned = 0;
    const lent: Record<string, number> = {};
    for (const s of runs) {
      if (s.magic?.spellsKnown.includes(id)) known++;
      if (s.magic?.learned.some((l) => l.spellId === id)) learned++;
      for (const t of Object.values(s.magic?.floors ?? {})) {
        casts += t.casts[id] ?? 0;
        failed += t.failed?.[id] ?? 0;
        damage += t.spellDamage[id] ?? 0;
        kills += t.spellKills?.[id] ?? 0;
        for (const [name, n] of Object.entries(t.lent?.[id] ?? {})) add(lent, name, n);
      }
    }
    const t = (byType[info.type] ??= { casts: 0, kills: 0, damage: 0 });
    t.casts += casts;
    t.kills += kills;
    t.damage += damage;
    // A summary from before `ownDamage` (17 Oct 2026) leaves it unknown: no note.
    const note =
      known === 0 ? 'never known' : casts === 0 ? 'never cast' : damage > 0 && info.ownDamage === false ? 'all its damage borrowed' : '';
    spellRows.push([id, info.type, info.stoneFrom ?? '-', known, learned, casts, failed, damage, kills, tally(lent), note]);
  }
  out.push(table(['spell', 'type', 'stone from', 'runs knowing', 'runs learning', 'casts', 'failed', 'damage', 'kills', 'borrowed', ''], spellRows));
  out.push('\nBy spell type.');
  out.push(table(['type', 'casts', 'damage', 'kills'], Object.entries(byType).map(([k, v]) => [k, v.casts, v.damage, v.kills])));

  // --- 2. Does the learning path work? -------------------------------------------
  out.push('\n## 2. Does the learning path work?');
  const routes: Record<string, number> = {};
  for (const s of runs) for (const l of s.magic?.learned ?? []) add(routes, l.via);
  out.push(`Spells learned, by route: ${tally(routes)}.`);
  out.push('\nSpells known on entering each floor (median over runs that entered it).');
  const entryRows: Array<Array<string | number>> = [];
  const paceFloors = [...new Set(runs.flatMap(floorsOf))].sort((a, b) => a - b);
  for (const f of paceFloors) {
    const xs = runs.map((s) => s.pace?.[String(f)]?.spellsOnEntry).filter((x): x is number => x !== undefined);
    if (xs.length) entryRows.push([f, xs.length, median(xs), Math.min(...xs), Math.max(...xs)]);
  }
  out.push(table(['floor', 'runs', 'median known', 'min', 'max'], entryRows));
  const stones: Record<string, Record<string, number>> = {};
  for (const s of runs) for (const [f, st] of Object.entries(s.magic?.stones ?? {})) add((stones[f] ??= {}), st);
  out.push('\nLearning stones on floors the hero entered: read, reached but not read, or missed.');
  out.push(
    table(
      ['floor', 'read', 'reached', 'missed'],
      Object.entries(stones)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([f, c]) => [f, c.read ?? 0, c.reached ?? 0, c.missed ?? 0])
    )
  );
  const altars: Record<string, Record<string, number>> = {};
  for (const s of runs) for (const [k, st] of Object.entries(s.magic?.altars ?? {})) add((altars[k] ??= {}), st);
  out.push('\nSpell altars on floors the hero entered ("floor:altar").');
  out.push(
    Object.keys(altars).length
      ? table(['altar', 'performed', 'reached', 'missed'], Object.entries(altars).map(([k, c]) => [k, c.performed ?? 0, c.reached ?? 0, c.missed ?? 0]))
      : 'No altar floor entered.'
  );

  // --- 3. Pacing -----------------------------------------------------------------
  out.push('\n## 3. Pacing of the floors');
  out.push('Per floor, over every run that entered it (deep starts included): turns, actions and minutes spent there.');
  const paceRows: Array<Array<string | number>> = [];
  for (const f of paceFloors) {
    const visits = runs.map((s) => s.pace?.[String(f)]).filter((p): p is NonNullable<typeof p> => Boolean(p));
    if (!visits.length) continue;
    paceRows.push([
      f,
      visits.length,
      median(visits.map((p) => p.turns)),
      quantile(visits.map((p) => p.turns), 0.9),
      median(visits.map((p) => p.actions)),
      median(visits.map((p) => p.wallMs / 60000)),
    ]);
  }
  out.push(table(['floor', 'runs', 'median turns', 'p90 turns', 'median actions', 'median minutes'], paceRows));
  // Turns below town on first reaching each floor, from runs that walked down from town.
  const belowAt: Record<number, number[]> = {};
  for (const s of town) {
    const floors = floorsOf(s).filter((f) => f > 0);
    for (const f of floors) {
      const first = s.pace![String(f)].firstTurn;
      const below = floors.filter((g) => s.pace![String(g)].firstTurn < first).reduce((a, g) => a + s.pace![String(g)].turns, 0);
      (belowAt[f] ??= []).push(below);
    }
  }
  out.push('\nTurns below town on first reaching each floor (runs from town). Cold stages: ' + opts.coldStages.join(', ') + '.');
  out.push(
    table(
      ['floor', 'runs', 'median below', 'min', 'max', 'cold stage reached (median)'],
      Object.entries(belowAt)
        .map(([f, xs]) => [Number(f), xs] as const)
        .sort((a, b) => a[0] - b[0])
        .map(([f, xs]) => [f, xs.length, median(xs), Math.min(...xs), Math.max(...xs), opts.coldStages.filter((t) => median(xs) >= t).length])
    )
  );
  const belowEnd = town.map((s) => s.belowTurns).filter((x): x is number => typeof x === 'number');
  out.push(`At the run's end (the cold's own counter): median ${fmt(median(belowEnd))}, max ${belowEnd.length ? Math.max(...belowEnd) : '-'}.`);

  // --- 4. Runestones -------------------------------------------------------------
  out.push('\n## 4. Do the Runestones matter?');
  out.push('By the run\'s policy (first gift, mostly a stat; second, mostly an item; leave). `answered`: runs that took or left at least one stone.');
  const byPolicy = groupBy(runs, (s) => `${s.hero?.runestonePolicy ?? '?'} | ${s.startFloor}`);
  out.push(
    table(
      ['policy', 'start', 'runs', 'answered', 'median deepest', 'deaths', 'death causes'],
      [...byPolicy].map(([key, ss]) => {
        const causes: Record<string, number> = {};
        for (const s of ss) if (s.endedBy === 'death') add(causes, s.bot?.deathCause ?? 'unknown');
        return [...key.split(' | '), ss.length, ss.filter((s) => Object.keys(s.hero?.runestones ?? {}).length > 0).length, median(ss.map((s) => s.deepestFloor)), ss.filter((s) => s.endedBy === 'death').length, tally(causes)];
      })
    )
  );
  const answers: Record<string, number> = {};
  for (const s of runs) for (const [id, opt] of Object.entries(s.hero?.runestones ?? {})) add(answers, `${id}=${opt}`);
  out.push(`Stones answered: ${tally(answers)}.`);

  // --- 5. Is magic broken? -------------------------------------------------------
  out.push('\n## 5. Is magic broken?');
  // A run is (folder, seed): seed 3 in two folders is two affected runs.
  const fam = new Map<string, { seeds: Set<string>; count: number; example: string }>();
  for (const s of runs) {
    for (const [sig, n] of Object.entries(s.findings ?? {})) {
      const k = family(sig);
      const e = fam.get(k) ?? { seeds: new Set<string>(), count: 0, example: sig };
      e.seeds.add(JSON.stringify([s.folder ?? '', s.seed]));
      e.count += n;
      fam.set(k, e);
    }
  }
  const famRows = [...fam].sort((a, b) => b[1].seeds.size - a[1].seeds.size || b[1].count - a[1].count);
  const magicRows = famRows.filter(([k]) => /magic|spell|cast|mana|void|grimoire|rune|altar|stone/i.test(k));
  out.push(`Magic findings (anomalies from the tap, and any finding naming spells, mana or stones): ${magicRows.length ? '' : 'none.'}`);
  if (magicRows.length) out.push(table(['finding', 'seeds', 'count'], magicRows.map(([k, e]) => [k, e.seeds.size, e.count])));
  let casts = 0;
  let failed = 0;
  for (const s of runs) {
    for (const t of Object.values(s.magic?.floors ?? {})) {
      casts += Object.values(t.casts).reduce((a, n) => a + n, 0);
      failed += Object.values(t.failed ?? {}).reduce((a, n) => a + n, 0);
    }
  }
  out.push(`Casts ${casts}, failed (spent nothing) ${failed} (${pct(failed, casts + failed)}).`);
  out.push('\nAll findings by family, ranked by seeds affected.');
  out.push(famRows.length ? table(['finding', 'seeds', 'count'], famRows.slice(0, 25).map(([k, e]) => [k, e.seeds.size, e.count])) : 'None.');

  return out.join('\n');
}
