@ARCHITECTURE.md

# CLAUDE.md — Project Operating Instructions

## Sessions
- One task per session. When a task is committed and leaves open questions, or the session has run long, write the handoff (`/handoff`) without asking; when the next request is unrelated, offer it. Suggest `/clear` only after the note is published; the owner then `/clear`s and resumes.
- When compacting, keep word for word: the owner's request as it will be quoted in `Requested:`, the task, the files changed, and each check run with its result.
- Delegate reading to the project agents; the main session reads only the files it changes.
  - `scout`: "where is X / what calls Y", answered as `path:line`. "How does X work" goes to Explore.
  - `visual-check`: captures before and after a presentation change and returns a verdict with image paths. Open an image only when the owner needs to see it.
  - `log-analyst`: soak, balance and test output past a few hundred lines, returned as counts, top findings and anomalies.

## Verification
- While iterating, run only the relevant tests: `npx vitest run <file>`.
- Before committing, run `npm run gate-stamp -- run lint test tooling`: lint (`tsc` over `src/` and `e2e/`, the `check:*` scripts, `knip`), the unit tests, and the tooling tests unless the tooling is unchanged since they last passed. The pre-commit hook then skips all three on the identical tree; a bare `npm run lint` or `npm test` writes no stamp.
- Run `npm run sim`, `npm run validate:schema` and `npm run build` when the change reaches them.
- A commit that touches presentation runs `npm run gates` first: all of the above, then Playwright in Chromium. The push runs all three browsers, but Chromium before the commit has caught regressions the unit tests missed.
- CSS or layout changed: `visual-check` captures the HUD before and after (`scripts/capture/menus.mjs 1366 g00`); menu screenshots hide the HUD behind the scrim.
- Report real output, pasted. A change that "should" pass has not passed.

## Commits
- A subject line, at most three lines of why, and a `Requested: "<the owner's words>"` trailer. The diff says what changed.
- One request per commit.
- A §8.1 protected file needs `§8.1 exception N` in the message; prefer a fix outside it. On `engine.ts` and `actionPipeline.ts`, exceptions 4 and 5 state the change on their line, and the reviewer's PASS and a second-look `ship` stand in for the owner's words; on `migrator.ts`, exception 4 comes only from the owner's own words in the task.

## Pushing
- Before pushing a change players will see, or any change under `src/engine/`: run the `reviewer` agent with "Request: <the owner's words>. Range: origin/main..HEAD". Fix its blockers once and run it again; list any minor concerns left in the summary. Docs, tooling and test-only changes skip it.
- With the reviewer's first run, start `node scripts/second-look.mjs "<the owner's words>"` in the background: another model reviews the same change through agy, picked by what the change touches. A change that touches a rail (hooks, guards, gates, git hooks, CI, `.claude/settings*.json`, the push lock; the script lists them) runs it even when the reviewer is skipped, with `--rails-only` for a tooling change; the rail audit, a deep review, asks whether the change loosens a check. The script ends `Verdict: <v>: <why>`:
  - `ship`: push. Notes never hold it.
  - `fix`: a `[blocker]` holds the push like a reviewer blocker. Check it against the code, fix it with the reviewer's, and run the script again. A blocker you judge wrong goes to the reviewer with your reason; only its agreement, named in the summary, lets the push go.
  - `owner`: the change loosens a rail. Push only after the owner says yes to that loosening, quoting the audit's reason; a loosening the owner asked for in their own words is that yes.
  - `retry`: a review did not run (no model answered, git failed, or a rail audit came from a model other than Argon, Opus or Flash), a machine failure. Run it again later; nothing is pushed on a review that did not run, and the owner is not asked.
- Push each finished task without asking, once all its commits are in: `git push`, run in the background (the pre-push hook runs the sim, the build and Playwright in three browsers).
- A push deploys the Pages site, which other people play, unless it changes only docs, tooling or tests (`scripts/lib/deploy-scope.mjs`; the gates still run). The task's summary lists, one line each, what players will see change, or says "nothing player-visible".
- Pre-push red: rerun once, since flakes are known. Red again on time-outs alone, a loaded host: push again once the host is quiet (no soak or sprint gate running), without asking. Red again otherwise: leave the commits unpushed and report the failure.
- Push landed: run `npm run ci:watch` in the background. It waits for GitHub's deploy and browser runs, which run on Linux and can fail where the Windows hooks pass. Red: the site stays on the last green deploy, so read the failed log it names, fix, and push again.
- A pull request's SonarCloud findings: `npm run sonar -- <pr>`. The project's open backlog on `main`: `npm run sonar:issues` (blocker and critical) or `npm run sonar:issues -- --files <path>...` (any severity in the files the task touches), read-only on the public API. Never hand-write `gh api` loops for SonarCloud findings, `curl` sonarcloud.io or handle a SonarCloud token; findings past GitHub's limit are the owner's to read, signed in. Issues outside the task's files are not fixed unless the owner asks.
- Ask first for force-pushes, history rewrites, deleting a branch or tag, and skipping hooks. The ask is two lines: why it isn't automatic, and what you recommend. Pruning merged local branches and stale worktrees needs no ask.

## What waits on the owner (28 Oct 2026)
- The owner decides product and design (game rules, balance, new mechanics, the save format in `migrator.ts`, scope); money, identity and the outside world (billing, secrets, the gh account, repo visibility, GitHub settings and rulesets, the sprint cue); and destruction (force-push, history rewrites, deleting branches or data). Ask each as one question, with a recommendation, and wait for the answer.
- Automation decides the rest: CI, the reviewer and agy's second look, with `git revert` as the safety net. Edits to skills, agents, rules, `CLAUDE.md`, `ARCHITECTURE.md`, docs, `package.json` and configs need no yes from the owner; a change touching a rail gets the rail audit (Pushing).
- Technical questions are never asked: how to build or structure it, APIs, tooling, tests, naming, placement, performance, refactors, architecture-doc updates. Decide them as the architect, on Opus, record `Decision (architect): …` on the issue when there is one, and go on.
- The owner reads neither the code, the docs nor the ADRs. Explain each decision in chat, in plain terms: what changes for the player or the workflow, and why.

## Model and effort
- Opus for design, debugging and engine work; Sonnet 5.5 for routine content, tuning, and UI changes with a clear spec. When the task changes kind, suggest a switch.

## Tooling gotchas
- Escaping: bash heredocs, `node -e` and template literals nested in an edit script mangle backticks and `${…}`. Write code to its own file with the Write tool, or use the Edit tool.
- Inline styles (static markup in `index.html`, `el.style.x = …`) beat stylesheet rules: remove the inline style instead of adding `!important`.
- knip fails on unused exports: delete what a refactor orphans.
- `git rm` stages at once, so a later `git add X && git commit` takes the deletion with it. Delete with plain `rm` and stage per commit.
- Python: `python` or `py` (`py -0p` lists the versions); `python3` is the Microsoft Store stub and fails.
- `.claude/settings.json` denies reading `dist/`, `test-results/`, `playwright-report/` and `*.log`: capture command output to a `.txt`. A hook refuses Read, Grep and Glob on `package-lock.json`; Bash commands may name it.
- A visible label changed: grep `e2e/` and `scripts/capture/` for the old text. Capture scripts click through `scripts/capture/play.mjs` (`startRun`, `button`, case-insensitive); use those, not new hard-coded matches.
