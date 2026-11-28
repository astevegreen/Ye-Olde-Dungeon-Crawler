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

## Content (cotw pack)

## Presentation

## Tests, gates and tooling
- `.github/dependabot.yml:3-4` says security updates skip the cooldown; unverified, as docs.github.com was blocked
  in the cloud session that wrote it. [6 Nov 2026, toolchain upgrades handoff]
- A push that only deletes branches runs every pre-push gate, all three browsers included (`.githooks/pre-push:30`
  lets only `handoffs` pushes skip); a deletion carries no code. A rail change: it gets the rail audit.
  [7 Nov 2026, housekeeping]

- `.claude/settings.local.json` is tracked and still holds broad one-off grants (`npm run *`, `npx tsx *`, `npx tsc *`,
  awk and scratchpad lines); the auto-mode classifier refused the pruning as self-modification, so the owner or a
  rail-audited change should narrow it to the gate scripts, `npx vitest *`, `gh run *`, `git worktree *`,
  `git ls-remote *`. [7 Nov 2026, agent context batch B]
- Playwright: the gameplay specs that test logic only run in Chromium alone (`playwright.config.ts:63-70`, per-project
  `testMatch`), four named by the 6 Nov audit. Off the sprint (was K9): it drops Firefox and WebKit coverage, so the rail
  audit will likely say it loosens a gate. [27 Nov 2026, sprint planning-day pass]
- Soak-shaped unit tests (`src/engine/__tests__/chaosSimulation.test.ts` and its kind) move to the `tooling` Vitest
  project (`vite.config.ts:13-15`), so `npm test` stays fast. Off the sprint (was K10): the tooling project runs at
  commit only when tooling changed, which likely loosens a gate. [27 Nov 2026, sprint planning-day pass]
- The 19 hand-built fake DOMs in the UI tests could share happy-dom, a real DOM where the fakes miss `classList`,
  focus and events. Off the sprint (was K11): it is a new dev dependency, which the sprint forbids.
  [6 Nov 2026, test-suite audit]

## Docs
