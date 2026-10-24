/**
 * When a session that stopped on a usage limit may start again (`queue.mjs resume`). The supervisor saves the
 * end of the run's log to a file and passes the time of its last event; this reads the reset time the error
 * names, converts its local time and zone to UTC, and says whether 2 minutes past it have gone. No one converts
 * time zones by hand. Ported from Terminal Dusk's sprint (tools/sprint/usage-limit.mjs), tested on the same
 * October messages.
 *   "You've hit your session limit · resets 4:30pm (America/New_York) (error type rate_limit, HTTP 429…)"
 *   "You've hit your weekly limit · resets Oct 28, 9am (America/New_York)"
 * With no reset time, or no zone to read it in, it waits an hour after the last event.
 */

const LIMIT = /hit your [a-z ]*limit|usage limit|rate_limit/i;
const RESET = /resets\s+(?:([A-Z][a-z]{2})\s+(\d{1,2}),?\s+(?:at\s+)?)?(\d{1,2})(?::(\d{2}))?\s*([ap]m)\s*\(([^)\s]+)\)/i;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const HOUR = 3_600_000;
/** A restart waits 2 minutes past the reset. */
const MARGIN = 2 * 60_000;
const DAY = 24 * HOUR;

/** The zone's wall clock at an instant, as the fields of a UTC date. */
function wallClock(zone, instant) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  }).formatToParts(new Date(instant));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: get('year'), month: get('month') - 1, day: get('day'), hour: get('hour'), minute: get('minute') };
}

/** The UTC instant when the zone's clock reads the given wall time (checked twice, for daylight saving). */
function zonedTime(zone, { year, month, day, hour, minute }) {
  const asUtc = Date.UTC(year, month, day, hour, minute);
  const offsetAt = (instant) => {
    const w = wallClock(zone, instant);
    return Date.UTC(w.year, w.month, w.day, w.hour, w.minute) - Math.floor(instant / 60_000) * 60_000;
  };
  const first = asUtc - offsetAt(asUtc);
  return asUtc - offsetAt(first);
}

/** The first time the named reset falls after the last event. */
function resetAt(m, zone, last) {
  const hour = (Number(m[3]) % 12) + (m[5].toLowerCase() === 'pm' ? 12 : 0);
  const minute = Number(m[4] ?? 0);
  const here = wallClock(zone, last);
  if (m[1]) {
    const month = MONTHS.indexOf(m[1].toLowerCase());
    if (month < 0) return null;
    const at = (year) => zonedTime(zone, { year, month, day: Number(m[2]), hour, minute });
    return at(here.year) > last ? at(here.year) : at(here.year + 1);
  }
  for (let d = 0; d < 3; d++) {
    const day = new Date(Date.UTC(here.year, here.month, here.day) + d * DAY);
    const at = zonedTime(zone, { year: day.getUTCFullYear(), month: day.getUTCMonth(), day: day.getUTCDate(), hour, minute });
    if (at > last) return at;
  }
  return null;
}

const iso = (t) => new Date(t).toISOString().replace(/:\d{2}\.\d{3}Z$/, 'Z');

/**
 * `{start, reason, after?, restartAt?}`: `after` is the reset, and `start` stays false until `restartAt`, 2
 * minutes later. `lastEventAt` is the run's last event; a run that ended any other way starts at once.
 */
export function resumeAfter(text, { lastEventAt, now = new Date() } = {}) {
  const last = new Date(lastEventAt ?? Number.NaN).getTime();
  if (Number.isNaN(last)) throw new Error(`--last-event "${lastEventAt ?? ''}" is not a time; give the run's last_event_at`);
  if (!LIMIT.test(String(text ?? ''))) return { start: true, reason: 'the run did not stop on a usage limit' };
  const m = RESET.exec(text);
  let after = null;
  let named = false;
  if (m) {
    try {
      after = resetAt(m, m[6], last);
      named = after !== null;
    } catch {
      after = null; // a zone Intl doesn't know: wait the hour instead
    }
  }
  after ??= last + HOUR;
  const start = now.getTime() >= after + MARGIN;
  const why = named
    ? `usage limit; resets ${iso(after)}`
    : `usage limit with no reset time I can read; waits until ${iso(after)}, an hour after its last event`;
  return { start, after: iso(after), restartAt: iso(after + MARGIN), reason: start ? `${why}, which has passed` : why };
}
