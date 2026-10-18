# Handoff: P-36 follow-ups, deep-start outfit next
2026-10-18 02:34 UTC · branch main · HEAD 14176d90 · tree clean · folder C:/Antigravity/YODC

## Goal
Finish the P-36 soak follow-ups. The owner's seven answers are applied and deployed (below); left: the deep-start outfit bug, optional soak-bot work, and a soak to measure the new Gálmr numbers.

## Decide first
- Rerun a soak on floors 5, 20, 26 and 34 once the outfit is fixed, to check Gálmr's deaths halved and get firmer late-game numbers? — recommend: yes, one overnight soak, because the Gálmr numbers (56 HP, 20% Shockwave) were picked, not measured.

## Done
- c6a794c4 monsters cast only when the flight would reach the hero (`castReaches`, `src/engine/magic/castTrace.ts:76`)
- 5fe6181d a spell that costs mana costs at least 1
- c2ce5cb3 a hostile spell aimed at the hero ends the rest (new built-in `spell_aimed` event)
- 8d8a59fb several Trickster's pieces count each step once
- a65a8f76 Gálmr: HP 68 to 56, Rime Shockwave chance 0.30 to 0.2
- 14176d90 P-36 retired from §9
- Uncommitted: none

## Next
1. Deep-start outfit (`src/engine/debug/triage.ts:240`): the fixed `() => 0.5` draw gives every piece the same family (all "Chaotic Trickster's" at floors 20+). Vary the draw per piece, deterministically; failing test first.
2. Optional soak work: `scripts/lib/soak-report.ts` counts findings by seed number, not (folder, seed); the bot never heals with spare mana against Gálmr and can't leave a radius-2 telegraph (`e2e/soak/playerBot.ts:1720`).
3. The hero bot still fires at visible monsters a corner blocks (`e2e/soak/playerBot.ts:1228`): monsters no longer do (c6a794c4). Check with the aim preview's trace if a soak shows it.

## Model
Sonnet 5.5 at medium thinking — step 1 is a specified change in one debug helper.

## Decisions
- Wall impacts fixed on the monster side, not by changing the flight: shots keep their straight path, so play feel is unchanged; monsters move for a clear shot instead.
- Cold stages unchanged — owner: "Leave it". P-37 stays deferred — owner: "Keep deferred (Recommended)".

## Dead ends
- A spell registered before a test's `new GameEngine` lands in the previous engine's registry when other tests ran first: register after creating the engine.

## Read first
- `src/engine/debug/triage.ts:240` — the outfit draw
- `.prompts/p36-answers.md` — the soak findings in plain terms

## Verification
- lint/test/tooling: green on 14176d90; sim, validate:schema: green; pre-push (build, Playwright x3): green; CI deploy: green on 14176d90
Resumed: 2026-10-18 02:36 UTC
