# Sprint: Act II, The Rot Below

**Window:** set when the sprint is cued. `/sprint-start [hours]` opens it from that minute, for 40 hours
unless it names others, and `node scripts/sprint/queue.mjs window` prints it in UTC and Eastern. This file
holds no time (Machinery).

Inside the window this file overrides `CLAUDE.md` wherever they conflict: its "ask and wait" steps, "push
each finished task" and "explain each decision in chat". Outside it, this file is inactive. `ARCHITECTURE.md`
is never overridden.

**Goal:** build Act II's arc, "The Rot Below", and the polish reserve with as little owner input as possible,
without lowering quality: every change has tests, passes the gates, gets a reviewer pass, and lands through
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

Each commit's trailer quotes the permission it rests on:
- Act II (lanes `story` and `lore`, and every item marked "(Act II)"):
  `Requested: "Act II: The Rot Below" (sprint <ID>)`
- the reserve: `Requested: "A headline feature + polish (Recommended)" (sprint <ID>)`
- a soak finding: `Requested: "A headline feature + polish (Recommended)" (sprint S<n>, soak finding)`
- a hunt finding: `Requested: "A headline feature + polish (Recommended)" (sprint S<n>, hunt finding)`

## What still stops a task (unchanged)

- **Product decisions are the owner's**: balance feel, scope, a save-format break (`migrator.ts`,
  `CURRENT_SCHEMA_VERSION`), new mechanics, and a name or placement the design leaves open. A task that needs
  one: comment one question on the issue, label it `blocked`, and move on. Never invent a rule.
- **§8.1 protected files**: only exception 1 (a confirmed bug, shown by a test that fails without the fix),
  and never `migrator.ts`. Exceptions 2–5 are not available to the sprint.
- **Locked paths** (`.claude/hooks/sprint-guard.mjs --file-lock`): `.claude/`, `.githooks/`, `.github/`,
  `scripts/sprint/`, this file, `CLAUDE.md`, `ARCHITECTURE.md`, `package.json`, `package-lock.json`, `migrator.ts`. No new
  dependencies.
- Every `ARCHITECTURE.md` invariant, every hook, and the gates. Hooks are never skipped.
- Only the integrator pushes, and only `git push origin HEAD:main`.

## Lanes

Each open sprint issue carries exactly one lane label. One coordinator runs per lane, and each lane builds
in its own persistent worktree, so lanes never share a working tree.

| Lane       | Label           | Worktree                          | Where it works                                       |
| ---------- | --------------- | --------------------------------- | ---------------------------------------------------- |
| `story`    | `lane:story`    | `C:/Antigravity/YODC-lane-story`  | Act II's arc: faction, hubs, the Great Tap, epilogues, objectives, art (`src/content/cotw/`) |
| `lore`     | `lane:lore`     | `C:/Antigravity/YODC-lane-lore`   | Act II's words and town: vignettes, town, dialogue, barks, shrines, bestiary (`src/content/cotw/`) |
| `ux`       | `lane:ux`       | `C:/Antigravity/YODC-lane-ux`     | Player aids and UX: `src/ui/`, `src/rendering/`, `src/main/`, `index.html` |
| `fixes`    | `lane:fixes`    | `C:/Antigravity/YODC-lane-fixes`  | Engine and content bugs: `src/engine/`, `src/content/` |
| `tooling`  | `lane:tooling`  | `C:/Antigravity/YODC-lane-tooling`| `e2e/soak/`, `scripts/` (never `scripts/sprint/`)    |
| `research` | `lane:research` | `C:/Antigravity/YODC-research`    | Soaks and bug hunts; reports and proposals as issue comments, no repo changes |

The integrator works in `C:/Antigravity/YODC-integrate`. The main checkout is only fetched and fast-forwarded.
While the window is open, the pre-push hook refuses a push to main from any other folder (`scripts/sprint/push-lock.mjs`).
Both Act II lanes edit `src/content/cotw/index.ts`: keep each change to its own lines, so cherry-picks apply.

## Flow

1. `sprint-plan <lane>` turns backlog items into issues titled `[task] <ID>: <what>`, labelled `lane:<lane>`
   and `sprint-ready`.
2. `sprint-lane <lane>` takes one at a time: the `implementer` builds it on branch `sprint/<issue>` from
   `origin/main` in the lane's worktree and commits (the pre-commit hook gates each commit); the `reviewer`
   reads `git diff origin/main...sprint/<issue>`. PASS: label `to-integrate`.
3. `sprint-integrate` takes up to three `to-integrate` issues per push, oldest first: cherry-picks each
   branch onto `origin/main` as its own commits, runs the gates once, pushes, watches CI, closes the issues
   and logs what players will see. A conflict sends back only the issue that caused it; a red gate or a red
   deploy sends the batch through again one issue at a time, and the one that fails alone goes back as `held`.

Labels: `lane:*`, `sprint-ready`, `in-progress`, `to-integrate`, `held`, `blocked`, `proposal`. Which issue is
ready, whose comment counts, when held work is retried, whether a session has work and the status block are
decided by the queue (`scripts/sprint/queue.mjs`, Machinery), never by hand.
Progress, questions and every push go to the pinned issue #19 "Sprint log". Its body is the status block,
which the supervisor rewrites every hour; comments hold the history.

## Act II: The Rot Below (approved design)

A blight eats Yggdrasil's roots under floors 26–49. The Sap-tappers drive silver spigots into the roots and
drink the sap; the Rot is what leaks, and Níðhöggr gnaws behind it. Three hubs, one per stretch of Act II,
each hold one NPC and one choice. The hero either takes the tappers' offer (tapped) or mends the root
(mended), and the tally colours the ending. Built from existing primitives: no engine change, no protected
file, no save-format change (flags, counters and factions are open records saved whole).

- **The Sap-tappers**, a faction (`sap_tappers`) shown in the Story tab once met. Its standing is only a
  visible mirror; the ending reads two counters, `rot_tapped` and `rot_mended`.
- **Hub 26, Tarnished Silver Veins:** a sap-tapper deserter by a campfire. She explains the spigots and the
  Rot. Choice: take a tapper's flask (tapped), pull the spigot (mended, and nearby monsters wake), or leave.
- **Hub 34, World-Bark Descent:** a bark-skinned root-warden, kin of the old grove-folk. She tells of the
  Great Tap, which the tappers will open under floor 40. Choice: swear to break it (the hero is sworn) or
  accept the tappers' safe-conduct (tapped).
- **The Great Tap, floor 40:** a labelled countdown, "The Great Tap", runs for a sworn hero, from the oath or
  from reaching floor 40 (Sprint question 3). Break the spigot in time: mended. If the countdown runs out, it
  opens (Sprint question 3).
- **Hub 43, the Maw's brink:** a sap-tapper elder who speaks for Níðhöggr: the tappers feed the wyrm on
  purpose. Choice: drink from her cup (tapped, and the display-only mark "Sap-drunk") or ward the Maw
  (mended). Hel's galdr altar shares the floor.
- **The ending:** each of the two endings gains a closing paragraph, "Tapped" or "Mended", by the rule
  Sprint question 1 settles. A hero who skipped the hubs reads "Mended". No new ending.
- **The world answers:** one objective line per hub and one for the Great Tap, each hub's pointing at its NPC
  (`pointTo` names entities only, so the Great Tap's line points at nothing and its bearing falls back to the
  nearest stairs down); town patches (spigots, green shoots, black sap) and town dialogue that follow the tally; the
  Act II vignettes on floors 26, 34 and 43 rewritten in place; companion barks for floors 26–49; four
  sap-shrines with lore verses; the root-creatures' bestiary verses rewritten as blighted kin.
- **Every one-time option** needs a `hasFlag … value:false` guard: NPC choices cost no turn and never resolve
  by themselves.
- **A hero already past a hub floor** misses that hub; the ending then counts it as neither.

Wording in each NPC's voice is the sprint's to write, short and in the pack's Norse register. These are the
owner's, asked on the "Sprint questions" issue with a recommendation each; plan sessions file only the items
an answered question settles:
1. **The ending's rule** (A2): (a) the tally, "Tapped" when `rot_tapped` is 2 or more; (b) a standing
   threshold, which kills could swing. Recommended: (a).
2. **What the tappers' offers give** (A3, A5): (a) existing items, a temporary buff and the display-only
   mark; (b) a permanent stat, a balance call. Recommended: (a).
3. **The Great Tap's countdown** (A4, A6, L2). While any countdown runs, the hero cannot rest on any floor,
   town included (`src/engine/actions/autoRest.ts:84-88`). When it starts: (a) at the oath on floor 34, about
   500 turns, so no resting from the oath until the spigot breaks or time runs out; (b) when the sworn hero
   first reaches floor 40, about 150 turns, so no resting only there (a hook, as the Siphon ritual starts its
   countdown, `hostageRitual.ts:681-691`). When it runs out: (c) it counts as tapped and floods the town with
   black sap; (d) nothing happens. Recommended: (b) and (c), the length tuned by a soak (E1).
4. **Fighters and the deserter** (L8): no Sap-tapper fighters this sprint (the Rot's creatures exist); the
   deserter follows the hero to town after a mend as a stretch item. Recommended: both.
5. **The three NPCs' names** (A3–A5): (a) the sprint writes them, distinct from every existing name, and the
   reviewer checks the register; (b) the owner names them. Recommended: (a).

## Backlog

Work in this order inside a lane. Each item is one line `- **<ID>** <what>`, under a `### <lane>` heading;
the queue reads the IDs and their order from here, as pushed to `origin/main`, so a change lands for every
session at once. An item too big for about 300 changed lines becomes `<ID>a`, `<ID>b`, each provable on its
own. IDs never repeat an earlier sprint's letter (B, H, M, R, S, T and U are October's). Sources: the Act II
design sketch and the backlog survey of 24 Oct, the playtest logs (`C:/Antigravity/YODC/.prompts/playtest/log.md`,
`log-yodc-07.md`), and the proposal issues #20, #53, #56, #62, #63 and #69.

### story (Act II's arc)

- **A1** Scaffold `src/content/cotw/rot.ts`: the `sap_tappers` faction (`FactionDefinition`, `factions.ts:24-30`;
  standing 0 in `initialWorldState.factions`, `index.ts:255-263`); a pre-hook that sets its `metFlag` when the
  hero bumps a hub NPC (copy `IVALDA_MET_HOOK`, `ironClans.ts:227-237`) and calls `modifyFaction(ws, id, 0)` so
  older saves get the key; the tally predicates on `rot_tapped` and `rot_mended`; the "Sap-drunk" mark
  (`HeroMarkDefinition`, `manifest.ts:596`; `index.ts:267`); four tracked milestones (`index.ts:180-195`); the
  hooks appended at the end of `actionHooks` (`index.ts:234`). Act II's tiles, choices and placements stay in
  `rot.ts`, each joined to the pack by one spread line at the end of its array (the way the barrows join:
  `tiles.ts:197`, `choices.ts:158`, `index.ts:347`), so lane `lore`'s lines never touch the same ones.
- **A2** The ending's two paragraphs on each ending: four `conditionalNarrative` entries (`quest.ts:110` and
  `:148`; type `manifest.ts:535-540`; no `before`, so each closes its ending), by Sprint question 1's rule, and
  a test that every combination of the hub choices gives exactly one paragraph per ending. Waits for: A1.
- **A3** Hub 26: the deserter's campfire-grotto vault (`vaults.ts`, the shape of `:345-392`), placed by
  `scriptedVaultPlacements` (`index.ts:375`) with her `ScriptedVaultNpc` (`manifest.ts:1389-1397`), and her
  choice `rot_hub_26` (the `IVALDA_CHOICE` pattern, `ironClans.ts:68-108`): flask, spigot or leave. No guards in
  the vault. Floors 26, 34 and 43 each open a zone in its threshold room (`floorLayouts.ts:26`, `:28`, `:30`),
  and no scripted vault sits on a threshold floor yet: a test shows this vault placed, its NPC reachable, on 15
  seeds before A4 and A5 copy it. Waits for: A1.
- **A4** Hub 34: the root-warden's vault, placement and choice; the oath sets `great_tap_sworn`, and starts
  the countdown too if Sprint question 3 says (a). Waits for: A1, A3.
- **A5** Hub 43: the elder's vault, placement and choice, beside `galdr_altar_hel` (`index.ts:359`; floor 47
  already pairs a vault with an altar). Waits for: A1, A3.
- **A6** The Great Tap: its tile and choice in `rot.ts`, placed on floor 40 (`middle_room_center`, the
  `fixedTilePlacements` shape of `index.ts:340-361`), and the labelled `TimedEventDefinition` "The Great Tap"
  (model `SIPHON_TIMED_EVENT`, `hostageRitual.ts:518-532`; listed at `index.ts:241`), started by Sprint
  question 3's rule: the oath, or a hook when a sworn hero first reaches floor 40. Its expiry consequences hold
  nothing floor-specific: the town reads a flag. Waits for: A1, A4.
- **A7** Objectives: one line per hub and one for the Great Tap, before `cotw_objective_act2`
  (`objectives.ts:57`), each hub's with `pointTo` its NPC (`manifest.ts:691`: entity ids only, so the Great
  Tap's line has none), done when its resolved flag is set or `deepest` passes its floor (the done rule is an
  OR, `src/engine/quest/objectives.ts:10-14`). Waits for: A3, A4, A5, A6.
- **A8** Art: sprites and portraits for the three NPCs (`sprites/allySprites.ts:45`, `portraitSprites.ts:70`),
  the Great Tap's tile recipe (`sprites/tiles.ts`), and their `spriteRecipes.test.ts` aliases. Waits for: A3,
  A4, A5, A6.
- **A9** `rotArc.test.ts` on the real `cotwManifest` (models: `ironClans.test.ts`, `nornicReliquaries.test.ts`):
  every NPC `choiceId` and tile handler resolves; every flag set is read somewhere; the three hub vaults appear
  on 15 seeds with their NPC reachable; the Great Tap is placed on floor 40; the objective chain advances; a
  save round trip keeps the flags, counters and standing. Waits for: A7.

### lore (Act II's words and town)

- **L1** Rewrite the Act II vignettes on floors 26, 34 and 43 in place (`narrative.ts:100-117`), naming the
  hubs' flags. Waits for: A3, A4, A5.
- **L2** Town patches that follow the tally: `TOWN_PATCHES` entries (`townStages.ts:79-136`, gated as at
  `:42-44`) for spigots and green shoots, which need new `townThing` tiles (`tiles.ts:49-78`), and black sap
  after the Great Tap opens, which reuses `town_black_sap` (`tiles.ts:55`) on cells the `roots` patch
  (`townStages.ts:89-104`) leaves alone, since the last due patch wins a cell; `townStages.test.ts` lane-walk
  entries. Waits for: A1, A6.
- **L3** Act II town dialogue: a `setDialogue` hook inserted right after `COTW_TOWN_REACTIVE_HOOK` (`index.ts:218`) and
  `COTW_HOMECOMING_HOOK` (`:213`), since the last writer wins (pattern `narrative.ts:177-398`), for Olaf, Mimir,
  Torvald and Gunther. Waits for: A1.
- **L4** Companion barks for floors 26–37: widen the floor gate (`narrative.ts:416`), for `hearth_frost_hound`
  and `ember_fang_wolf`.
- **L5** Companion barks for floors 38–49, with Rot-state variants in the `byMark` idiom (`narrative.ts:401`).
  Waits for: A1.
- **L6** Four sap-shrines on floors 28, 33, 38 and 41 (no galdr or scripted floor): a tile and a read-only
  choice each (one key per placed tile, as `BARROWS`, `ironClans.ts:151-225`), four `loreEntries` verses
  (model `runestones.ts:90`, `index.ts:197`), and the shrine's tile recipe (`sprites/tiles.ts`) and
  `spriteRecipes.test.ts` alias. They live in a new `sapShrines.ts`, joined by one spread line each right after
  the barrows' (`tiles.ts:197`, `choices.ts:158`, `index.ts:347`), never at the arrays' ends, where A6 adds.
- **L7** Bestiary as blighted kin: rewrite the `hintVerse` of `root_wraith`, `bark_husk_miner`,
  `amber_sap_weeper`, `rotwood_crawler` and `root_bound_berserker` (`killRites.ts:249-310`) and the descriptions
  of the families that list them (`monsterCategories.ts`, at `:28`, `:30`, `:51`, `:53` and `:117`). Lore only;
  no monster changes.
- **L8** Stretch, by Sprint question 4: the deserter moves to Bjarnarhaven after a mend (the
  `moveIvaldaToTown` pattern, `ironClans.ts:283-302`). Waits for: A3, L2.

### ux (player aids)

- **X1** (Act II) Tests only, since both models are already generic: a `storyTab.test.ts` case for the
  Sap-tappers in `buildStanding` (`src/ui/characterMenu/storyModel.ts:138-158`): hidden before meeting, shown
  after, the tier labels, the bar at ±100; and one for the Great Tap's countdown in the sidebar
  (`src/ui/sidebar/sidebarModel.ts:142-146`). No presentation code changes. Waits for: A1, A6.
- **X2** The hero-creation stat − and + buttons get accessible names (`index.html:182-184`).
- **X3** An overburdened hero who cannot move is told once to drop something, instead of "cannot move!" again
  and again (`src/engine/actions/movement.ts:53`).
- **X4** The "First stat" choice at hero creation says it is about spells (`index.html:168`,
  `src/ui/title-screen.ts:381`).
- **X5** Rest (`KeyR`) with the map open does nothing and says nothing (#20, #69: 4–15 seeds per soak).
  Question: stay silent, or print a line.
- **X6** Reproduce, then fix or close: the console's Rest entry hides at full health and Seiðr although Rest
  now settles Void Debt (`src/ui/console/consoleModel.ts:109`).
- **X7** Reproduce, then fix or close: the F1 Spellbook card overlaps the log at 1366×768 (#37); a
  `visual-check` capture first.
- **X8** Reproduce, then fix or close: shop focus returns to the same row, not the moved selection
  (`src/ui/keepFocus.ts`, #51).
- **X9** Hrefna speaks to the newest teaching, not the fixed order altar, debt, first spell
  (`src/content/cotw/hrefna.ts:79`, #63; a test pins today's order). Question: newest first, or keep the order.
- **X10** Playtest leftovers, each reproduced on today's build first, then fixed or closed: shop number keys
  renumber after a sold-out row; Esc deselects before closing the inventory; the pack weight differs between
  inventory (17.1/40) and shop (6.3/30) (question: which to show); "(3x)" beside "×2"; the "+1" badge reads as
  renown; Thrain assumes a Rune of Return; Thrym's lines repeat on floor 4; at 1920×1080 the map fills half its
  pane. Splits into X10a–X10h, one leftover each, in that order; X10c (the pack weight) waits for its question.

### fixes (unverified bugs; a failing test first, or close with a reason)

- **F1** Take all from a worn belt, purse or rune pouch moves nothing but spends a turn (#70;
  `src/engine/actions/inventory-actions.ts:414`, the fix pattern at `:326`).
- **F2** The canvas may stay black after the GPU drops its context: nothing redraws on `contextrestored` (#47).
  Reproduce or close.
- **F3** A tactical effect batch can be cut short under about 12 fps by the stall deadline
  (`src/rendering/fxRunner.ts:226-227`, #63 candidate 6). Reproduce or close.
- **F4** Rally Howl at full health logs "(+0 HP to <hound>, you feel hastened…)" (`src/content/cotw/town.ts:218`).

### tooling

- **K1** (Act II) Act II soaks: a `SOAK_FLAGS` setting that sets world flags through
  `window.__cotwEngine.setWorldFlag` before the deep-start jump (`e2e/soak.spec.ts:246-301`), so a
  `--start-floor` soak can start with earlier hubs settled; and check that the bot bumps a hub NPC.
- **K2** soak-report's "all findings" table counts findings tagged stairs or latency
  (`scripts/lib/soak-report.ts` never reads `tag`). Reproduce or close.
- **K3** The soak oracle "same line N times" fires in 39 of 41 R4 seeds although U1b collapses the display
  (`e2e/soak/oracles.ts:453`, #69). Question: are the repeated lines intended (R4 option 3).
- **K4** The soak bot casts Phase Door: known in 41 of 41 R4 runs, never cast (`e2e/soak/playerBot.ts:711`,
  #69 option 1). Question: approve R4 option 1.
- **K5** SonarCloud complexity: split the worst S3776 functions outside `scripts/sprint/`, starting with
  `scripts/lib/soak-report.ts:173` (77). Question: is this worth sprint time.

### research (decides nothing; first line of each report: "Proposal, not a rule")

Each open item's line ends with `Waits for:` (backlog IDs or issue numbers, or `nothing`; an ID waits until
every issue of it is closed), `Soaks:` (lens `player`, `--workers 2` unless it says otherwise) and what its
report covers. The queue reads them here, with any `Waits for:` line in the item's issue; nothing keeps a copy.
The bug hunt runs on its own every 12 hours (`sprint-research` step 4); the first, H1, reads `src/` since
74e30d5e, where October's last hunt stopped.

- **E1** (Act II) An Act II soak: does each hub's vault appear, does the bot reach its NPC, and how many turns
  the Great Tap's countdown has left when the bot reaches the spigot; findings that are bugs become `fixes` issues
  (permission 6). Waits for: A3–A6, K1. Soaks: one with `--start-floor 26`, `--count 12`. Report: per seed,
  each hub found and its NPC reached, the countdown's turns left, and each bug filed.
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
- **Supervisor.** "YODC sprint supervisor", made by `/sprint-start` with the remote `create_trigger` tool,
  runs `.claude/skills/sprint-supervisor` in a fresh session at minute 22 of every hour (Terminal Dusk's keeps
  minute 2).
  - It starts `YODC lane: <lane>`, `YODC plan: <lane>` and `YODC integrate` sessions and restarts any that
    stopped. After a usage limit it restarts 2 minutes past the reset the error names (`queue.mjs resume`).
  - A limit also stops its own runs, which fail in seconds until the reset. So `/sprint-start` makes "YODC
    sprint supervisor wake", a one-shot of the same skill, and each lane taking an issue reads its session's
    `rate_limit_info.resetsAt` (`get_session`) and moves the wake to 2 minutes past it (`queue.mjs wake`),
    unless the :22 run follows within 15 minutes. The window's end and `/sprint-stop` switch it off.
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
  - `status` for the status block;
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
  question goes in one issue, "Sprint questions": one numbered question per comment, with options and a
  recommended answer. The owner answers them in one sitting before the window opens, by number; plan sessions
  then file the items those answers settle.
- During the window, a new question goes on its task issue as usual, since lanes look for the answer there.
  The status block links it under "Needs you".

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
