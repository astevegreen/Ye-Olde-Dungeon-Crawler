/**
 * Bug-report relay: lets the game file GitHub issues for testers who have no GitHub
 * account. The game POSTs a report here; this Worker holds a token that can only create
 * issues on one repository, and files the issue itself.
 *
 * Deployed separately from the game (see relay/README.md); nothing here is bundled into
 * it. Kept free of Cloudflare-specific types so it runs under the repo's Vitest suite.
 */

export interface KvLike {
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { expirationTtl?: number; metadata?: unknown }): Promise<void>;
}

export interface RateLimiterLike {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  /** Fine-grained token: this repository only, Issues read and write. A Worker secret. */
  GITHUB_TOKEN: string;
  /** `owner/name`. */
  GITHUB_REPO: string;
  /** Comma-separated origins allowed to submit; `null` is the game opened from a file. */
  ALLOWED_ORIGINS: string;
  /** Optional: stores screenshots so the issue can show them. */
  SHOTS?: KvLike;
  /** Optional: per-IP submission limit. */
  REPORT_LIMITER?: RateLimiterLike;
}

export interface ReportPayload {
  type: 'bug' | 'feature';
  title: string;
  labels: string[];
  /** The prefilled issue body the game builds (description, build, where, last actions). */
  body: string;
  /** The full diagnostic report (Markdown, replay data included), bugs only. */
  report?: string;
  /** PNG data URL of the game view, bugs only. */
  screenshot?: string;
}

export const LIMITS = {
  title: 120,
  body: 20_000,
  report: 62_000,
  screenshotBytes: 4 * 1024 * 1024,
  /** GitHub rejects issue and comment bodies over 65,536 characters. */
  issueBody: 65_000,
};

/** The only labels a report can set; anything else is dropped. */
export const ALLOWED_LABELS = new Set([
  'bug',
  'enhancement',
  'crash',
  'area:combat',
  'area:magic',
  'area:inventory',
  'area:map',
  'area:ui',
  'balance',
  'gameplay',
  'quality-of-life',
  'content',
  'triage',
]);

const SHOT_PREFIX = 'data:image/png;base64,';
const SHOT_TTL_SECONDS = 180 * 24 * 60 * 60;

export function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Checks a parsed request body; returns the payload or a reason it was refused. */
export function validatePayload(raw: unknown): { ok: true; payload: ReportPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'body must be a JSON object' };
  const r = raw as Record<string, unknown>;
  if (r.type !== 'bug' && r.type !== 'feature') return { ok: false, error: 'type must be bug or feature' };
  if (typeof r.title !== 'string' || !r.title.trim()) return { ok: false, error: 'title is required' };
  if (typeof r.body !== 'string') return { ok: false, error: 'body is required' };
  if (r.body.length > LIMITS.body) return { ok: false, error: `body is over ${LIMITS.body} characters` };
  if (r.report !== undefined && (typeof r.report !== 'string' || r.report.length > LIMITS.report)) {
    return { ok: false, error: `report must be text under ${LIMITS.report} characters` };
  }
  if (r.screenshot !== undefined) {
    if (typeof r.screenshot !== 'string' || !r.screenshot.startsWith(SHOT_PREFIX)) {
      return { ok: false, error: 'screenshot must be a PNG data URL' };
    }
    if (((r.screenshot.length - SHOT_PREFIX.length) * 3) / 4 > LIMITS.screenshotBytes) {
      return { ok: false, error: 'screenshot is too large' };
    }
  }
  const labels = Array.isArray(r.labels) ? r.labels.filter((l): l is string => typeof l === 'string' && ALLOWED_LABELS.has(l)) : [];
  return {
    ok: true,
    payload: {
      type: r.type,
      title: r.title.trim().slice(0, LIMITS.title),
      labels,
      body: r.body,
      report: r.report as string | undefined,
      screenshot: r.screenshot as string | undefined,
    },
  };
}

const FOOTER = '\n\n---\n_Filed by the in-game bug reporter._';

/**
 * The issue body, and the comment to post after it when the whole report won't fit in
 * one body. `screenshotUrl` is embedded when the screenshot was stored.
 */
export function composeIssue(payload: ReportPayload, screenshotUrl?: string): { body: string; comment?: string } {
  let head = payload.body;
  if (screenshotUrl) head += `\n\n### Screenshot\n![Game view when the report was opened](${screenshotUrl})`;
  if (!payload.report) return { body: head + FOOTER };
  const whole = `${head}\n\n---\n\n${payload.report}${FOOTER}`;
  if (whole.length <= LIMITS.issueBody) return { body: whole };
  return { body: head + '\n\n_The full diagnostic report is in the first comment._' + FOOTER, comment: payload.report };
}

function decodeBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function github(env: Env, path: string, body: unknown): Promise<Response> {
  return fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'yodc-report-relay',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function json(status: number, data: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } });
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const cors = corsHeaders(origin, env);

  if (request.method === 'GET' && url.pathname.startsWith('/shot/')) {
    const id = url.pathname.slice('/shot/'.length).replace(/\.png$/, '');
    const png = /^[0-9a-f-]{36}$/.test(id) && env.SHOTS ? await env.SHOTS.get(id, 'arrayBuffer') : null;
    return png
      ? new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' } })
      : new Response('not found', { status: 404 });
  }
  if (request.method === 'GET' && url.pathname === '/') return new Response('yodc report relay: ok');
  if (request.method === 'OPTIONS') return new Response(null, { status: cors['Access-Control-Allow-Origin'] ? 204 : 403, headers: cors });
  if (request.method !== 'POST' || url.pathname !== '/report') return json(404, { ok: false, error: 'not found' }, cors);

  // Browsers always send Origin on a cross-origin POST; refusing others keeps casual
  // abuse out. It is not authentication (a script can send any Origin) — the token's
  // narrow scope and the limits below are what bound the damage.
  if (!cors['Access-Control-Allow-Origin']) return json(403, { ok: false, error: 'origin not allowed' }, cors);

  if (env.REPORT_LIMITER) {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const { success } = await env.REPORT_LIMITER.limit({ key: ip });
    if (!success) return json(429, { ok: false, error: 'too many reports; try again in a minute' }, cors);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(400, { ok: false, error: 'body must be JSON' }, cors);
  }
  const checked = validatePayload(raw);
  if (!checked.ok) return json(400, { ok: false, error: checked.error }, cors);
  const payload = checked.payload;

  let screenshotUrl: string | undefined;
  if (payload.screenshot && env.SHOTS) {
    const id = crypto.randomUUID();
    await env.SHOTS.put(id, decodeBase64(payload.screenshot.slice(SHOT_PREFIX.length)), { expirationTtl: SHOT_TTL_SECONDS });
    screenshotUrl = `${url.origin}/shot/${id}.png`;
  }

  const issue = composeIssue(payload, screenshotUrl);
  const created = await github(env, '/issues', { title: payload.title, body: issue.body, labels: payload.labels });
  if (!created.ok) {
    return json(502, { ok: false, error: `GitHub refused the issue (${created.status})` }, cors);
  }
  const { number, html_url } = (await created.json()) as { number: number; html_url: string };
  if (issue.comment) {
    // The issue exists either way; a failed comment is reported but not fatal.
    const commented = await github(env, `/issues/${number}/comments`, { body: issue.comment });
    if (!commented.ok) return json(201, { ok: true, number, url: html_url, warning: 'report comment failed' }, cors);
  }
  return json(201, { ok: true, number, url: html_url }, cors);
}
