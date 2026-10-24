/**
 * The sprint's queue rules (docs/sprint.md), held in one place: which issue a lane works on next, whose
 * comment counts as the owner's, when held work is retried, what an issue waits for, whether a session
 * has work, and the sprint log's status block. The skills ask `scripts/sprint/queue.mjs`, which gathers
 * the world with gh and git and calls `run` here; the rules themselves read only what they are given.
 * Types: queue-rules.d.mts.
 */

/** Sprint sessions comment as the bot; only the owner's own account answers for the owner. */
export const OWNER = 'astevegreen';
export const BOT = 'greenbeanbot';
/** Under this, the supervisor starts nothing; over it, a lane retries work the machine failed. */
export const MEMORY_FLOOR_MB = 4096;
/** The labels that say where a sprint issue stands. `move` keeps one of them on each issue. */
export const STATES = ['sprint-ready', 'in-progress', 'to-integrate', 'held', 'blocked'];
const RESEARCH = 'research';
const HOUR = 3_600_000;
/** A hunt runs every 12 hours over what landed since the last one. */
const HUNT_EVERY = 12 * HOUR;
/** The soak's process starts a moment before its "Research: started" comment is posted. */
const SOAK_COMMENT_GRACE = 2 * 60_000;
/** A soak ends 90 minutes before the window closes, so a session can read it, and runs an hour at least. */
const LAST_SOAK_START = 150 * 60_000;

const STOP = 'Stop and report this output on the sprint log issue. Never work out the queue by hand.';

/** A failure: `error` says what went wrong, `do` what the session does next. */
export class QueueError extends Error {
  constructor(message, todo = STOP, code = 1) {
    super(message);
    this.do = todo;
    this.code = code;
  }
}
/** A move the rules don't allow: the session acts on `do` and carries on. */
const refuse = (message, todo) => new QueueError(message, todo, 2);

// --- docs/sprint.md ---------------------------------------------------------------------------------

const stamp = (s) => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:00Z`);

/** Ranges such as `M3–M6` name each ID between. */
function idRefs(text) {
  const ids = new Set();
  for (const m of text.matchAll(/\b([A-Z]+)(\d+)\s*[–-]\s*(?:\1)?(\d+)\b/g)) {
    for (let n = Number(m[2]); n <= Number(m[3]); n++) ids.add(`${m[1]}${n}`);
  }
  for (const m of text.matchAll(/\b([A-Z]+\d+[a-z]?)\b/g)) ids.add(m[1]);
  return [...ids];
}
const issueRefs = (text) => [...text.matchAll(/#(\d+)/g)].map((m) => Number(m[1]));

/** The text of a "Depends on" or "Waits for" up to its first full stop; "none" and "nothing" name nothing. */
function firstSentence(text) {
  if (/^(none|nothing)\b/i.test(text)) return '';
  const end = text.search(/\.(\s|$)/);
  return end >= 0 ? text.slice(0, end) : text;
}

/** The window, lanes, sprint log issue, pre-sprint tag and backlog that docs/sprint.md declares. */
export function parseSprintDoc(text) {
  const window = /\*\*Window \(UTC\):\*\*\s*`(\d{8}T\d{4})`\s*to\s*`(\d{8}T\d{4})`/.exec(text);
  if (!window) throw new QueueError('docs/sprint.md has no "**Window (UTC):** `<start>` to `<end>`" line');
  const lanes = [...text.matchAll(/^\|\s*`([a-z]+)`\s*\|\s*`lane:\1`\s*\|\s*`([^`]+)`/gm)].map((m) => ({ name: m[1], worktree: m[2] }));
  if (lanes.length === 0) throw new QueueError('docs/sprint.md has no Lanes table rows (| `<lane>` | `lane:<lane>` | `<worktree>` |)');
  const log = /#(\d+) "Sprint log"/.exec(text);
  if (!log) throw new QueueError('docs/sprint.md names no sprint log issue (#<n> "Sprint log")');

  const backlog = {};
  const start = text.search(/^## Backlog\s*$/m);
  if (start < 0) throw new QueueError('docs/sprint.md has no "## Backlog" section');
  const rest = text.slice(start).split(/\r?\n/).slice(1);
  let lane = null;
  let item = null;
  for (const line of rest) {
    if (/^## /.test(line)) break;
    const heading = /^### ([a-z]+)\b/.exec(line);
    if (heading) {
      lane = heading[1];
      backlog[lane] = [];
      item = null;
      continue;
    }
    const entry = /^- \*\*([A-Z]+\d+[a-z]?)\*\*\s*(.*)$/.exec(line);
    if (entry && lane) {
      item = { id: entry[1], text: entry[2] };
      backlog[lane].push(item);
    } else if (item && /^\s+\S/.test(line)) {
      item.text += ` ${line.trim()}`;
    } else {
      item = null;
    }
  }
  for (const items of Object.values(backlog)) {
    for (const it of items) {
      const waits = /Waits for:\s*(.*)$/i.exec(it.text);
      const said = waits ? firstSentence(waits[1].trim()) : '';
      it.waits = [...idRefs(said).map((id) => ({ id })), ...issueRefs(said).map((issue) => ({ issue }))];
      it.soaks = !/Soaks:\s*none\b/i.test(it.text);
    }
  }
  return {
    window: { start: stamp(window[1]), end: stamp(window[2]) },
    lanes,
    logIssue: Number(log[1]),
    preSprintTag: /`(pre-sprint-[\w-]+)`/.exec(text)?.[1] ?? null,
    backlog,
  };
}

// --- issues -------------------------------------------------------------------------------------------

/** The backlog ID in a title `[task] <ID>: …`, or null. */
export function taskId(title) {
  return /^\[task\]\s+([A-Z]+\d+[a-z]?):/.exec(title)?.[1] ?? null;
}

/** gh's JSON for `issue list --json number,title,body,labels,state,comments,closedAt,createdAt`. */
export function normalizeIssues(raw) {
  return raw.map((i) => ({
    number: i.number,
    title: i.title,
    id: taskId(i.title),
    body: i.body ?? '',
    open: String(i.state).toUpperCase() === 'OPEN',
    labels: (i.labels ?? []).map((l) => l.name),
    closedAt: i.closedAt ? new Date(i.closedAt) : null,
    createdAt: i.createdAt ? new Date(i.createdAt) : null,
    comments: (i.comments ?? [])
      .map((c) => ({ author: c.author?.login ?? '', body: c.body ?? '', at: new Date(c.createdAt) }))
      .sort((a, b) => a.at - b.at),
  }));
}

/** `M1` is the issue `[task] M1:` or a split of it, `[task] M1a:`; never `[task] M10:`. */
export function matchesId(issue, id) {
  return issue.id === id || (/[a-z]$/.test(issue.id ?? '') && issue.id.slice(0, -1) === id);
}

/** The issue numbers a body's "Depends on" and "Waits for" lines name, read up to their first full stop. */
export function bodyRefs(body) {
  const lines = body.split(/\r?\n/);
  const refs = new Set();
  lines.forEach((line, k) => {
    const m = /^[\s>*#-]*(?:depends on|waits for)\s*(?:\*\*)?\s*:?\s*(?:\*\*)?\s*(.*)$/i.exec(line);
    if (!m) return;
    const text = m[1].trim() || (lines.slice(k + 1).find((l) => l.trim()) ?? '').trim();
    for (const n of issueRefs(firstSentence(text))) refs.add(n);
  });
  return [...refs];
}

const oneLine = (s, max = 300) => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};
const short = (i) => i.id ?? oneLine(i.title.replace(/^\[task\]\s*/, ''), 40);
const name = (i) => `#${i.number} ${short(i)}`;
const findLast = (xs, f) => [...xs].reverse().find(f) ?? null;

/** The owner's newest comment after the bot's newest one: an answer the lanes may act on. */
export function ownerReply(issue) {
  const lastBot = findLast(issue.comments, (c) => c.author === BOT);
  return findLast(issue.comments, (c) => c.author === OWNER && (!lastBot || c.at > lastBot.at));
}

/**
 * Whether a lane retries a held issue now. Only the owner's and the bot's comments count; the newest
 * one decides: an owner reply, the integrator sending it back, or a machine failure once memory is
 * over the floor. Anything else (the lane's own note, an answer relayed by the bot) waits for the owner.
 */
export function heldRetry(issue, freeMb) {
  const last = findLast(issue.comments, (c) => c.author === OWNER || c.author === BOT);
  if (!last) return { retry: false, why: 'no comment says why it is held' };
  const concerns = oneLine(last.body);
  if (last.author === OWNER) return { retry: true, why: 'the owner replied', concerns };
  if (last.body.startsWith('Integrator:')) return { retry: true, why: 'the integrator sent it back', concerns };
  if (last.body.startsWith('Implementer: machine')) {
    return freeMb > MEMORY_FLOOR_MB
      ? { retry: true, why: `the machine failed it and ${freeMb} MB is free now`, concerns }
      : { retry: false, why: `the machine failed it and ${freeMb} MB free is not over ${MEMORY_FLOOR_MB} MB` };
  }
  return { retry: false, why: `waits for the owner; newest comment: "${oneLine(last.body, 100)}"` };
}

const byNumber = (world, n) => world.issues.find((i) => i.number === n);

/** What a wait names is over: an issue closed, or every issue of a backlog ID closed (and one exists). */
function refOver(world, ref) {
  if ('issue' in ref) return byNumber(world, ref.issue)?.open === false;
  const issues = world.issues.filter((i) => matchesId(i, ref.id));
  return issues.length > 0 && issues.every((i) => !i.open);
}
const refName = (world, ref) => {
  if ('id' in ref) return ref.id;
  const i = byNumber(world, ref.issue);
  return i ? name(i) : `#${ref.issue} (no such issue)`;
};
/** The "Depends on" and "Waits for" of an issue's body that are not over yet. */
function unmet(world, issue) {
  return bodyRefs(issue.body).map((n) => ({ issue: n })).filter((r) => !refOver(world, r));
}

/** Backlog order: the ID's place in its lane's list, then its letter; issues with no listed ID after. */
function backlogOrder(items) {
  const ids = items.map((it) => it.id);
  const key = (i) => {
    const base = ids.includes(i.id) ? i.id : i.id?.replace(/[a-z]$/, '');
    const at = base ? ids.indexOf(base) : -1;
    return at >= 0 ? [0, at, i.id, i.number] : [1, 0, '', i.number];
  };
  return (a, b) => {
    const [x, y] = [key(a), key(b)];
    return x[0] - y[0] || x[1] - y[1] || (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : 0) || x[3] - y[3];
  };
}

// --- next ---------------------------------------------------------------------------------------------

/**
 * A build lane's next job and why each other open issue waits. Jobs, in order: work a stopped session
 * left in progress (resume when its branch has commits, else build it again); held work the rules
 * retry; then ready issues, and blocked ones the owner answered, in backlog order.
 */
export function laneQueue(world, lane, taken = []) {
  const label = `lane:${lane}`;
  const issues = world.issues.filter((i) => i.open && i.labels.includes(label)).sort(backlogOrder(world.doc.backlog[lane] ?? []));
  const jobs = [];
  const waiting = [];
  const job = (rank, mode, i, reason, concerns = null) => jobs.push({ rank, job: { mode, issue: i.number, concerns, reason } });
  for (const i of issues) {
    const has = (l) => i.labels.includes(l);
    // `held` and `blocked` beat a leftover `in-progress`: they are the builder's own verdict.
    if (taken.includes(i.number)) {
      waiting.push(`${name(i)} was taken this session`);
    } else if (has('to-integrate')) {
      waiting.push(`${name(i)} is the integrator's`);
    } else if (has('held')) {
      const r = heldRetry(i, world.freeMb);
      if (r.retry) job(1, 'fix', i, `${name(i)} is held and ${r.why}`, r.concerns);
      else waiting.push(`${name(i)} is held: ${r.why}`);
    } else if (has('in-progress') && !has('blocked')) {
      const ahead = world.branchAhead(i.number);
      if (ahead > 0) job(0, 'resume', i, `${name(i)} was in progress when its session stopped; sprint/${i.number} has ${ahead} commit(s) to review`);
      else job(0, 'build', i, `${name(i)} was in progress when its session stopped, with no commits on sprint/${i.number}`);
    } else if (has('blocked') || has('sprint-ready')) {
      const blocked = has('blocked');
      const waits = unmet(world, i);
      if (blocked && !ownerReply(i)) waiting.push(`${name(i)} is blocked: no owner reply yet`);
      else if (waits.length > 0) waiting.push(`${name(i)} waits for ${waits.map((r) => refName(world, r)).join(', ')}`);
      else job(2, 'build', i, blocked ? `${name(i)}: the owner answered its question` : `${name(i)} is ready`);
    }
  }
  jobs.sort((a, b) => a.rank - b.rank);
  return { job: jobs[0]?.job ?? null, waiting };
}

/** The folder a "Research: read <folder> …" comment names: its first word. */
const readFolder = (body) => /^Research: read ([^\s.,:;()]+)/.exec(body)?.[1] ?? null;
const isHunt = (i) => /^H\d+$/.test(i.id ?? '');
const huntSince = (i) =>
  findLast(i.comments, (c) => c.author === BOT && c.body.startsWith('Research: hunt candidates'))?.body.match(/sha (\w+)/)?.[1] ??
  /since (\S+)/.exec(i.title)?.[1] ??
  null;

/**
 * The research lane's next job: read a soak that ended (`read`), start the first item's next soak whose
 * waits are over while none runs (`soak`), or the bug hunt when one is open or due (`hunt`).
 */
export function researchQueue(world) {
  const waiting = [];
  const started = [];
  for (const i of world.issues.filter((x) => x.labels.includes(`lane:${RESEARCH}`))) {
    i.comments.forEach((c, k) => {
      const m = /^Research: started (\S+) (\S+) pid (\d+)/.exec(c.body);
      if (c.author !== BOT || !m) return;
      const read = i.comments.slice(k + 1).some((r) => r.author === BOT && readFolder(r.body) === m[2]);
      if (!read) started.push({ issue: i.number, item: m[1], folder: m[2], pid: Number(m[3]), at: c.at });
    });
  }
  const soak = started.sort((a, b) => a.at - b.at).at(-1);
  let running = false;
  if (soak) {
    // A pid reused after the soak ended belongs to a process that started after the comment.
    const p = world.processInfo(soak.pid);
    running = Boolean(p && /^cmd(\.exe)?$/i.test(p.name) && p.start.getTime() <= soak.at.getTime() + SOAK_COMMENT_GRACE);
    const what = `${soak.item}'s soak ${soak.folder} (pid ${soak.pid}, #${soak.issue})`;
    if (!running) {
      return { job: { mode: 'read', issue: soak.issue, item: soak.item, folder: soak.folder, reason: `${what} has ended and is not read yet` }, waiting };
    }
    waiting.push(`${what} is still running`);
  }
  const lastStart = new Date(world.doc.window.end.getTime() - LAST_SOAK_START);
  if (!running && world.now > lastStart) waiting.push(`no soak starts after ${fmt(lastStart)}: under an hour would fit before the window closes`);
  else if (!running) {
    for (const item of world.doc.backlog[RESEARCH] ?? []) {
      if (!item.soaks) continue;
      const issue = findLast(world.issues, (i) => matchesId(i, item.id));
      if (issue && !issue.open) continue;
      const waits = [...item.waits, ...(issue ? bodyRefs(issue.body).map((n) => ({ issue: n })) : [])].filter((r) => !refOver(world, r));
      if (waits.length > 0) {
        waiting.push(`${item.id} waits for ${waits.map((r) => refName(world, r)).join(', ')}`);
        continue;
      }
      const reason = issue ? `${item.id} (#${issue.number}): its waits are over` : `${item.id}: its waits are over and it has no issue yet`;
      return { job: { mode: 'soak', issue: issue?.number ?? null, item: item.id, reason }, waiting };
    }
  }
  const hunts = world.issues.filter(isHunt);
  const open = hunts.find((h) => h.open);
  if (open) return { job: { mode: 'hunt', issue: open.number, item: open.id, since: huntSince(open), reason: `hunt ${open.id} (#${open.number}) is open` }, waiting };
  const last = hunts.filter((h) => h.closedAt).sort((a, b) => a.closedAt - b.closedAt).at(-1);
  const due = last ? new Date(last.closedAt.getTime() + HUNT_EVERY) : null;
  if (!due || world.now >= due) {
    const next = `H${Math.max(0, ...hunts.map((h) => Number(h.id.slice(1)))) + 1}`;
    const since = last ? huntSince(last) : world.doc.preSprintTag;
    const reason = last ? `the last hunt, ${last.id}, closed 12 or more hours ago` : 'no hunt has run yet';
    return { job: { mode: 'hunt', issue: null, item: next, since, reason }, waiting };
  }
  waiting.push(`the next hunt is due at ${fmt(due)}`);
  return { job: null, waiting };
}

/** `next <lane>`: the job, or null. */
export function nextJob(world, lane, taken = []) {
  laneOf(world, lane);
  return (lane === RESEARCH ? researchQueue(world) : laneQueue(world, lane, taken)).job;
}

function laneOf(world, lane) {
  if (!world.doc.lanes.some((l) => l.name === lane)) {
    throw refuse(`unknown lane "${lane}"`, `Use a lane from the Lanes table in docs/sprint.md: ${world.doc.lanes.map((l) => l.name).join(', ')}.`);
  }
}

// --- has-work -----------------------------------------------------------------------------------------

/** The session titles the supervisor keeps running. */
export function sessionTitles(doc) {
  const build = doc.lanes.map((l) => l.name).filter((l) => l !== RESEARCH);
  return [...doc.lanes.map((l) => `YODC lane: ${l.name}`), ...build.map((l) => `YODC plan: ${l}`), 'YODC integrate'];
}

/** Whether a fresh session with this title would find work. Extra fields: `todo` and `ready` for a plan, `issues` to integrate. */
export function hasWork(world, title) {
  if (!sessionTitles(world.doc).includes(title)) {
    throw refuse(`unknown session title "${title}"`, `Use one of: ${sessionTitles(world.doc).map((t) => `"${t}"`).join(', ')}.`);
  }
  const floor = world.freeMb < MEMORY_FLOOR_MB ? `memory: ${world.freeMb} MB free, under the ${MEMORY_FLOOR_MB} MB floor` : null;
  let answer;
  if (title === 'YODC integrate') {
    const issues = world.issues.filter((i) => i.open && i.labels.includes('to-integrate')).map((i) => i.number).sort((a, b) => a - b);
    answer = { start: issues.length > 0, reason: issues.length ? `to integrate: ${issues.map((n) => `#${n}`).join(', ')}` : 'no open issue is labelled to-integrate', issues };
  } else if (title.startsWith('YODC plan: ')) {
    const lane = title.slice('YODC plan: '.length);
    const ready = world.issues.filter((i) => i.open && i.labels.includes(`lane:${lane}`) && i.labels.includes('sprint-ready')).length;
    const todo = (world.doc.backlog[lane] ?? []).map((it) => it.id).filter((id) => !world.issues.some((i) => matchesId(i, id)));
    const start = ready < 3 && todo.length > 0;
    const reason = todo.length === 0 ? 'every backlog item has an issue' : `${ready} open sprint-ready${ready < 3 ? ', under 3' : ', 3 or more'}; not yet filed: ${todo.join(', ')}`;
    answer = { start, reason, ready, todo };
  } else {
    const lane = title.slice('YODC lane: '.length);
    const q = lane === RESEARCH ? researchQueue(world) : laneQueue(world, lane);
    answer = { start: q.job !== null, reason: q.job ? q.job.reason : q.waiting.length ? `nothing to do: ${q.waiting.join('; ')}` : 'nothing to do: no open issue' };
  }
  return floor ? { ...answer, start: false, reason: floor } : answer;
}

// --- move ---------------------------------------------------------------------------------------------

const RETRY = 'Leave it, and run `next` for the next job.';

/** The labels and the standard comment a move makes, or a refusal saying what to do instead. */
export function planMove(world, number, to, note = null) {
  const issue = byNumber(world, number);
  if (!issue) throw refuse(`no issue #${number}`, 'Use the issue number `next` printed.');
  if (!issue.open) throw refuse(`#${number} is closed`, RETRY);
  const targets = ['in-progress', 'to-integrate', 'held', 'blocked'];
  if (!targets.includes(to)) throw refuse(`a lane cannot move an issue to "${to}"`, `Move it to one of: ${targets.join(', ')}.`);
  const has = STATES.filter((s) => issue.labels.includes(s));
  // A lane's claim (`in-progress`) is what it moves on, even beside a label the builder added.
  const from = has.includes('in-progress') ? 'in-progress' : has.length === 1 ? has[0] : has.length === 0 ? 'none' : has.join('+');
  const text = note ? note.replace(/\\n/g, '\n').trim() : null;
  const plan = (comment) => ({ issue: number, from, to, comment, add: has.includes(to) ? [] : [to], remove: has.filter((s) => s !== to) });

  if (from === 'to-integrate') throw refuse(`#${number} is to-integrate: the integrator's, not the lane's`, RETRY);
  if (from === 'none' || from.includes('+')) {
    throw refuse(`#${number} has ${from === 'none' ? 'no state label' : `the state labels ${has.join(' and ')}`}`, 'Report it on the sprint log issue for the owner, then run `next`.');
  }
  if (to === 'in-progress') {
    if (from === 'in-progress') return plan('Lane: re-queued, the previous lane session stopped.');
    if (from === 'held') {
      const r = heldRetry(issue, world.freeMb);
      if (!r.retry) throw refuse(`#${number} is held and ${r.why}`, RETRY);
      return plan(null);
    }
    if (from === 'blocked' && !ownerReply(issue)) throw refuse(`#${number} is blocked and the owner has not replied`, RETRY);
    const waits = unmet(world, issue);
    if (waits.length > 0) throw refuse(`#${number} waits for ${waits.map((r) => refName(world, r)).join(', ')}`, RETRY);
    return plan(from === 'blocked' ? "Lane: unblocked by the owner's answer; the implementer reads it as part of the spec." : null);
  }
  if (from === to) return { issue: number, from, to, comment: null, add: [], remove: [] };
  if (from !== 'in-progress') throw refuse(`#${number} is ${from}; only work in progress moves to ${to}`, RETRY);
  if (to === 'to-integrate') {
    if (!text) throw refuse('ready to integrate needs a note', "Run it again with --note '<WHAT CHANGED and PLAYER-VISIBLE lines from the hand-back>'.");
    const ahead = world.branchAhead(number);
    if (ahead === 0) {
      throw refuse(`sprint/${number} has no commits ahead of origin/main`, `Nothing to integrate: move it to held with a --note saying why.`);
    }
    return plan(`Lane: ready to integrate, branch sprint/${number}.\n${text}`);
  }
  return plan(text ? `Lane: ${to}. ${text}` : null);
}

// --- status -------------------------------------------------------------------------------------------

function fmt(d) {
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}Z`;
}
const needKey = (line) => /^#(\d+) \[(\w+)\]/.exec(line)?.[0] ?? line;

/**
 * The sprint log's body: per lane, the open issues by state label and those closed since the window
 * opened; the last push to main and its deploy; free memory; and "Needs you" (a blocked question with
 * no owner reply, held work the lanes won't retry, then `also`: stuck sessions, failed starts). `new`
 * lists the "Needs you" items the old body didn't have.
 */
export function statusBlock(world, { also = [], oldBody = '' } = {}) {
  const lines = [`Status at ${fmt(world.now)}. The supervisor rewrites this every hour; the comments hold the history.`, ''];
  lines.push('**Lanes** (open issues by label; closed since the window opened)');
  for (const { name: lane } of world.doc.lanes) {
    const mine = world.issues.filter((i) => i.labels.includes(`lane:${lane}`));
    const counts = STATES.map((s) => `${mine.filter((i) => i.open && i.labels.includes(s)).length} ${s}`).join(', ');
    const closed = mine
      .filter((i) => !i.open && i.closedAt && i.closedAt >= world.doc.window.start)
      .sort((a, b) => a.closedAt - b.closedAt)
      .map(name);
    lines.push(`- ${lane}: ${counts}; closed: ${closed.length ? closed.join(', ') : 'none'}`);
  }
  const d = world.lastDeploy;
  lines.push(
    '',
    d ? `**Main:** last push ${d.headSha.slice(0, 8)} "${oneLine(d.displayTitle, 80)}"; deploy ${d.conclusion || d.status} ${d.url}` : '**Main:** no deploy run found',
    `**Free memory:** ${world.freeMb} MB`,
  );
  const needs = [];
  for (const i of world.issues.filter((x) => x.open && x.labels.some((l) => l.startsWith('lane:'))).sort((a, b) => a.number - b.number)) {
    if (i.labels.includes('blocked') && !ownerReply(i)) needs.push(`#${i.number} [blocked] ${short(i)}: waiting for your answer`);
    if (i.labels.includes('held')) {
      const r = heldRetry(i, world.freeMb);
      if (!r.retry) needs.push(`#${i.number} [held] ${short(i)}: ${r.why}`);
    }
  }
  needs.push(...also.map((a) => oneLine(a)));
  lines.push('', '**Needs you**', ...(needs.length ? needs.map((n) => `- ${n}`) : ['- nothing']));

  const old = oldBody.split(/\r?\n/);
  const at = old.findIndex((l) => l.trim() === '**Needs you**');
  const before = new Set(at < 0 ? [] : old.slice(at + 1).filter((l) => l.startsWith('- ')).map((l) => needKey(l.slice(2))));
  return { body: lines.join('\n'), needsYou: needs, new: needs.filter((n) => !before.has(needKey(n))) };
}

// --- the command line ----------------------------------------------------------------------------------

const USAGE = 'Usage: queue.mjs has-work "<session title>" | next <lane> [--taken <n,n>] | move <n> <state> [--note \'<text>\'] | status [--write] [--also \'<line>\']...';
const ISSUE_FIELDS = 'number,title,body,labels,state,comments,closedAt,createdAt';

/** Flags after the positional words: `--name value`, repeatable. */
function flags(args) {
  const words = [];
  const out = {};
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === '--write') out.write = true;
    else if (a.startsWith('--')) {
      if (k + 1 >= args.length) throw refuse(`${a} needs a value`, USAGE);
      (out[a.slice(2)] ??= []).push(args[++k]);
    } else words.push(a);
  }
  return { words, flags: out };
}

/**
 * Runs one command against `io` (gh, git, the sprint doc, free memory, processes, the clock) and returns
 * the one line of JSON to print, with the exit code: 0 done, 2 refused (act on `do`), 1 failed (stop).
 */
export function run(argv, io) {
  try {
    const [command, ...rest] = argv;
    const { words, flags: f } = flags(rest);
    const shapes = { 'has-work': words.length === 1, next: words.length === 1, move: words.length === 2 && /^\d+$/.test(words[0] ?? ''), status: words.length === 0 };
    if (!shapes[command]) throw refuse(`unknown command: ${argv.join(' ') || '(none)'}`, USAGE);
    const doc = parseSprintDoc(io.sprintDoc());
    const world = {
      doc,
      issues: normalizeIssues(JSON.parse(io.gh(['issue', 'list', '--state', 'all', '--limit', '1000', '--json', ISSUE_FIELDS]))),
      now: io.now(),
      freeMb: io.freeMb(),
      branchAhead: io.branchAhead,
      processInfo: io.processInfo,
      lastDeploy: null,
    };
    let out;
    if (command === 'has-work') {
      out = hasWork(world, words[0]);
    } else if (command === 'next') {
      const taken = (f.taken ?? []).flatMap((t) => t.split(',')).filter(Boolean).map(Number);
      if (taken.some((n) => !Number.isInteger(n))) throw refuse('--taken takes issue numbers, comma-separated', USAGE);
      out = nextJob(world, words[0], taken);
    } else if (command === 'move') {
      const m = planMove(world, Number(words[0]), words[1], f.note?.at(-1) ?? null);
      if (m.comment) io.gh(['issue', 'comment', String(m.issue), '--body', m.comment]);
      if (m.add.length || m.remove.length) {
        io.gh(['issue', 'edit', String(m.issue), ...m.add.flatMap((l) => ['--add-label', l]), ...(m.remove.length ? ['--remove-label', m.remove.join(',')] : [])]);
      }
      out = { ok: true, issue: m.issue, from: m.from, to: m.to, changed: Boolean(m.comment || m.add.length || m.remove.length), comment: m.comment };
    } else {
      const runs = JSON.parse(io.gh(['run', 'list', '--workflow', 'deploy.yml', '--branch', 'main', '--limit', '1', '--json', 'headSha,displayTitle,status,conclusion,url']));
      world.lastDeploy = runs[0] ?? null;
      const oldBody = byNumber(world, doc.logIssue)?.body ?? '';
      const s = statusBlock(world, { also: f.also ?? [], oldBody });
      if (f.write) io.gh(['issue', 'edit', String(doc.logIssue), '--body-file', '-'], s.body);
      out = { ...s, written: Boolean(f.write) };
    }
    return { code: 0, line: JSON.stringify(out) };
  } catch (e) {
    if (e instanceof QueueError) return { code: e.code, line: JSON.stringify({ error: e.message, do: e.do }) };
    return { code: 1, line: JSON.stringify({ error: String(e?.stack ?? e), do: STOP }) };
  }
}
