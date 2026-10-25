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
    - matcher: "mcp__plugin_github_.*"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/.claude/hooks/sprint-guard.mjs" --lane
          timeout: 10
---
You run lane `research` of the sprint in `docs/sprint.md`; read it and `.claude/skills/soak/SKILL.md` first.
You never edit tracked files, commit or decide a rule. `R` is `C:/Antigravity/YODC-research`. A soak runs for
hours, longer than this session: you start it detached, record it, and a later session reads it. Only one soak
runs at a time (the same computer runs the lanes). Start every comment you write with
"Research:". Sprint sessions comment as `greenbeanbot`; go by `author.login`. A comment over one line goes
through a file: write it with the Write tool to `.prompts/tmp/`, then `gh issue comment <n> --body-file <file>`
(the guard reads every line of a command, so a report line such as `git push …` passed inline is refused).

**The queue.** `Q` below is `node C:/Antigravity/YODC/scripts/sprint/queue.mjs`: write it out in full, on a
line of its own (the guard refuses it chained, piped or redirected). It reads the `### research` list in
`docs/sprint.md`, each item's waits ("Waits for:" on its line and in its issue), your soak comments and the
soak's process, and prints the next job as one line of JSON. When it prints `error`, do what its `do` line
says; when it fails any other way, stop and report its output on issue #19. Never copy the list or work out a
wait by hand: on 22 Oct a copy fell 7 hours behind the second backlog.

The queue reads these comments word for word:
- "Research: started <ID> <folder> pid <pid> sha <origin/main sha> flags <flags>" when a soak starts;
- "Research: read <folder> …", the folder as its first word, once that soak is read;
- "Research: hunt candidates sha <sha>" when a hunt has its candidates.

Stop when `Q window` prints a `phase` other than `open`.

## 1. Next job
`Q next research`. `null`: stop. Otherwise it prints `mode`, `item`, `issue` and `reason`:
- `read`: the soak in `folder` has ended: step 3.
- `soak`: start `item`'s next soak: step 2. When `issue` is null, first create `[task] <item>: ...` with label
  `lane:research` and the item's backlog line as its Goal.
- `hunt`: step 4, on `issue`. When it is null, first create `[task] <item>: bug hunt since <since>` with label
  `lane:research`.
After each job, step 1 again.

## 2. Start a soak
The item's line in `docs/sprint.md` names its soaks (lens `player`, `--workers 2` unless it says otherwise);
the next is the first with no started comment. If every soak of the item is already read, write its report
instead (the end of step 3).
1. If `R` does not exist: `git worktree add --detach R origin/main`, then `cd R && npm ci`. Otherwise
   `git -C R fetch origin` and `git -C R switch --detach --discard-changes origin/main`.
2. `cd R && npm run build`.
3. The soak writes to `R/.prompts/soak/<lens>` (or `<lens>-floor<n>`) and appends to what is there. If that
   folder exists, it is an earlier item's: `mv` it to `R/.prompts/soak/<that item's ID>-<folder>` first (the
   ID is on the started comment that names it).
4. `--until` is local wall-clock time, 2 hours ahead unless the item's line says otherwise: `date -d '+2 hours' +%H:%M`.
   It never falls later than 90 minutes before the window's `end` (`Q window`), so a session can read the soak. Start the
   soak detached with the PowerShell tool, so it outlives this session:
   `Start-Process -WindowStyle Hidden -WorkingDirectory R -FilePath npm.cmd -ArgumentList 'run','soak','--','<flags>' -PassThru`
   with the flags the item's line names and that `--until`. Note the process id, and set its priority at once:
   `(Get-Process -Id <pid>).PriorityClass = 'BelowNormal'`. Processes the soak starts after that inherit it,
   so the lanes' tests on the same computer slow down less.
5. Comment the started line on the issue.

## 3. Read a finished soak
`cd R && npm run soak:report -- .prompts/soak/<folder>`. Hand anything over a few hundred lines to the
`log-analyst` agent. Then:
- each distinct bug (crash, softlock, oracle failure, wrong text) not already an open issue becomes an issue
  `[task] S<next free number>: <bug>` with labels `lane:fixes` and `sprint-ready` (permission 6). Its body
  follows the template in `.claude/skills/sprint-plan/SKILL.md`: the Goal holds the finding's signature, the
  seeds and the `repro` command; the acceptance criterion is a test that fails before the fix; the Trailer is
  the soak-finding `Requested:` line in `docs/sprint.md`, with `S<n>` for its ID;
- anything about balance or feel goes in the report as an option, never a task. Timings (turns, seconds,
  time-outs) were measured under load: the lanes build and test on the same computer, so say so beside them;
- the report covers what the item's line in `docs/sprint.md` names;
- comment the read line with the soak's findings, under 15 lines;
- `mv` the folder to `R/.prompts/soak/<ID>-<folder>`, so the next soak starts clean and a later item can
  compare with it.
When every soak of the item is read: comment the item's report, first line "Proposal, not a rule", under 40
lines, add `proposal`, and close the issue.

## 4. Bug hunt over the sprint's changes
The hunt runs beside a soak, in its own worktree `H`, `C:/Antigravity/YODC-research-hunt`, so the soak's build
in `R` stays untouched. It runs every 12 hours over what landed since the last hunt, each run its own issue;
the queue says when one is due and gives its `since` sha.
1. If `H` does not exist: `git worktree add --detach H origin/main`, then `cd H && npm ci`. Otherwise
   `git -C H fetch origin` and `git -C H switch --detach --discard-changes origin/main`. Note the sha.
2. A comment beginning "Research: hunt candidates" exists: take its list to 3. Otherwise hunt. List the commits
   with `git -C H log --reverse --format='%h %s' <since>..origin/main -- src/` and split them
   in three: those touching `src/engine/`, then those touching `src/content/`, then the rest. Dispatch one
   `general-purpose` agent per group in one message, with `model: "opus"`, read-only: it reads each commit
   (`git -C H show <sha>`) and the code around it in `H`, and returns candidate bugs, each as `path:line`, the
   inputs or state that trigger it, and the wrong outcome (crash, softlock, wrong state or text, a broken
   `ARCHITECTURE.md` invariant). The hunt is done when every listed commit was read by one agent. Comment
   the candidates line with the sha you noted, then one line per candidate.
3. Confirm each candidate with a failing test: a Vitest case in a new file `H/<dir>/__tests__/r6-<n>.test.ts`,
   run with `cd H && npx vitest run <file>`. Red for the predicted reason confirms it; green, or red for another
   reason, leaves it unconfirmed. Each confirmed bug not already an open issue becomes an issue as in step 3,
   its Goal holding the test's code, its Trailer the hunt-finding `Requested:` line in `docs/sprint.md`, with
   `S<n>` for its ID. Then delete the `r6-*.test.ts` files.
4. Comment the report, first line "Proposal, not a rule", under 40 lines: confirmed bugs with their issues,
   unconfirmed candidates in a line each, anything about balance or feel as an option. Add `proposal` and close
   the issue.

When you stop, one line on issue #19 "Sprint log".
