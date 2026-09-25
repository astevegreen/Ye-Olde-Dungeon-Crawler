# Bug-report relay

A Cloudflare Worker that files GitHub issues for the in-game bug reporter (F3), so
playtesters need no GitHub account and never paste anything. The game POSTs the
report here; the Worker holds a token that can only create issues on this repository.

Without it (or when it can't be reached), the game falls back to opening GitHub's
new-issue page with the report on the clipboard.

## One-time setup

1. **Cloudflare account** (free plan is enough: 100,000 requests/day). Then, from this folder:
   ```
   npx wrangler login
   ```
2. **GitHub token.** GitHub → Settings → Developer settings → Fine-grained tokens → Generate:
   - Repository access: *Only select repositories* → this repository
   - Permissions: *Issues: Read and write* (nothing else)
   - Set an expiry you're comfortable renewing.
3. **Give the token to the Worker** (paste it when prompted; it is stored encrypted by Cloudflare, never in the repo):
   ```
   npx wrangler secret put GITHUB_TOKEN
   ```
4. **Optional: screenshots in issues.**
   ```
   npx wrangler kv namespace create SHOTS
   ```
   Uncomment the `[[kv_namespaces]]` block in `wrangler.toml` and paste the id it printed.
   Screenshots are kept 180 days.
5. **Deploy:**
   ```
   npx wrangler deploy
   ```
   It prints the Worker's URL, e.g. `https://yodc-report-relay.<your-subdomain>.workers.dev`.
6. **Point the game at it:** add a repository variable (Settings → Secrets and variables →
   Actions → Variables) named `REPORT_RELAY_URL` with that URL, then re-run the deploy
   workflow (or push). The in-game button changes from *Submit to GitHub* to *Send Report*.

Check it: open `<relay URL>/` in a browser; it should say `yodc report relay: ok`.

## Abuse limits

- Only origins in `ALLOWED_ORIGINS` (`wrangler.toml`) are accepted. `null` is the game
  opened from a downloaded file. This stops casual misuse from other sites but is not
  authentication: anyone can send any `Origin` from a script.
- What actually bounds damage: the token can only create issues on this one repository;
  labels are limited to a fixed list; sizes are capped.
- If it gets spammed: uncomment the `[[ratelimits]]` block (5 reports/minute per IP), or
  rotate the token (`npx wrangler secret put GITHUB_TOKEN`). Cloudflare Turnstile is the
  next step up if needed.

## Local testing

```
printf 'GITHUB_TOKEN=<token>\nALLOWED_ORIGINS=http://localhost:4173,null\n' > .dev.vars
npx wrangler dev --port 8787
REPORT_RELAY_URL=http://127.0.0.1:8787 npm run build   # from the repo root, then preview dist/
```

The request handling lives in `src/relay.ts` and is tested by the repo's `npm test`
(`src/__tests__/relay.test.ts`).
