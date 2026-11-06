# Follow-ups

Known work that a session found outside its task. The list carries it forward, so session summaries stop repeating
it. Sessions add to it by day; sprint lanes file follow-up issues instead. Moving an item into an issue deletes it here.

## How to use
- Grep this file before adding: an item already here gets nothing more.
- One item per bullet: what is wrong or missing, and where (`path:line`, an issue number), then the date found and
  how, in brackets.
- Finish an item: delete its bullet in the same commit.
- A decision only the owner can make goes to the owner as a question, not here.

## Engine
- No test covers a kill rite teaching into full grimoires (the "Every slot in your grimoires is full" suffix) or its `screen_flash` (`src/engine/magic/killRites.ts`, `teachRiteSpell`); found 3 Nov 2026 by the reviewer on 1d02df90.

## Content (cotw pack)

## Presentation

## Tests, gates and tooling
- Planned: move type checking to TypeScript 7 (Microsoft's native compiler; `package.json` pins `^5.7.3`, the lockfile has 5.9.3). Measured 6 Nov 2026: `tsc --noEmit` passes with no errors and drops from 14.8s (3.7s with a warm incremental cache) to 2.1s, and the `e2e/` check from 9.7s to 1.4s; both run in `npm run lint` and `npm run build`. `scripts/check-engine-encapsulation.ts` imports the compiler API, which 7.0 lacks and 7.1 adds (beta 20 Oct 2026; stable reported for late November 2026). Wait for 7.1 and move in one step if the script runs on it unchanged; otherwise keep 5.9 beside 7.x for that script alone. The Rust port tsrs was looked at and skipped: it is experimental and would save under a second here. Found 6 Nov 2026 by the owner's research request.
- Planned, with or after the TypeScript 7 move: Vite 6.4 to Vite 8 (Rust bundler Rolldown; Terminal Dusk already runs it). Vite claims 10-30x faster builds and one independent test measured 13x; the bundle build takes about 16 s in CI, so it saves seconds, and it ends the `vite <=6.4.3` advisories for good. `vite-plugin-singlefile` 2.3.4 supports Vite 8 (its peer range covers 5-8); retest the post-build plugin in `vite.config.ts` that rewrites module scripts to classic ones (§7.1) and Vite 7's changed defaults. Raise `engines` (`package.json`, `>=22.12.0`) to Node 24 at the same time: Node 22 reaches end of life on 30 Apr 2027. Found 6 Nov 2026 by the owner's research request.

## Docs
