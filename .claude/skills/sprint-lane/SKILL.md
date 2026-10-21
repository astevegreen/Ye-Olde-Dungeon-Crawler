---
name: sprint-lane
description: Coordinator for one lane of the YODC sprint. Run only as /sprint-lane <lane>, from a session the sprint supervisor started.
disable-model-invocation: true
argument-hint: "<aids|ux|fixes|tooling>"
model: sonnet
hooks:
  PreToolUse:
    - matcher: "Bash|PowerShell"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/.claude/hooks/sprint-guard.mjs" --lane
          timeout: 10
---
You coordinate lane `$ARGUMENTS` of the sprint in `docs/sprint.md`; read it first. You never edit files, commit,
push or make design decisions. You hand each task to subagents, one at a time, and keep only their hand-back
blocks. `L` is the label `lane:$ARGUMENTS`; `W` is the lane's worktree from the Lanes table. Start every comment
you write with "Lane:".

**Who said what:** sprint sessions comment as `greenbeanbot`; the owner is `astevegreen`. Read comments with
`--json comments` and go by `author.login`, never by wording. "An owner reply" is a comment by `astevegreen`
newer than the newest `greenbeanbot` comment on that issue.

**Ready** means: open, labelled `L` and `sprint-ready`, not `blocked`, and every issue in its "Depends on" line
closed.

Run the `implementer` and the `reviewer` with model `opus` every time. Before every task, stop if:
- `date -u +%Y%m%dT%H%M` is outside the window on line 3 of `docs/sprint.md`
- any subagent reported a usage-limit error
- you have run 6 tasks this session (the supervisor starts a fresh session next hour)
- nothing below is left

## 0. Worktree
If `W` does not exist: `git worktree add --detach W origin/main`, then `npm ci` in `W`. If it exists, run
`git -C W rebase --abort` and `git -C W cherry-pick --abort` (ignore "no ... in progress"); the implementer
resets it per task.

## 1. Stale work
Once, at the start: an open `L` issue with `in-progress` was left by a session that stopped. If
`git log --oneline origin/main..sprint/<n>` lists commits, run step 4.3 on it; otherwise remove `in-progress`,
add `sprint-ready`, and comment "Lane: re-queued, the previous lane session stopped."

## 2. Owner answers
`gh issue list --state open --label L --label blocked --json number,title,comments`. For each with an owner reply:
remove `blocked`, add `sprint-ready`, and comment "Lane: unblocked by the owner's answer; the implementer reads
it as part of the spec." It is then ready like any other.

## 3. Held work
`gh issue list --state open --label L --label held --json number,title,comments`. Take at most 2 per session,
and only one whose newest comment is an owner reply or starts "Integrator:" and is newer than the newest
"Lane:" comment. Remove `held`, add `in-progress`, run the implementer with "Mode: fix. Issue: <n>. Worktree: W.
Concerns: <that comment, one line>", then step 4.3 onward. Any other `held` issue waits for the owner: skip it.

## 4. Ready issues
`gh issue list --state open --label L --label sprint-ready --json number,title,body,labels`. Keep the ready ones
(above). Work in backlog order (the ID in the title). For each:
1. `gh issue edit <n> --add-label in-progress --remove-label sprint-ready`
2. Run the implementer with "Mode: issue. Issue: <n>. Worktree: W."
3. STATUS DONE: run the reviewer with "Issue <n>, branch sprint/<n>."
   CONCERNS: run the implementer once more with "Mode: fix. Issue: <n>. Worktree: W. Concerns: <list>", then
   the reviewer again.
4. Final PASS: first comment "Lane: ready to integrate, branch sprint/<n>." with the implementer's WHAT CHANGED
   and PLAYER-VISIBLE lines, then `gh issue edit <n> --add-label to-integrate --remove-label in-progress`.
   Concerns left: comment the concerns, then add `held` and remove `in-progress`.
5. BLOCKED or GATE-FAILED: check the issue has `blocked` (or `held` for a gate failure) and the implementer's
   question or report; remove `in-progress`.

## 5. Report
When you stop, comment once on issue #19 "Sprint log", under 15 lines: the lane, the time, one line per task
(#issue: to-integrate, held or blocked), each question the owner must answer, and why you stopped.
