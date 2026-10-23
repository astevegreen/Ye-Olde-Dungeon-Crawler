# Sprint: 21–22 October 2026

**Window (UTC):** `20261021T0040` to `20261022T1800` (Tue 20 Oct 20:40 to Thu 22 Oct 14:00, Eastern).
Check with `date -u +%Y%m%dT%H%M`. Every sprint skill reads the window from this line.

Inside the window this file overrides `CLAUDE.md` wherever they conflict: its "ask and wait" steps, "push
each finished task" and "explain each decision in chat". Outside it, this file is inactive. `ARCHITECTURE.md`
is never overridden.

**Goal:** use the plan's usage fully for 40 hours with as little owner input as possible, without lowering
quality: every change has tests, passes the gates, gets a reviewer pass, and lands through one integrator.

## Owner's standing permissions (20 Oct, in the session that set up the sprint)

1. The backlog below is approved: "I approve your backlog proposal, with one caveat: I want to incorporate
   some player aids first." `sprint-plan` writes and files its specs without asking.
2. Magic onboarding (lane `aids`) follows the approved design under "Magic onboarding" below: the owner chose
   "Seeress + just-in-time" and "New NPC: a völva".
3. Sprint sessions may edit what their task needs, with the exceptions in "What still stops a task"; the
   owner authorized edits to the system files for the sprint and wants to revert to today's setup afterwards
   (tag `pre-sprint-2026-10-20`; see "Turning it off").
4. Lanes commit on local branches; one integrator lands and pushes them: "I approve your recommendation
   for pushes."
5. Start tonight, every lane at once, beside Terminal Dusk's sprint: "Tonight, full lanes".
6. A bug the sprint's own soak finds (crash, softlock, oracle failure, wrong text) may be filed and fixed in
   lane `fixes` without asking. Anything about balance or feel is a proposal, never a fix.
7. The second backlog (21 Oct: U7, T5–T7, R4–R6) is approved: "I approve the second backlog, all seven
   items." Permission 6 covers bugs R6's code hunt confirms with a failing test.

Each commit's trailer quotes the permission it rests on:
`Requested: "I approve your backlog proposal" (sprint <ID>)`, or for `aids`,
`Requested: "Seeress + just-in-time" (sprint <ID>)`, or for the second backlog,
`Requested: "I approve the second backlog, all seven items." (sprint <ID>)`.

## What still stops a task (unchanged)

- **Product decisions are the owner's**: balance feel, scope, a save-format break (`migrator.ts`,
  `CURRENT_SCHEMA_VERSION`), new mechanics. A task that needs one: comment one question on the issue, label
  it `blocked`, and move on. Never invent a rule.
- **§8.1 protected files**: only exception 1 (a confirmed bug, shown by a test that fails without the fix),
  and never `migrator.ts`. Exceptions 2–5 are not available to the sprint.
- **Locked paths** (`.claude/hooks/sprint-guard.mjs --file-lock`): `.claude/`, `.githooks/`, `.github/`,
  this file, `CLAUDE.md`, `ARCHITECTURE.md`, `package.json`, `package-lock.json`, `migrator.ts`. No new
  dependencies.
- Every `ARCHITECTURE.md` invariant, every hook, and the gates. Hooks are never skipped.
- Only the integrator pushes, and only `git push origin HEAD:main`.

## Lanes

Each open sprint issue carries exactly one lane label. One coordinator runs per lane, and each lane builds
in its own persistent worktree, so lanes never share a working tree.

| Lane       | Label           | Worktree                          | Where it works                                       |
| ---------- | --------------- | --------------------------------- | ---------------------------------------------------- |
| `aids`     | `lane:aids`     | `C:/Antigravity/YODC-lane-aids`   | Magic onboarding: `src/content/cotw/`, `src/ui/`, hint plumbing in `src/engine/` |
| `ux`       | `lane:ux`       | `C:/Antigravity/YODC-lane-ux`     | Other player aids and UX: `src/ui/`, `src/rendering/`, `src/main/` |
| `fixes`    | `lane:fixes`    | `C:/Antigravity/YODC-lane-fixes`  | Engine and content bugs: `src/engine/`, `src/content/` |
| `tooling`  | `lane:tooling`  | `C:/Antigravity/YODC-lane-tooling`| `e2e/soak/`, `scripts/`                              |
| `research` | `lane:research` | `C:/Antigravity/YODC-research`    | Soak runs; reports and proposals as issue comments, no repo changes |

The integrator works in `C:/Antigravity/YODC-integrate`. The main checkout is only fetched and fast-forwarded.

## Flow

1. `sprint-plan <lane>` turns backlog items into issues titled `[task] <ID>: <what>`, labelled `lane:<lane>`
   and `sprint-ready`.
2. `sprint-lane <lane>` takes one at a time: the `implementer` builds it on branch `sprint/<issue>` from
   `origin/main` in the lane's worktree and commits (the pre-commit hook gates each commit); the `reviewer`
   reads `git diff origin/main...sprint/<issue>`. PASS: label `to-integrate`.
3. `sprint-integrate` takes `to-integrate` issues oldest first, one per push: cherry-picks the branch onto
   `origin/main`, runs the gates, pushes, watches CI, closes the issue and logs what players will see.
   A conflict or a red gate sends the issue back to its lane as `held`.

Labels: `lane:*`, `sprint-ready`, `in-progress`, `to-integrate`, `held`, `blocked`, `proposal`.
Progress, questions and every push go to the pinned issue #19 "Sprint log". Its body is the status block,
which the supervisor rewrites every hour; comments hold the history.

## Magic onboarding (approved design)

A town völva, **Hrefna**, by the well, is the voice of magic. Each mechanic is taught the first time the
player meets it, in a line or two of her voice, never a wall of text; nothing blocks play, and the hints
setting turns the teaching off. The owner's sketch:

- Prologue: the Magic Arrow cue stays. A wounded villager presses a Seiðr draught on the hero ("Your well
  runs dry fast. Drink, and aim true."), the player's first look at the Seiðr orb.
- Town, after the raid: Hrefna, three short lines ("Seiðr is borrowed. Take more than you hold and the Void
  keeps the tally."). HUD objective "Learn your first spell".
- The first time the hero casts short (Void Debt, how rest and town clear it, before tier 2 can bite), sees a
  sleeping shard-carrier ("It dreams with a shard. Let it sleep, or wake it your own way."), picks up a shard
  ("Carry it to the broken stone.", map pin), reads a stone (grimoire slots, picking a stat axis), fills the
  grimoire (forgetting, altars, Astrid's tablets).
- Floor 4 (already scripted): the objective points to the sleeping kobold, then the stone.
- Back in town, Hrefna reacts to what the hero has learned. Not a quiz.

Wording in Hrefna's voice is the sprint's to write, short and in the pack's Norse register. Placement,
names of other characters and any new mechanic beyond this sketch are the owner's.

## Backlog

Work in this order inside a lane. An item too big for about 300 changed lines becomes `<ID>a`, `<ID>b`, each
provable on its own. Sources: the magic survey and backlog survey of 20 Oct, the open handoff note
`2026-10-18-2252-engine-bug-verify.md` (repros in `.prompts/engine-bug-hunt/`), and the soak folders.

### aids (magic onboarding)

- **M1** Fix stale and misleading magic text: the kill-rite hint (predates learning stones), Runestone lore
  naming the retired Lightning Bolt, the `grimoire` hint (say spells cast only from a slot and that stat axes
  start unpicked), Hel's altar using "Void Debt" undefined, Astrid never saying she sells rune tablets,
  the stale comment in `spellTablets.ts:5-7`.
- **M2** A generic first-time-hint capability for packs: today `FirstTimeHintId` is a closed engine union
  (`src/engine/types/manifest.ts:1097`). Let a pack declare its own hints and the game events that show them,
  with no pack names in the engine (§3, No Engine Creep). Port the existing hints; no protected file.
- **M3** Hrefna: the NPC by the well, her post-raid lines, and the "Learn your first spell" objective (a flag
  set after the prologue, done when a stone is first read).
- **M4** The prologue's Seiðr draught beat.
- **M5** Just-in-time lines in Hrefna's voice on M2's capability: first short cast, first shard-carrier
  sighting, first shard pickup (`firstPickupHint`), first stone read, grimoire full.
- **M6** Floor 4: the objective points to the sleeping kobold, then to the stone.
- **M7** Hrefna reacts back in town to what the hero has learned (first spell, first debt, first altar).
- **M8** Playwright: a new hero meets Hrefna after the raid and the objective appears; a capture view for
  `scripts/capture/`.

### ux (other player aids)

- **U1** Collapse repeated log lines from one action into one line with a count ("×3"); 9 of 12 soak seeds.
- **U2** A first-time hint for unidentified items: Mimir, the Scroll of Identify and the Lore-Keeper perk.
- **U3** The controls primer names the two starting spells, Seiðr and the Spellbook key; the F1 Spellbook and
  aiming cards say how Seiðr returns and where spells come from.
- **U4** Command palette entries for casting, aiming and resting to regain Seiðr.
- **U5** Pack-flavoured run-advisor quotes (`advisorQuotes` is unset, so the engine defaults show).
- **U6** Reproduce, then fix or close: rest key with full HP gives no feedback; focus leaving the shop modal.
- **U7** A learning stone the hero has seen but not read stays marked on the map until read; today the mark
  (`learningStoneMarks`, `src/engine/magic/learningStones.ts:393`) shows only while the hero holds its shard.

### fixes (unverified bugs from the 18 Oct bug hunt; a failing test first, or close with a reason)

- **B1** Taking an item out of the worn belt, purse or pouch puts it back and spends a turn.
- **B2** Disarm on a disarmed trap never scans the other neighbours (`disarm.ts:46`).
- **B3** A buffered arrow step fires after a modal opens.
- **B4** Hliðskjálf sensing carries over to the next floor (fix in `reveal.ts`/`sensing.ts`, not `engine.ts`).
- **B5** A turret winds up at a hero it cannot perceive.
- **B6** A fast monster's wind-up warns and strikes with no hero turn between (fix in `behaviorTree.ts`).
- **B7** Tile effects fire on the old tile after a blink or an ice slide.
- **B8** `healCarry` is not saved; the prologue's coven-fled flag lags one action.
- **B9** Investigate: input locked about 5 s in 6 older seeds; Magic Arrow spending no turn in one. Reproduce
  on today's build or close.

### tooling

- **T1** `soak-report` groups by seed number, not (folder, seed).
- **T2** Oracle noise: "no stairs seen in 300 turns" and key latency swamp the findings; the "died after the
  raid" oracle fires in deep starts. Tag or tune.
- **T3** The bot fires at monsters a corner blocks.
- **T4** The bot never heals with spare Seiðr against Gálmr and cannot leave a radius-2 telegraph.
- **T5** The bot casts every spell it learns: it casts only quick-bar spells (`e2e/soak/playerBot.ts:1280`),
  and skips `loki_switch` (a swap, no status) and `hlidskjalf` (no `spellType`). R1: ten known spells never cast.
- **T6** The soak records why a run stopped: `scripts/soak.mjs:143` drops the signal name; write it to
  `runs.jsonl` and show it in `soak-report`. R3's soak died twice with no cause.
- **T7** An energy-clamp counter in the soak tap and report, so R5 can measure the clamp R3 could not.

### research (decides nothing; first line of each report: "Proposal, not a rule")

Each open item's line ends with what it waits for, its soaks (lens `player`, `--workers 2` unless it says
otherwise) and what its report covers. `sprint-research` reads them here and keeps no copy.

- **R1** A player soak on today's `main` (floors 5, 20, 26, 34) after cd263494 and a65a8f76; findings that are
  bugs become `fixes` issues (permission 6).
- **R2** After M3–M6 land: a soak comparing stones read and spells cast before and after onboarding.
- **R3** Measure the hearth-cold stages (turns per floor) and the energy clamp question; options only.
- **R4** After T5 lands: a magic-coverage soak from town and from floor 20, every known spell cast; findings
  that are bugs become `fixes` issues (permission 6). Waits for: every issue titled `[task] T5` closed.
  Soaks: one from town, then one with `--start-floor 20`. Report: each spell the bot knew and never cast, and
  each failed cast.
- **R5** After T6 and T7 land: R3 again with a full sample (30 or more seeds from town): hearth-cold stages
  and the energy clamp; options only. Waits for: the T6 and T7 issues closed. Soaks: one from town,
  `--count 30`, `--until` 6 hours ahead. Report: turns per floor, the floor each hearth-cold stage arrives on,
  and energy debt per floor, beside R3's numbers (folder `R3-<folder>`).
- **R6** A read-only bug hunt over the sprint's own changes (`git diff pre-sprint-2026-10-20..origin/main -- src/`);
  a finding a failing test confirms becomes a `fixes` issue (permission 7). Waits for: nothing. Soaks: none
  (the bug hunt in `sprint-research` step 5).

Not sprint work (the owner's call): P-24, P-27, P-37, the raid's difficulty at level 1, the arrival autosave
on the death screen, new mechanics (oil slick, shield `onBlock`, `bsp`/`cavern` floors), renaming spells.

## Machinery

- One supervisor trigger, "YODC sprint supervisor", id `trig_…` (filled in at setup), runs
  `.claude/skills/sprint-supervisor` in this folder (environment `env_0157HwSnMQCykikhVk9tpWUC`) at minute 2 of
  every hour from the evening before. Outside the window its first step stops it; after the window it switches
  itself off by this id. It is created from a session the owner started (desktop app or `claude rc`) with the
  remote `create_trigger` tool, so any agent can edit it later: a trigger made through the HTTP API can be
  changed only by its own runs or by the owner.
- It starts `YODC lane: <lane>`, `YODC plan: <lane>` and `YODC integrate` sessions and restarts any that
  stopped, for example after a usage limit.
- The sprint archiver: an hourly scheduled task at minute 50 that posts into a long-lived session the owner
  started (`claude rc` or the desktop app), because scheduled sessions have no `archive_session`. It archives
  finished sessions after an hour, and stuck ones (no event in 60 minutes, or 30 minutes waiting for an answer).
  It is on before the window opens, and the dry run proves it: one finished session archived, its process gone.
- Agents: `implementer` and `reviewer` (`.claude/agents/`); guard `.claude/hooks/sprint-guard.mjs`.

## Preflight (Claude runs it the evening before; the owner fixes what it finds)

1. GitHub Actions: the budget has room for about 300 more runs.
2. This computer: at least 30 GB of free disk and 8 GB of free memory; fewer than 10 sessions on the rc host
   (archive the rest).
3. The sprint archiver is on, and the dry run proved it (Machinery).
4. The supervisor trigger exists, its id is in Machinery, and the dry run showed an agent can switch it off.
5. Another project's sprint on this account or this computer in the same window has the owner's explicit OK:
   in October two sprints shared one usage limit and one laptop's memory.
6. The owner has answered the design questions for the first issues, and has approved the reserve backlog.

## Turning it off

- Pause: disable the supervisor trigger (its id is under Machinery). Running sessions finish their current task.
- Afterwards, one commit deletes this file, `.claude/skills/sprint-*`, `.claude/agents/{implementer,reviewer}.md`,
  `.claude/hooks/sprint-guard.mjs`, `scripts/__tests__/sprintGuard.test.ts` and the sprint lines in `CLAUDE.md`
  (`git diff pre-sprint-2026-10-20 -- CLAUDE.md .claude/` lists every machinery change). The lane worktrees go
  with `git worktree remove`; the `lane:*`, `sprint-ready`, `to-integrate`, `held` and `proposal` labels are
  deleted by the owner (`gh label delete` is the owner's).
