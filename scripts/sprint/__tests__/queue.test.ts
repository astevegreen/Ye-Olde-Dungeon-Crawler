import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DEFAULT_HOURS,
  MEMORY_FLOOR_MB,
  SESSION_MB,
  TRIGGERS_FILE,
  WINDOW_FILE,
  bodyRefs,
  hasWork,
  heldRetry,
  laneQueue,
  matchesId,
  nextJob,
  normalizeIssues,
  parseSprintDoc,
  planMove,
  researchQueue,
  run,
  sessionTitles,
  statusBlock,
  type QueueIO,
  type RawIssue,
  type World,
} from '../queue-rules.mjs';

/**
 * The sprint queue (scripts/sprint/queue.mjs) on October's issues. The fixture is the issue list as the
 * sprint ended; `at` winds it back to a moment: issues not yet created drop out, an issue closed later is
 * open again, and comments not yet written go. Labels at that moment aren't in the export, so a test names
 * the ones that matter, as the sprint log (#19) recorded them.
 */

const FIXTURES = path.join(__dirname, 'fixtures');
const OCTOBER: RawIssue[] = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'october-issues.json'), 'utf-8')).issues;
const SPRINT_MD = fs.readFileSync(path.join(FIXTURES, 'october-sprint.md'), 'utf-8');
/** October's window, as /sprint-start would have written it on the sprint computer. */
const OCTOBER_WINDOW = { start: '2026-10-21T00:40:00.000Z', end: '2026-10-22T18:00:00.000Z', environment: 'env_01SNfen', supervisor: null, archiver: null };
const doc = { ...parseSprintDoc(SPRINT_MD), window: { start: new Date(OCTOBER_WINDOW.start), end: new Date(OCTOBER_WINDOW.end) } };

function at(iso: string, labels: Record<number, string[]> = {}, extra: RawIssue[] = [], world: Partial<World> = {}): World {
  const t = new Date(iso);
  const issues = [...OCTOBER, ...extra]
    .filter((i) => new Date(i.createdAt!) <= t)
    .map((i) => ({
      ...i,
      state: i.closedAt && new Date(i.closedAt) <= t ? 'CLOSED' : 'OPEN',
      labels: labels[i.number] ? labels[i.number]!.map((name) => ({ name })) : i.labels,
      comments: (i.comments ?? []).filter((c) => new Date(c.createdAt) <= t),
    }));
  return { doc, issues: normalizeIssues(issues), now: t, freeMb: 20_000, branchAhead: () => 0, processInfo: () => null, lastDeploy: null, ...world };
}

const issue = (n: number, title: string, labels: string[], body = '', comments: [string, string, string][] = []): RawIssue => ({
  number: n,
  title,
  body,
  state: 'OPEN',
  createdAt: '2026-10-20T00:00:00Z',
  closedAt: null,
  labels: labels.map((name) => ({ name })),
  comments: comments.map(([login, createdAt, body]) => ({ author: { login }, createdAt, body })),
});
/** A hunt like R6 (#63): it closed at 05:26Z on 22 Oct, so the next is due at 17:26Z. */
const hunt: RawIssue = {
  ...issue(900, '[task] H1: bug hunt since pre-sprint-2026-10-20', ['lane:research']),
  state: 'CLOSED',
  createdAt: '2026-10-22T05:13:11Z',
  closedAt: '2026-10-22T05:26:36Z',
  comments: [{ author: { login: 'greenbeanbot' }, createdAt: '2026-10-22T05:22:39Z', body: 'Research: hunt candidates sha 74e30d5e' }],
};

describe('docs/sprint.md, read once', () => {
  it('finds the lanes, sprint log, tag and every backlog list, and no window: /sprint-start opens that', () => {
    expect(parseSprintDoc(SPRINT_MD).window).toBeNull();
    expect(doc.lanes.map((l) => l.name)).toEqual(['aids', 'ux', 'fixes', 'tooling', 'research']);
    expect(doc.logIssue).toBe(19);
    expect(doc.preSprintTag).toBe('pre-sprint-2026-10-20');
    expect(doc.backlog.tooling!.map((i) => i.id)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']);
    expect(doc.backlog.research!.map((i) => i.id)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6']);
  });
  it('reads each research item\'s "Waits for" and whether it has soaks', () => {
    const r = Object.fromEntries(doc.backlog.research!.map((i) => [i.id, i]));
    expect(r.R4!.waits).toEqual([{ id: 'T5' }]);
    expect(r.R5!.waits).toEqual([{ id: 'T6' }, { id: 'T7' }]);
    expect(r.R6).toMatchObject({ waits: [], soaks: false });
    const ranged = parseSprintDoc(SPRINT_MD.replace('After M3–M6 land: a soak', 'A soak. Waits for: M3–M6. Then'));
    expect(ranged.backlog.research![1]!.waits).toEqual(['M3', 'M4', 'M5', 'M6'].map((id) => ({ id })));
  });
  it('reads this checkout\'s docs/sprint.md, the template the next sprint fills in', () => {
    const current = parseSprintDoc(fs.readFileSync(path.join(__dirname, '../../../docs/sprint.md'), 'utf-8'));
    expect(current.lanes.length).toBeGreaterThan(0);
    expect(sessionTitles(current)).toContain('YODC integrate');
    // Every lane the table names has a backlog list, and every item has an ID the queue can match.
    for (const lane of current.lanes) expect(current.backlog[lane.name]?.length, lane.name).toBeGreaterThan(0);
  });
  it('fails, saying what is missing, rather than guess', () => {
    expect(() => parseSprintDoc(SPRINT_MD.replace(/^## Backlog\s*$/m, '## Work'))).toThrow(/Backlog/);
  });
});

describe('what an issue waits for', () => {
  const body = (n: number) => OCTOBER.find((i) => i.number === n)!.body!;
  it('reads every form October used, up to the first full stop', () => {
    expect(bodyRefs(body(49))).toEqual([27, 48]); // **Depends on**: #27 and #48 (…)
    expect(bodyRefs(body(59))).toEqual([58]); // ## Depends on, then "T5a (issue #58)"
    expect(bodyRefs(body(36))).toEqual([28]); // "#28 (M2). Independent of #35, …"
    expect(bodyRefs(body(69))).toEqual([57, 64]); // **Waits for**: #57 (U7) and #64 (S2) …
  });
  it('reads "none" as nothing, whatever follows it', () => {
    expect(bodyRefs(body(47))).toEqual([]); // "none (see #46)"
    expect(bodyRefs(body(50))).toEqual([]); // "none. If #30 (U1b) lands first, …"
    expect(bodyRefs(body(25))).toEqual([]); // "depends on machine load" mid-sentence, then "None. (#21, …)"
  });
});

describe('done IDs (M1 against M1a)', () => {
  const w = normalizeIssues([issue(1, '[task] M1a: first half', []), issue(2, '[task] M10: other', [])]);
  it('a split counts for its item; a longer number does not', () => {
    expect(matchesId(w[0]!, 'M1')).toBe(true);
    expect(matchesId(w[1]!, 'M1')).toBe(false);
    expect(matchesId(w[1]!, 'M10')).toBe(true);
  });
  it('plan has work while an item has no issue and the lane has under 3 ready', () => {
    // 21:30Z on 21 Oct: the second backlog (T5–T7) is approved and not yet filed.
    const w2 = at('2026-10-21T21:30:00Z', { 49: ['lane:tooling', 'to-integrate'] });
    expect(hasWork(w2, 'YODC plan: tooling')).toMatchObject({ start: true, ready: 0, todo: ['T5', 'T6', 'T7'] });
    expect(hasWork(at('2026-10-23T12:00:00Z'), 'YODC plan: tooling')).toMatchObject({ start: false, todo: [] });
  });
});

describe('October failures', () => {
  it('T4b is not started while T4a, which it depends on, is still open', () => {
    // 17:33Z on 21 Oct a tooling session started and found "#49 not ready, depends on #48" (#19).
    const w = at('2026-10-21T17:30:00Z', { 48: ['lane:tooling', 'to-integrate'], 49: ['lane:tooling', 'sprint-ready'] });
    expect(hasWork(w, 'YODC lane: tooling')).toMatchObject({ start: false, reason: expect.stringContaining('#49 T4b waits for #48 T4a') });
    expect(nextJob(w, 'tooling')).toBeNull();
    expect(() => planMove(w, 49, 'in-progress')).toThrow('#49 waits for #48 T4a');
  });
  it('T5a held with the lane\'s own comment newest waits for the owner, and says so', () => {
    const w = at('2026-10-22T03:05:00Z', { 58: ['lane:tooling', 'held'], 59: ['lane:tooling', 'sprint-ready'] });
    expect(hasWork(w, 'YODC lane: tooling').start).toBe(false);
    expect(statusBlock(w).needsYou).toEqual([expect.stringMatching(/^#58 \[held\] T5a: waits for the owner/)]);
  });
  it('an answer relayed by the bot account does not count as the owner\'s', () => {
    const t5a = at('2026-10-22T04:25:00Z', { 58: ['lane:tooling', 'held'], 59: ['lane:tooling', 'sprint-ready'] });
    expect(nextJob(t5a, 'tooling')).toBeNull();
    // U3 at 23:19Z on 21 Oct: the relay came after the owner's last comment.
    const u3 = at('2026-10-21T23:19:50Z', { 37: ['lane:ux', 'blocked'] });
    expect(laneQueue(u3, 'ux').waiting).toContain('#37 U3 is blocked: no owner reply yet');
    expect(statusBlock(u3).needsYou).toContain('#37 [blocked] U3: waiting for your answer');
  });
  it('no research session while a soak runs; reading it once it has ended', () => {
    // R5's soak, pid 31660, started 05:13Z on 22 Oct and was read at 12:28Z.
    const soak = { name: 'cmd', start: new Date('2026-10-22T05:12:58Z') };
    const running = at('2026-10-22T08:00:00Z', {}, [hunt], { processInfo: (pid) => (pid === 31660 ? soak : null) });
    expect(hasWork(running, 'YODC lane: research')).toEqual({
      start: false,
      reason: "nothing to do: R5's soak player (pid 31660, #62) is still running; the next hunt is due at 2026-10-22 17:26Z",
    });
    const ended = { ...running, processInfo: () => null };
    expect(nextJob(ended, 'research')).toMatchObject({ mode: 'read', issue: 62, item: 'R5', folder: 'player' });
    // The pid now belongs to a process that started after the comment: the soak has ended.
    const reused = { ...running, processInfo: () => ({ name: 'cmd', start: new Date('2026-10-22T07:00:00Z') }) };
    expect(nextJob(reused, 'research')).toMatchObject({ mode: 'read', issue: 62 });
  });
  it('the research list is docs/sprint.md\'s: R5 is found the hour its wait ends', () => {
    // 03:09Z on 22 Oct the research skill's own copy stopped at R3; T6 and T7 had landed at 02:00Z and 02:13Z.
    const w = at('2026-10-22T03:09:00Z', {}, [{ ...hunt, createdAt: '2026-10-21T23:00:00Z', closedAt: '2026-10-22T00:00:00Z' }]);
    expect(nextJob(w, 'research')).toEqual({ mode: 'soak', issue: null, item: 'R5', reason: 'R5: its waits are over and it has no issue yet' });
  });
  it('a "Waits for" written in the issue holds the soak', () => {
    // R4 (#69) waited for #57 and #64 to land; its soak started at 12:29:57Z anyway.
    const w = at('2026-10-22T12:29:30Z', {}, [hunt]);
    expect(hasWork(w, 'YODC lane: research')).toMatchObject({ start: false, reason: expect.stringContaining('R4 waits for #57 U7, #64 S2') });
    const landed = { ...w, issues: w.issues.map((i) => ([57, 64].includes(i.number) ? { ...i, open: false } : i)) };
    expect(nextJob(landed, 'research')).toMatchObject({ mode: 'soak', issue: 69, item: 'R4' });
  });
  it('starts no soak that would get under an hour before the window closes', () => {
    // R4's first soak was read at 15:12Z on 22 Oct; the window closed at 18:00Z.
    const w = at('2026-10-22T15:12:58Z', {}, [hunt]);
    const landed = { ...w, issues: w.issues.map((i) => ([57, 64].includes(i.number) ? { ...i, open: false } : i)) };
    expect(nextJob(landed, 'research')).toMatchObject({ mode: 'soak', issue: 69 });
    expect(researchQueue({ ...landed, now: new Date('2026-10-22T15:31:00Z') })).toEqual({
      job: null,
      waiting: ['no soak starts after 2026-10-22 15:30Z: under an hour would fit before the window closes', 'the next hunt is due at 2026-10-22 17:26Z'],
    });
  });
});

describe('held work', () => {
  it('is retried after an owner reply, with that reply as the concerns', () => {
    const w = at('2026-10-22T04:20:00Z', { 57: ['lane:ux', 'held'] });
    expect(nextJob(w, 'ux')).toEqual({ mode: 'fix', issue: 57, concerns: 'retry the gate', reason: '#57 U7 is held and the owner replied' });
  });
  it('is retried when the integrator sent it back, not after the builder\'s own report', () => {
    expect(nextJob(at('2026-10-22T06:45:00Z', { 57: ['lane:ux', 'held'] }), 'ux')).toMatchObject({ mode: 'fix', issue: 57 });
    expect(nextJob(at('2026-10-22T07:50:00Z', { 57: ['lane:ux', 'held'] }), 'ux')).toBeNull();
  });
  it('a machine failure is retried only over the memory floor', () => {
    const [i] = normalizeIssues([issue(5, '[task] B1: x', ['lane:fixes', 'held'], '', [['greenbeanbot', '2026-10-21T10:00:00Z', 'Implementer: machine. knip ran out of memory']])]);
    expect(heldRetry(i!, 8000)).toMatchObject({ retry: true });
    expect(heldRetry(i!, 3000)).toMatchObject({ retry: false });
  });
  it('a comment by anyone else changes nothing', () => {
    const [i] = normalizeIssues([
      issue(5, '[task] B1: x', ['lane:fixes', 'held'], '', [
        ['greenbeanbot', '2026-10-21T10:00:00Z', 'Integrator: conflicts with main'],
        ['someone', '2026-10-21T11:00:00Z', 'me too'],
      ]),
    ]);
    expect(heldRetry(i!, 8000)).toMatchObject({ retry: true, why: 'the integrator sent it back' });
  });
});

describe('next, in order', () => {
  const lane = (issues: RawIssue[], world: Partial<World> = {}): World => ({ ...at('2026-10-21T01:00:00Z'), issues: normalizeIssues(issues), ...world });
  it('takes ready issues in backlog order, not issue number, and IDs not in the backlog last', () => {
    const w = lane([issue(10, '[task] S1: soak bug', ['lane:fixes', 'sprint-ready']), issue(11, '[task] B3: x', ['lane:fixes', 'sprint-ready']), issue(12, '[task] B1: y', ['lane:fixes', 'sprint-ready'])]);
    expect(nextJob(w, 'fixes')?.issue).toBe(12);
    expect(nextJob(w, 'fixes', [12])?.issue).toBe(11);
    expect(nextJob(w, 'fixes', [12, 11])?.issue).toBe(10);
  });
  it('picks up a stopped session\'s work first: review it when its branch has commits, else build it again', () => {
    const issues = [issue(11, '[task] B1: x', ['lane:fixes', 'sprint-ready']), issue(12, '[task] B2: y', ['lane:fixes', 'in-progress'])];
    expect(nextJob(lane(issues, { branchAhead: () => 2 }), 'fixes')).toMatchObject({ mode: 'resume', issue: 12 });
    expect(nextJob(lane(issues), 'fixes')).toMatchObject({ mode: 'build', issue: 12 });
  });
  it('builds a blocked issue the owner answered, as the lanes\' unblock step did', () => {
    const w = lane([issue(11, '[task] B1: x', ['lane:fixes', 'blocked'], '', [['greenbeanbot', '2026-10-21T00:10:00Z', 'Implementer: which?'], ['astevegreen', '2026-10-21T00:20:00Z', '(a)']])]);
    expect(nextJob(w, 'fixes')).toMatchObject({ mode: 'build', issue: 11 });
  });
});

describe('has-work', () => {
  it('covers every session title the supervisor keeps, and refuses others', () => {
    expect(sessionTitles(doc)).toHaveLength(10);
    expect(() => hasWork(at('2026-10-22T00:00:00Z'), 'YODC lane: art')).toThrow(/unknown session title/);
  });
  it('starts nothing under the memory floor', () => {
    const w = at('2026-10-21T12:00:00Z', {}, [], { freeMb: 3000 });
    for (const title of sessionTitles(doc)) expect(hasWork(w, title)).toMatchObject({ start: false, reason: 'memory: 3000 MB free, under the 4096 MB floor' });
  });
  it('integrate has work while an issue is labelled to-integrate', () => {
    // 12:00Z on 22 Oct: U7 and S2 were handed over again at 11:53Z and 11:58Z.
    expect(hasWork(at('2026-10-22T12:00:00Z'), 'YODC integrate')).toMatchObject({ start: true, issues: [57, 64] });
    expect(hasWork(at('2026-10-23T12:00:00Z'), 'YODC integrate')).toMatchObject({ start: false, issues: [] });
  });
});

describe('move', () => {
  const w = (labels: string[], world: Partial<World> = {}) =>
    ({ ...at('2026-10-21T01:00:00Z'), issues: normalizeIssues([issue(7, '[task] B1: x', ['lane:fixes', ...labels])]), ...world }) as World;
  it('claims a ready issue with no comment', () => {
    expect(planMove(w(['sprint-ready']), 7, 'in-progress')).toEqual({ issue: 7, from: 'sprint-ready', to: 'in-progress', comment: null, add: ['in-progress'], remove: ['sprint-ready'] });
  });
  it('hands over to the integrator with the standard comment, only with commits and a note', () => {
    const ready = planMove(w(['in-progress'], { branchAhead: () => 1 }), 7, 'to-integrate', 'WHAT CHANGED: a\\nPLAYER-VISIBLE: b');
    expect(ready.comment).toBe('Lane: ready to integrate, branch sprint/7.\nWHAT CHANGED: a\nPLAYER-VISIBLE: b');
    expect(() => planMove(w(['in-progress']), 7, 'to-integrate', 'x')).toThrow(/no commits ahead/);
    expect(() => planMove(w(['in-progress'], { branchAhead: () => 1 }), 7, 'to-integrate')).toThrow(/needs a note/);
  });
  it('refuses what the rules do not allow, saying what to do instead', () => {
    expect(() => planMove(w(['held']), 7, 'in-progress')).toThrow(/held and/);
    expect(() => planMove(w(['to-integrate']), 7, 'held')).toThrow(/integrator's/);
    expect(() => planMove(w(['sprint-ready']), 7, 'held')).toThrow(/only work in progress/);
    expect(() => planMove(w(['held', 'blocked']), 7, 'in-progress')).toThrow(/state labels held and blocked/);
  });
  it('a second move to the same state changes nothing', () => {
    expect(planMove(w(['held']), 7, 'held')).toMatchObject({ comment: null, add: [], remove: [] });
  });
});

/** This computer's sprint state, in memory: October's window unless a test says otherwise. */
function memory(files: Record<string, unknown> = { [WINDOW_FILE]: OCTOBER_WINDOW }) {
  const store = new Map(Object.entries(files).map(([k, v]) => [k, JSON.stringify(v)]));
  const local: QueueIO['local'] = {
    read: (name) => (store.has(name) ? JSON.parse(store.get(name)!) : null),
    write: (name, value) => void store.set(name, JSON.stringify(value)),
    claim: (name, value) => (store.has(name) ? false : (store.set(name, JSON.stringify(value)), true)),
    remove: (name) => void store.delete(name),
  };
  return { local, file: (name: string) => (store.has(name) ? JSON.parse(store.get(name)!) : undefined) };
}
describe('the command line', () => {
  function io(issues: RawIssue[], over: Partial<QueueIO> = {}) {
    const calls: { args: string[]; input?: string }[] = [];
    const fake: QueueIO = {
      local: memory().local,
      readFile: () => '',
      sprintDoc: () => SPRINT_MD,
      gh: (args, input) => {
        calls.push({ args, input });
        if (args[0] === 'issue' && args[1] === 'list') return JSON.stringify(issues);
        if (args[0] === 'run') return JSON.stringify([{ headSha: 'be34383f0', displayTitle: 'S2', status: 'completed', conclusion: 'success', url: 'https://x/1' }]);
        return '';
      },
      branchAhead: () => 1,
      processInfo: () => null,
      freeMb: () => 9000,
      now: () => new Date('2026-10-21T02:00:00Z'),
      ...over,
    };
    return { fake, writes: () => calls.filter((c) => c.args[1] !== 'list') };
  }
  const ready = [issue(7, '[task] B1: x', ['lane:fixes', 'in-progress']), { ...issue(19, 'Sprint log', []), body: '**Needs you**\n- #8 [held] B2: old' }];

  it('prints one line of JSON per command', () => {
    expect(run(['next', 'fixes'], io(ready).fake)).toEqual({ code: 0, line: expect.stringContaining('"mode":"resume","issue":7') });
    expect(run(['next', 'fixes', '--taken', '7'], io(ready).fake)).toEqual({ code: 0, line: 'null' });
  });
  it('move comments first, then sets the labels', () => {
    const { fake, writes } = io(ready);
    expect(run(['move', '7', 'to-integrate', '--note', 'WHAT CHANGED: a'], fake).code).toBe(0);
    expect(writes().map((c) => c.args)).toEqual([
      ['issue', 'comment', '7', '--body', 'Lane: ready to integrate, branch sprint/7.\nWHAT CHANGED: a'],
      ['issue', 'edit', '7', '--add-label', 'to-integrate', '--remove-label', 'in-progress'],
    ]);
  });
  it('a refused move writes nothing and exits 2 with an error and a do line', () => {
    const { fake, writes } = io(ready);
    const out = run(['move', '7', 'sprint-ready'], fake);
    expect(out.code).toBe(2);
    expect(JSON.parse(out.line)).toEqual({ error: expect.any(String), do: expect.stringContaining('Move it to one of') });
    expect(writes()).toEqual([]);
  });
  it('status writes the block to the sprint log and lists only the new "Needs you" items', () => {
    const { fake, writes } = io([...ready, issue(9, '[task] B3: y', ['lane:fixes', 'blocked'])]);
    const out = JSON.parse(run(['status', '--write', '--also', 'stuck: YODC lane: ux'], fake).line);
    expect(out.new).toEqual(['#9 [blocked] B3: waiting for your answer', 'stuck: YODC lane: ux']);
    expect(writes()).toEqual([{ args: ['issue', 'edit', '19', '--body-file', '-'], input: out.body }]);
    expect(out.body).toContain('- fixes: 0 sprint-ready, 1 in-progress, 0 to-integrate, 0 held, 1 blocked; closed: none');
  });
  it('has-work raises the memory floor for each session this run already started', () => {
    // 9000 MB free: one start leaves 4096 + 1536 = 5632 under it, four need 10240.
    expect(JSON.parse(run(['has-work', 'YODC lane: fixes', '--starting', '1'], io(ready).fake).line).start).toBe(true);
    expect(JSON.parse(run(['has-work', 'YODC lane: fixes', '--starting', '4'], io(ready).fake).line)).toEqual({
      start: false,
      reason: `memory: 9000 MB free, under the 10240 MB floor (${MEMORY_FLOOR_MB} + ${SESSION_MB} for each of 4 starting)`,
    });
  });
  it('a failing gh is an error that says stop', () => {
    const out = run(['next', 'fixes'], io(ready, { gh: () => { throw new Error('HTTP 502'); } }).fake);
    expect(out.code).toBe(1);
    expect(JSON.parse(out.line).do).toMatch(/^Stop and report/);
  });
  it('an unknown command reads nothing and shows the usage', () => {
    const { fake, writes } = io(ready);
    const out = run(['nxt', 'fixes'], fake);
    expect(out.code).toBe(2);
    expect(JSON.parse(out.line).do).toMatch(/^Usage/);
    expect(writes()).toEqual([]);
  });
});

describe('the cue (window, ledger, lock)', () => {
  const NOW = new Date('2026-10-24T22:31:40Z');
  const noGh = (local: QueueIO['local'], now = NOW): QueueIO => ({
    local,
    readFile: () => '',
    sprintDoc: () => SPRINT_MD,
    gh: () => { throw new Error('the cue must not call gh'); },
    branchAhead: () => 0,
    processInfo: () => null,
    freeMb: () => 9000,
    now: () => now,
  });
  const q = (args: string[], io: QueueIO) => {
    const out = run(args, io);
    return { code: out.code, out: JSON.parse(out.line) };
  };

  it('reads phase none before any sprint was started here, with the titles a plan session needs', () => {
    const { local } = memory({});
    expect(q(['window'], noGh(local))).toEqual({
      code: 0,
      out: { phase: 'none', environment: null, supervisor: null, archiver: null, stoppedBy: null, logIssue: 19, titles: expect.arrayContaining(['YODC plan: fixes']) },
    });
  });
  it('window start opens the window from this minute, for the default hours, and clears the last ledger', () => {
    const { local, file } = memory({ [TRIGGERS_FILE]: [{ title: 'YODC integrate', id: 'trig_old', at: '2026-10-21T01:00:00Z' }] });
    const { code, out } = q(['window', 'start', '--environment', 'env_01SNfen'], noGh(local));
    expect(code).toBe(0);
    expect(out).toMatchObject({ phase: 'open', window: { start: '2026-10-24T22:31Z', end: `2026-10-${24 + Math.floor((22 + DEFAULT_HOURS) / 24)}T${String((22 + DEFAULT_HOURS) % 24).padStart(2, '0')}:31Z` }, environment: 'env_01SNfen', dryRun: false });
    expect(out.window.eastern).toBe('Sat 24 Oct 18:31 to Mon 26 Oct 10:31');
    expect(file(WINDOW_FILE)).toEqual({ start: '2026-10-24T22:31:00.000Z', end: '2026-10-26T14:31:00.000Z', environment: 'env_01SNfen', supervisor: null, archiver: null });
    expect(file(TRIGGERS_FILE)).toEqual([]);
  });
  it('a dry run checks the same and writes nothing', () => {
    const { local, file } = memory({});
    expect(q(['window', 'start', '6', '--environment', 'env_01SNfen', '--dry-run'], noGh(local)).out).toMatchObject({ phase: 'open', dryRun: true, window: { end: '2026-10-25T04:31Z' } });
    expect(file(WINDOW_FILE)).toBeUndefined();
  });
  it('refuses a start while a window is open, while the last archiver is on record, or with bad hours or environment', () => {
    const open = { ...OCTOBER_WINDOW, start: '2026-10-24T20:00:00.000Z', end: '2026-10-25T20:00:00.000Z' };
    expect(q(['window', 'start', '--environment', 'env_x'], noGh(memory({ [WINDOW_FILE]: open }).local))).toMatchObject({ code: 2, out: { error: 'a window is already open, until 2026-10-25T20:00Z' } });
    const archiverOn = { ...OCTOBER_WINDOW, archiver: 'trig_arch' };
    expect(q(['window', 'start', '--environment', 'env_x'], noGh(memory({ [WINDOW_FILE]: archiverOn }).local))).toMatchObject({ code: 2, out: { do: expect.stringMatching(/^RemoteTrigger get it/) } });
    for (const args of [['window', 'start', '0', '--environment', 'env_x'], ['window', 'start', '2.5', '--environment', 'env_x'], ['window', 'start', '40']]) {
      expect(q(args, noGh(memory({}).local)).code, args.join(' ')).toBe(2);
    }
  });
  it('records the scheduled tasks\' ids, ends the window now, and clears the archiver once it is off', () => {
    const { local, file } = memory({});
    q(['window', 'start', '40', '--environment', 'env_01SNfen'], noGh(local));
    expect(q(['window', 'ids', '--supervisor', 'trig_sup', '--archiver', 'trig_arch'], noGh(local)).out).toMatchObject({ supervisor: 'trig_sup', archiver: 'trig_arch' });
    expect(q(['window', 'archived'], noGh(local)).code).toBe(2);
    const later = new Date('2026-10-25T03:00:20Z');
    expect(q(['window'], noGh(local)).out.stoppedBy).toBeNull();
    expect(q(['window', 'stop'], noGh(local, later)).out).toMatchObject({ phase: 'after', window: { end: '2026-10-25T03:00Z' }, stoppedBy: 'sprint-stop' });
    expect(q(['window'], noGh(local, new Date('2026-10-25T03:01:00Z'))).out.phase).toBe('after');
    expect(q(['window', 'archived'], noGh(local, new Date('2026-10-25T04:00:00Z'))).out).toMatchObject({ phase: 'after', archiver: null });
    expect(file(WINDOW_FILE)).toMatchObject({ supervisor: 'trig_sup', archiver: null, end: '2026-10-25T03:00:00.000Z', stoppedBy: 'sprint-stop' });
  });
  it('an open window with no environment starts and archives nothing', () => {
    const { local } = memory({ [WINDOW_FILE]: { ...OCTOBER_WINDOW, start: '2026-10-24T20:00:00.000Z', end: '2026-10-25T20:00:00.000Z', environment: null } });
    expect(q(['window'], noGh(local))).toMatchObject({ code: 1, out: { do: expect.stringMatching(/^Start and archive nothing/) } });
  });
  it('the ledger finds each title\'s newest trigger since the window opened, with no RemoteTrigger list', () => {
    const { local } = memory({});
    q(['window', 'start', '--environment', 'env_01SNfen'], noGh(local));
    q(['started', 'YODC lane: fixes', 'trig_a'], noGh(local, new Date('2026-10-24T23:00:00Z')));
    q(['started', 'YODC lane: fixes', 'trig_b'], noGh(local, new Date('2026-10-25T01:00:00Z')));
    q(['started', 'YODC integrate', 'trig_c'], noGh(local, new Date('2026-10-25T01:05:00Z')));
    const { out } = q(['sessions'], noGh(local));
    expect(out).toMatchObject({ 'YODC lane: fixes': 'trig_b', 'YODC integrate': 'trig_c', 'YODC lane: ux': null });
    expect(q(['sessions', '--all'], noGh(local)).out.map((t: { id: string }) => t.id)).toEqual(['trig_c', 'trig_b', 'trig_a']);
    expect(q(['started', 'YODC lane: art', 'trig_d'], noGh(local)).code).toBe(2);
    expect(q(['started', 'YODC lane: ux', 'not-a-trigger'], noGh(local)).code).toBe(2);
  });
  it('after the window only the integrator that drains it is recorded', () => {
    const { local } = memory({});
    q(['window', 'start', '2', '--environment', 'env_01SNfen'], noGh(local));
    const after = new Date('2026-10-25T01:00:00Z');
    expect(q(['started', 'YODC lane: fixes', 'trig_late'], noGh(local, after))).toMatchObject({ code: 2, out: { error: 'no window is open' } });
    expect(q(['started', 'YODC integrate', 'trig_drain'], noGh(local, after)).code).toBe(0);
    expect(q(['sessions'], noGh(local, after)).out).toMatchObject({ 'YODC integrate': 'trig_drain', 'YODC lane: fixes': null });
  });
  it('one supervisor run at a time: a second waits, a lock left by a dead run expires', () => {
    const { local } = memory({});
    expect(q(['lock'], noGh(local)).out).toEqual({ ok: true });
    expect(q(['lock'], noGh(local, new Date(NOW.getTime() + 5 * 60_000)))).toMatchObject({ code: 2, out: { do: expect.stringMatching(/^Stop now/) } });
    expect(q(['lock'], noGh(local, new Date(NOW.getTime() + 25 * 60_000))).out).toEqual({ ok: true, stale: '2026-10-24T22:31Z' });
    expect(q(['unlock'], noGh(local)).out).toEqual({ ok: true });
    expect(q(['lock'], noGh(local)).out).toEqual({ ok: true });
  });
  it('identity passes only when gh is signed in as the bot, whose comments never count as the owner\'s', () => {
    const as = (login: string) => ({ ...noGh(memory({}).local), gh: () => `${login}\n` });
    expect(q(['identity'], as('greenbeanbot'))).toEqual({ code: 0, out: { login: 'greenbeanbot', ok: true } });
    expect(q(['identity'], as('astevegreen'))).toMatchObject({ code: 2, out: { error: 'gh is signed in as astevegreen, not greenbeanbot' } });
  });
  it('resume reads a saved run log and says when a usage-limit stop may restart', () => {
    const local = memory({}).local;
    const log = "API Error: You've hit your session limit · resets 6:20pm (America/New_York) (error type rate_limit, HTTP 429)";
    const io = { ...noGh(local, new Date('2026-10-24T22:10:00Z')), readFile: () => log };
    expect(q(['resume', '--log', 'x.txt', '--last-event', '2026-10-24T20:12:00Z'], io).out).toEqual({
      start: false, after: '2026-10-24T22:20Z', restartAt: '2026-10-24T22:22Z', reason: 'usage limit; resets 2026-10-24T22:20Z',
    });
    expect(q(['resume', '--log', 'x.txt'], io).code).toBe(2);
    expect(q(['resume'], io).code).toBe(2);
  });
});
