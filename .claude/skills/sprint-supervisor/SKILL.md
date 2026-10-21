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
You only start sessions and report on them, with the `RemoteTrigger` tool (load it with ToolSearch). Finish in
a few minutes.

`$ARGUMENTS` is `dry-run`: do every check and print what you would start, disable and comment, but create,
update and comment nothing.

## 1. Window
Run `date -u +%Y%m%dT%H%M` and read the window from line 3 of `docs/sprint.md`.
- Before it: print "before the window" and stop.
- After it: `RemoteTrigger` `list`, then `update` each enabled trigger whose name starts "YODC sprint supervisor"
  with `{"enabled": false}`, comment "Sprint over" on issue #19 "Sprint log" with one line per lane from
  step 4, and stop.

## 2. Sync
In the main checkout: `git fetch origin --prune`. If `git status --porcelain --untracked-files=no` is empty and
the branch is `main`, run `git merge --ff-only origin/main`; otherwise leave it and note it in step 5.
Run `git worktree prune`.

## 3. Sessions
Session titles: `YODC lane: <lane>` for `aids`, `ux`, `fixes`, `tooling`, `research`; `YODC plan: <lane>` for
`aids`, `ux`, `fixes`, `tooling`; and `YODC integrate`. Ten titles.

Run `RemoteTrigger` `list` once. For each title, take the newest trigger with that exact name and run
`list_runs` on it. Its newest run is the session:
- **Running** (`worker_status` is not `idle`, and `last_event_at` is within 3 hours): leave it.
- **Stuck** (running, but no event in 3 hours): start nothing for that title; name it in step 5 with its `url`
  so the owner can stop it.
- **Missing, or finished** (`worker_status` `idle`, or no trigger yet): start one if it has work (below).
  A trigger with no run 15 minutes after its `run_once_at` never started: report it, `update` it to
  `{"enabled": false}`, and start a new one. Before starting, `update` every enabled trigger with that name
  that has no run to `{"enabled": false}`, so a late start never puts two sessions on one title.

For a finished run, read the end of `get_run_log`: if it stopped on a usage limit and its last event is under
an hour old, start nothing for that title this hour. An older usage-limit stop is restarted like any other.

Comments: sprint sessions write as `greenbeanbot`, the owner as `astevegreen`; read them with
`--json comments` and go by `author.login`. An **owner reply** is an `astevegreen` comment newer than the
newest `greenbeanbot` comment on that issue. **Ready** is open, `sprint-ready`, not `blocked`, and every issue
in its body's "Depends on" line closed.

Work exists for:
- a lane session (not `research`): the lane has a ready issue; or one labelled `in-progress`; or `blocked`
  with an owner reply; or `held` whose newest comment is an owner reply, or starts "Integrator:" and is newer
  than the newest comment starting "Lane:" (the same rules `sprint-lane` follows);
- `YODC lane: research`: an open `lane:research` issue whose precondition in `docs/sprint.md` holds (R2 waits
  for M3–M6 to close), or a research backlog ID with no issue yet;
- a plan session: the lane has fewer than 3 open `sprint-ready` issues and its backlog has an ID that is not
  done. An ID is done when an issue title starts `[task] <ID>:` or `[task] <ID>` plus a letter and a colon.
  Get every title once with `gh issue list --state all --search "[task] in:title" --limit 500 --json title`
  and match the start yourself (GitHub search matches whole words, so `M1` misses `M1a`);
- `YODC integrate`: any open issue labelled `to-integrate`.

To start one, `RemoteTrigger` `create` with this body:
`{"name": "<title>", "run_once_at": "<now + 1 minute, UTC, ISO 8601 with Z>", "enabled": true,
"job_config": {"ccr": {"environment_id": "env_01Tnhbujy7ocSKWa8wqLPdCm", "session_context": {"model": "<model>"},
"events": [{"data": {"type": "user", "uuid": "<new random UUID from node -e \"console.log(crypto.randomUUID())\">",
"parent_tool_use_id": null, "message": {"role": "user", "content": "<prompt>"}}}]}}}`

| Title                   | Prompt                    | Model               |
| ----------------------- | ------------------------- | ------------------- |
| `YODC lane: <lane>`     | `/sprint-lane <lane>`     | `claude-sonnet-5-5` |
| `YODC lane: research`   | `/sprint-research`        | `claude-sonnet-5-5` |
| `YODC plan: <lane>`     | `/sprint-plan <lane>`     | `claude-opus-5-5`   |
| `YODC integrate`        | `/sprint-integrate`       | `claude-sonnet-5-5` |

## 4. Status
For each lane, the open `sprint-ready`, `in-progress`, `to-integrate`, `held` and `blocked` counts, and the
issues closed since the window opened (`gh issue list --state closed --label lane:<lane> --search "closed:>=<window start as YYYY-MM-DDTHH:MM:00Z>"`).

## 5. Report
Comment on issue #19 "Sprint log" only on the
first run of the window, every sixth UTC hour (00, 06, 12, 18), or when a session is stuck or never started,
a usage limit stopped one, or step 2 needed attention. Under 15 lines: the time, one line per lane (counts,
sessions started), and anything the owner must act on, with links.
