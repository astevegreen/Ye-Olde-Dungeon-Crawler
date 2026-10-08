---
name: soak
description: Overnight soak runs of the built game by a seeded bot. Use when the owner asks to run, compare or read a soak; when a bot change or a balance change needs measuring over many seeds; when reading `findings.jsonl`, `runs.jsonl` or a seed's `summary.json`; or when the owner mentions the soak-fix campaign, the bot's phases or Gálmr.
---

# Soak

A soak is `e2e/soak.spec.ts` played once per seed by a seeded bot through real input against the built bundle, with oracles checking the game after every action. No gate runs it; `npm run soak` (`scripts/soak.mjs`) loops it.

## Run
1. `npm run build` first: the soak plays `dist/index.html`, so an unbuilt change is not what it measures.
2. `npm run soak -- --help` lists the flags. Pick the lens:
   - `chaos`: random keys and clicks, for robustness (crashes, softlocks, focus escapes). Even seeds play the opening, odd seeds skip it.
   - `player`: a bot that plays to win, for balance (deepest floor, death causes, gear).
   - `ui-sweep`: runs as `chaos` until its own policy exists.
3. `--start-floor N` soaks floors the bot never reaches on foot: `engine.diagnostics.outfitForFloor(N)` levels and dresses the hero for floor N (`--start-level` overrides the level), then `jumpToFloor(N)`.
4. `--until HH:MM` stops an overnight loop at a wall-clock time; `--count` bounds it by seeds.

Done when each seed's `summary.json` reads `partial: false`: a summary is rewritten with `partial: true` every 100 actions while the run is live.

## Output
Everything lands in `.prompts/soak/<lens>/` (gitignored), or `<lens>-floor<N>/` for a deep start:
- `runs.jsonl`: one line per seed from the runner: `status`, `endedBy`, `turnsPlayed`, `deepestFloor`, `causeOfDeath`, `deathCause`, `findingCounts`, `sha` (`deathCause` and `sha` only from 1cb68d5, 5 Oct; older runs keep their sha in `summary.json`).
- `findings.jsonl`: one line per signature new to a run, across the lens: `sig`, `category` (`bug`, `softlock`, `text`, `ux`), `severity`, `seed`, `action`, `turn`, `floor`, `detail`, and `repro`, the command that replays that seed to that action.
- `<seed>/summary.json` (`SoakSummary`, `e2e/soak/types.ts`): the run's totals, every signature with its count, latency, the raid, interruptions, and for `player` the gear and bot telemetry.
- `<seed>/actions.jsonl` (a finding's `lastActions` points into it), `f<action>.png`/`.zip` evidence for the first sighting of a signature, `save-<n>.txt` save codes every 100 actions and `save-first-finding.txt`.

## Read
- Hand the counting to the `log-analyst` agent: the logs run to megabytes. Ask for counts per signature and seed, the top findings by seeds affected, death causes, and anomalies against the last soak, with file paths; the main session opens a screenshot or save code only for a finding it will act on.
- A signature is one defect however often it fires; rank by seeds affected, not by count.
- Reproduce with the finding's `repro` line, or load its save code; evidence from soaks before 7 Oct 2026 lost its traces and periodic snapshots (deleted to save space), so plan no work that replays them.

## Compare arms
A soak is not reproducible per seed across machine load: the bot's rest (`R`) steps on the wall clock, so how many turns pass before its next key depends on CPU speed, and every later floor differs.
- Run every arm of a comparison at the same time, with the same runner count, launches interleaved; drop an arm that ran under different load.
- Compare unpaired: Mann-Whitney on deepest floors, two-proportion tests on pass rates. Per-seed pairing holds only for the first floors.
- Measure a bot change on a fixed game commit, so bot commits touch only `e2e/`: the baseline arm runs from a worktree at the last commit before the change. Filter summaries by `sha`. `.prompts/soak/compare-bots.py` is the last comparison script; adapt its paths.
- Measure a game change with the bot fixed, the same way.

## Campaign
The soak-fix campaign (harness, game bugs, bot, balance) keeps its plan in `.prompts/soak-fix-plan.md` and its state in `.prompts/HANDOFF-soak-fixes.md`; read both when the owner mentions the campaign, the bot's phases or Gálmr.
