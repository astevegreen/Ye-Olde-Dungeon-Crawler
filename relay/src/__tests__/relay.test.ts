import { afterEach, describe, expect, it, vi } from 'vitest';
import { composeIssue, handleRequest, validatePayload, LIMITS, type Env, type KvLike } from '../relay';

const ORIGIN = 'https://astevegreen.github.io';

function env(extra: Partial<Env> = {}): Env {
  return { GITHUB_TOKEN: 'test-token', GITHUB_REPO: 'owner/repo', ALLOWED_ORIGINS: `${ORIGIN},null`, ...extra };
}

function post(body: unknown, origin: string | null = ORIGIN): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin) headers.Origin = origin;
  return new Request('https://relay.example.workers.dev/report', { method: 'POST', headers, body: JSON.stringify(body) });
}

const bug = { type: 'bug', title: '[Bug]: Froze on stairs', labels: ['bug', 'crash', 'not-a-label'], body: '### Description\nIt froze.', report: '# Report\nreplay here' };

function mockGitHub(): ReturnType<typeof vi.fn> {
  const calls: Array<{ url: string; body: any }> = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    if (url.endsWith('/issues')) return new Response(JSON.stringify({ number: 7, html_url: 'https://github.com/owner/repo/issues/7' }), { status: 201 });
    return new Response('{}', { status: 201 });
  });
  (fn as any).calls = calls;
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('report relay', () => {
  it('files an issue with the report in the body, keeping only known labels', async () => {
    const gh = mockGitHub();
    const res = await handleRequest(post(bug), env());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, number: 7, url: 'https://github.com/owner/repo/issues/7' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);

    const [call] = (gh as any).calls;
    expect(call.url).toBe('https://api.github.com/repos/owner/repo/issues');
    expect(call.body.labels).toEqual(['bug', 'crash']);
    expect(call.body.body).toContain('It froze.');
    expect(call.body.body).toContain('replay here');
    expect(gh.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  });

  it('moves a report that would overflow the issue body into a comment', async () => {
    const gh = mockGitHub();
    const big = { ...bug, body: 'y'.repeat(5000), report: 'x'.repeat(LIMITS.report) };
    await handleRequest(post(big), env());
    const calls = (gh as any).calls;
    expect(calls).toHaveLength(2);
    expect(calls[0].body.body).toContain('first comment');
    expect(calls[1].url).toBe('https://api.github.com/repos/owner/repo/issues/7/comments');
    expect(calls[1].body.body).toHaveLength(LIMITS.report);
  });

  it('stores a screenshot and embeds a link to it', async () => {
    const gh = mockGitHub();
    const store = new Map<string, Uint8Array>();
    const SHOTS: KvLike = {
      put: async (k, v) => void store.set(k, new Uint8Array(v as Uint8Array)),
      get: async (k) => (store.get(k)?.buffer as ArrayBuffer) ?? null,
    };
    await handleRequest(post({ ...bug, screenshot: 'data:image/png;base64,iVBORw0KGgo=' }), env({ SHOTS }));

    const body: string = (gh as any).calls[0].body.body;
    const link = body.match(/\((https:\/\/relay\.example\.workers\.dev\/shot\/[0-9a-f-]+\.png)\)/)?.[1];
    expect(link).toBeDefined();
    const served = await handleRequest(new Request(link!), env({ SHOTS }));
    expect(served.headers.get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await served.arrayBuffer())[1]).toBe(0x50); // 'P' of the PNG signature
  });

  it('refuses unknown origins, bad payloads, and rate-limited senders', async () => {
    mockGitHub();
    expect((await handleRequest(post(bug, 'https://evil.example'), env())).status).toBe(403);
    expect((await handleRequest(post(bug, null), env())).status).toBe(403);
    expect((await handleRequest(post({ ...bug, type: 'spam' }), env())).status).toBe(400);
    const REPORT_LIMITER = { limit: async () => ({ success: false }) };
    expect((await handleRequest(post(bug), env({ REPORT_LIMITER }))).status).toBe(429);
  });

  it('accepts the game opened from a file (Origin: null) and answers preflight', async () => {
    mockGitHub();
    expect((await handleRequest(post(bug, 'null'), env())).status).toBe(201);
    const pre = await handleRequest(new Request('https://relay.example.workers.dev/report', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), env());
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('reports a GitHub failure instead of claiming success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad credentials', { status: 401 })));
    const res = await handleRequest(post(bug), env());
    expect(res.status).toBe(502);
    expect((await res.json()).ok).toBe(false);
  });

  it('files the issue without the screenshot when the bytes are not a PNG or the store fails', async () => {
    const SHOTS: KvLike = { put: async () => { throw new Error('KV PUT failed: 429'); }, get: async () => null };
    let gh = mockGitHub();
    let res = await handleRequest(post({ ...bug, screenshot: 'data:image/png;base64,iVBORw0KGgo=' }), env({ SHOTS }));
    expect(res.status).toBe(201);
    expect((gh as any).calls[0].body.body).not.toContain('/shot/');

    const stored: string[] = [];
    const KEEP: KvLike = { put: async (k) => void stored.push(k), get: async () => null };
    gh = mockGitHub();
    res = await handleRequest(post({ ...bug, screenshot: 'data:image/png;base64,PGh0bWw+' }), env({ SHOTS: KEEP })); // "<html>"
    expect(res.status).toBe(201);
    expect(stored).toEqual([]);
    res = await handleRequest(post({ ...bug, screenshot: 'data:image/png;base64,@@@@' }), env({ SHOTS: KEEP }));
    expect(res.status).toBe(201);
  });

  it('answers a failure past the checks with a CORS-headed 502, never a rejection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const res = await handleRequest(post(bug), env());
    expect(res.status).toBe(502);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it('quiets @mentions, and serves screenshots with nosniff', async () => {
    const gh = mockGitHub();
    await handleRequest(post({ ...bug, title: 'ping @someone', body: 'cc @org/team', report: '@x' }), env());
    const sent = (gh as any).calls[0].body;
    expect(sent.title).not.toMatch(/@[A-Za-z]/);
    expect(sent.body).not.toMatch(/@[A-Za-z]/);
    const store = new Map<string, Uint8Array>([['00000000-0000-0000-0000-000000000000', new Uint8Array([137, 80, 78, 71])]]);
    const SHOTS: KvLike = { put: async () => {}, get: async (k) => (store.get(k)?.buffer as ArrayBuffer) ?? null };
    const served = await handleRequest(new Request('https://relay.example.workers.dev/shot/00000000-0000-0000-0000-000000000000.png'), env({ SHOTS }));
    expect(served.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('validates sizes and screenshot format', () => {
    expect(validatePayload({ ...bug, body: 'x'.repeat(LIMITS.body + 1) }).ok).toBe(false);
    expect(validatePayload({ ...bug, screenshot: 'data:text/html;base64,AAAA' }).ok).toBe(false);
    expect(composeIssue({ type: 'feature', title: 't', labels: [], body: 'idea' }).comment).toBeUndefined();
  });

  it('holds every limit at its edge, and refuses what is not a report', () => {
    expect(validatePayload({ ...bug, body: 'x'.repeat(LIMITS.body) }).ok).toBe(true);
    expect(validatePayload({ ...bug, report: 'x'.repeat(LIMITS.report) }).ok).toBe(true);
    expect(validatePayload({ ...bug, report: 'x'.repeat(LIMITS.report + 1) }).ok).toBe(false);
    expect(validatePayload({ ...bug, report: 42 }).ok).toBe(false);
    // Base64 carries three bytes in four characters.
    const shot = (bytes: number) => `data:image/png;base64,${'A'.repeat((bytes * 4) / 3)}`;
    expect(validatePayload({ ...bug, screenshot: shot(LIMITS.screenshotBytes - (LIMITS.screenshotBytes % 3)) }).ok).toBe(true);
    expect(validatePayload({ ...bug, screenshot: shot(LIMITS.screenshotBytes + 3 - (LIMITS.screenshotBytes % 3)) }).ok).toBe(false);
    expect(validatePayload({ ...bug, screenshot: 7 }).ok).toBe(false);

    const long = validatePayload({ ...bug, title: `  ${'t'.repeat(LIMITS.title + 50)}  ` });
    expect(long.ok && long.payload.title).toBe('t'.repeat(LIMITS.title));
    expect(validatePayload({ ...bug, title: '   ' }).ok).toBe(false);
    expect(validatePayload({ ...bug, title: 3 }).ok).toBe(false);
    expect(validatePayload({ ...bug, body: undefined }).ok).toBe(false);
    const noLabels = validatePayload({ ...bug, labels: 'bug' });
    expect(noLabels.ok && noLabels.payload.labels).toEqual([]);

    for (const raw of [null, undefined, 'a report', 7, []]) expect(validatePayload(raw).ok, JSON.stringify(raw)).toBe(false);
  });

  it('answers a body that is not JSON with a 400, filing nothing', async () => {
    const github = mockGitHub();
    for (const body of ['{"type":"bug",', 'not json', '']) {
      const request = new Request('https://relay.example.workers.dev/report', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body });
      const response = await handleRequest(request, env());
      expect(response.status, body).toBe(400);
      expect(await response.json()).toEqual({ ok: false, error: 'body must be JSON' });
    }
    expect(github).not.toHaveBeenCalled();
  });
});
