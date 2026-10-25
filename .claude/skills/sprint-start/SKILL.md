---
name: sprint-start
description: Cue the YODC sprint in docs/sprint.md now. Checks the computer, opens the window, makes the supervisor and the archiver, fires the supervisor. Run only as /sprint-start [hours] [--dry-run], by the owner or the root /sprint-cue.
disable-model-invocation: true
argument-hint: "[hours] [--dry-run]"
model: sonnet
hooks:
  PreToolUse:
    - matcher: "Bash|PowerShell"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/.claude/hooks/sprint-guard.mjs" --lane
          timeout: 10
---
You start the sprint in `docs/sprint.md` now, from the main checkout `C:/Antigravity/YODC`. `$ARGUMENTS` holds
the window's length in whole hours (40 when none is given) and may hold `--dry-run`. No one may be watching,
so never ask: the checks below decide everything. You start, start with what is short named, or refuse. You
never edit tracked files, commit, push or make design decisions.

`Q` below is `node C:/Antigravity/YODC/scripts/sprint/queue.mjs`. Write it out in full, on a line of its own:
the guard refuses it chained, piped or redirected. It prints one line of JSON and exits 2 when it refuses, 1
when it fails; its `error` is your reason. Load `RemoteTrigger` and the remote tools you need
(`list_environments`, `list_sessions`, `create_trigger`, `create_session`, `fire_trigger`, `get_session`) with
ToolSearch.

**Dry run** (`--dry-run`): make every check and every read, and nothing that writes. That means no merge, no
`create_*`, no RemoteTrigger `update`, no `fire_trigger`, no comment, and `Q window start` only with
`--dry-run`. It proves the cue before the owner relies on it. In a dry run, a refusal check that fails goes on
the FAIL line and the run carries on, so one dry run names every problem. Otherwise the first refusal ends the
run.

Your last message starts with exactly one of these lines, with nothing before it (the root cue reads line 1),
then at most 8 lines from step 6:
- `STARTED yodc window <start>–<end>`, both from `Q window start` (they end in `Z`)
- `REFUSED yodc: <reason>`
- `DRY-RUN OK yodc`
- `DRY-RUN FAIL yodc: <each failed refusal check, separated by "; ">`

This session is the start session. The archiver may post into it (step 4.2), so it stays open. Nothing in the
sprint archives it: the archiver skips its own session, and the root cue never archives start sessions.

## 1. Refusal checks
1. **On main:** `git -C C:/Antigravity/YODC branch --show-current` prints `main`, and
   `git -C C:/Antigravity/YODC status --porcelain --untracked-files=no` prints nothing.
   Then run `git -C C:/Antigravity/YODC fetch origin main`.
   `git -C C:/Antigravity/YODC rev-list --count origin/main..HEAD` must be `0`: the supervisor runs the skills
   in this checkout, and they must be the ones on `main`.
   Then run `git -C C:/Antigravity/YODC merge --ff-only origin/main`. In a dry run, skip the merge and instead
   say when `HEAD` is behind `origin/main`.
   Reasons:
   - `the main checkout is on <branch>`
   - `the main checkout has uncommitted changes`
   - `main is <n> commit(s) ahead of origin/main; push them first`
2. **GitHub identity:** `Q identity` prints `"ok": true`. Sprint sessions comment as the bot, and the queue
   counts only `astevegreen`'s comments as the owner's. Never run `gh auth switch`. Reason: its `error`.
3. **Environment:** pick from `list_environments`. The environment must have `kind` `bridge` and `state`
   `active`, and a name of the form `<host>:C:\Antigravity\YODC:<four characters>`, where `<host>` is what
   `hostname` prints. When several match, take the newest `created_at`. Every sprint session starts there.
   Reason: `no active bridge environment for C:\Antigravity\YODC on <host>; claude rc must run in that folder`.
4. **No window open:** `Q window` prints a `phase` that is neither `open` nor `before`. Note its `supervisor`
   and `archiver` for steps 2 and 3. Reasons:
   - when it is open: `a window is already open, until <window.end>`
   - when it fails: its `error`

## 2. What is short
Each of these is a line in step 6, never a refusal:
- **Disk:** under 30 GB free, from `node -e "const s=require('fs').statfsSync('C:/');console.log(Math.round(s.bavail*s.bsize/2**30))"`.
- **Memory:** under 8192 MB free, from `node -e "console.log(Math.round(require('os').freemem()/2**20))"`.
- **Sessions:** 10 or more sessions whose `session_status` is not `SESSION_STATUS_ARCHIVED` and whose
  `environment_id` is step 1.3's: "10 or more YODC sessions are not archived; archive some on the rc host". Read
  `list_sessions` with `mine: true` and `limit: 10`, then the next page with `after_id` set to its `last_id`. Stop at
  the tenth such session, when the pages run out, or after 10 pages ("could not count the YODC sessions" when none
  of these ends it): a bigger page runs to 200,000 characters. Other projects' sessions are theirs to count.
- **Claude Code:** `claude --version` is below 2.1.304: "update Claude Code (`claude update`)".
- **Deploy:** `gh run list --workflow deploy.yml --branch main --limit 1 --json conclusion,status` shows a
  completed run whose conclusion is not `success`: "main's last deploy is <conclusion>; the integrator waits
  for green".
- **The last supervisor:** when step 1.4's `supervisor` is not null, `RemoteTrigger` `get` it. When it is
  enabled, `update` it to `{"enabled": false}`, since the new window gets its own. In a dry run, only name it.
  When the update is refused: "the last supervisor is still on; switch it off at
  https://claude.ai/code/routines/<id>". Its runs stop at their lock, so they never double this window's work.

## 3. Open the window
Run `Q window start <hours> --environment <step 1.3's id>`, adding `--dry-run` in a dry run.

It may refuse because the last window's archiver is still on record. Then `RemoteTrigger` `get` that id:
- **Disabled:** in a dry run this check passes; note "a real start clears the last archiver". Otherwise run
  `Q window archived`, then `Q window start` again.
- **Enabled,** and that window ended over 12 hours ago: every session of it has long stopped. Not in a dry
  run, `update` it to `{"enabled": false}`, run `Q window archived`, start again, and note it.
- **Enabled** otherwise: refuse with the `error`, since its sessions may still be running.

Any other refusal or failure: refuse with its `error` (a dry run puts it on the FAIL line). From here on, a dry
run stops and gives its report (step 6).

## 4. The scheduled tasks
1. **Supervisor:**
   1. `create_trigger` with name `YODC sprint supervisor`, cron_expression `22 * * * *`, prompt
      `/sprint-supervisor`, create_new_session_on_fire `true`, environment_id from step 1.3, notifications `{}`
      and initiation `human_request`. Pass no `connectors`: the org refuses the parameter, even `[]` (25 Oct),
      and without it the trigger stores none. The cron is minute 22: Terminal Dusk's supervisor
      keeps minute 2.
   2. Then `Q window ids --supervisor <its trig_ id>`.
   3. When the create fails: `Q window stop`, and refuse with `could not create the supervisor: <error>`.
2. **Archiver:**
   1. `create_session` with title `YODC sprint archiver`, model `claude-haiku-5-5`, the same environment_id,
      and no prompt. When that fails, the archiver posts into this session instead: `get_session` with no id
      gives its id.
   2. Then `create_trigger` with name `YODC sprint archiver`, cron_expression `50 * * * *`,
      persistent_session_id that session, prompt `/sprint-archive` and initiation `human_request`, with no
      `connectors`.
   3. Then `Q window ids --archiver <its trig_ id>`.
   4. When the trigger create fails, the sprint still starts: "no archiver, so finished sessions pile up;
      archive them by hand".
3. **Wake:** a usage limit stops every session, and the supervisor's own runs fail until it resets. So each
   lane, as it takes an issue, moves this one-shot supervisor to 2 minutes past the reset (`Q wake`).
   1. `create_trigger` with name `YODC sprint supervisor wake`, run_once_at the `end` `Q window start`
      printed (in RFC3339, seconds and all: at the window's end it starts the drain), prompt
      `/sprint-supervisor`, create_new_session_on_fire `true`, the same environment_id, notifications `{}`
      and initiation `human_request`, with no `connectors`.
   2. Then `Q window ids --wake <its trig_ id>`.
   3. When the create fails, the sprint still starts: "no wake, so after a usage limit lanes wait for the
      hourly supervisor".

## 5. Go
`fire_trigger` the supervisor, so the lanes start now rather than at minute 22. Then write the step 6 lines
with the Write tool to `C:/Antigravity/YODC/.prompts/tmp/sprint-start.md` (gitignored), and run
`gh issue comment <logIssue from Q window> --body-file C:/Antigravity/YODC/.prompts/tmp/sprint-start.md`.

## 6. Report
After the first line:
- the window in Eastern (`window.eastern`);
- the environment;
- the supervisor's, the archiver's and the wake's ids, and the session the archiver posts into ("this session; leave it
  open" when it is this one);
- each item from step 2.

A dry run gives the same lines for what a real start would make.
