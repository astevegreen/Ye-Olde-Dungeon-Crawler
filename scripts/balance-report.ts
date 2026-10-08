import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ProfileManager, MemoryStorage } from '../src/engine/storage/profile-manager';
import { cotwManifest } from '../src/content/cotw';
import { Monster } from '../src/engine/entities/monster';
import { Container } from '../src/engine/items/container';
import { CoinItem } from '../src/engine/economy/currency';
import { PRNG } from '../src/engine/dungeon/prng';
import type { Item } from '../src/engine/items/item';
import type { GameEngine } from '../src/engine/engine';
import type { GameDifficulty } from '../src/engine/types';

/**
 * Headless balance report (`npm run balance`): what a run is offered, floor by floor.
 *
 * Every floor is generated through the real game path (`ProfileManager.createCharacter`, then
 * `engine.changeFloor`, which runs `DungeonArc.generateFloor` with the cotw manifest), so rooms,
 * vaults, chests, scripted placements, minibosses and the lair are all counted. Floor 0 is the
 * night raid (the pack's prologue). Per floor it prints:
 * - monsters, their XP, and the level a hero reaches by killing all of them (a full clear,
 *   median run), on the pack's own XP curve;
 * - coins: value, coin count, weight and volume, from the ground and from monsters;
 * - items by family (the item's modifier category; `quality: 'cursed'` counts as Cursed), +N
 *   items, and their weight and volume.
 *
 * Monster drops are expected values: every monster on the floor is "killed" `--trials` times and
 * each loot rule is rolled the way `deathResolver` rolls it (no pact or perk bonuses). Not
 * counted: wandering spawns, cleared-floor respawns, catch-up spawns, kill-rite essences, trophies.
 *
 * Run it before and after every balance change and quote both in the commit:
 *   npm run balance -- --out .prompts/balance/before.json
 *   (change)
 *   npm run balance -- --baseline .prompts/balance/before.json
 * Options: --seeds N (20), --seed0 N (7000), --trials N (20), --difficulty easy,medium,hard
 * (medium), --floors all|1,5,10 (a selection), --out file.json, --baseline file.json.
 */

const FAMILIES = ['normal', 'blessed', 'enchanted', 'holy', 'cursed', 'hexed', 'unholy', 'chaotic'] as const;
type Family = (typeof FAMILIES)[number];
const DIFFICULTIES: readonly GameDifficulty[] = ['easy', 'medium', 'hard'];
const DEFAULT_FLOORS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 20, 22, 25, 28, 30, 33, 36, 40, 44, 45, 47, 49, 50];
const LAST_FLOOR = 50;

interface FloorMetrics {
  floor: number;
  monsters: number;
  xp: number;
  cumulativeXp: number;
  /** Median over seeds of the level after killing everything on floors 0..this one. */
  level: number;
  items: number;
  groundItems: number;
  monsterItems: number;
  families: Record<Family, number>;
  /** Items with an enchantment level above 0 or an elemental affix. */
  plusN: number;
  itemKg: number;
  itemL: number;
  coinCp: number;
  monsterCoinCp: number;
  coins: number;
  coinKg: number;
  coinL: number;
}

interface DifficultyReport {
  difficulty: GameDifficulty;
  floors: FloorMetrics[];
  game: FloorMetrics;
}

interface Report {
  commit: string;
  seeds: number;
  seed0: number;
  trials: number;
  reports: DifficultyReport[];
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const SEEDS = Number(arg('seeds') ?? 20);
const SEED0 = Number(arg('seed0') ?? 7000);
const TRIALS = Number(arg('trials') ?? 20);
const difficulties = (arg('difficulty') ?? 'medium').split(',') as GameDifficulty[];
for (const d of difficulties) {
  if (!DIFFICULTIES.includes(d)) throw new Error(`Unknown difficulty "${d}"; use ${DIFFICULTIES.join(', ')}`);
}
const floorsArg = arg('floors');
const shownFloors =
  floorsArg === 'all'
    ? Array.from({ length: LAST_FLOOR + 1 }, (_, i) => i)
    : floorsArg
      ? floorsArg.split(',').map(Number)
      : DEFAULT_FLOORS;
const outPath = arg('out');
const baselinePath = arg('baseline');

function familyOf(item: Item): Family {
  for (const modifier of item.modifiers) {
    if ((FAMILIES as readonly string[]).includes(modifier.category)) return modifier.category as Family;
  }
  return 'normal';
}

/** Sums for one floor of one seed. Monster drops arrive weighted by 1/TRIALS. */
class FloorTally {
  monsters = 0;
  xp = 0;
  groundItems = 0;
  monsterItems = 0;
  families = Object.fromEntries(FAMILIES.map((f) => [f, 0])) as Record<Family, number>;
  plusN = 0;
  itemGrams = 0;
  itemBulk = 0;
  coinCp = 0;
  monsterCoinCp = 0;
  coins = 0;
  coinGrams = 0;
  coinBulk = 0;

  add(item: Item, fromMonster: boolean, weight = 1): void {
    if (item instanceof CoinItem) {
      this.coinCp += item.valueInCp * weight;
      if (fromMonster) this.monsterCoinCp += item.valueInCp * weight;
      this.coins += item.count * weight;
      this.coinGrams += item.totalWeight() * weight;
      this.coinBulk += item.totalBulk() * weight;
      return;
    }
    // A chest is furniture: count what is in it, not the chest.
    if (item instanceof Container && item.containerType === 'chest') {
      for (const inner of item.getItems()) this.add(inner, fromMonster, weight);
      return;
    }
    if (fromMonster) this.monsterItems += weight;
    else this.groundItems += weight;
    this.families[familyOf(item)] += weight;
    if (item.enchantmentLevel > 0 || item.elementalAffix) this.plusN += weight;
    this.itemGrams += item.totalWeight() * weight;
    this.itemBulk += item.totalBulk() * weight;
  }
}

function hostilesOn(engine: GameEngine): Monster[] {
  return engine.map
    .getAllEntities()
    .filter((m): m is Monster => m instanceof Monster && m.isAlive() && m.faction !== 'player' && m !== engine.companion);
}

function tallyFloor(engine: GameEngine, floor: number, dropRng: () => number): FloorTally {
  const tally = new FloorTally();
  for (const { items } of engine.map.getAllGroundItems()) {
    for (const item of items) tally.add(item, false);
  }
  const weight = 1 / TRIALS;
  for (const monster of hostilesOn(engine)) {
    tally.monsters += 1;
    tally.xp += monster.xpValue;
    for (const carried of monster.getItems()) tally.add(carried, true);
    for (let t = 0; t < TRIALS; t++) {
      for (const rule of monster.lootTable) {
        if (dropRng() >= rule.chance) continue;
        const item = rule.generate(`balance-${floor}-${monster.id}-${t}`, dropRng, floor);
        if (item) tally.add(item, true, weight);
      }
    }
  }
  return tally;
}

/** The level a fresh hero of this pack reaches with `totalXp`, on the pack's own curve and cap. */
function levelFor(engine: GameEngine, totalXp: number): number {
  const player = engine.player;
  const cap = player.progressionConfig?.maxLevel ?? Infinity;
  let level = 1;
  let left = totalXp;
  while (level < cap) {
    const need = player.getXpRequirement(level);
    if (left < need) break;
    left -= need;
    level += 1;
  }
  return level;
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function runDifficulty(difficulty: GameDifficulty): DifficultyReport {
  const perFloor: FloorTally[][] = Array.from({ length: LAST_FLOOR + 1 }, () => []);
  const levels: number[][] = Array.from({ length: LAST_FLOOR + 1 }, () => []);
  for (let s = 0; s < SEEDS; s++) {
    const seed = SEED0 + s;
    const dropPrng = new PRNG(99991 + seed);
    const dropRng = () => dropPrng.next();
    const profiles = new ProfileManager(new MemoryStorage(), cotwManifest);

    const { engine: raid } = profiles.createCharacter('Balance', { seed, difficulty, prologue: true });
    const tallies = [tallyFloor(raid, 0, dropRng)];

    const { engine } = profiles.createCharacter('Balance', { seed, difficulty });
    engine.onChoiceInteract = undefined;
    for (let floor = 1; floor <= LAST_FLOOR; floor++) {
      engine.changeFloor(floor);
      tallies.push(tallyFloor(engine, floor, dropRng));
    }

    let cumulative = 0;
    tallies.forEach((tally, floor) => {
      perFloor[floor].push(tally);
      cumulative += tally.xp;
      levels[floor].push(levelFor(engine, cumulative));
    });
  }

  let cumulativeXp = 0;
  const floors = perFloor.map((tallies, floor): FloorMetrics => {
    const m = (pick: (t: FloorTally) => number) => mean(tallies.map(pick));
    const xp = m((t) => t.xp);
    cumulativeXp += xp;
    return {
      floor,
      monsters: m((t) => t.monsters),
      xp,
      cumulativeXp,
      level: median(levels[floor]),
      items: m((t) => t.groundItems + t.monsterItems),
      groundItems: m((t) => t.groundItems),
      monsterItems: m((t) => t.monsterItems),
      families: Object.fromEntries(FAMILIES.map((f) => [f, m((t) => t.families[f])])) as Record<Family, number>,
      plusN: m((t) => t.plusN),
      itemKg: m((t) => t.itemGrams) / 1000,
      itemL: m((t) => t.itemBulk) / 1000,
      coinCp: m((t) => t.coinCp),
      monsterCoinCp: m((t) => t.monsterCoinCp),
      coins: m((t) => t.coins),
      coinKg: m((t) => t.coinGrams) / 1000,
      coinL: m((t) => t.coinBulk) / 1000,
    };
  });

  const sum = (pick: (f: FloorMetrics) => number) => floors.reduce((a, f) => a + pick(f), 0);
  const last = floors[floors.length - 1];
  const game: FloorMetrics = {
    floor: -1,
    monsters: sum((f) => f.monsters),
    xp: sum((f) => f.xp),
    cumulativeXp: last.cumulativeXp,
    level: last.level,
    items: sum((f) => f.items),
    groundItems: sum((f) => f.groundItems),
    monsterItems: sum((f) => f.monsterItems),
    families: Object.fromEntries(FAMILIES.map((fam) => [fam, sum((f) => f.families[fam])])) as Record<Family, number>,
    plusN: sum((f) => f.plusN),
    itemKg: sum((f) => f.itemKg),
    itemL: sum((f) => f.itemL),
    coinCp: sum((f) => f.coinCp),
    monsterCoinCp: sum((f) => f.monsterCoinCp),
    coins: sum((f) => f.coins),
    coinKg: sum((f) => f.coinKg),
    coinL: sum((f) => f.coinL),
  };
  return { difficulty, floors, game };
}

// ── Printing ──

type Column = { head: string; get: (f: FloorMetrics) => number; digits: number };

const PROGRESSION: Column[] = [
  { head: 'monsters', get: (f) => f.monsters, digits: 1 },
  { head: 'XP', get: (f) => f.xp, digits: 0 },
  { head: 'cum XP', get: (f) => f.cumulativeXp, digits: 0 },
  { head: 'level', get: (f) => f.level, digits: 0 },
  { head: 'coins CP', get: (f) => f.coinCp, digits: 0 },
  { head: 'from monsters', get: (f) => f.monsterCoinCp, digits: 0 },
  { head: 'coins', get: (f) => f.coins, digits: 0 },
  { head: 'coin kg', get: (f) => f.coinKg, digits: 1 },
  { head: 'coin L', get: (f) => f.coinL, digits: 1 },
];

const ITEMS: Column[] = [
  { head: 'items', get: (f) => f.items, digits: 1 },
  { head: 'ground', get: (f) => f.groundItems, digits: 1 },
  { head: 'monsters', get: (f) => f.monsterItems, digits: 1 },
  ...FAMILIES.map((fam): Column => ({ head: fam, get: (f) => f.families[fam], digits: 2 })),
  { head: '+N', get: (f) => f.plusN, digits: 1 },
  { head: 'item kg', get: (f) => f.itemKg, digits: 1 },
  { head: 'item L', get: (f) => f.itemL, digits: 1 },
];

function format(value: number, digits: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function cell(column: Column, now: FloorMetrics, before: FloorMetrics | undefined): string {
  const after = format(column.get(now), column.digits);
  if (!before) return after;
  const was = format(column.get(before), column.digits);
  return was === after ? after : `${was} → ${after}`;
}

function printTable(title: string, columns: Column[], report: DifficultyReport, baseline: DifficultyReport | undefined): void {
  console.log(`\n${title}`);
  console.log(['floor', ...columns.map((c) => c.head)].join(' | '));
  const rows: Array<[string, FloorMetrics, FloorMetrics | undefined]> = shownFloors
    .filter((floor) => floor >= 0 && floor <= LAST_FLOOR)
    .map((floor) => [floor === 0 ? '0 raid' : String(floor), report.floors[floor], baseline?.floors[floor]]);
  rows.push(['game', report.game, baseline?.game]);
  for (const [label, now, before] of rows) {
    console.log([label, ...columns.map((c) => cell(c, now, before))].join(' | '));
  }
}

const commit = execSync('git rev-parse --short HEAD').toString().trim();
const dirty = execSync('git status --porcelain --untracked-files=no').toString().trim() ? '+dirty' : '';
const baseline: Report | undefined = baselinePath ? JSON.parse(readFileSync(baselinePath, 'utf8')) : undefined;

const started = Date.now();
const report: Report = { commit: commit + dirty, seeds: SEEDS, seed0: SEED0, trials: TRIALS, reports: difficulties.map(runDifficulty) };

console.log(
  `Balance report at ${report.commit}${baseline ? ` (before → after: baseline ${baseline.commit})` : ''}: ` +
    `${SEEDS} seeds from ${SEED0}, monster drops over ${TRIALS} kills each, full clear. ${Date.now() - started} ms`
);
for (const r of report.reports) {
  const before = baseline?.reports.find((b) => b.difficulty === r.difficulty);
  printTable(`[${r.difficulty}] Progression and coins, mean per floor (level: median run)`, PROGRESSION, r, before);
  printTable(`[${r.difficulty}] Items by family, mean per floor`, ITEMS, r, before);
}
if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 1));
  console.log(`\nWrote ${outPath}`);
}
