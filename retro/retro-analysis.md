# YODC Retrospective: Rework Audit (2026-09-23)

## Bottom line

The plan isn't fundamentally broken. The tools are good: an architecture spec, automatic checks, one AI reviewing the other, and careful use of git. No rollback in git history lost meaningful work. What's off is the **order of work** and **where the effort goes**:

- Only about 1 in 6 commits added something a player would see (≈22 of 136). About 3 in 5 went to engine architecture, restructuring code, or the rules and checks themselves.
- The game's technical foundation was built to a production standard (a "frozen" engine, save-file upgrade chains, support for multiple games in one engine) while the game design was still changing week to week. When design changed, that foundation had to be retrofitted or thrown away.
- Verification checked whether the code was well-formed, not whether the game played correctly. The first time an agent played the built game start to finish (Sept 23), it found 7+ bugs in one session, even though 1,300 automated tests were passing.

Your own changes of mind account for only about 2 of the 15 biggest reworks. That part is normal. The rest came from the order of work and the process around it.

*"Typical game development" comparisons in this report are informed opinion, not data.*

---

## Sources and their limits

| Source | Coverage | Notes |
|---|---|---|
| Git history (138 commits) | 2026-09-11 → 09-23 | Saved as `git-log.txt` (already present, left unchanged), `git-churn.txt`, `git-reflog.txt` |
| Claude Code session logs (7) | 2026-09-20 → 09-23 only | Condensed: your prompts are complete, but assistant replies are trimmed to ~300 characters |
| Antigravity session logs (10) | 2026-09-20 → 09-23 only | Same trimming. **So handoff findings before Sept 20 come from git alone** |
| ARCHITECTURE.md + 8 sub-docs + 5 ADRs | Current | ADRs record several reworks directly |
| **Adversarial_Analysis.md** | **Not found** | Searched the repo, git history, Documents, Downloads, Desktop, OneDrive, My Drive, `.gemini`. Closest match: `.antigravity/skills/adversarial-audit.md` (the audit *procedure*, not a result) |

Other limits:
- About 100 of the 138 commits (Sept 11–19) have no session log from either tool. Their causes are inferred from commit messages and ADRs.
- Only 71 of 138 commits say which tool wrote them (all Claude). The `Agent: Antigravity` trailer only started on Sept 23, so pre-Sept-20 work can't be split by tool.
- The project predates git. The first commit imported 73,160 lines, and it contained an audit report dated **Sept 6** (`reports/architectural_audit.md`).
- I opened two raw transcripts to verify findings: Claude session `a4a6fde1` (the `dc5de31` assessment) and Antigravity session `3f76c169` (which tools it used).
- Commit categories below are my reading of commit subjects and file lists, so treat them as approximate.

---

## 1. Rework audit: 15 most significant reworks

Categories: **Arch** = Architecture/spec didn't fit actual game requirements · **Agent-Instr** = Agent misunderstood or ignored instructions · **Agent-Regr** = Agent introduced a regression/defect · **Mind** = You changed your mind after seeing it · **Scope** = Scope creep · **Handoff** = Multi-model handoff friction. **Confidence:** *Evidence* = shown directly by the sources. *Inferred* = the likely reading, not proven.

### Theme A: Technical foundation built ahead of the game

**1. Engine architecture retrofit (planned items P-01 to P-21)**. **Arch** · Evidence
An architecture audit's recommendations (`95f4296`, Sept 12: +2,017/−629 lines, 91 files) became a to-do register. About 25 commits on Sept 15–16 (`4166b13` … `d1f0b5f`) then reworked randomness, monster turns, events, and storage in a 73k-line codebase that had been declared an "engine freeze" on Sept 11 (`fc7df79`). The spec was written after the code, and the code was bent to match it. These commits carry Claude's trailer, so this isn't only an Antigravity problem.

**2. Per-engine registries (P-22)**. **Arch** · Evidence
12 commits, Sept 16–19 (`93a7bd9`, `ab8f689`, `01ed348`…`d0376b6`, `0305ae9`). `93a7bd9`'s message: nine registry classes with ~45 global fields meant two games loaded in one engine "share one set of lookups and the second registration leaks into the first." The original design didn't support the multi-game goal.

**3. Save-file upgrade chain built, then deleted**. **Arch** · Evidence
The save format went through 7 versions in 8 days (v5→v11: `95f4296`, `6486a15`, `8cd5825`, `be490c8`, `0339f1a`, `92ca137`, `2a9be38`). Each version needed an upgrade step. Then `df68c71` (Sept 20) deleted 458 lines from `migrator.ts` and 527 from its tests, because "no save predating v11 existed outside development" (ADR-0002). This is production-grade save compatibility for a game with no players yet.

**4. Scheduler speed-up built, measured, reverted**. **Arch** · Evidence
Built Sept 13 and reverted Sept 15 (ADR-0001; benchmark scripts last seen in `3d71469`). The gain was "sub-millisecond per turn at every tested population," and one of its six sync points "desynced and produced a real bug."

### Theme B: Game-specific content leaking into the shared engine, cleaned up five times

**5. Repeated "No Engine Creep" cleanups**. **Agent-Instr** · Evidence
The Sept 6 audit already flagged "Residual Norse strings in `src/engine/`." Cleanups followed: `cb1aec7` (Sept 16), `9cdc39b` (Sept 19), `b2ca822` (Sept 22), then `a67caa4` + `077ec9d` (Sept 23). The rule was written down the whole time, but no automatic check enforced it until `check:engine-creep` arrived in `cab9165` (Sept 23).

**6. Blood magic / hostage ritual redone**. **Agent-Instr** (with **Handoff**) · Evidence
Designed and built in one Antigravity conversation (`2026-09-22_antigravity_4.md`, design request 02:15Z, "implemented" 02:43Z), left uncommitted, then committed as **"Code Hygiene Pass"** (`dc5de31`, 1,274 lines, 22 engine files). Claude's review (raw transcript `a4a6fde1`, 12:43Z) found three problems:
- a protected-file edit with no stated exception
- Castle of the Winds names hard-coded into five engine files
- two conflicting implementations, where the tested one was unreachable ("Green tests over dead code")

It was reworked in `b2ca822`, where `engine.ts` got +46 lines in one commit and −46 in the next.

**7. Four town-return mechanics (plus their dispatcher) deleted**. **Agent-Instr** (probable) · Inferred
`b3132a3` (Sept 16) deleted 3,333 lines: Runic Conduit, Valkyrie Sprint, Dwarven Winch, Town Portal, and a floor-rotation dispatcher. The commit calls them "real, working, tested mechanics — undocumented additions with no architecture-review sign-off." That reads like an agent over-building from a loose request. No session log exists for when they were built, so it could also be a change of mind.

### Theme C: Game design iteration (normal)

**8. Rune of Return reworked three times in four days**. **Mind** · Evidence of the iterations; motive inferred
`350e365` (Sept 16) → `21f929e` (Sept 19, adds a skill tree and a discovery screen) → `76e5a29` (Sept 19, "two-way dimensional recall"). The two-way idea removed on Sept 16 came back three days later.

**9. Permafrost hazard became a giant-blood buff, and difficulty was redesigned**. **Mind** · Evidence
`46401b2` (Sept 18) and ADR-0003: "a design change, not a bug fix." Difficulty stopped controlling floor count and started scaling monster power instead.

### Theme D: Defects and regressions

**10. Character menu fix broke the Inventory screen**. **Agent-Regr** · Evidence · took more than 3 prompts
`df68c71` merged all menus into one (49 files, +2,656/−2,537, bundled in the same commit with the save-chain deletion). The follow-up fix `334c848` made the Inventory screen "blurred out and unusable" (`2026-09-21_1.md`, 01:56Z), and `54b38db` reverted that approach. The prompt told Antigravity to "manually verify in-browser" at two window sizes. Its transcript shows no browser tool was used: only file view, search, edit, and command-line tools. It substituted unit tests with fake screen-scale values.

**11. Bugs found only when an agent first played the built game (Sept 23)**. **Agent-Regr** (latent defects rather than broken working features) · Evidence
In one play session:
- a monster's action credited to the wrong actor (`7aa442f`)
- Continue resumed a dead character (`1c7c234`)
- the published build's code shrinking broke class-name checks (`f5acc97`)
- the map screen leaked keypresses, and default keys were bound twice (`dbd4492`)
- the WarCraft battle cry never fired (`51a62ee`)
- WarCraft showed Castle of the Winds titles and town name (`a67caa4`)
- monster types were guessed from their IDs (`077ec9d`)

Earlier, a code-quality sweep had found that ranged attacks always used DEX 14 and that stat potions did nothing (`b2ca822`, test `9f1bef6`).

**12. Tests that passed over broken behavior; test strategy redone four times**. **Arch** (the verification design didn't match what matters) · Evidence
- `ccde814` Test Suite Overhaul (Sept 14)
- Playwright setup `9fa33bb` replaced by a boot-only smoke test `e247f68` (Sept 15)
- optional campaign test `df0fb3d` (Sept 16)
- a real gameplay test only in `55638f2` (Sept 23)

Along the way, 1,211 tests passed with a deliberately broken wall sprite (`2026-09-21_2.md` 22:35Z, fixed by `af528c6`). A shop test passed with its buttons swapped (00:41Z). The blood-magic test covered only unreachable code.

### Theme E: Process and documentation rework

**13. Architecture doc and agent-rules churn**. **Scope** (of process, not of the game) · Evidence
`ARCHITECTURE.md` was touched by **61 of 138 commits**. It grew 5 KB (Sept 11) → 40 KB (Sept 13) → 80 KB (Sept 19), was split to 25 KB (`ec15022`, Sept 21), and is now 29 KB. Contradictions between the rule files were fixed at least four times (`ade6bba`, `80156d7`, `4963243`, `0b46af9`). The spec, rules, and agent-config files now total **138 KB** (~35k tokens).

**14. Token-efficiency restructure**. **Arch** (file layout didn't fit what AI agents can read cheaply) · Evidence
Sept 21: 13 commits, −8,676 lines that day. Five large files were split:
- `ARCHITECTURE.md` (`ec15022`)
- `sprites.ts` (`ca84fc4`)
- `main.ts` (`01f0745`)
- `diagnostic-modal` (`f6624cf`)
- `shop-overlay` (`71b8ab5`)

The trigger was two AI reports on how much the project cost to read.

**15. Relay friction between the two tools**. **Handoff** · Evidence
- Antigravity hung for hours on a `tsx -e` command that Claude's prompt told it to run ("a trap I built into the prompt," `2026-09-21_2.md` 18:04Z).
- Claude's prompt had wrong line ranges for the sprite split (18:07Z).
- Task 4.3 was relayed to Claude as "completed," but the session implementing it had stopped and explained why (`2026-09-21_3.md` 00:07Z vs `2026-09-21_2.md` 00:14Z).
- Prompt files were twice left at the repo root (`2026-09-21_3.md` 23:14Z, 00:02Z).
- Edits you had approved were flagged as rule violations because the approval wasn't written anywhere (ADR-0005; `2026-09-23.md` 09:46Z).

**Tally by primary cause:** Arch 6 · Agent-Instr 3 · Agent-Regr 2 · Mind 2 · Scope 1 · Handoff 1 (Handoff also contributes to #6 and #10).

---

## 2. Pattern and churn analysis

### Most frequent root causes
1. **Architecture/spec ahead of the game** (6 of 15, and by far the largest by volume, at about 38 commits of retrofitting). The spec asked for platform-grade properties before the game needed them: multiple games in one engine, save compatibility, performance headroom. Every design change then had to go through that machinery.
2. **Agent output that ignored rules or shipped defects, and verification didn't catch it** (5 of 15: #5, #6, #7, #10, #11). The common thread is that the checks measured code shape (imports, types, file boundaries), not game behavior. The rule against leaking game content into the engine was checked by hand for about 17 days.
3. **Process overhead** (#13, #15, plus contributions to #6 and #10). Keeping 138 KB of rules consistent, relaying prompts by copy-paste, and working from audit-generated fix lists.

**A driver outside your category list: audit-driven work.** I count at least 12 audit or assessment rounds in ~17 days:
- Sept 6 audit and the "finalization audit"
- `95f4296` recommendations
- PR #1 `audit/project-maintenance`
- `b12b134`
- the foundation housekeeping report
- the Gemini town-return document
- the DeepSeek evaluation
- two token-usage audits
- Antigravity's health analysis
- the repomix assessment (both tools)
- Claude's health analysis
- the governance and game-state assessment

Most of the architecture rework in Theme A and all of Theme E trace back to one of these. In the last three days (Sept 21–23), 45 commits landed: **1 added gameplay** (`dc5de31`), 7 fixed player-facing bugs, and 37 were restructuring, hygiene, or governance. Each "fix everything" pass also created new drift for the next audit to find. For example, dead exports were added in `71b8ab5` one commit before `7dc4dac` cleaned them up, and six docs went stale when a new check was added to lint.

**"Changed my mind" is a small share** (2 of 15). That's the normal part.

### Highest-churn files: redoing or normal growth?

| File | Commits | Verdict |
|---|---|---|
| `ARCHITECTURE.md` | 61 | **Redoing.** Grew to 80 KB, then was cut to 25 KB. +938/−708 lines in total for a file that's now ~230 lines |
| `src/engine/engine.ts` | 30 | **Mostly small wiring for the registry retrofit and new features** (+6/−2 each), plus one full add-and-undo pair (`dc5de31`/`b2ca822`). This "protected" file changed in 29 commits after the "engine freeze" |
| `src/main.ts` | 27 | **Normal growth.** Every feature connects here. One deliberate split (`01f0745`) |
| `storage/serializer.ts`, `storage/types.ts`, `migrator.ts` + test | 20 / 17 / 9 + 9 | **Redoing.** Seven save-format versions, then the upgrade chain was deleted |
| `src/engine/index.ts`, `types/manifest.ts` | 20 / 15 | **Normal growth.** Every new capability gets exported and declared here |
| `inventory-overlay.ts`, `input-handler.ts`, `canvas-renderer.ts`, `shop-overlay.ts` | 14 / 15 / 14 / 11 | **Mixed.** Mostly growth; inventory-overlay has one rewrite (`06c8660`, −370/+274) and one broken-then-reverted pair; shop-overlay was split |
| `.antigravity/rules.md` | 12 | **Process redoing.** Small edits to keep it in sync with other rules |
| `src/content/cotw/*` | 6–13 each | **Normal growth** of game content |

Line totals after day one: +57,756 / −23,677. Deletions are ~41% of additions, but file splits count twice, so this ratio overstates real waste.

**Summary:** game-code churn is mostly normal growth plus the one-time architecture retrofit. Genuine redoing is concentrated in the architecture doc, the save format, and a few UI screens.

---

## 3. Structural diagnosis

### The Plan

**Evidence**
- The technical foundation was locked early and then rebuilt. "Engine freeze" happened on day one (`fc7df79`), but the frozen engine changed in 29 commits, the save chain was built and deleted, and the registries were retrofitted.
- A second game pack (WarCraft) was built before the first is balanced. On Sept 23 WarCraft showed Castle of the Winds branding and town name and drew letter glyphs instead of art (`2026-09-23.md` 02:48–02:49Z).
- Balance is unknown. A scripted bot on Sept 23 found floors 1–3 "nearly free" and floor 5 killing "a naive player outright" (02:48Z). That's a bot, not a human, but it's the first balance data in the sources.
- Systems were built wide rather than deep: two storyline acts, 83 items, a 50-floor campaign, pacts, companions, blood magic, Rune of Return, an ability tree, and two packs, while the basic loop (walk, fight, descend) was never checked end to end until day ~17.
- Lopsided design effort: technical design is heavy (138 KB of rules and specs). Game design is light: blood magic went from idea to 1,274 lines in under an hour, and the four deleted town-return mechanics had no design record. I found no document describing the intended player experience or balance targets. The docs in the repo describe how systems are wired.

**Informed opinion**
- Small roguelike projects usually start with a rough, playable core loop that gets played daily. Systems are added one at a time, and the architecture is hardened once the design stops moving. This project inverted that order. That inversion, not your iteration, is why changes felt expensive.
- Wanting future packs is a fine long-term goal. Building for it before one pack is fun doubled the surface area of every change.

### The Workflow

**Evidence**
- **Task size.** Prompts are often very large and open-ended:
  - "Implement all recommended options"
  - "Fix all of the issues you identified. Then perform a holistic health analysis … fix any identified issues without asking permission"
  - "Fix all mistakes and audit issues, and tie up all loose ends"

  One session ended with 68 uncommitted files (`2026-09-22.md` 00:31Z). Commits mix unrelated work under vague labels: `df68c71` bundles a feature, a menu merge, and deletion of the save chain; `e7dbac7` "Bug Fixes" restructured the whole monster roster; `dc5de31` "Code Hygiene Pass" is a new feature.
- **Instructions.** Claude-written prompts were detailed, and some worked very well: the Phase 3 "stop rule" made the agent stop and report instead of forcing a bad split. But some carried unchecked assumptions (the `tsx -e` hang, wrong line ranges, a wrong estimate for Task 4.3). Antigravity skipped explicit instructions twice: the browser check (#10) and the architecture rules (#6).
- **Verification.** The automatic checks are strong for code structure and did catch real problems: the pre-commit hook caught a type error the tests missed (`2026-09-21_2.md` 00:44Z), and the test suite caught a wrongly removed monster wake-up behavior (`2026-09-22.md` 00:22Z). They're weak for gameplay: CI only checked that the game boots until Sept 23, the shop panels had no tests at all (`2026-09-21_2.md` 00:40Z), and tests passed over broken behavior (#12).
- **Handoffs.** You relay prompts and status by hand between tools. That produced a misread status (Task 4.3), uncommitted work from one task getting mixed into another tool's commit (#6), and twice sending the same prompt to both tools at once (the DeepSeek evaluation and the repomix assessment), which is duplicate effort. Claude's review of Antigravity's work caught the two largest Antigravity problems, so the review step itself is earning its keep.
- **Rules overhead.** The 138 KB of rules led directly to a one-day restructure just to make them cheaper to read (#14), and to your approved edits being flagged as violations (#15).

**Informed opinion**
- The two-tool split is workable, but only if each handoff is a finished, committed, clearly labeled piece of work. At the moment the handoffs pass along half-finished state.
- The rules keep growing because each incident adds a rule. Past a point, keeping the rules consistent becomes its own job. This project is at or past that point for a solo project.

---

## 4. Recommendations (ranked by rework likely prevented)

**1. Freeze the foundation and make one game fun first.** [Act now] (addresses Pattern 1, Plan diagnosis)
Treat Castle of the Winds as the only game until a short slice is fun to play: town → the first several floors → the first boss. Pause WarCraft and any new engine-architecture items. The only exception is when a gameplay feature you want is actually blocked by the engine. When an audit proposes architecture work, the question to ask is "does a player feel this in the next month?" If not, park it. *This targets the biggest source of past rework (Theme A, ~38 commits).*

**2. Define "done" as "played and seen working," with proof.** [Act now, and later a `/playtest` skill] (addresses Pattern 2, #10, #11, #12)
End every task prompt with a line like: *"Done means you started a new game in the built version, did X, and saw Y. Include a screenshot. Passing tests alone is not done."* Reject a reply that doesn't include that proof, and play the result yourself for five minutes before starting the next task. Later, turn this into a reusable skill that builds the game, runs the gameplay test, plays a scripted route, and reports with screenshots.

**3. Write a one-paragraph design card before any new mechanic, then build the smallest playable version.** [Skill later; you can start by hand now] (addresses #6, #7, #8, #9, Plan diagnosis)
Before asking for a feature, write in plain words: what the player does, what they see, why it's fun, and what "too strong" or "too weak" looks like. Ask the agent for the smallest version you can play today, play it, then decide on the next piece. Don't use "implement all recommended options." Pick one option. This turns expensive rebuilds, like blood magic built in an hour and four town-return mechanics built then deleted, into cheap early changes. Later, a skill could interview you and produce the card plus a slice plan.

**4. Stop open-ended "holistic audit, fix everything" requests.** [Act now] (addresses the audit-loop pattern, #13, #14)
Audit only at milestones, for example after the slice in #1 is playable. When an audit returns a list, you choose the 3–5 items that affect the player or block your next feature, and the rest wait. Don't add a new rule unless a real problem happened twice. This breaks the cycle where each audit creates work that the next audit then flags.

**5. One task, one tool, one commit, then hand off.** [Act now, and later a `/handoff` skill] (addresses Pattern 3, #6, #15)
Before switching between Antigravity and Claude, the current tool finishes the task and commits it with a message that says what changed in plain words, or the change is thrown away. Nothing is left half-done in the folder. When you report status to the other tool, paste the first tool's final reply instead of summarizing it. Don't send the same request to both tools at once. Later, a skill could produce the Antigravity prompt with the done-criteria, the commit rule, and a report template built in.

**Act on now:** 1, 2, 4, 5. **Good candidates for reusable skills later:** 2 (`/playtest`), 3 (design card), 5 (`/handoff`).

---

## Appendix A: Commit classification (approximate, from commit subjects and file lists)

| Category | ≈ Commits | Share |
|---|---:|---:|
| New gameplay, content, or visuals | 22 | 16% |
| Player-facing bug fixes | 12 | 9% |
| Engine-architecture retrofits (P-items, registries, content extraction) | 38 | 28% |
| Code restructuring and hygiene (splits, dead code, typing) | 19 | 14% |
| Docs, agent rules, checks, CI, tests only | 45 | 33% |

(136 non-merge commits.)

## Appendix B: Session-start check (per CLAUDE.md)

`git log verified..HEAD` was empty (tag `verified` = `55638f2` = HEAD), and there were no uncommitted engine changes. The only untracked items were `retro/` and the two `scripts/extract_*retro.py` files. Nothing needed review, and the tag was not moved.
