---
name: sprint-archive
description: The YODC sprint archiver. Archives the sprint's finished and stuck sessions, then switches itself off after the window. Run only from the "YODC sprint archiver" scheduled task that /sprint-start makes.
disable-model-invocation: true
model: haiku
hooks:
  PreToolUse:
    - matcher: "Bash|PowerShell"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/.claude/hooks/sprint-guard.mjs" --lane
          timeout: 10
---
Sprint archiver run. Every run lands in this one conversation and re-reads the ones before it, so be brief.
Run once even if several of these arrive together, and reply in one line. Use only these:
- Bash, for `node C:/Antigravity/YODC/scripts/sprint/queue.mjs`;
- `RemoteTrigger` (`list_runs` and `update`);
- `archive_session`.

Load the tools with ToolSearch when they are not listed.

1. Run `node C:/Antigravity/YODC/scripts/sprint/queue.mjs window`. If it prints `error`, reply with it and
   stop.
2. Run `node C:/Antigravity/YODC/scripts/sprint/queue.mjs sessions --all`: the triggers the supervisor started
   this window. Add the `supervisor` id that step 1 printed.
3. `RemoteTrigger` `list_runs` on each id. A run's session id is the last part of its `url` (`session_…`).
   Archive with `archive_session` each run that is not this session and whose `status` is not `archived`, when
   one of these holds:
   - **finished:** `worker_status` is `idle` and `last_event_at` is over 60 minutes ago;
   - **stuck:** `worker_status` is not `idle` and `last_event_at` is over 60 minutes ago.

   Leave every other run.
4. When step 1's `phase` is `after` and no run is left with `worker_status` other than `idle`:
   1. `RemoteTrigger` `update` step 1's `archiver` id with `{"enabled": false}`;
   2. then run `node C:/Antigravity/YODC/scripts/sprint/queue.mjs window archived`.

Reply with one line: "Archived <n>: <titles>" (mark stuck ones "(stuck)"), or "Archived 0". After step 4, add
"; switched off".
