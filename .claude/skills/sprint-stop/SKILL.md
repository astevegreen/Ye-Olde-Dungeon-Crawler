---
name: sprint-stop
description: End the YODC sprint's window now and switch its supervisor, its wake and its waiting sessions off; sessions already running finish the task in hand. Run only as /sprint-stop.
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
You end the sprint in `docs/sprint.md` now. `Q` below is `node C:/Antigravity/YODC/scripts/sprint/queue.mjs`.
Write it out in full, on a line of its own. You never edit tracked files, commit or push. Your last message
starts with exactly one of these lines, then at most 6 lines:
- `STOPPED yodc at <end>`
- `NOT RUNNING yodc: <phase from Q window>`

1. Run `Q window`. Unless `phase` is `open`, reply `NOT RUNNING` and stop.
2. Run `Q window stop`: the window ends this minute.
   - Each lane and plan session finishes the task in hand, then stops at its window check.
   - The supervisor starts nothing more.
   - The integrator lands what is already `to-integrate`.
3. Switch the supervisor off: `update_trigger` the `supervisor` id with enabled `false`, then the `wake` id
   the same way, each one `Q window` names (load `update_trigger` and `get_trigger` with ToolSearch; auto mode
   refused `RemoteTrigger` `update` here on 25 Oct). When one is refused, add the line "switch <name> off at
   https://claude.ai/code/routines/<id>". Until then their runs stop at their window check.
   Leave the archiver alone: it switches itself off once no sprint session is left running, and only then can a
   new `/sprint-start` open a window.
4. `Q sessions` gives the last trigger for each session title. `get_trigger` each one that is not null: an
   enabled one whose `run_once_at` is still ahead is a restart waiting out a usage limit, or a lane or plan
   session not yet started. `update_trigger` it with enabled `false`, so it starts no session that would only
   stop at its window check.
5. Write "Sprint stopped at <end>." and the lane lines of `Q status` with the Write tool to
   `C:/Antigravity/YODC/.prompts/tmp/sprint-stop.md`. Then run
   `gh issue comment <logIssue> --body-file C:/Antigravity/YODC/.prompts/tmp/sprint-stop.md`.
