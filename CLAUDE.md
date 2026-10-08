@ARCHITECTURE.md

# CLAUDE.md — Project Operating Instructions

## Sessions
- One task per session. When a task is committed and leaves open questions, or the session has run long, write the handoff (`/handoff`) without asking; when the next request is unrelated, offer it. The owner then `/clear`s and resumes.
- Delegate reading to the project agents; the main session reads only the files it changes.
  - `scout`: "where is X / what calls Y", answered as `path:line`. "How does X work" goes to Explore.
  - `visual-check`: captures before and after a presentation change and returns a verdict with image paths. Open an image only when the owner needs to see it.
  - `log-analyst`: soak, balance and test output past a few hundred lines, returned as counts, top findings and anomalies.

## Verification
- While iterating, run only the relevant tests: `npx vitest run <file>`.
- Before committing, run `npm run gate-stamp -- run lint test`: lint (`tsc` over `src/` and `e2e/`, the `check:*` scripts, `knip`) and the full suite. The pre-commit hook then skips both on the identical tree; a bare `npm run lint` or `npm test` writes no stamp.
- Run `npm run sim`, `npm run validate:schema` and `npm run build` when the change reaches them.
- A commit that touches presentation runs `npm run gates` first: all of the above, then Playwright in Chromium. The push runs all three browsers, but Chromium before the commit has caught regressions the unit tests missed.
- CSS or layout changed: `visual-check` captures the HUD before and after (`scripts/capture/menus.mjs 1366 g00`); menu screenshots hide the HUD behind the scrim.
- Report real output, pasted. A change that "should" pass has not passed.

## Commits
- A subject line, at most three lines of why, and a `Requested: "<the owner's words>"` trailer. The diff says what changed.
- One request per commit.
- A §8.1 protected file needs `§8.1 exception N` in the message; prefer a fix outside it. Exception 4 comes only from the owner's own words in the task.

## Working with the owner
- The owner reads neither the code, the docs nor the ADRs. Explain each decision in chat, in plain terms: what changes for the player or the workflow, and why.
- Product decisions (balance feel, save breaks, scope) are the owner's: ask them as questions, with a recommendation, and wait for the answer.

## Model and effort
- Opus for design, debugging and engine work; Sonnet 5.5 for routine content, tuning, and UI changes with a clear spec. When the task changes kind, suggest a switch.

## Tooling gotchas
- Escaping: bash heredocs, `node -e` and template literals nested in an edit script mangle backticks and `${…}`. Write code to its own file with the Write tool, or use the Edit tool.
- Inline styles (static markup in `index.html`, `el.style.x = …`) beat stylesheet rules: remove the inline style instead of adding `!important`.
- knip fails on unused exports: delete what a refactor orphans.
- `git rm` stages at once, so a later `git add X && git commit` takes the deletion with it. Delete with plain `rm` and stage per commit.
- Python: `python` or `py` (`py -0p` lists the versions); `python3` is the Microsoft Store stub and fails.
- `.claude/settings.json` denies reading `dist/`, `test-results/`, `playwright-report/` and `*.log`: capture command output to a `.txt`.
- A visible label changed: grep `e2e/` and `scripts/capture/` for the old text. Capture scripts click through `scripts/capture/play.mjs` (`startRun`, `button`, case-insensitive); use those, not new hard-coded matches.
