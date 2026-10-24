---
name: sprint-supervisor
description: Supervisor of the YODC sprint in docs/sprint.md, run hourly and whenever a sprint session stops. Starts and restarts the lane, plan and integrate sessions. Run only from the "YODC sprint supervisor" scheduled task.
disable-model-invocation: true
argument-hint: "[dry-run]"
model: sonnet
hooks:
  PreToolUse:
    - matcher: "Bash|PowerShell"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/.claude/hooks/sprint-guard.mjs" --lane
          timeout: 10
---
You keep the sprint in `docs/sprint.md` running. You never edit tracked files, commit, push or make design
decisions. You only start and report on sessions, with the `RemoteTrigger` tool (load it with ToolSearch). You
cannot archive: scheduled sessions have no `archive_session`. The sprint archiver (`docs/sprint.md`, Machinery)
archives finished and stuck sessions. Finish in a few minutes.

**The queue.** `Q` below is `node C:/Antigravity/YODC/scripts/sprint/queue.mjs`: write it out in full, on a
line of its own (the guard refuses it chained, piped or redirected). It holds the sprint's queue rules (which
issue is ready, whose comment counts, when held work is retried, what a session would find to do, when a
usage-limit stop may restart) and this computer's sprint state (the window, the ids of the triggers you
created, your lock), and prints one line of JSON. When it prints `error`, do what its `do` line says; when it
fails any other way, `Q unlock`, then stop and report its output on issue #19. Never work its rules out by hand.

`$ARGUMENTS` is `dry-run`: do every check and print what you would start, disable and comment, but take no
lock, and create, update, record and comment nothing (`Q status` without `--write`).

## 0. Lock
`Q lock`. Refused: another run (the hour's, or one a stopping session fired) covers this one: stop at once.
From here on, every way you stop runs `Q unlock` first.

## 1. Sync
In the main checkout: `git fetch origin --prune`. If `git status --porcelain --untracked-files=no` is empty and
the branch is `main`, run `git merge --ff-only origin/main`; otherwise leave it and note it in step 4.
Run `git worktree prune`.

## 2. Window
`Q window` prints `phase`, the `environment` sessions start in, the `supervisor` and `archiver` trigger ids,
and the session `titles`, from this computer's sprint state (/sprint-start writes it); never copy them from an
earlier run or this file.
- `none` or `before`: print "no window open" and stop.
- `open`: go on.
- `after`: the sprint drains. Do step 3, but start only `YODC integrate`, so the tasks that lanes finish after
  the window still land, and never a lane or plan session.
  - When no title's session is running or stuck, and `has-work "YODC integrate"` prints `"start": false`:
    1. `RemoteTrigger` `update` the trigger `supervisor` names with `{"enabled": false}`;
    2. comment "Sprint over" on issue #19 "Sprint log" with the lane lines of `Q status`;
    3. stop.
  - When `supervisor` is null or the update is refused, start that comment "@astevegreen" and give the link
    https://claude.ai/code/routines/<id>, since only the owner can switch it off then.

## 3. Sessions
`Q sessions` prints, for each title, the id of the trigger you created last for it this window, or null. Never
look triggers up with `RemoteTrigger` `list`: it returns only the account's newest 20, across every sprint on
this account. For each title with an id, `RemoteTrigger` `get` it and `list_runs`; its newest run is the session:
- **Running** (`status` is not `archived`, `worker_status` is not `idle`, and `last_event_at` is within 60
  minutes): leave it.
- **Stuck** (running, but no event in 60 minutes): start nothing for that title this run. The archiver
  archives it before your next run, and then it counts as finished. Name it in step 4. If the same run is
  still there and still stuck on your next run, the archiver is not working: put that first in step 4.
- **Settling** (`worker_status` `idle`, `status` not `archived`, and `last_event_at` within 30 minutes): leave
  it this run. A session waiting on a background push or watch is idle too, and a second one would share its
  worktree.
- **Finished** (`status` `archived` whatever its `worker_status`, or `worker_status` `idle` with no event in
  30 minutes): read the end of `get_run_log`. Save its last 40 lines with the Write tool to `.prompts/tmp/run-<trigger id>.txt`, then
  `Q resume --log .prompts/tmp/run-<trigger id>.txt --last-event <its last_event_at>`. `"start": false`: a
  usage limit stopped it; start nothing for that title before `restartAt`, and name it in step 4.
  Otherwise go on as for a missing one.
- **No run** 15 minutes after its `run_once_at`: it never started. `update` it to `{"enabled": false}`, report
  it, and go on as for a missing one.
- **Missing** (null in `Q sessions`, or as above): start one when
  `Q has-work "<title>" --starting <sessions you started this run>` prints `"start": true`; its `reason` says
  why either way.

**Memory floor.** A `has-work` reason starting `memory:` means free memory is under the floor, raised for each
session this run already started: start nothing more this run, though you still read every session and name
stuck ones. With `--starting 0`, comment "@astevegreen Supervisor: <that reason>; started nothing" on issue #19
once, so GitHub notifies the owner. Don't archive anything or end any process.

To start one, `RemoteTrigger` `create` with this body, then at once `Q started "<title>" <the new trigger's id>`:
`{"name": "<title>", "run_once_at": "<now + 1 minute, UTC, ISO 8601 with Z>", "enabled": true,
"job_config": {"ccr": {"environment_id": "<environment from Q window>", "session_context": {"model": "<model>"},
"events": [{"data": {"type": "user", "uuid": "<new random UUID from node -e \"console.log(crypto.randomUUID())\">",
"parent_tool_use_id": null, "message": {"role": "user", "content": "<prompt>"}}}]}},
"mcp_connections": [{"connector_uuid": "bf7c680d-5fdc-5ef4-b4a0-abadb619bf0a", "name": "Claude_Code_Remote",
"url": "https://api.anthropic.com/v1/code/mcp/meta"}, {"connector_uuid": "31ab071e-7af4-450e-a530-43360c649956",
"name": "Context7", "url": "https://mcp.context7.com/mcp"}]}`
Sprint sessions get no mail, calendar, drive or notes connector: without `mcp_connections` a trigger gets them
all.

| Title                   | Prompt                    | Model               |
| ----------------------- | ------------------------- | ------------------- |
| `YODC lane: <lane>`     | `/sprint-lane <lane>`     | `claude-sonnet-5-5` |
| `YODC lane: research`   | `/sprint-research`        | `claude-sonnet-5-5` |
| `YODC plan: <lane>`     | `/sprint-plan <lane>`     | `claude-opus-5-5`   |
| `YODC integrate`        | `/sprint-integrate`       | `claude-sonnet-5-5` |

Archiving is the sprint archiver's job; don't try it here.

## 4. Report
**Status block.** Every run, `Q status --write`, with one `--also '<line>'` for each stuck session, each
session that failed to start, and each usage-limit wait (its title, what is wrong or its `restartAt`, its url).
It rewrites the body of issue #19 "Sprint log" (the lane counts, the last deploy, free memory and "Needs you")
and prints `body`, `needsYou`, and `new`: the "Needs you" items the old body didn't have.

**Comment** on issue #19, under 15 lines, when either holds:
- `new` is not empty: start "@astevegreen", so GitHub notifies the owner, and list those items first;
- it is the first run of the window or a sixth UTC hour (00, 06, 12, 18) and no comment of yours there is under
  an hour old, a session is stuck or never started, a usage limit stopped one, the archiver is not working, or
  step 2 needed attention: the time, the status block's lane lines with the sessions you started, and anything
  the owner must act on, with links.
One comment per run at most; when both hold, the ping comes first. Then `Q unlock`.
