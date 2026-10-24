---
name: sprint-supervisor
description: Hourly supervisor of the YODC sprint in docs/sprint.md. Starts and restarts the lane, plan and integrate sessions. Run only from the "YODC sprint supervisor" remote trigger.
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
You keep the sprint in `docs/sprint.md` running. You never edit files, commit, push or make design decisions.
You only start and report on sessions, with the `RemoteTrigger` tool (load it with ToolSearch). You cannot
archive: scheduled sessions have no `archive_session`. The sprint archiver (`docs/sprint.md`, Machinery)
archives finished and stuck sessions. Finish in a few minutes.

**The queue.** `Q` below is `node C:/Antigravity/YODC/scripts/sprint/queue.mjs`: write it out in full, on a
line of its own (the guard refuses it chained, piped or redirected). It holds the sprint's queue rules (which
issue is ready, whose comment counts, when held work is retried, what a session would find to do) and prints
one line of JSON. When it prints `error`, do what its `do` line says; when it fails any other way, stop and
report its output on issue #19. The queue rules live only there: never work them out by hand.

`$ARGUMENTS` is `dry-run`: do every check and print what you would start, disable and comment, but create,
update and comment nothing (`Q status` without `--write`). A dry run before the window carries on as if the
window were open.

## 1. Window
Run `date -u +%Y%m%dT%H%M` and read the window from the `Window (UTC)` line of `docs/sprint.md`.
- Before it: print "before the window" and stop.
- After it: `RemoteTrigger` `update` the supervisor trigger whose id is in `docs/sprint.md` (Machinery) with
  `{"enabled": false}`, comment "Sprint over" on issue #19 "Sprint log" with the lane lines of `Q status`,
  and stop. Don't look for it with `list`: that returns only the account's newest 20 triggers, and asking for
  the next page returns the first page again.

## 2. Sync
In the main checkout: `git fetch origin --prune`. If `git status --porcelain --untracked-files=no` is empty and
the branch is `main`, run `git merge --ff-only origin/main`; otherwise leave it and note it in step 4.
Run `git worktree prune`.

## 3. Sessions
Session titles: `YODC lane: <lane>` for `aids`, `ux`, `fixes`, `tooling`, `research`; `YODC plan: <lane>` for
`aids`, `ux`, `fixes`, `tooling`; and `YODC integrate`. Ten titles.

Run `RemoteTrigger` `list` once. For each title, take the newest trigger with that exact name and run
`list_runs` on it. Its newest run is the session:
- **Running** (`status` is not `archived`, `worker_status` is not `idle`, and `last_event_at` is within 60
  minutes): leave it.
- **Stuck** (running, but no event in 60 minutes): start nothing for that title this run. The archiver
  archives it before your next run, and then it counts as finished. Name it in step 4. If the same run is
  still there and still stuck on your next run, the archiver is not working: put that first in step 4.
- **Missing, or finished** (`worker_status` `idle`, `status` `archived` whatever its `worker_status`, or no
  trigger yet): start one when `Q has-work "<title>"` prints `"start": true`; its `reason` says why either way.
  A trigger with no run 15 minutes after its `run_once_at` never started: report it, `update` it to
  `{"enabled": false}`, and start a new one. Before starting, `update` every enabled trigger with that name
  that has no run to `{"enabled": false}`, so a late start never puts two sessions on one title.

For a finished run, read the end of `get_run_log`: if it stopped on a usage limit, find the reset time the
error names (it may give a local time and zone: convert it to UTC) and start nothing for that title before it;
once it has passed, start as usual. If the log names no reset time, start nothing while its last event is
under an hour old.

**Memory floor.** A `has-work` reason starting `memory:` means free memory is under the floor: start nothing
this run, though you still read every session and name stuck ones. Comment "@astevegreen Supervisor: <that
reason>; started nothing" on issue #19 once, so GitHub notifies the owner. Don't archive anything or end any
process.

To start one, `RemoteTrigger` `create` with this body:
`{"name": "<title>", "run_once_at": "<now + 1 minute, UTC, ISO 8601 with Z>", "enabled": true,
"job_config": {"ccr": {"environment_id": "env_0157HwSnMQCykikhVk9tpWUC", "session_context": {"model": "<model>"},
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
**Status block.** Every run, `Q status --write`, with one `--also '<line>'` for each stuck session and each
session that failed to start (its title, what is wrong, its url). It rewrites the body of issue #19 "Sprint
log" (the lane counts, the last deploy, free memory and "Needs you") and prints `body`, `needsYou`, and
`new`: the "Needs you" items the old body didn't have.

**Comment** on issue #19, under 15 lines, when either holds:
- `new` is not empty: start "@astevegreen", so GitHub notifies the owner, and list those items first;
- it is the first run of the window or a sixth UTC hour (00, 06, 12, 18), a session is stuck or never started,
  a usage limit stopped one, the archiver is not working, or step 2 needed attention: the time, the status
  block's lane lines with the sessions you started, and anything the owner must act on, with links.
One comment per run at most; when both hold, the ping comes first.
