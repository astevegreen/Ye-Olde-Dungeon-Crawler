// The Gemini API fallback's trip through the cloud proxy (agy.mjs, postApi): the request must travel inside the
// CONNECT tunnel, a cut tunnel must come back as a reason, and the child must not outlive its answer.
// The rest of the fallback is in agyApi.test.ts.
import { describe, expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { API, parseApiReply, postApi } from '../lib/gemini-api.mjs';

// Starts a proxy in its own process (postApi blocks this one) and resolves once it prints its port. `said` collects
// what it prints after that.
async function startProxy(script: string) {
  const proxy = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'inherit'] });
  const out = { said: '' };
  const port = await new Promise<string>((resolve) => proxy.stdout.once('data', (d) => resolve(String(d).trim())));
  proxy.stdout.setEncoding('utf8').on('data', (d: string) => (out.said += d));
  return { proxy, port, out };
}

// Runs `body` with HTTPS_PROXY pointing at the proxy, then restores it and stops the proxy.
async function throughProxy<T>(script: string, body: (out: { said: string }) => T | Promise<T>) {
  const { proxy, port, out } = await startProxy(script);
  const before = process.env.HTTPS_PROXY;
  try {
    process.env.HTTPS_PROXY = `http://127.0.0.1:${port}`;
    return await body(out);
  } finally {
    if (before === undefined) delete process.env.HTTPS_PROXY;
    else process.env.HTTPS_PROXY = before;
    proxy.kill();
  }
}

// A proxy that accepts the tunnel, then cuts it: after the first bytes through it (printing whether they open a TLS
// handshake for the API's host), or after a second if none come, as the cloud proxy cuts an idle tunnel.
const CUTTING_PROXY =
  'const s = require("node:http").createServer();' +
  's.on("connect", (req, sock) => {' +
  '  sock.write("HTTP/1.1 200 Connection Established\\r\\n\\r\\n");' +
  '  const cut = setTimeout(() => sock.resetAndDestroy(), 1000);' +
  '  sock.once("data", (d) => {' +
  '    clearTimeout(cut);' +
  '    console.log(d[0] === 22 && d.includes("gemini.invalid") ? "tls hello" : "other bytes");' +
  '    sock.resetAndDestroy();' +
  '  });' +
  '  sock.resume();' +
  '});' +
  's.listen(0, () => console.log(s.address().port));';

// A proxy that refuses the tunnel but leaves the connection open.
const LINGERING_PROXY =
  'const s = require("node:http").createServer();' +
  's.on("connect", (req, sock) => sock.write("HTTP/1.1 407 Proxy Authentication Required\\r\\n\\r\\n"));' +
  's.listen(0, () => console.log(s.address().port));';

describe('the Gemini API through the cloud proxy', () => {
  it('sends the request inside the tunnel, and a cut tunnel comes back as a reason, not a crash', async () => {
    await throughProxy(CUTTING_PROXY, async (out) => {
      // gemini.invalid has no address, so only the tunnel can carry this request anywhere.
      const r = postApi('https://gemini.invalid/v1beta/models/x:generateContent', {}, 'k');
      expect(r.status).toBe(0);
      expect(r.text).not.toMatch(/node:events|Unhandled/);
      expect(r.text).toMatch(/ECONNRESET|socket hang up|disconnected/);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(out.said).toMatch(/tls hello/);
    });
  });

  it('reports a child that crashes by its error line, not the first line of the stack', () => {
    const stderr = [
      'node:events:497',
      "      throw er; // Unhandled 'error' event",
      '      ^',
      '',
      'Error: read ECONNRESET',
      '    at TCP.onStreamRead (node:internal/stream_base_commons:216:20)',
    ].join('\n');
    const r = postApi(`${API}/x:generateContent`, {}, 'k', () => ({ stdout: '', stderr }));
    expect(() => parseApiReply(r)).toThrow(/could not be reached \(no answer\): Error: read ECONNRESET$/);
  });

  it('exits the child once it has answered, though the proxy leaves the connection open', async () => {
    // A 5-second limit in place of 11 minutes: a child that waits on the open connection is cut off and says so.
    const short = (cmd: string, args: string[], opts: { input: string; env: Record<string, string | undefined> }) =>
      spawnSync(cmd, args, { ...opts, encoding: 'utf8', timeout: 5000 });
    await throughProxy(LINGERING_PROXY, () => {
      expect(postApi(`${API}/x:generateContent`, {}, 'k', short)).toEqual({
        status: 0,
        text: 'the proxy refused the tunnel (407)',
      });
    });
  });
});
