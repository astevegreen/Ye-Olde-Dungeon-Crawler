---
name: sprint-lane
description: Coordinator for one lane of the YODC sprint. Run only as /sprint-lane <lane>, from a session the sprint supervisor started.
disable-model-invocation: true
argument-hint: "<story|lore|ux|fixes|tooling>"
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
You coordinate lane `$ARGUMENTS` of the sprint in `docs/sprint.md`; read it first. You never edit files, commit,
push or make design decisions. You hand each task to subagents, one at a time, and keep only their hand-back
blocks. `W` is the lane's worktree from the Lanes table. Start every comment you write with "Lane:" (`Q move`
writes its own that way). Write `W`'s full path in every command; never store it
in a shell variable (`W=…; git -C $W`): the guard can't read variables and refuses them as the main checkout.

**The queue.** `Q` below is `node C:/Antigravity/YODC/scripts/sprint/queue.mjs`: write it out in full, on a
line of its own (the guard refuses it chained, piped or redirected). It holds the lane's rules (which issue is
ready, whose comment counts as the owner's, when held work is retried, what a stopped session left) and prints
one line of JSON. When it prints `error`, do what its `do` line says; when it fails any other way, stop and
report its output on issue #19. The queue rules live only there: never work them out by hand.

Run the `implementer` and the `reviewer` with model `opus` and `run_in_background: false` every time. A
session waiting on a background agent looks finished to the supervisor, which would start a second one in `W`.
Before every task, stop if:
- `Q window` prints a `phase` other than `open`
- any subagent reported a usage-limit error
- you have run 6 tasks this session (the supervisor starts a fresh session when you stop)

## 0. Worktree
If `W` does not exist: `git worktree add --detach W origin/main`, then `npm ci` in `W`. If it exists, run
`git -C W rebase --abort` and `git -C W cherry-pick --abort` (ignore "no ... in progress"); the implementer
resets it per task.

## 1. Next task
`Q next $ARGUMENTS --taken <every issue you took this session, comma-separated>` (no `--taken` the first
time). `null`: nothing is left; stop. Otherwise it prints the task's `issue` (`n` below), `mode`, `concerns`
and `reason`:
- `build`: `Q move <n> in-progress`, then run the implementer with "Mode: issue. Issue: <n>. Worktree: W."
- `fix`: `Q move <n> in-progress`, then run the implementer with "Mode: fix. Issue: <n>. Worktree: W.
  Concerns: <concerns>". When its `reason` says the machine failed it, the concerns are that failure, and the
  fix is to run the gates again on the quieter machine.
- `resume`: a stopped session built it; its branch holds the commits. Go straight to 2.1's reviewer run,
  unless `git -C W stash list` has an entry `On sprint/<n>:`: the session also left unfinished work, so run
  the implementer as for `build`, which restores it.

**Wake.** Each time you take an issue, whatever its mode, before the implementer or the reviewer runs:
`get_session` with no id (load it and `update_trigger` with ToolSearch), then
`Q wake --resets-at <its external_metadata.rate_limit_info.resetsAt>`, or `Q wake` alone when it has none.
`"arm": true`: `update_trigger` the `wake` id it prints with run_once_at its `at` and enabled `true`, so
that if a usage limit stops this session, a supervisor restarts the lanes 2 minutes after the reset.
Otherwise, or when the update is refused, keep its `reason` (or the refusal) as one line for step 3 and go on.

## 2. Review and hand over
1. STATUS DONE (or `resume`): run the reviewer with "Issue <n>, branch sprint/<n>."
   CONCERNS: send them to the implementer that built it, with `SendMessage` (load it with ToolSearch) to the
   agent ID its run returned: "Mode: fix. Concerns: <list>". It still holds the spec and its own work. If the
   message fails, or the reply shows it has lost the task (it asks which issue, or starts again from the
   spec), run a fresh implementer with "Mode: fix. Issue: <n>. Worktree: W. Concerns: <list>"; after a
   `resume` there is no builder to message, so start that fresh one at once. Then the reviewer again.
2. Final PASS, or only `[minor]` concerns left: `Q move <n> to-integrate --note '<WHAT CHANGED and
   PLAYER-VISIBLE lines from the hand-back>\nMinor, shipped: <each minor concern>'` (no "Minor" line after a
   PASS). A minor concern that is real work (a missing test, a known gap) also gets a follow-up issue,
   `gh issue create --title "[task] <ID>-follow: <what>" --label lane:$ARGUMENTS --label sprint-ready`, its body
   the concern with its file:line, the line `Depends on: #<n>.` and #<n>'s `Requested:` trailer; name it in the
   note.
   A `[blocker]` left: `Q move <n> held --note '<the blocker concerns, each with its [blocker] tag>'`. Only a
   blocker holds work.
   Write the note in single quotes, a line break as `\n`, and ’ for an apostrophe.
3. BLOCKED (a design question, with a recommendation, is on the issue; the supervisor's daily digest asks the
   owner, and you go on to other work): `Q move <n> blocked`. GATE-FAILED: `Q move <n> held`. The implementer
   has already commented why; when it has already moved the issue, the move changes nothing.
Then step 1 again.

## 3. Report
When you stop, comment once on issue #19 "Sprint log", under 15 lines: the lane, the time, one line per task
(#issue: to-integrate, held or blocked), why you stopped, and one line for each wake you could not arm. Design
questions reach the owner in the daily digest, never here.
Then, if you finished at least one task this session and did not stop on a usage limit or an error,
`RemoteTrigger` `run` the `supervisor` id `Q window` prints (load RemoteTrigger with ToolSearch): it starts the
integrator for your work, and a fresh session for this lane when work is left, now rather than at the next hour.
