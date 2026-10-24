import { describe, expect, it } from 'vitest';
import { resumeAfter } from '../usage-limit.mjs';

/** When a usage-limit stop may restart, on the messages October's sessions ended on (Terminal Dusk's fixtures). */
const SESSION = (time: string) => `You've hit your session limit · resets ${time} (America/New_York) (error type rate_limit, HTTP 429, request id)`;
const at = (s: string) => new Date(s);

describe('resumeAfter', () => {
  it('21 Oct: a limit at 02:11Z that resets 12am New York waits until 04:00Z and restarts at 04:02Z', () => {
    const last = '2026-10-21T02:11:00Z';
    expect(resumeAfter(SESSION('12am'), { lastEventAt: last, now: at('2026-10-21T03:02:00Z') })).toEqual({
      start: false, after: '2026-10-21T04:00Z', restartAt: '2026-10-21T04:02Z', reason: 'usage limit; resets 2026-10-21T04:00Z',
    });
    expect(resumeAfter(SESSION('12am'), { lastEventAt: last, now: at('2026-10-21T04:01:00Z') }).start).toBe(false);
    const later = resumeAfter(SESSION('12am'), { lastEventAt: last, now: at('2026-10-21T04:02:00Z') });
    expect(later.start).toBe(true);
    expect(later.reason).toMatch(/which has passed$/);
  });
  it('reads a reset with minutes later the same New York day', () => {
    const r = resumeAfter(SESSION('4:30pm'), { lastEventAt: '2026-10-22T19:00:00Z', now: at('2026-10-22T19:05:00Z') });
    expect(r).toMatchObject({ after: '2026-10-22T20:30Z', restartAt: '2026-10-22T20:32Z', start: false });
  });
  it('reads the reset in whichever offset New York has then, across the 1 November clock change', () => {
    expect(resumeAfter(SESSION('3am'), { lastEventAt: '2026-10-31T23:00:00Z' }).after).toBe('2026-11-01T08:00Z');
    expect(resumeAfter(SESSION('1:30pm'), { lastEventAt: '2026-11-02T15:00:00Z' }).after).toBe('2026-11-02T18:30Z');
  });
  it('reads a weekly limit\'s date', () => {
    const weekly = "You've hit your weekly limit · resets Oct 28, 9am (America/New_York)";
    expect(resumeAfter(weekly, { lastEventAt: '2026-10-26T12:00:00Z' }).after).toBe('2026-10-28T13:00Z');
  });
  it('waits an hour after the last event with no reset time, no zone, or a zone no one knows', () => {
    for (const text of ['API Error: usage limit reached', "You've hit your session limit · resets 4:30pm", "You've hit your session limit · resets 4:30pm (Mars/Olympus_Mons)"]) {
      const r = resumeAfter(text, { lastEventAt: '2026-10-21T02:11:00Z', now: at('2026-10-21T02:40:00Z') });
      expect(r, text).toMatchObject({ start: false, after: '2026-10-21T03:11Z' });
      expect(r.reason, text).toMatch(/an hour after its last event/);
    }
  });
  it('lets a run that ended any other way start, and refuses a missing or bad last-event time', () => {
    expect(resumeAfter('Done. Landed #51.', { lastEventAt: '2026-10-21T02:11:00Z' })).toEqual({ start: true, reason: 'the run did not stop on a usage limit' });
    expect(() => resumeAfter(SESSION('12am'), { lastEventAt: 'yesterday' })).toThrow(/is not a time/);
    expect(() => resumeAfter(SESSION('12am'), {})).toThrow(/is not a time/);
  });
});
