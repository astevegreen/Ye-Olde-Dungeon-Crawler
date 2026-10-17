# Handoff: P-36 full measurement soak
2026-10-17 11:27 UTC · branch main · HEAD 608428b8 · tree clean

## Goal
P-36 (ARCHITECTURE.md §9): measure magic in play. The soak now records what the owner's five questions need: is magic worth it, does the learning path work, floor pacing against the Hearth-Tear cold stages (3000/7000/12000/20000), do the six Runestones matter (P-37), is magic broken. Done when a full soak's `npm run soak:report` answers all five, the owner gets it in plain terms, and P-36's §9 entry is retired.

## Decide first
- Run the full measurement soak now (several hours: 9 seeds from town, plus 9 each deep-started on floors 14, 20, 26, 34)? — recommend: yes, because it is the only way to answer the Runestone question and to pace floors 21-25

## Done
- 674543ba soak records builds/Runestone policies, per-floor pace, spell damage/kills/failures, stones and altars missed; `npm run soak:report`
- 608428b8 bot crosses a found trap that walls it in; stops hiding from casters after 40 steps per floor
- Uncommitted: none

## Next
1. `npm run build`, then 9 seeds per arm with `node scripts/soak.mjs --lens player [--start-floor N] --from 1 --count 9 --workers 3`, each redirected to a `.prompts/*.txt`; run arms in parallel only if CPU allows (rest steps on the wall clock, `.claude/skills/soak/SKILL.md` Compare arms).
2. `npm run soak:report -- .prompts/soak/player .prompts/soak/player-floor14 ...` to a .txt; hand findings to log-analyst.
3. Report to the owner per question, plain terms; then retire P-36 in §9 (delete entry, add ID to retired list) only if the owner agrees the questions are answered.

## Model
Sonnet 5.5 at medium thinking — running and reading a specified soak; Opus only if the report shows a magic bug to trace.

## Decisions
- One build per seed n%3 (warrior/caster/hybrid), Runestone policy floor(n/3)%3 (first/second/leave): nine seeds cover every pair — chosen so one soak compares play styles
- Bot fixes touch only e2e/; game bugs reported, not fixed — brief `.prompts/p36-soak-data-audit.md`

## Dead ends
- Replaying a seed to diagnose a bot loop drifts (rest is wall-clock); decode the seed's `save-<n>.txt` (base64 JSON, `data.map.tilesRle`) instead

## Read first
- .claude/skills/soak/SKILL.md — flags, output fields, report
- .prompts/p36-soak-audit.md — the audit: gaps and what each fix answers
- .prompts/soak-report.txt — first run's tables (11 runs, pre-stall-fix)

## Verification
- gate-stamp lint test: green on 608428b8 (429 files, 3296 tests); pre-push (sim, build, Playwright 3 browsers): green, pushed
- Open findings, not fixed: shop focus slips to "Esc Menu" (player/1, S3, town action 65); input locked 5 s after rest on floor 16 (player-floor8/4, likely six browsers' load); Slow (0 power) credited 750 damage, maybe a ray-through-water reaction at src/engine/magic/spellPipeline.ts:1155
