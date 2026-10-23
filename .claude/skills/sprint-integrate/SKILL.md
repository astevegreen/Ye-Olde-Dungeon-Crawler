---
name: sprint-integrate
description: The YODC sprint's single integrator. Lands reviewed sprint branches on main, up to three per push, pushes, watches CI. Run only as /sprint-integrate, from a session the sprint supervisor started.
disable-model-invocation: true
model: sonnet
hooks:
  PreToolUse:
    - matcher: "Bash|PowerShell"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/.claude/hooks/sprint-guard.mjs" --integrator
          timeout: 10
---
You land reviewed work from the sprint in `docs/sprint.md`, up to three tasks per push, each as its own commits.
You never edit files or fix code: a task that does not land cleanly goes back to its lane. `I` is
`C:/Antigravity/YODC-integrate`. Run every git command as `git -C I ...` and every npm command as
`cd I && npm ...`, with `I`'s full path written out each time; never store it in a shell variable: the guard
can't read variables and refuses them as the main checkout. Start every comment you write with "Integrator:".

Stop when `date -u +%Y%m%dT%H%M` is outside the window on the `Window (UTC)` line of `docs/sprint.md`, when no open issue has
`to-integrate`, after 15 pushes this session, or after a usage-limit error.

## 0. Before anything
- If `I` does not exist: `git worktree add --detach I origin/main`, then `npm ci` in `I`.
- Clear any half-finished git operation a stopped session left: run `git -C I cherry-pick --abort`,
  `git -C I revert --abort` and `git -C I rebase --abort`, each on its own, ignoring "no ... in progress".
- `gh run list --workflow deploy.yml --branch main --limit 1 --json conclusion,status,headSha,url`. If it is
  completed with conclusion `failure` and its `headSha` is `git -C I rev-parse origin/main` (a later push
  with no run of its own is not red), main is red: comment on issue #19 "Integrator: main is red at <headSha>
  (<url>); integration paused." (once; skip if your previous comment there says the same) and stop. Another
  session or the owner fixes main first.

## 1. Land a batch
`gh issue list --state open --label to-integrate --json number,title,labels,comments`. The batch is the three
lowest numbers; after a red gate (1.3) or a red deploy (step 2), it is one issue at a time until every issue of
that batch has landed or gone back. For each issue, `B` is `sprint/<n>`.
1. `git -C I fetch origin`, then `git -C I switch --detach --discard-changes origin/main`.
   `pre` is `git -C I rev-parse HEAD`: the batch's start.
2. For each issue, in order (one that goes back leaves the rest to go on):
   1. `git -C I merge-base origin/main B` is `base`. `git -C I rev-list --count <base>..B` must be above 0;
      if it is 0, send it back (step 3) with "branch B has no commits ahead of main".
   2. Check what it brings: `git -C I diff --name-only <base>..B` must not match a locked path from
      `docs/sprint.md` ("What still stops a task"), and every commit in `git -C I log --format=%B <base>..B`
      must carry a `Requested: ` line. Either fails: send it back with `blocked` instead of `held`.
   3. Note `git -C I rev-parse HEAD` as `p`, then `git -C I cherry-pick <base>..B`. A conflict:
      `git -C I cherry-pick --abort`, then send it back with "conflicts with main in <files>; rebase B with
      `git rebase --reapply-cherry-picks origin/main`". After the pick, `git -C I rev-parse HEAD` must differ
      from `p`; if not, send it back as above.
3. `cd I && npm run gate-stamp -- run lint test tooling`. Red only by a timeout ("Test timed out", "Hook timed
   out"): run it once more, since a soak may be loading the computer. Red otherwise, or red again: with one
   issue in the batch, send it back with the first failing lines; with more,
   `git -C I switch --detach --discard-changes origin/main` and land them one at a time from 1.1.
4. Push with `run_in_background: true`: `git -C C:/Antigravity/YODC-integrate push origin HEAD:main`, and wait
   for its notification. The pre-push hook runs the sim, the build and Playwright in three browsers; with the
   lanes running it can take over ten minutes. Rejected because `origin/main` moved: go back to 1.1, once.
   Red: push once more (flakes are known). Red again: as a red gate in 1.3, with the failing test names.
5. Start `cd I && npm run ci:watch -- <pushed sha>` (timeout 600000) with `run_in_background: true`. While it
   runs, you may prepare the next batch (1.1 to 1.3), but push nothing until this watch ends green. When it
   ends, read its output, not only its exit code:
   - `deploy.yml: success`: each issue of the pushed batch is done (step 4); then push the prepared batch (1.4).
   - `deploy.yml: failure ...`: revert (step 2).
   - anything else (no run found yet, still running, cancelled, a gh error): run it again, up to 3 times;
     then comment on issue #19 with its output and stop.

## 2. Revert a red deploy
CI runs on Linux and can fail where the Windows hooks pass; the site stays on the last green deploy, and every
later push would carry the failure. Drop any prepared batch: `git -C I switch --detach --discard-changes <pushed sha>`.
Revert only what this push added: `git -C I revert --no-commit <pre>..<pushed sha>`,
then `git -C I commit -m "revert(sprint): <IDs> failed CI on Linux" -m "<failing job and step, one line>" -m "Requested: \"I approve your recommendation for pushes\" (sprint integrator)"`
(add `-m "§8.1 exception 1: revert of a change that fails CI"` when a protected file is in the diff). Push as
in 1.4 and watch as in 1.5, in the foreground. If the revert's CI is red too, comment on issue #19
"Integrator: main is red after <sha>; integration paused." and stop.
A batch of one: send it back with the CI failure and the words "main now holds this task plus its revert;
rebase with `git rebase --reapply-cherry-picks origin/main`". A bigger batch: land its issues again one at a
time (its branches are unchanged, so each picks cleanly onto main); the one whose deploy goes red alone is sent
back that way.

## 3. Send it back
Comment first: "Integrator: <why, one or two lines>". Then, if an earlier comment on this issue already starts
"Integrator:" and sent it back, this is the second time: `gh issue edit <n> --add-label blocked
--remove-label to-integrate` (the owner looks at it). Otherwise `gh issue edit <n> --add-label held
--remove-label to-integrate`; the lane's next session fixes it on `B`.

## 4. Done
For each issue of the batch: `gh issue close <n> --comment "Integrator: landed <sha>. Players will see: <the lane's PLAYER-VISIBLE lines>."`
Then one line per issue on issue #19 "Sprint log": `<sha> <ID> <title>: <player-visible line or "nothing player-visible">`.
Go back to step 1.

When you stop, comment once on issue #19 "Sprint log": pushes made, tasks sent back and why, and why you
stopped. Under 10 lines.
