# Sprint: follow-ups and the polish reserve (November)

**Window:** set when the sprint is cued. `/sprint-start [hours]` opens it from that minute, for 40 hours
unless it names others, and `node scripts/sprint/queue.mjs window` prints it in UTC and Eastern. This file
holds no time (Machinery).

Inside the window this file overrides `CLAUDE.md` wherever they conflict: its "ask and wait" steps, "push
each finished task" and "explain each decision in chat". Outside it, this file is inactive. `ARCHITECTURE.md`
is never overridden.

**Goal:** clear the follow-ups (`docs/follow-ups.md`) and the polish reserve overnight, and the follow-ups the
night itself files, with as little owner input as possible, without lowering quality: every change has tests, passes the gates, gets a reviewer pass, and lands through
one integrator.

## Owner's standing permissions (24 Oct, in the session that prepared the sprint)

1. Scope, "A headline feature + polish (Recommended)": one headline feature, designed on the planning day,
   with the surveyed polish items as the reserve. The backlog below is approved: `sprint-plan` writes and
   files its specs without asking, except where an item names a question.
2. The feature, "Act II: The Rot Below", follows the design under "Act II" below. The owner chose
   "The Rot (Recommended)", "26, 34 and 43 (Recommended)" and "Two epilogue variants (Recommended)".
3. Sprint sessions may edit what their task needs, with the exceptions in "What still stops a task".
4. Lanes commit on local branches; one integrator lands and pushes them, as in October ("I approve your
   recommendation for pushes").
5. The cue, "Yes, build the cue (Recommended)": the owner opens the window when they choose ("I will decide
   later") with `/sprint-start`, and it may overlap other projects' sprints on this computer.
6. A bug the sprint's own soaks or bug hunts find (crash, softlock, oracle failure, wrong text) may be filed
   and fixed in lane `fixes` without asking, as polish (permission 1). Anything about balance or feel is a
   proposal, never a fix.
7. No owner playtest this sprint ("Skip it"): the research lane's soaks stand in.
8. Follow-ups (27 Nov), "Follow-ups + reserve (Recommended)": the follow-ups moved into this Backlog (IDs `N<n>`),
   October's unbuilt reserve, and the `-follow` issues lanes file during the window are approved like the
   reserve (permission 1). Act II shipped in October; its lanes `story` and `lore` are off this sprint.

Each commit's trailer quotes the permission it rests on:
- a follow-up (`N<n>`, or a `-follow` issue of any item):
  `Requested: "Follow-ups + reserve (Recommended)" (sprint <ID>)`
- the reserve: `Requested: "A headline feature + polish (Recommended)" (sprint <ID>)`
- a soak finding: `Requested: "A headline feature + polish (Recommended)" (sprint S<n>, soak finding)`
- a hunt finding: `Requested: "A headline feature + polish (Recommended)" (sprint S<n>, hunt finding)`

## What still stops a task

The owner's gates since 28 Oct ("Auto; audit holds loosening", "Design only, daily digest"): the owner keeps
product and design, money and identity, and destruction; CI, the reviewer and agy decide the rest, with
`git revert` as the safety net.

- **Design decisions are the owner's**: game rules, balance feel, scope, a save-format break (`migrator.ts`,
  `CURRENT_SCHEMA_VERSION`), new mechanics, and a name or placement the design leaves open. A task that needs
  one: comment one question on the issue, with options and a recommended answer, label it `blocked`, and move
  on to other work. Never invent a rule. The supervisor puts every open question in one daily digest on the
  Decisions issue, #122 "Sprint questions" (Planning day).
- **Technical questions are never asked**: how to build or structure it, APIs, tooling, tests, naming,
  placement in the code, performance, refactors, architecture-doc updates. The Opus session that meets one
  (implementer or plan) decides it as the architect, comments `Decision (architect): <question>: <decision>,
  because <why>` on the issue, and goes on.
- **`held` is for a `[blocker]` only.** A `[minor]` concern ships, named in the hand-over note, or becomes a
  follow-up issue when it is real work. A machine failure (a time-out, memory running out, a loaded host)
  retries by itself once free memory is over the floor, whatever the newest comment says, and never waits for
  the owner; after three retries the time-out counts as the code's.
- **§8.1 protected files**: only exception 1 (a confirmed bug, shown by a test that fails without the fix),
  and never `migrator.ts`. Exceptions 2–5 are not available to the sprint: 4 and 5 need a second look, which
  sprint sessions don't run.
- **Locked paths** (`.claude/hooks/sprint-guard.mjs --file-lock`), what governs the sprint's own sessions:
  `.claude/settings*.json`, `.claude/hooks/`, the sprint skills and agents (`.claude/skills/sprint-*`,
  `.claude/agents/implementer.md`, `.claude/agents/reviewer.md`), `.githooks/`, `.github/`, `scripts/sprint/`,
  this file, and `migrator.ts`. `CLAUDE.md`, `ARCHITECTURE.md`, `package.json`, the other skills and agents,
  and the docs are open like any code. No new dependencies.
- **Rails** (`RAILS` in `scripts/lib/second-look.mjs`: hooks, guards, gates, git hooks, CI workflows,
  `.claude/settings*.json`, the push lock): a task touching one lands only once the rail audit says it loosens
  nothing (`sprint-integrate`, step 1.2).
- Every `ARCHITECTURE.md` invariant, every hook, and the gates. Hooks are never skipped.
- Only the integrator pushes, and only `git push origin HEAD:main`.

## Lanes

Each open sprint issue carries exactly one lane label. One coordinator runs per lane, and each lane builds
in its own persistent worktree, so lanes never share a working tree.

| Lane       | Label           | Worktree                          | Where it works                                       |
| ---------- | --------------- | --------------------------------- | ---------------------------------------------------- |
| `ux`       | `lane:ux`       | `C:/Antigravity/YODC-lane-ux`     | Player aids and UX: `src/ui/`, `src/rendering/`, `src/main/`, `index.html` |
| `fixes`    | `lane:fixes`    | `C:/Antigravity/YODC-lane-fixes`  | Engine and content bugs: `src/engine/`, `src/content/` |
| `tooling`  | `lane:tooling`  | `C:/Antigravity/YODC-lane-tooling`| `e2e/soak/`, `scripts/` (never `scripts/sprint/`)    |
| `research` | `lane:research` | `C:/Antigravity/YODC-research`    | Soaks and bug hunts; reports and proposals as issue comments, no repo changes |

The integrator works in `C:/Antigravity/YODC-integrate`. The main checkout is only fetched and fast-forwarded.
While the window is open, the pre-push hook refuses a push to main from any other folder (`scripts/sprint/push-lock.mjs`).

## Flow

1. `sprint-plan <lane>` turns backlog items into issues titled `[task] <ID>: <what>`, labelled `lane:<lane>`
   and `spec-review`. Gemini then audits the specs (`node scripts/gemini-audit.mjs specs <issues>`, as Terminal
   Dusk does); the plan session applies the valid points, answers the rest on the issue, and swaps
   `spec-review` for `sprint-ready` (the owner's request of 25 Oct: "I want Gemini/Agy to be used for YODC and
   the course in the same way they are used for terminal dusk"). An audit that fails or is skipped holds
   nothing up.
2. `sprint-lane <lane>` takes one at a time: the `implementer` builds it on branch `sprint/<issue>` from
   `origin/main` in the lane's worktree and commits (the pre-commit hook gates each commit); the `reviewer`
   reads `git diff origin/main...sprint/<issue>`. PASS, or only `[minor]` concerns left after one fix round:
   label `to-integrate`; a `[blocker]` left: `held`.
3. `sprint-integrate` takes up to three `to-integrate` issues per push, oldest first: cherry-picks each
   branch onto `origin/main` as its own commits, runs the gates once, pushes, watches CI, closes the issues
   and logs what players will see. A conflict sends back only the issue that caused it; a red gate or a red
   deploy sends the batch through again one issue at a time, and the one that fails alone goes back as `held`.

Labels: `lane:*`, `spec-review`, `sprint-ready`, `in-progress`, `to-integrate`, `held`, `blocked`, `proposal`. Which issue is
ready, whose comment counts, when held work is retried, whether a session has work and the status block are
decided by the queue (`scripts/sprint/queue.mjs`, Machinery), never by hand.
Progress, questions and every push go to the pinned issue #121 "Sprint log". Its body is the status block,
which the supervisor rewrites every hour; comments hold the history.

## Backlog

Work in this order inside a lane. Each item is one line `- **<ID>** <what>`, under a `### <lane>` heading;
the queue reads the IDs and their order from here, as pushed to `origin/main`, so a change lands for every
session at once. An item too big for about 300 changed lines becomes `<ID>a`, `<ID>b`, each provable on its
own. IDs never repeat an earlier sprint's letter (B, H, M, R, S, T and U are October's; A, L and K's Act II
items were late October's). Sources: `docs/follow-ups.md` (the `N` items, moved here on 27 Nov), the backlog
survey of 24 Oct, the 6 Nov test-suite audit, the playtest logs (`C:/Antigravity/YODC/.prompts/playtest/log.md`,
`log-yodc-07.md`), and the proposal issues #20, #53, #56, #62, #63 and #69, which GitHub no longer serves: the
item's own line is the spec.

### ux (player aids)

- **X3** An overburdened hero who cannot move is told once to drop something, instead of "cannot move!" again
  and again (`src/engine/actions/movement.ts:52-54`).
- **X5** Rest (`KeyR`) with the map open does nothing and says nothing (`src/rendering/map-overlay.ts:74-96`
  takes every key). Question: stay silent, or print a line.
- **X8** Reproduce, then fix or close: shop focus returns to the same row, not the moved selection
  (`src/ui/keepFocus.ts:37-56` restores the control with the same id or `data-*`).
- **X9** Hrefna speaks to the newest teaching, not the fixed order altar, debt, first spell
  (`src/content/cotw/hrefna.ts:80-84`; a test pins today's order). Question: newest first, or keep the order.
- **X10** Playtest leftovers, each reproduced on today's build first, then fixed or closed, one issue each:
  X10a shop number keys renumber after a sold-out row (`src/ui/shop/shopDialog.ts:207-208`); X10c the pack
  weight differs between inventory (the total) and shop (the pack's own load, `shopDialog.ts:667`), waits for
  its question (which to show); X10d "(3x)" (`src/ui/inventory/inventoryController.ts:116`, `:124`) beside "×2"
  (`inventoryTab.ts:263`); X10e the "+1" badge reads as renown; X10f Thrain assumes a Rune of Return
  (`src/content/cotw/town.ts:169`); X10g Thrym's lines repeat on floor 4; X10h at 1920×1080 the map fills half
  its pane (a `visual-check` capture first). X10b (Esc deselects before closing the inventory) is dropped: it is
  intended (`inventoryController.ts:806-814`), so changing it is a feel call.

### fixes (bugs and their tests; a failing test first, or close with a reason)

- **N1** Tests only: a kill rite that teaches into full grimoires logs the "Every slot in your grimoires is full"
  suffix and fires its `screen_flash` (`src/engine/magic/killRites.ts:148-157`, `teachRiteSpell`; nothing
  asserts either).
- **N2** A bug report's replay checkpoint and state snapshot are bare `serializeGame()` output with no schema
  version, so `loadReplayState` (`src/engine/debug/replay.ts:347-353`) decodes a report from an older build as
  current, or fails it as `corrupt`. Stamp the version on the checkpoint so an old one is refused like any old
  save (read `CURRENT_SCHEMA_VERSION`; `migrator.ts` itself is not edited).
- **N3** `ProfileManager.importHero` throws a plain `Error` (`src/engine/storage/profile-manager.ts:513`,
  `:517`) for an envelope at the current version whose `data` lacks `profile`, `player` or `map`, or whose hero
  is dead; its doc promises a typed `SaveLoadError` reason (`asImportError`, `:593`).
- **N4** `declaredVersion` (`src/engine/storage/loadResult.ts:67-71`) reads `{}`, `[]` or an envelope with a
  non-numeric `schemaVersion` and no timestamp as version 0, so they fail as `migration-failed`, not `corrupt`.
- **N5** `DungeonGenerator.isReachable` (`src/engine/dungeon/dungeon-generator.ts:502`, the vault exemption at
  `:524-529`) checks only a vault's `@` connectors, so a blueprint with no `@` passes walled off: a stamp-time
  check that a blueprint has an `@` (`src/engine/dungeon/vaultStamp.ts:128-150`) closes it. Where every room is
  a vault (`:308`, `joinable` falls back to `rooms`) a connector can join its own vault again; fix that too if
  it stays under about 300 lines, else split N5a, N5b.

### tooling

- **K5** SonarCloud complexity: split the worst S3776 functions outside `scripts/sprint/`, one function per
  issue (K5a, K5b, …), starting with `soakReport` (`scripts/lib/soak-report.ts:194`, about 277 lines).
  Question: is this worth sprint time.
- **K6** The 34 test files under `src/` and `tests/` that assign `globalThis.document`/`window` by hand use
  `vi.stubGlobal` instead (`vite.config.ts:116` already sets `unstubGlobals`), so no test's global leaks into
  the next file. Splits into K6a, K6b, K6c, about 10 files each.
- **K7** One round-trip table with a `roundTrip()` helper for the six `src/engine/storage/__tests__/*RoundTrip.test.ts`
  files, each case a row; no case dropped. Splits K7a, K7b if it passes about 300 changed lines.
- **K8** A shared fake sprite sheet for the about 14 tests in `src/rendering/__tests__/` that each build their
  own, kept beside them in `src/rendering/__tests__/` (`tests/setup/` is a rail).

### research (decides nothing; first line of each report: "Proposal, not a rule")

Each open item's line ends with `Waits for:` (backlog IDs or issue numbers, or `nothing`; an ID waits until
every issue of it is closed), `Soaks:` (lens `player`, `--workers 2` unless it says otherwise) and what its
report covers. The queue reads them here, with any `Waits for:` line in the item's issue; nothing keeps a copy.
The bug hunt runs on its own every 12 hours (`sprint-research` step 4); the first, H1, reads `src/` since
74e30d5e, where October's last hunt stopped.

- **E2** Runestone policy on one build, and two old questions from the same runs: the floor-5 deaths (R2 2 of
  12, R3 2 of 5, R5 8 of 28, against 7 of 16 before a65a8f76) and why the floor-10 stone is missed in 6 of 6
  runs from town. Waits for: nothing. Soaks: one from town with `--runestones first`, then one with
  `--runestones leave`, `--count 12` each. Report: the median deepest floor per policy, floor-5 deaths and
  their causes, and whether each run saw the floor-10 stone. P-37 stays deferred: this only measures.

Not sprint work (the owner's call): P-24, P-27, P-37, Sap-tapper fighters, hearth-cold stages (#53, #62),
energy debt (#62), the late spells' share of damage (#20), the bot reading hints (#56 option 3), new
mechanics, renaming spells.

## Machinery

- **The cue.** In a session in the main checkout (`C:\Antigravity\YODC`), on `main` with this file pushed,
  the owner or the root `/sprint-cue` on this computer runs `/sprint-start [hours]`. It asks nothing: it
  checks the computer, opens the window, makes the supervisor and the archiver, fires the supervisor once and
  posts on the sprint log. Its last message starts `STARTED yodc window <start>Z–<end>Z` or
  `REFUSED yodc: <reason>`. `/sprint-start --dry-run` makes every check and read, writes nothing, and ends
  `DRY-RUN OK yodc` or `DRY-RUN FAIL yodc: <items>`. The start session stays open, since the archiver may post
  into it; the root cue never archives start sessions.
- **Stopping.** The window ends on its own. `/sprint-stop` (optional) ends it now, and switches off the
  supervisor, its wake and every one-shot session still waiting to fire. Either way, running sessions
  finish the task in hand, and the supervisor drains: it starts only the integrator, for what the lanes
  finished, then switches itself off. The archiver switches itself off once no sprint session runs, and a new
  `/sprint-start` waits until it has.
  `/sprint-stop` records itself (`stoppedBy: sprint-stop` in `queue.mjs window`), so the supervisor reports
  the owner's pause as a stop, never as a fault.
- **This computer's state**, never committed, in the git folder every worktree shares
  (`git rev-parse --git-common-dir`), written only by `queue.mjs`:
  - `sprint-window.json`: the window, the environment and the three scheduled tasks' ids;
  - `sprint-triggers.json`: every trigger the supervisor started, so it finds a session by id
    (`RemoteTrigger list` shows only the account's newest 20, across every project's sprint);
  - `sprint-supervisor.lock`: one supervisor run at a time.
  `queue.mjs window` prints the first; nothing else names those ids.
- **Environment.** `/sprint-start` picks the newest active bridge environment named
  `<host>:C:\Antigravity\YODC:<four characters>` from `list_environments`. A new one appears whenever
  `claude rc` restarts in this folder, so nothing writes it down before the cue. Nobody restarts `claude rc`,
  reboots or signs out during the window: the sessions' environment would go.
- **Bridge.** `claude rc --name YODC --capacity <N>`, run in this folder. Before the cue, the root
  `/sprint-cue` brings it up with `node C:/Antigravity/sprints/free-bridge-slots.mjs up yodc <hours>`, which sizes
  `--capacity` to the window (32 to 48 slots). It restarts a smaller bridge only when every child is shown idle;
  a restart makes a new environment, which `/sprint-start` picks up. A session keeps its slot until its process
  ends, and scheduled sessions can't archive, so the supervisor ends finished and stuck sessions' processes every
  run (its step 2b; after-sprint fix 13, 26 Oct 2026).
- **Supervisor.** "YODC sprint supervisor", made by `/sprint-start` with the remote `create_trigger` tool,
  runs `.claude/skills/sprint-supervisor` in a fresh session at minute 22 of every hour (Terminal Dusk's keeps
  minute 2).
  - It starts `YODC lane: <lane>`, `YODC plan: <lane>` and `YODC integrate` sessions and restarts any that
    stopped. After a usage limit it restarts 2 minutes past the reset the error names (`queue.mjs resume`).
  - A limit also stops its own runs, which fail in seconds until the reset, and no session can read the reset
    beforehand (scheduled sessions have no `get_session`). So when a session in this folder stops on a limit,
    Claude Code's `StopFailure` hook (`.claude/hooks/usage-limit-wake.mjs`) reads the reset from its
    transcript or error (`queue.mjs wake`) and, while the window is open, starts one detached waiter
    (`scripts/sprint/wake-waiter.mjs`). 2 minutes past the reset, unless the :22 run follows within 15
    minutes, the waiter has a one-turn headless `claude -p` run the supervisor trigger if it is still switched
    on, so `/sprint-stop` and a pause by hand hold. Its lines: `.prompts/tmp/sprint-wake.txt`.
  - "YODC sprint supervisor wake", a one-shot of the same skill that `/sprint-start` makes, runs at the
    window's end and starts the drain. `/sprint-stop` switches it off.
  - Lanes, plan sessions and the integrator fire it when they stop after finishing work, so the next session
    starts within minutes rather than at the next hour.
  - A session idle for under 30 minutes may be waiting on a background push; it is left alone, so no title
    ever has two sessions.
  - A trigger made with `create_trigger` can be changed by any agent; one made through the HTTP API only by its
    own runs or the owner.
- **Archiver.** "YODC sprint archiver", made by `/sprint-start`, posts `/sprint-archive` at minute 50 of every
  hour into one session on Haiku 5.5. That session is made with `create_session`, which has `archive_session`
  (checked 24 Oct), where scheduled sessions have none; the start session stands in when that fails.
  - Every run lands in the same conversation, so the skill is short: October's archiver re-read every earlier
    run, 12.9 M tokens.
  - It archives sessions finished or stuck for an hour, and `unarchive_session` undoes a mistake.
- **Agents and guard.** Agents: `implementer` and `reviewer` (`.claude/agents/`); guard
  `.claude/hooks/sprint-guard.mjs`.
  - Sprint sessions write to GitHub only with `gh`, signed in as the bot. The GitHub plugin signs in as the
    owner, so its comments never notify the owner and would read as the owner's answers: the project turns
    it off, and the guard refuses its write tools in every sprint skill. The agents list their tools.
- **Before the sprint:** the tag `pre-sprint-2026-10-24` marks `main` as the sprint found it. A bug hunt whose
  issue names no commit reads from there, and the morning-after figures count from it.
- **The queue.** `scripts/sprint/queue.mjs` holds the sprint's bookkeeping rules once, tested on October's
  issues:
  - `has-work "<session title>"` for the supervisor;
  - `next <lane>` and `move <n> <state>` for the lanes;
  - `status` for the status block, and `decisions` for the daily digest of design questions;
  - the cue's `window`, `started`, `sessions`, `lock`, `resume` and `identity`.

  It reads the issues with `gh` and this file as pushed to `origin/main`, and prints one line of JSON. A
  session it gives an `error` does what its `do` line says; when it fails, the session stops and reports, and
  never falls back to rules written in a skill. Changing a rule means changing the script and its tests
  (`scripts/sprint/__tests__/`), outside the window.
- **Other sprints.** Terminal Dusk and the blockchain course run their own sprints on this computer, possibly
  at the same time. They share two things:
  - The account's usage limit: one limit stop halts all of them, and each supervisor restarts its own after
    the reset.
  - The computer's memory: the supervisor starts nothing while free memory is under 4096 MB, plus 1536 MB for
    each session it already started that run.

## What we measure

The morning after the window, Claude posts these on the sprint log beside October's figures, so the next
review starts from numbers instead of transcripts:

- **Ready to live:** median hours from `to-integrate` to deployed (October: 6.4 h), and the first change live,
  in hours after the window opened (October: 11 h).
- **Cue to work:** minutes from `STARTED` to the first lane session, and to the first issue in progress.
- **Empty starts:** sessions that started and found no work (October: at least 18). Target 0.
- **Two sessions on one title:** target 0.
- **Failed tool calls**, in sessions and in their helpers: guard, deny-rule and classifier refusals, and
  prompts nobody could answer (October: 225 in 25 hours).
- **Owner touchpoints**, and how often the owner asked for status (October: about 30, and 4). The status block
  should answer the second.
- **Reviewer misses:** bugs found after landing in code a reviewer passed (October: 5). Each one becomes a case
  in `scripts/eval/reviewer-eval.mjs`.
- **Time-outs:** gate runs that failed on a time limit and passed on a rerun, against the idle baseline
  (Preflight).
- **Tokens** per session kind, and the archiver's per day (October: 12.9 M for one archiver kept all window).

## Planning day (before the window)

- Before any spec is written, the `reviewer` agent reads this file's Backlog against the code and the queue
  (`scripts/sprint/`): every `path:line` an item cites still says what the item claims, every bug item says how
  it reproduces on `origin/main` or is marked "reproduce or close", and no item contradicts another or "What
  still stops a task". Its concerns are fixed in this file first.
- Plan sessions spec each lane's first 6 issues (`/sprint-plan <lane>`, every lane but research). Every design
  question goes in one issue, the Decisions issue #122 "Sprint questions": one numbered question per comment,
  with options and a recommended answer. The owner answers them in one sitting before the window opens, by
  number; plan sessions then file the items those answers settle.
- During the window, a design question goes on its task issue, labelled `blocked`, and the lane works on other
  issues. Once a day at most, the supervisor posts every open one on #122 in one digest with one @-mention
  (`queue.mjs decisions --write`). The owner answers there, one line per question (`#<issue> <answer>`), or
  on the task issue; only the owner's own comments answer, and the queue reads both places.

## Preflight (the dry run checks most of it; the owner fixes what it finds)

1. `/sprint-start --dry-run` ends `DRY-RUN OK yodc`. It checks:
   - the main checkout is on a clean `main` with nothing unpushed;
   - `gh` is signed in as `greenbeanbot` (`queue.mjs identity`);
   - this folder's bridge environment is listed;
   - no window is open, and the last archiver is off.

   It also names what is short: disk under 30 GB, memory under 8 GB, 10 or more live sessions, Claude Code
   below 2.1.304, a red last deploy.
2. GitHub Actions: no run sits queued (`gh run list --status queued`); the repository is public, so runs cost
   no minutes.
3. The "Sprint questions" issue is answered (Planning day).
4. Claude Code is 2.1.304 or later in every copy the sprint runs. A lane sends the reviewer's concerns back to
   the builder that wrote the change (`SendMessage`), and before 2.1.304 a resumed subagent could forget its
   latest work. Check with `claude --version` and
   `Get-CimInstance Win32_Process -Filter "Name='claude.exe'" | Select-Object -Unique ExecutablePath`;
   auto-update is off on this computer, so the owner updates by hand.
5. On the idle computer, `npm test` and `npm run sim` pass, and their times go on the sprint log, so a time-out
   in the window can be told apart: a busy computer, or slow code. No games or other heavy work on this
   computer during the window.
6. Windows Update is paused until the window closes and the power plan never sleeps: a reboot or sleep ends
   the rc host, and with it every session.

## Turning it off

- **Pause:** `/sprint-stop`. To stop at once, switch the supervisor off at
  `https://claude.ai/code/routines/<supervisor id from queue.mjs window>`; running sessions finish their
  current task.
- **Between sprints** the machinery stays and does nothing: no scheduled task exists until `/sprint-start`,
  and every sprint session stops at its window check.
- **To remove it for good**, one commit deletes this file, `.claude/skills/sprint-*`,
  `.claude/agents/implementer.md` and `scripts/sprint/`. Sessions outside a sprint use three pieces, so they
  stay:
  - `.claude/agents/reviewer.md`: `CLAUDE.md` (Pushing) and `scripts/eval/reviewer-eval.mjs` run it;
  - `.claude/hooks/sprint-guard.mjs` and `scripts/__tests__/sprintGuard.test.ts`: its `--read-only` mode is
    the reviewer's hook, and its other modes do nothing once no skill calls them;
  - `.claude/hooks/handoff-nudge.mjs`: its sprint-window check finds no window and stays quiet.

  `git diff pre-sprint-2026-10-24 -- CLAUDE.md .claude/` lists what this sprint changes there. The lane
  worktrees go with `git worktree remove`; labels are deleted by the owner (`gh label delete` is the owner's).
