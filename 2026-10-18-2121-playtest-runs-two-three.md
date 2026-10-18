# Handoff: playtest runs 2 and 3 (yodc-07)
2026-10-18 21:21 UTC · branch worktree-playtest-yodc-07 · HEAD 2af973ab · tree 1 uncommitted file · folder C:/Antigravity/YODC/.claude/worktrees/playtest-yodc-07

## Goal
"Play the live game as a player would and fix what breaks." This session took runs 2 and 3 (caster and DEX/Hard, breaking the Oath, leaving the Hearth-Tear, every spell found, F2 deep start to floors 20+, both endings, 1920 and narrow). Peer yodc-f8 had run 1 and owns `log.md`. Bugs are fixed and pushed; the owner's calls wait below.

## Decide first
- A monster's charge that knocks the hero into a chasm kills outright under 200 max HP (`impulse.ts`, `BOSS_CHASM_IMMUNITY_HP_THRESHOLD`), with 120 HP left — recommend: the hero takes fall damage instead, because a missed chasm tile shouldn't end a 25-level run.
- Leaving the Hearth-Tear on floor 25 gives no warning, and the matriarch never comes — recommend: one line on leaving the floor ("The Hearth-Tear still lies where the Warden fell."), because Act 1 is lost silently.
- The Sealed ending says "hearths burn warm" even when the Tear never came home — recommend: a variant paragraph for that path.
- Bolt range counts a circle (5 diagonal steps = 7.1), so a "6 tile" Magic Arrow fades short of a foe 5 steps away diagonally — recommend: count steps like every other range (longer diagonal shots: a balance call).
- At 760 wide the character menu now scrolls sideways — recommend: keep it unless narrow windows matter; a stacked layout otherwise.
- Wording: "Ten levels under Bjarnarhaven" (counts hero levels, reads as floors); "Sure Shot" is a melee bonus — recommend: reword both.
- Feel: fleeing Níðhögg only waits; the Ember-Fang Wolf "waits a moment" while the hero is bitten; no HP/Seiðr regen while a fled monster blocks Rest — recommend: look at the wolf first (possible default stay order).

## Done
- 1dd68920 2e2ad85f bc505e74 b6e55452 cc806332 8693e28c 2af973ab (cleanse spam, self-aim refusal, cast wording, matriarch tense, aim opens on nearest foe, narrow menu columns, refused cast says why)
- Uncommitted: none (`.playwright-mcp/` is scratch)

## Next
1. Complete. Answers to the questions above start new tasks; the full list with screenshots is `.prompts/playtest/log-yodc-07.md` (main checkout).
2. Prune worktree `.claude/worktrees/playtest-yodc-07` (all pushed).

## Decisions
- Chasm knockback: the hero takes fall damage instead of dying — owner: "Fall damage (Recommended)"
- Hearth-Tear left behind: a nudge line on leaving floor 25, plus a Sealed-ending variant — owner: "Nudge + ending variant (Recommended)"
- Bolt range counts grid steps — owner: "Count steps (Recommended)"
- Narrow character menu keeps the sideways scroll — owner: "Keep sideways scroll (Recommended)"
- Reword "Ten levels under Bjarnarhaven" and "Sure Shot"; poison ticks don't stop a rest; investigate the idle wolf / fleeing Níðhögg / fled foe blocking regen — owner chose all

## Read first
- .prompts/playtest/log-yodc-07.md — every finding, with screenshot paths
- .prompts/playtest/claims.md — who fixed what across sessions

## Verification
- gates (lint, unit 3294, tooling, sim, schema, build, Playwright Chromium): green on c7453539 before rebase; gate-stamp green after rebase (3316 tests)
- pre-push (three browsers) and ci:watch: green on 2af973ab, deployed
Resumed: 2026-10-18 22:17 UTC
