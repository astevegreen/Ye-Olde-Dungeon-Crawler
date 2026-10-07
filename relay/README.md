# Bug-report relay

A Cloudflare Worker that files GitHub issues for the in-game bug reporter (F3), so
playtesters need no GitHub account and never paste anything. The game POSTs the
report here; the Worker holds a token that can only create issues on this repository.

Without it (or when it can't be reached), the game falls back to opening GitHub's
new-issue page with the report on the clipboard.

## One-time setup

Wrangler is a dev dependency of the repo (`npm install` at the root brings it), so `npx wrangler`
from **this folder** uses that pinned version. **Never run `wrangler` from the repo root:** with
no Wrangler config there, it offers to set the game itself up as a Worker, rewrites
`vite.config.ts` and `package.json`, and deploys the game. From the root, use the scripts
`npm run relay:deploy` and `npm run relay:dev`, which point at this folder's `wrangler.toml`.

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
4. **Screenshots in issues.** `wrangler.toml`'s `[[kv_namespaces]]` block already binds
   `SHOTS` to this repo's namespace. Deploying a relay of your own on another Cloudflare
   account, create one and put the id it prints in that block's `id`:
   ```
   npx wrangler kv namespace create SHOTS
   ```
   To deploy without screenshots, delete the block; the relay then files issues without them.
   Screenshots are kept 180 days.
5. **Deploy** (again after any change under `src/` or to `wrangler.toml`):
   ```
   npx wrangler deploy
   ```
   or `npm run relay:deploy` from the repo root.
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
- A per-IP rate limit (the `[[ratelimits]]` block, 5 reports a minute) is on by default.
  `@` mentions in a report are quieted (a zero-width space after the `@`), so a report
  can't ping users from the owner's account; a screenshot must be a real PNG, and is
  served with `nosniff`. A failing screenshot store files the issue without it.
- If it gets spammed anyway: rotate the token (`npx wrangler secret put GITHUB_TOKEN`).
  Cloudflare Turnstile is the next step up if needed.

## Local testing

```
printf 'GITHUB_TOKEN=<token>\nALLOWED_ORIGINS=http://localhost:4173,null\n' > .dev.vars
npx wrangler dev --port 8787
REPORT_RELAY_URL=http://127.0.0.1:8787 npm run build   # from the repo root, then preview dist/
```

The request handling lives in `src/relay.ts` and is tested by the repo's `npm test`
(`src/__tests__/relay.test.ts`).
