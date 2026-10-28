/**
 * The sprint's queue rules (docs/sprint.md), held in one place: which issue a lane works on next, whose
 * comment counts as the owner's, when held work is retried, what an issue waits for, whether a session
 * has work, and the sprint log's status block. The skills ask `scripts/sprint/queue.mjs`, which gathers
 * the world with gh and git and calls `run` here; the rules themselves read only what they are given.
 * The cue's state (the window, the trigger ledger, the supervisor's lock) is this computer's, read and
 * written through `io.local`. Types: queue-rules.d.mts.
 */
import { namedReset, resumeAfter } from './usage-limit.mjs';

/** Sprint sessions comment as the bot; only the owner's own account answers for the owner. */
export const OWNER = 'astevegreen';
export const BOT = 'greenbeanbot';
/**
 * scripts/gemini-audit.mjs starts every comment with this. An audit is a note for the plan session and the
 * implementer, posted as the bot: never an answer, a send-back or a sprint step, so the rules skip it.
 */
export const AUDIT = '<!-- gemini-audit -->';
/**
 * The supervisor's daily digest on the Decisions issue starts with this (`decisionsDigest`). Its lines name every
 * open question's issue, and gh may be signed in as the owner when it posts, so a digest is never an answer.
 */
const DIGEST = 'Decisions digest';
const isDigest = (c) => (c.author === BOT || c.author === OWNER) && c.body.trimStart().startsWith(DIGEST);
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

/**
 * The lanes, sprint log issue, pre-sprint tag and backlog that docs/sprint.md declares. The window is not
 * in it: /sprint-start opens one on this computer (`windowFacts`), and `run` sets `window` from there.
 */
export function parseSprintDoc(text) {
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
  // The standing Decisions issue: design questions and the owner's answers to them (docs/sprint.md, Planning day).
  const decisions = /#(\d+) "Sprint questions"/.exec(text);
  return {
    window: null,
    lanes,
    logIssue: Number(log[1]),
    decisionsIssue: decisions ? Number(decisions[1]) : null,
    preSprintTag: /`(pre-sprint-[\w-]+)`/.exec(text)?.[1] ?? null,
    backlog,
  };
}

// --- the cue: what this computer keeps ----------------------------------------------------------------
//
// /sprint-start opens the window when it runs, so starting a sprint needs no push. It, the supervisor and
// /sprint-stop keep the sprint's state in the git folder every worktree shares (`git rev-parse
// --git-common-dir`), never committed; every session of the sprint runs on this computer and reads it there:
//   sprint-window.json     {start, end, environment, supervisor, archiver, wake, stoppedBy}: the window, the
//                          ids it acts on, and "sprint-stop" when /sprint-stop ended it
//   sprint-triggers.json   [{title, id, at}]: every trigger the supervisor created, so it finds a session by
//                          id: RemoteTrigger's list shows only the account's newest 20, and three sprints share it
//   sprint-supervisor.lock {at}: one supervisor run at a time, whether the hour or a stopping session fired it
//   sprint-wake.json       {at, resetsAt}: the one waiter that fires the supervisor after a usage limit

export const WINDOW_FILE = 'sprint-window.json';
export const TRIGGERS_FILE = 'sprint-triggers.json';
export const LOCK_FILE = 'sprint-supervisor.lock';
export const WAKE_FILE = 'sprint-wake.json';
/** /sprint-start's window when it names no hours, and the longest it opens. */
export const DEFAULT_HOURS = 40;
const MAX_HOURS = 96;
/** A supervisor run takes minutes: a lock older than this was left by a run that died. */
const LOCK_STALE = 20 * 60_000;
/** A session started this run takes about this much memory before free memory shows it. */
export const SESSION_MB = 1536;
const TRIGGER_ID = /^trig_\w+$/;
const ENV_ID = /^env_\w+$/;

const iso = (d) => d.toISOString().replace(/:\d{2}\.\d{3}Z$/, 'Z');
const minute = (d) => new Date(Math.floor(d.getTime() / 60_000) * 60_000);

/** "Sat 24 Oct 17:00", the owner's clock. */
function eastern(d) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York', hourCycle: 'h23', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('weekday')} ${get('day')} ${get('month')} ${get('hour')}:${get('minute')}`;
}

/** The window file's dates, or null when no sprint was ever started here. */
function readWindow(local) {
  const w = local.read(WINDOW_FILE);
  if (!w) return null;
  const start = new Date(w.start);
  const end = new Date(w.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new QueueError(`${WINDOW_FILE} holds no window (start "${w.start}", end "${w.end}")`, 'Start nothing. Report it; /sprint-start writes a new one.');
  }
  return { ...w, start, end };
}

const phaseOf = (w, now) => (!w ? 'none' : now < w.start ? 'before' : now > w.end ? 'after' : 'open');

/**
 * What every sprint session reads first: where the clock stands (`none`: no sprint started here yet, the
 * planning day; then `before`, `open`, `after`), the window, the environment sessions start in, the
 * supervisor's and archiver's trigger ids, the sprint log and the session titles. An open window with no
 * environment is refused: nothing starts on a guess (October's id had gone by 24 Oct).
 */
function windowFacts(doc, w, now) {
  const phase = phaseOf(w, now);
  if ((phase === 'open' || phase === 'before') && !w.environment) {
    throw new QueueError(`${WINDOW_FILE} names no environment`, 'Start and archive nothing. Report it on the sprint log: /sprint-stop, then /sprint-start, writes one.');
  }
  return {
    phase,
    ...(w && { window: { start: iso(w.start), end: iso(w.end), eastern: `${eastern(w.start)} to ${eastern(w.end)}` } }),
    environment: w?.environment ?? null,
    supervisor: w?.supervisor ?? null,
    archiver: w?.archiver ?? null,
    wake: w?.wake ?? null,
    // "sprint-stop": the owner ended the window early, a pause and not a fault.
    stoppedBy: w?.stoppedBy ?? null,
    logIssue: doc.logIssue,
    titles: sessionTitles(doc),
  };
}

/**
 * `window start|ids|stop|archived`: open the window from now for `hours`, record the scheduled tasks'
 * ids, close it now, and clear the archiver once it has switched itself off. A new window waits while the
 * last one's archiver is on record, since that sprint's sessions may still run. Returns what to print and
 * the files to write (none in a dry run).
 */
function windowCommand(doc, w, now, sub, { hours, environment, supervisor, archiver, wake, dryRun = false } = {}) {
  const phase = phaseOf(w, now);
  const facts = (next) => windowFacts(doc, next, now);
  if (sub === 'start') {
    const h = hours === undefined ? DEFAULT_HOURS : Number(hours);
    if (!Number.isInteger(h) || h < 1 || h > MAX_HOURS) throw refuse(`the window is a whole number of hours from 1 to ${MAX_HOURS}, not "${hours}"`, 'Refuse the start with this error.');
    if (!ENV_ID.test(environment ?? '')) throw refuse(`--environment "${environment ?? ''}" is not an environment id`, 'Pass the env_ id list_environments gives for this computer and folder.');
    if (phase === 'open' || phase === 'before') throw refuse(`a window is already open, until ${iso(w.end)}`, 'Refuse the start with this error; /sprint-stop ends the window.');
    if (w?.archiver) {
      throw refuse(
        `the last window's archiver ${w.archiver} is still on record, so its sessions may still be running`,
        'RemoteTrigger get it. Disabled: run `window archived`, then start again. Enabled: refuse with this error; it switches itself off once none of its sessions runs.',
      );
    }
    const start = minute(now);
    const next = { start: start.toISOString(), end: new Date(start.getTime() + h * 3_600_000).toISOString(), environment, supervisor: null, archiver: null, wake: null };
    const parsed = { ...next, start, end: new Date(next.end) };
    return { out: { ...facts(parsed), dryRun }, writes: dryRun ? [] : [[WINDOW_FILE, next], [TRIGGERS_FILE, []]] };
  }
  if (sub === 'ids') {
    if (phase !== 'open') throw refuse('no window is open', 'Run `window start` first.');
    const next = { ...w };
    for (const [name, id] of [['supervisor', supervisor], ['archiver', archiver], ['wake', wake]]) {
      if (id === undefined) continue;
      if (!TRIGGER_ID.test(id)) throw refuse(`--${name} "${id}" is not a trigger id`, 'Pass the trig_ id the create returned.');
      next[name] = id;
    }
    return { out: facts(next), writes: [[WINDOW_FILE, { ...next, start: w.start.toISOString(), end: w.end.toISOString() }]] };
  }
  if (sub === 'stop') {
    if (phase !== 'open') throw refuse('no window is open', 'Nothing to stop; report it.');
    const next = { ...w, end: minute(now), stoppedBy: 'sprint-stop' };
    return { out: facts(next), writes: [[WINDOW_FILE, { ...next, start: w.start.toISOString(), end: next.end.toISOString() }]] };
  }
  if (sub === 'archived') {
    if (phase === 'open') throw refuse('the window is still open', 'Leave the archiver on until it ends.');
    if (!w?.archiver) return { out: facts(w), writes: [] };
    const next = { ...w, archiver: null };
    return { out: facts(next), writes: [[WINDOW_FILE, { ...next, start: w.start.toISOString(), end: w.end.toISOString() }]] };
  }
  throw refuse(`unknown window command "${sub}"`, 'Use `window`, `window start [hours] --environment <env>`, `window ids`, `window stop` or `window archived`.');
}

/** The supervisor's cron minute (/sprint-start), the wake's delay after a reset, and the quiet before a run. */
const SUPERVISOR_MINUTE = 22;
const WAKE_DELAY = 2 * 60_000;
const WAKE_QUIET = 15 * 60_000;

/**
 * The epoch seconds a usage-limit stop resets at, from the stopped session's transcript: Claude Code records
 * the rejected request's `quotaLimits` (or `apiErrorParams.rate_limit_info`) on its error entry, and on no
 * other. The last such entry; null when there is none.
 */
export function resetFromTranscript(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  for (let k = lines.length - 1; k >= 0; k--) {
    if (!lines[k].includes('"resetsAt"')) continue;
    let entry;
    try {
      entry = JSON.parse(lines[k]);
    } catch {
      continue;
    }
    const info = entry?.quotaLimits ?? entry?.apiErrorParams?.rate_limit_info;
    if (entry?.apiError && info?.status === 'rejected' && Number.isInteger(info.resetsAt)) return info.resetsAt;
  }
  return null;
}

/**
 * `wake`: a usage limit stops every session, and no supervisor run can start until it resets. Claude Code's
 * StopFailure hook (.claude/hooks/usage-limit-wake.mjs) passes the stopped session's transcript and error;
 * this reads the reset and arms one waiter (scripts/sprint/wake-waiter.mjs) to fire the supervisor 2 minutes
 * past it. Not when the supervisor's own :22 run follows within 15 minutes: two supervisors at once can start
 * a lane twice. Several sessions stop on one limit, so a reset already armed arms nothing. Prints
 * {arm, at, supervisor, reason}, with the waiter's claim to write.
 */
function wakeCommand(w, now, resetsAt, armed) {
  const no = (reason) => ({ out: { arm: false, at: null, supervisor: w?.supervisor ?? null, reason }, writes: [] });
  if (phaseOf(w, now) !== 'open') return no('no window is open');
  if (!w.supervisor) return no('no supervisor on record');
  if (resetsAt === null) return no('the stop names no reset time; the hourly supervisor covers it');
  const at = new Date(Math.ceil((resetsAt * 1000 + WAKE_DELAY) / 60_000) * 60_000);
  if (at <= now) return no(`the reset at ${iso(new Date(resetsAt * 1000))} has passed`);
  if (at > w.end) return no(`${iso(at)} is after the window ends`);
  const run = new Date(at);
  run.setUTCMinutes(SUPERVISOR_MINUTE, 0, 0);
  if (run < at) run.setUTCHours(run.getUTCHours() + 1);
  if (run - at <= WAKE_QUIET) return no(`the supervisor's ${iso(run)} run follows ${iso(at)} within 15 minutes`);
  if (armed?.at === at.toISOString()) return no(`a waiter already fires the supervisor at ${iso(at)}`);
  return {
    out: { arm: true, at: at.toISOString(), supervisor: w.supervisor, reason: `the usage limit resets at ${iso(new Date(resetsAt * 1000))}` },
    writes: [[WAKE_FILE, { at: at.toISOString(), resetsAt }]],
  };
}

/**
 * `wake --due <at>`: the waiter asks at its time whether to fire. Only the waiter armed for that time fires,
 * once, and only while the window is open; it then checks the supervisor is still switched on.
 */
function wakeDue(w, now, at, armed) {
  const no = (reason) => ({ fire: false, supervisor: w?.supervisor ?? null, reason });
  if (armed?.at !== at) return no(armed ? `the waiter for ${armed.at} replaced this one` : 'no waiter is armed; another fired');
  if (phaseOf(w, now) !== 'open') return no('no window is open');
  if (!w.supervisor) return no('no supervisor on record');
  return { fire: true, supervisor: w.supervisor, reason: `armed for ${at}` };
}

/**
 * The trigger the supervisor created last for each session title since the window opened (null: none yet);
 * with `all`, every one since the window opened, newest first, for the archiver.
 */
function sessions(doc, w, ledger, { all = false } = {}) {
  const since = w?.start.getTime() ?? Infinity;
  const recent = ledger.filter((t) => new Date(t.at).getTime() >= since).sort((a, b) => new Date(b.at) - new Date(a.at));
  if (all) return recent;
  return Object.fromEntries(sessionTitles(doc).map((title) => [title, recent.find((t) => t.title === title)?.id ?? null]));
}

/**
 * `started "<title>" <trig_id>`: the ledger entry the supervisor adds after each create. After the window
 * it still starts the integrator, so what the lanes finish lands; that start is recorded too.
 */
function recordStart(doc, w, ledger, now, title, id) {
  if (!sessionTitles(doc).includes(title)) throw refuse(`"${title}" is not a sprint session title`, `Use one of: ${sessionTitles(doc).map((t) => `"${t}"`).join(', ')}.`);
  if (!TRIGGER_ID.test(id ?? '')) throw refuse(`"${id ?? ''}" is not a trigger id`, 'Pass the trig_ id the create returned.');
  const phase = phaseOf(w, now);
  if (phase !== 'open' && !(phase === 'after' && title === 'YODC integrate')) throw refuse('no window is open', 'Start no sessions; report it.');
  const entry = { title, id, at: now.toISOString() };
  return { out: { recorded: entry }, writes: [[TRIGGERS_FILE, [...ledger, entry]]] };
}

/**
 * `lock`: a supervisor run takes it first and `unlock` gives it back, so an hourly run and one a stopping
 * session fired never start two sessions for one title. A lock past `LOCK_STALE` was left by a run that died.
 */
function lockCommand(held, now) {
  if (!held) return { ok: true };
  const at = new Date(held.at);
  if (now.getTime() - at.getTime() < LOCK_STALE) {
    throw refuse(`another supervisor run holds the lock, since ${Number.isNaN(at.getTime()) ? held.at : iso(at)}`, 'Stop now and start, update and comment nothing: that run covers this one.');
  }
  return { ok: true, stale: iso(at) };
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
      .filter((c) => !c.body.startsWith(AUDIT))
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

/** A line that answers an issue on the Decisions issue: `#<n>` first on it, after spaces at most. */
const answers = (n) => new RegExp(String.raw`^[ \t]*#${n}(?!\w)`);
const ANSWER = answers(String.raw`\d+`);

/**
 * The owner's answer to `#n` in one Decisions comment: the line that starts with `#n` and the lines under it, up
 * to the next line that starts with an issue number; null when no line starts with `#n`, or nothing follows it.
 * A mention anywhere else answers nothing: "#6 no, the defender wins. I need to think more about #5." is #6's.
 */
function answerIn(body, n) {
  const lines = body.split(/\r?\n/);
  const at = lines.findIndex((l) => answers(n).test(l));
  if (at < 0) return null;
  const end = lines.findIndex((l, k) => k > at && ANSWER.test(l));
  const text = lines.slice(at, end < 0 ? undefined : end).join('\n').trim();
  return /[^\s\p{P}]/u.test(text.replace(answers(n), '')) ? text : null;
}

/**
 * The owner's answer to a blocked issue's question: their reply on the issue itself, or a line of their comment
 * on the Decisions issue that starts with `#<n>`, posted after the bot's newest comment on the issue. Only the
 * owner's own account answers; an answer the bot relays, an architect decision, or the digest never does.
 */
export function answerTo(world, issue) {
  const own = ownerReply(issue);
  if (own) return { ...own, on: issue.number };
  const decisions = world.doc.decisionsIssue ? byNumber(world, world.doc.decisionsIssue) : null;
  if (!decisions || decisions.number === issue.number) return null;
  const lastBot = findLast(issue.comments, (c) => c.author === BOT);
  const found = findLast(
    decisions.comments,
    (c) => c.author === OWNER && !isDigest(c) && (!lastBot || c.at > lastBot.at) && answerIn(c.body, issue.number) !== null,
  );
  // Only the answer to this issue is quoted to its implementer, not the owner's lines about other issues.
  return found ? { ...found, body: answerIn(found.body, issue.number), on: decisions.number } : null;
}

/** The comment a lane writes when it takes held work back (`planMove`): where the next held episode starts. */
const RETRYING = 'Lane: retrying held work';
/** Machine retries of one held issue before a time-out that keeps coming back counts as the code's. */
export const MACHINE_RETRIES = 3;
/**
 * A machine failure in a sprint session's comment, whatever the comment starts with: a time-out, memory
 * running out, or a loaded host (#84's began "Implementer: work committed", and waited 59 hours for the
 * owner). Only the sessions' own words count, never a reviewer concern quoted in a note.
 */
const MACHINE =
  /^Implementer: machine|\btimed out\b|\btime-?outs?\b|\bETIMEDOUT\b|out of memory|\bOOM\b|\bENOMEM\b|heap limit|host load|under load|looks like load|machine load|(quiet|quieter|busy) (host|machine|computer)/i;
const SESSION = /^(Implementer|Integrator|Lane):/;
const BLOCKER = /\[blocker\]/i;
const MINOR = /\[minor\]|\bminor\b/i;

/** What one sprint comment on held work says: a blocker, a machine failure, a send-back, minor concerns only, or nothing the rules read. */
function heldKind(c) {
  // An architect's decision is part of the build, never a verdict on it, whatever it is about (time-outs too).
  if (c.author !== BOT || !SESSION.test(c.body) || /Decision \(architect\)/.test(c.body)) return null;
  if (BLOCKER.test(c.body)) return 'blocker';
  if (MACHINE.test(c.body)) return 'machine';
  if (c.body.startsWith('Integrator:')) return 'integrator';
  if (c.body.startsWith('Lane:') && MINOR.test(c.body)) return 'minor';
  return null;
}

/**
 * Whether a lane retries a held issue now. Only the owner's and the bot's comments count. The owner's
 * reply, newest, retries it. Otherwise the newest sprint comment since the lane last took it back decides:
 * - a `[blocker]` waits for the owner: only a blocker holds work (`owner: true`);
 * - a machine failure (time-out, memory, host load) retries once memory is over the floor, never waiting
 *   for the owner; after `MACHINE_RETRIES` retries it is the code's, a blocker;
 * - the integrator sending it back, or minor concerns alone (they ship with a note), retry.
 * Anything else (an answer relayed by the bot, a bare note) waits for the owner.
 */
export function heldRetry(issue, freeMb) {
  const counted = issue.comments.filter((c) => c.author === OWNER || c.author === BOT);
  const last = counted.at(-1);
  if (!last) return { retry: false, owner: true, why: 'no comment says why it is held' };
  if (last.author === OWNER) return { retry: true, owner: false, why: 'the owner replied', concerns: oneLine(last.body) };
  const lastOwner = findLast(counted, (c) => c.author === OWNER);
  const since = counted.filter((c) => !lastOwner || c.at > lastOwner.at);
  const start = since.findLastIndex((c) => c.author === BOT && c.body.startsWith(RETRYING));
  const deciding = since.slice(start + 1).reverse().find((c) => heldKind(c) !== null);
  const kind = deciding ? heldKind(deciding) : null;
  const concerns = deciding ? oneLine(deciding.body) : null;
  if (kind === 'machine') {
    const retries = since.filter((c) => c.author === BOT && c.body.startsWith(`${RETRYING}: the machine`)).length;
    if (retries >= MACHINE_RETRIES) {
      return { retry: false, owner: true, why: `a [blocker]: it failed on the machine again after ${retries} retries with memory free, so the code is slow, not the host` };
    }
    return freeMb > MEMORY_FLOOR_MB
      ? { retry: true, owner: false, why: `the machine failed it and ${freeMb} MB is free now`, concerns }
      : { retry: false, owner: false, why: `the machine failed it; it retries once free memory is over ${MEMORY_FLOOR_MB} MB (now ${freeMb} MB)` };
  }
  if (kind === 'integrator') return { retry: true, owner: false, why: 'the integrator sent it back', concerns };
  if (kind === 'minor') return { retry: true, owner: false, why: 'only minor concerns are left, and they ship with a note', concerns };
  if (kind === 'blocker') return { retry: false, owner: true, why: `waits for the owner: a [blocker] is left: "${oneLine(deciding.body, 100)}"` };
  return { retry: false, owner: true, why: `waits for the owner; newest comment: "${oneLine(last.body, 100)}"` };
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
      if (blocked && !answerTo(world, i)) waiting.push(`${name(i)} is blocked on a design question: no owner answer yet`);
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
  // No window open: no soak starts (the supervisor starts no research session then either).
  const lastStart = new Date((world.doc.window?.end.getTime() ?? 0) - LAST_SOAK_START);
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

/**
 * Whether a fresh session with this title would find work. Extra fields: `todo` and `ready` for a plan,
 * `issues` to integrate. `starting`: sessions this supervisor run already started, whose memory free
 * memory doesn't show yet; each raises the floor by `SESSION_MB`.
 */
export function hasWork(world, title, starting = 0) {
  if (!sessionTitles(world.doc).includes(title)) {
    throw refuse(`unknown session title "${title}"`, `Use one of: ${sessionTitles(world.doc).map((t) => `"${t}"`).join(', ')}.`);
  }
  const need = MEMORY_FLOOR_MB + SESSION_MB * starting;
  const floor = world.freeMb < need
    ? `memory: ${world.freeMb} MB free, under the ${need} MB floor${starting ? ` (${MEMORY_FLOOR_MB} + ${SESSION_MB} for each of ${starting} starting)` : ''}`
    : null;
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
      // Marks where this retry starts, so a later hold is read on its own (heldRetry).
      return plan(`${RETRYING}: ${r.why}.`);
    }
    const answer = from === 'blocked' ? answerTo(world, issue) : null;
    if (from === 'blocked' && !answer) throw refuse(`#${number} is blocked and the owner has not answered`, RETRY);
    const waits = unmet(world, issue);
    if (waits.length > 0) throw refuse(`#${number} waits for ${waits.map((r) => refName(world, r)).join(', ')}`, RETRY);
    if (!answer) return plan(null);
    // An answer given on the Decisions issue is quoted here, where the implementer reads the spec.
    return plan(
      answer.on === number
        ? "Lane: unblocked by the owner's answer; the implementer reads it as part of the spec."
        : `Lane: unblocked by the owner's answer on #${answer.on}, which the implementer reads as part of the spec: "${oneLine(answer.body, 1000)}"`,
    );
  }
  if (from === to) return { issue: number, from, to, comment: null, add: [], remove: [] };
  if (from !== 'in-progress') throw refuse(`#${number} is ${from}; only work in progress moves to ${to}`, RETRY);
  if (to === 'to-integrate') {
    if (!text) throw refuse('ready to integrate needs a note', "Run it again with --note '<WHAT CHANGED and PLAYER-VISIBLE lines from the hand-back>'.");
    // A blocker, the reviewer's or agy's, never reaches the integrator: it holds the work.
    if (BLOCKER.test(text)) {
      throw refuse('the note names a [blocker], and only a PASS or minor concerns go to integration', "Move it to held instead, with --note '<each blocker, with its [blocker] tag>'.");
    }
    const ahead = world.branchAhead(number);
    if (ahead === 0) {
      throw refuse(`sprint/${number} has no commits ahead of origin/main`, `Nothing to integrate: move it to held with --note '[blocker] <why>'.`);
    }
    return plan(`Lane: ready to integrate, branch sprint/${number}.\n${text}`);
  }
  // A hold note is read by heldRetry: without its [blocker] tag a blocker would read as minor and be retried.
  if (to === 'held' && text && !BLOCKER.test(text)) {
    throw refuse(
      'a hold note names each blocker with its [blocker] tag, and only a blocker holds work',
      "Run it again with each blocker tagged [blocker]; with minor concerns only, move it to-integrate with a 'Minor, shipped:' line.",
    );
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
      .filter((i) => !i.open && i.closedAt && i.closedAt >= (world.doc.window?.start ?? world.now))
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
  const where = world.doc.decisionsIssue ? ` (in the daily digest on #${world.doc.decisionsIssue})` : '';
  for (const i of world.issues.filter((x) => x.open && x.labels.some((l) => l.startsWith('lane:'))).sort((a, b) => a.number - b.number)) {
    if (i.labels.includes('blocked') && !answerTo(world, i)) needs.push(`#${i.number} [blocked] ${short(i)}: a design question waits for your answer${where}`);
    if (i.labels.includes('held')) {
      const r = heldRetry(i, world.freeMb);
      // Work waiting on the machine is not the owner's.
      if (!r.retry && r.owner) needs.push(`#${i.number} [held] ${short(i)}: ${r.why}`);
    }
  }
  needs.push(...also.map((a) => oneLine(a)));
  lines.push('', '**Needs you**', ...(needs.length ? needs.map((n) => `- ${n}`) : ['- nothing']));

  const old = oldBody.split(/\r?\n/);
  const at = old.findIndex((l) => l.trim() === '**Needs you**');
  const before = new Set(at < 0 ? [] : old.slice(at + 1).filter((l) => l.startsWith('- ')).map((l) => needKey(l.slice(2))));
  // Design questions reach the owner once a day, in the Decisions digest (`decisions`), never in an hourly ping.
  const fresh = needs.filter((n) => !before.has(needKey(n)) && !/^#\d+ \[blocked\]/.test(n));
  return { body: lines.join('\n'), needsYou: needs, new: fresh };
}

// --- decisions ----------------------------------------------------------------------------------------

const DAY = 24 * HOUR;

/**
 * `decisions [--write]`: the daily digest of design questions on the standing Decisions issue. Due when an
 * open lane issue is blocked on a question the owner has not answered and no digest was posted in the last
 * 24 hours, by either account: one comment a day, one @-mention, every open question with its recommendation.
 * An answer counts only when it is newer than the question (`answerTo`), so a new question on an issue the
 * last digest already listed is in the next one.
 */
export function decisionsDigest(world) {
  const n = world.doc.decisionsIssue;
  if (!n) throw refuse('docs/sprint.md names no Decisions issue (#<n> "Sprint questions")', 'Post no digest; report it on the sprint log.');
  const issue = byNumber(world, n);
  if (!issue?.open) throw refuse(`the Decisions issue #${n} is ${issue ? 'closed' : 'missing'}`, 'Post no digest; report it on the sprint log.');
  const questions = world.issues
    .filter((i) => i.open && i.labels.includes('blocked') && i.labels.some((l) => l.startsWith('lane:')) && !answerTo(world, i))
    .sort((a, b) => a.number - b.number);
  const last = findLast(issue.comments, isDigest);
  const nextAt = last ? new Date(last.at.getTime() + DAY) : null;
  const due = questions.length > 0 && (!nextAt || world.now >= nextAt);
  const ask = (i) => {
    const q = findLast(i.comments, (c) => c.author === BOT);
    const text = oneLine(q ? q.body : i.body, 400);
    return `- #${i.number} ${short(i)} (${i.labels.find((l) => l.startsWith('lane:')).slice(5)}): ${text}${/recommend/i.test(text) ? '' : ' (no recommendation given)'}`;
  };
  const body = [
    `${DIGEST}, ${world.now.toISOString().slice(0, 10)}. @${OWNER}: ${questions.length} design question${questions.length === 1 ? '' : 's'} wait for you; the lanes work on other issues meanwhile.`,
    `Answer here, one line per question: \`#<issue> <your answer>\`, or on the issue itself. Technical questions never come here: an architect decision settles them on the issue.`,
    '',
    ...questions.map(ask),
  ].join('\n');
  const why = questions.length === 0 ? 'no design question waits for the owner' : due ? 'questions wait and no digest went out in the last 24 hours' : `the last digest went out at ${fmt(last.at)}; the next is due at ${fmt(nextAt)}`;
  return { due, issue: n, questions: questions.map((i) => i.number), why, body };
}

// --- the command line ----------------------------------------------------------------------------------

const USAGE = [
  'Usage: queue.mjs window [start [hours] --environment <env> [--dry-run] | ids [--supervisor <trig>] [--archiver <trig>] [--wake <trig>] | stop | archived] | wake [--resets-at <epoch s> | --transcript <file> [--message <text>] | --due <at>]',
  'started "<session title>" <trig> | sessions [--all] | lock | unlock | resume --log <file> --last-event <ISO> | identity',
  'has-work "<session title>" [--starting <n>] | next <lane> [--taken <n,n>] | move <n> <state> [--note \'<text>\'] | status [--write] [--also \'<line>\']... | decisions [--write]',
].join(' | ');
const ISSUE_FIELDS = 'number,title,body,labels,state,comments,closedAt,createdAt';
const BOOLEAN_FLAGS = new Set(['--write', '--dry-run', '--all']);

/** Flags after the positional words: `--name value`, repeatable; `--write`, `--dry-run` and `--all` take none. */
function flags(args) {
  const words = [];
  const out = {};
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (BOOLEAN_FLAGS.has(a)) out[a.slice(2)] = true;
    else if (a.startsWith('--')) {
      if (k + 1 >= args.length) throw refuse(`${a} needs a value`, USAGE);
      (out[a.slice(2)] ??= []).push(args[++k]);
    } else words.push(a);
  }
  return { words, flags: out };
}

/** The ledger of started triggers, empty before the supervisor's first start. */
function readLedger(local) {
  const ledger = local.read(TRIGGERS_FILE) ?? [];
  if (!Array.isArray(ledger)) throw new QueueError(`${TRIGGERS_FILE} is not a list of triggers`, 'Start nothing. Report it; the next /sprint-start writes a new one.');
  return ledger;
}

/** The cue's commands, which read this computer's state and never gh; undefined for any other command. */
function cueCommand(command, words, f, doc, w, io) {
  const now = io.now();
  const done = (out) => ({ code: 0, line: JSON.stringify(out) });
  const apply = ({ out, writes }) => {
    for (const [name, value] of writes) io.local.write(name, value);
    return done(out);
  };
  const last = (name) => f[name]?.at(-1);
  if (command === 'window') {
    if (words.length === 0) return done(windowFacts(doc, w, now));
    return apply(windowCommand(doc, w, now, words[0], {
      hours: words[1], environment: last('environment'), supervisor: last('supervisor'), archiver: last('archiver'), wake: last('wake'), dryRun: Boolean(f['dry-run']),
    }));
  }
  if (command === 'wake') {
    const armed = io.local.read(WAKE_FILE);
    if (last('due')) {
      const out = wakeDue(w, now, last('due'), armed);
      if (armed?.at === last('due')) io.local.remove(WAKE_FILE);
      return done(out);
    }
    let resetsAt = null;
    if (last('resets-at') !== undefined) {
      resetsAt = Number(last('resets-at'));
      if (!Number.isInteger(resetsAt) || resetsAt <= 0) throw refuse(`--resets-at "${last('resets-at')}" is not epoch seconds`, 'Pass the reset as epoch seconds.');
    } else {
      // The transcript is exact, but Claude Code writes it a moment behind: an entry from an earlier limit, or
      // none yet, falls back to the time the error names.
      if (last('transcript')) {
        try {
          resetsAt = resetFromTranscript(io.readFile(last('transcript')));
        } catch {
          resetsAt = null;
        }
      }
      if (resetsAt === null || resetsAt * 1000 <= now.getTime()) {
        const named = namedReset(last('message'), now.getTime());
        resetsAt = named === null ? null : Math.round(named / 1000);
      }
    }
    return apply(wakeCommand(w, now, resetsAt, armed));
  }
  if (command === 'started') return apply(recordStart(doc, w, readLedger(io.local), now, words[0], words[1]));
  if (command === 'sessions') return done(sessions(doc, w, readLedger(io.local), { all: Boolean(f.all) }));
  if (command === 'lock') {
    if (io.local.claim(LOCK_FILE, { at: now.toISOString() })) return done({ ok: true });
    const out = lockCommand(io.local.read(LOCK_FILE), now);
    io.local.write(LOCK_FILE, { at: now.toISOString() });
    return done(out);
  }
  if (command === 'unlock') {
    io.local.remove(LOCK_FILE);
    return done({ ok: true });
  }
  if (command === 'resume') {
    if (!last('log')) throw refuse('resume needs --log <file>: the end of the run log, saved with the Write tool', USAGE);
    try {
      return done(resumeAfter(io.readFile(last('log')), { lastEventAt: last('last-event'), now }));
    } catch (e) {
      throw refuse(String(e?.message ?? e), 'Pass the run\'s last_event_at as --last-event and the saved log as --log.');
    }
  }
  return undefined;
}

/**
 * Runs one command against `io` (gh, git, the sprint doc, this computer's sprint state, free memory,
 * processes, the clock) and returns the one line of JSON to print, with the exit code: 0 done, 2 refused
 * (act on `do`), 1 failed (stop).
 */
export function run(argv, io) {
  try {
    const [command, ...rest] = argv;
    const { words, flags: f } = flags(rest);
    const shapes = {
      window: words.length <= 2, wake: words.length === 0, started: words.length === 2, sessions: words.length === 0, lock: words.length === 0,
      unlock: words.length === 0, resume: words.length === 0, identity: words.length === 0,
      'has-work': words.length === 1, next: words.length === 1, move: words.length === 2 && /^\d+$/.test(words[0] ?? ''), status: words.length === 0,
      decisions: words.length === 0,
    };
    if (!shapes[command]) throw refuse(`unknown command: ${argv.join(' ') || '(none)'}`, USAGE);
    const doc = parseSprintDoc(io.sprintDoc());
    const w = readWindow(io.local);
    doc.window = w ? { start: w.start, end: w.end } : null;
    const cue = cueCommand(command, words, f, doc, w, io);
    if (cue) return cue;
    if (command === 'identity') {
      // Sessions comment as the bot, and only the owner's comments answer a question: a session signed in
      // as the owner would answer its own. Sprint sessions may not run `gh api` or `gh auth` themselves.
      const login = io.gh(['api', 'user', '--jq', '.login']).trim();
      if (login !== BOT) throw refuse(`gh is signed in as ${login || 'no one'}, not ${BOT}`, `Refuse the start with this error. Never run \`gh auth switch\`: the owner signs gh in as ${BOT}.`);
      return { code: 0, line: JSON.stringify({ login, ok: true }) };
    }
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
      const starting = Number(f.starting?.at(-1) ?? 0);
      if (!Number.isInteger(starting) || starting < 0) throw refuse('--starting takes the number of sessions this run already started', USAGE);
      out = hasWork(world, words[0], starting);
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
    } else if (command === 'decisions') {
      const d = decisionsDigest(world);
      const write = Boolean(f.write && d.due);
      if (write) io.gh(['issue', 'comment', String(d.issue), '--body-file', '-'], d.body);
      out = { ...d, written: write };
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
