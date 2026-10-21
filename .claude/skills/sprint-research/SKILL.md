---
name: sprint-research
description: The YODC sprint's research lane. Runs soaks of today's build and reports findings and options; changes no code. Run only as /sprint-research, from a session the sprint supervisor started.
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
For each research backlog ID in order (R1, R2, R3), the issue is the one titled `[task] <ID>: ...` with label
`lane:research`; create it when missing, with the backlog line as its Goal. Take the first open one whose
precondition holds (R2 waits until the M3–M6 issues are closed). None: stop.

An item may need several soaks (R1 names four floors: one soak per floor, one after another). A **started**
comment is one beginning "Research: started"; it is **read** once a later comment beginning "Research: read"
names its folder.

## 2. A soak already running?
Take the newest started comment that is not read. With PowerShell,
`Get-Process -Id <pid> -ErrorAction SilentlyContinue | Select-Object ProcessName,StartTime`: if it exists, is
named `cmd`, and started at or after the comment's time, the soak is still running: stop. Otherwise it has
ended: go to step 4 with that folder.

## 3. Start a soak
The item's next soak is the first of its floors (or its one run) with no started comment.
1. If `R` does not exist: `git worktree add --detach R origin/main`, then `cd R && npm ci`. Otherwise
   `git -C R fetch origin` and `git -C R switch --detach --discard-changes origin/main`.
2. `cd R && npm run build`.
3. The soak writes to `R/.prompts/soak/<lens>` (or `<lens>-floor<n>`) and appends to what is there. If that
   folder exists, it is an earlier item's: `mv` it to `R/.prompts/soak/<that item's ID>-<folder>` first (the
   ID is on the started comment that names it).
4. `--until` is local wall-clock time: `date -d '+2 hours' +%H:%M`. Start the soak detached with the PowerShell
   tool, so it outlives this session:
   `Start-Process -WindowStyle Hidden -WorkingDirectory R -FilePath npm.cmd -ArgumentList 'run','soak','--','<flags>' -PassThru`
   with `--workers 2`, the lens and `--start-floor` the item names, and that `--until`. Note the process id.
5. Comment on the issue "Research: started <ID> <folder> pid <pid> sha <origin/main sha> flags <flags>", and
   stop.

## 4. Read a finished soak
`cd R && npm run soak:report -- .prompts/soak/<folder>`. Hand anything over a few hundred lines to the
`log-analyst` agent. Then:
- each distinct bug (crash, softlock, oracle failure, wrong text) not already an open issue becomes an issue
  `[task] S<next free number>: <bug>` with labels `lane:fixes` and `sprint-ready` (permission 6). Its body
  follows the template in `.claude/skills/sprint-plan/SKILL.md`: the Goal holds the finding's signature, the
  seeds and the `repro` command; the acceptance criterion is a test that fails before the fix; the Trailer is
  `Requested: "I approve your backlog proposal" (sprint S<n>, soak finding)`;
- anything about balance or feel goes in the report as an option, never a task;
- comment "Research: read <folder>" with the floor's findings in under 15 lines;
- `mv` the folder to `R/.prompts/soak/<ID>-<folder>`, so the next soak starts clean and R2 can compare with
  `R1-<folder>`.
When every soak of the item is read: comment the item's report, first line "Proposal, not a rule", under 40
lines, add `proposal`, and close the issue. Otherwise go to step 3 for its next soak.

When you stop, one line on issue #19 "Sprint log".
