---
name: sprint-research
description: The YODC sprint's research lane. Runs soaks of today's build and a read-only bug hunt over the sprint's changes, and reports findings and options; changes no code. Run only as /sprint-research, from a session the sprint supervisor started.
disable-model-invocation: true
model: sonnet
hooks:
  PreToolUse:
    - matcher: "Bash|PowerShell"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/.claude/hooks/sprint-guard.mjs" --lane
          timeout: 10
---
You run lane `research` of the sprint in `docs/sprint.md`; read it and `.claude/skills/soak/SKILL.md` first.
You never edit tracked files, commit or decide a rule. `R` is `C:/Antigravity/YODC-research`. A soak runs for
hours, longer than this session: you start it detached, record it, and a later session reads it. Only one soak
runs at a time (the laptop also runs the lanes and Terminal Dusk). Start every comment you write with
"Research:". Sprint sessions comment as `greenbeanbot`; go by `author.login`.

Stop when `date -u +%Y%m%dT%H%M` is outside the window on line 3 of `docs/sprint.md`.

## 1. Find the research issue
R1–R3 are done. The open items, in order:

| ID | Waits for | Work (lens `player`, `--workers 2`) |
| -- | --------- | ----------------------------------- |
| R4 | every issue titled `[task] T5` closed | a soak from town, then one with `--start-floor 20` |
| R5 | the T6 and T7 issues closed | one soak from town, `--count 30`, `--until` 6 hours ahead |
| R6 | nothing | no soak: the bug hunt in step 5 |

Each item's issue is the one titled `[task] <ID>: ...` with label `lane:research`; create it when missing, with
the backlog line as its Goal. Take the first open soak item (R4, R5) whose wait is over. None: step 5.

An item may need several soaks (R4 names two: one after another). A **started** comment is one beginning
"Research: started"; it is **read** once a later comment beginning "Research: read" names its folder.

## 2. A soak already running?
Take the newest started comment, on any `lane:research` issue, that is not read. With PowerShell,
`Get-Process -Id <pid> -ErrorAction SilentlyContinue | Select-Object ProcessName,StartTime`: if it exists, is
named `cmd`, and started at or after the comment's time, the soak is still running: step 5. Otherwise it has
ended: go to step 4 with that folder and its item.

## 3. Start a soak
The item's next soak is the first of its soaks with no started comment.
1. If `R` does not exist: `git worktree add --detach R origin/main`, then `cd R && npm ci`. Otherwise
   `git -C R fetch origin` and `git -C R switch --detach --discard-changes origin/main`.
2. `cd R && npm run build`.
3. The soak writes to `R/.prompts/soak/<lens>` (or `<lens>-floor<n>`) and appends to what is there. If that
   folder exists, it is an earlier item's: `mv` it to `R/.prompts/soak/<that item's ID>-<folder>` first (the
   ID is on the started comment that names it).
4. `--until` is local wall-clock time, 2 hours ahead unless the table says otherwise: `date -d '+2 hours' +%H:%M`.
   It never falls later than 90 minutes before the window closes, so a session can read the soak; when that
   cap leaves under an hour, start no soak: step 5. Start the soak detached with the PowerShell tool, so it
   outlives this session:
   `Start-Process -WindowStyle Hidden -WorkingDirectory R -FilePath npm.cmd -ArgumentList 'run','soak','--','<flags>' -PassThru`
   with the flags the table names and that `--until`. Note the process id.
5. Comment on the issue "Research: started <ID> <folder> pid <pid> sha <origin/main sha> flags <flags>", then
   step 5.

## 4. Read a finished soak
`cd R && npm run soak:report -- .prompts/soak/<folder>`. Hand anything over a few hundred lines to the
`log-analyst` agent. Then:
- each distinct bug (crash, softlock, oracle failure, wrong text) not already an open issue becomes an issue
  `[task] S<next free number>: <bug>` with labels `lane:fixes` and `sprint-ready` (permission 6). Its body
  follows the template in `.claude/skills/sprint-plan/SKILL.md`: the Goal holds the finding's signature, the
  seeds and the `repro` command; the acceptance criterion is a test that fails before the fix; the Trailer is
  `Requested: "I approve your backlog proposal" (sprint S<n>, soak finding)`;
- anything about balance or feel goes in the report as an option, never a task;
- R4 reports each spell the bot knew and never cast, and each failed cast; R5 reports the turns per floor, the
  floor each hearth-cold stage arrives on, and the energy debt per floor, beside R3's numbers;
- comment "Research: read <folder>" with the soak's findings in under 15 lines;
- `mv` the folder to `R/.prompts/soak/<ID>-<folder>`, so the next soak starts clean and R5 can compare with
  `R3-<folder>`.
When every soak of the item is read: comment the item's report, first line "Proposal, not a rule", under 40
lines, add `proposal`, close the issue, and return to step 1. Otherwise go to step 3 for its next soak.

## 5. R6: bug hunt over the sprint's changes
R6 runs beside a soak, in its own worktree `H`, `C:/Antigravity/YODC-research-hunt`, so the soak's build in `R`
stays untouched. Its issue is closed: stop. Missing: create it as in step 1.
1. If `H` does not exist: `git worktree add --detach H origin/main`, then `cd H && npm ci`. Otherwise
   `git -C H fetch origin` and `git -C H switch --detach --discard-changes origin/main`. Note the sha.
2. A comment beginning "Research: R6 candidates" exists: take its list to 3. Otherwise hunt. List the commits
   with `git -C H log --reverse --format='%h %s' pre-sprint-2026-10-20..origin/main -- src/` and split them
   in three: those touching `src/engine/`, then those touching `src/content/`, then the rest. Dispatch one
   `general-purpose` agent per group in one message, with `model: "opus"`, read-only: it reads each commit
   (`git -C H show <sha>`) and the code around it in `H`, and returns candidate bugs, each as `path:line`, the
   inputs or state that trigger it, and the wrong outcome (crash, softlock, wrong state or text, a broken
   `ARCHITECTURE.md` invariant). The hunt is done when every listed commit was read by one agent. Comment
   "Research: R6 candidates sha <sha>", one line per candidate.
3. Confirm each candidate with a failing test: a Vitest case in a new file `H/<dir>/__tests__/r6-<n>.test.ts`,
   run with `cd H && npx vitest run <file>`. Red for the predicted reason confirms it; green, or red for another
   reason, leaves it unconfirmed. Each confirmed bug not already an open issue becomes an issue as in step 4,
   its Goal holding the test's code, its Trailer
   `Requested: "I approve the second backlog, all seven items." (sprint S<n>, R6 finding)` (permission 7).
   Then delete the `r6-*.test.ts` files.
4. Comment the report, first line "Proposal, not a rule", under 40 lines: confirmed bugs with their issues,
   unconfirmed candidates in a line each, anything about balance or feel as an option. Add `proposal` and close
   the issue.

When you stop, one line on issue #19 "Sprint log".
