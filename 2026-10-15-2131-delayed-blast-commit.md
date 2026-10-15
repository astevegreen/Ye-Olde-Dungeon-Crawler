# Handoff: magic 4b-2, commit the delayed blast, retire P-33
2026-10-15 21:31 UTC · branch main · HEAD faeca343 · tree 19 uncommitted files

## Goal
Phase 4b "New shapes" (`.prompts/plan-page.txt:451-461`, P-33), the owner's "Proceed with the next phase". 4b-2 (delayed blast + aim previews) is built and tested but not committed; commit it, push, then retire P-33 in ARCHITECTURE.md §9 (separate commit). If `git log` already shows a "delayed blast" commit on main, this session finished steps 1–2: skip to 3.

## Decide first
- A cone's (and wall's) hit flash plays as a square burst over its bounds (`boundsOf`, `spellPipeline.ts:142`); the aim preview already shows the true tiles. Add a tile-list burst to playback? — recommend: not now, because the flash lasts 250 ms and no cotw spell uses a shape yet; revisit when 4c adds Fáfnir's Breath.

## Done
- Uncommitted (all one commit, `Requested: "Proceed with the next phase"`; no §8.1 file touched):
  - `src/engine/magic/delayedBlast.ts` (new) — `SpellDefinition.delay`; the cast lays a stacking `delayed_blast` status on the caster (spell id, aim, origin, element, free); on expiry `onEnd` re-resolves the spell via `resolveCastSpell` and strikes the marked tiles; `pendingBlasts(engine)` for presentation.
  - `statusHandlers.ts` `stacks`; `statusManager.ts` keys later instances `type#n` (lookups by type, `removeEffect`, save format unchanged); `endings.ts` uses `removeEffect`.
  - `castNumbers.ts`: `resolveCastSpell`, `castShaping`, `withElement` moved out of `spell-actions.ts` (now shared by cast and blast).
  - `spellPipeline.ts`: `executeSpell(..., delayed?: DelayedOrigin)` — geometry from the cast-time origin; a delayed burst lands on its marked tile with no flight; "X's Spell strikes" log lines.
  - Presentation: `intentOverlay.ts` draws pending blasts in the danger zone + a pill naming the spell; `targeting-overlay.ts` preview draws `geo.area` and an out-and-back's path, aim card notes ("Strikes all it passes, out and back", "Strikes next turn"); `sidebarModel.ts` unique keys per stacked status.
  - Fixture: spells `rockslide` (delayed 3×3 + water) and `star_fall` (delayed thrown burst); the fixture's old `delayed_blast` ending renamed `laid_blast` (it shadowed the engine handler). Tests: `delayedBlast.test.ts`, `markers.test.ts`, `aimCard.test.ts`. Doc: `content-extensibility.md` "Delayed blasts (P-33)".

## Next
1. Read `.prompts/gates-4b2.txt` (last line `exit 0` = green). Red: fix and rerun `npm run gates`. The first run failed only on knip (`PendingBlast` export, since removed).
2. Commit (subject e.g. `feat(magic): delayed blasts and aim previews for every shape`), `git push` in the background; summary: nothing player-visible (no cotw spell uses `shape` or `delay` yet).
3. Retire P-33: delete its §9 entry, add P-33 to the retired list (`ARCHITECTURE.md` §9), commit, push.
4. Next phase per the plan page: 4c-1 "The outliers" (`.prompts/plan-page.txt:462`).

## Model
Sonnet 5.5 at medium thinking — steps 1–3 are mechanical; switch to Opus for 4c.

## Decisions
- Two delayed blasts from one caster both land — owner: "yes to both"
- The blast re-resolves the spell when it goes off (slot Area, power, lends) instead of a fixed status ending — chosen because statuses save only scalars, and a fixed ending couldn't grow with Area, lay ground or carry lends.
- `duration = delay + 1`: the hero's statuses tick as the casting action ends, so foes get `delay` turns to step out.
- No Area-stat test for the blast: it resolves through the same `resolveCastSpell` as the cast.

## Read first
- `src/engine/magic/delayedBlast.ts` — the whole mechanism
- `ARCHITECTURE.md` §9 — P-33 entry to retire

## Verification
- `npx vitest run` delayedBlast, status, rendering (295), markers: green on the uncommitted tree; `tsc` clean.
- `npm run gates`: rerun in progress after the knip fix, output `.prompts/gates-4b2.txt`.
Resumed: 2026-10-15 21:32 UTC
