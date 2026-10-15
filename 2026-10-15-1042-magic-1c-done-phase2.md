# Handoff: magic plan 1c done, dry-run table read, phase 2 next
2026-10-15 10:42 UTC · branch main · HEAD 60d41bbf · tree clean

## Goal
Magic implementation plan (local copy `.prompts/plan-page.txt`). Phase 1c (P-30 neighbour lending) is finished; the plan wants the owner to read the floor-50 table before phase 2 (risk 1). Phase 2 = cotw moves to the new grimoire on side branch `magic-grimoire` (plan-page.txt:231), first session 2a-1 (Spellbook UI, Sonnet 5.5).

## Decide first
- Swift at two steps: the stat catalog says ¾ → ⅔ → ½ of a turn (plan-page.txt:168), but the dry run says Paralyze two steps out casts in half a turn. Today two steps = ⅔ — recommend: keep ⅔, because the catalog is the rule and ½ stays for three steps.
- Phase Door and Loki's Switch are both Movement school, but one lends a blink and the other a pull; lending by school can't tell them apart — recommend: each sets its own `lends` in cotw data (no engine change), with its doubled form declared by the flavour.
- The dry-run table (below): does anything read wrong? — recommend: approve it and start phase 2.

## Done
- 60d41bbf feat(magic): casts take their slot's stats and their neighbours' lends. On origin/main.
- Stale worktree YODC-1b2 and branch magic-1b-2 removed.
- Uncommitted: none

## Next
1. Ask the questions above; record the answers.
2. Cut `magic-grimoire` from main and start 2a-1 (plan-page.txt:250), suggesting a switch to Sonnet 5.5.

## Decisions
- Borrowed effects land: damage/control/terrain on what the cast hit; heal on foes beside the caster; movement on foes beside the tile it left. Summon hits deliver nothing until P-31 gives summons fights.
- Healing lend cleanses the caster: `CleanseEffect.target: 'caster'` (types.ts), set in the pack's flavour.
- Power (slot × borrowing) travels as `CastShaping.powerMultiplier` (dice amounts can't be pre-scaled); range, area and duration reshape a copy of the spell (`withSlotStats`, castNumbers.ts). Duration rounds down (15 × 1.5 = 22, the wolves' number).
- Blood-price HP is added after Thrift; Thrift doesn't lower it.
- Cache: `heroResolvedCasts` keyed by the grimoire state's JSON, in a WeakMap on the state.
- P-28/P-29/P-30 are still in ARCHITECTURE §9; not retired here (cotw isn't on them until phase 2).

## Read first
- `src/engine/magic/__tests__/floor50DryRun.test.ts` — the dry run; `MAGIC_DRY_RUN=1 npx vitest run <it> --disableConsoleIntercept` prints the table
- `src/engine/magic/spellPipeline.ts` — `deliverLends`, `CastShaping`
- `src/engine/actions/spell-actions.ts` — `castShaping`, where a cast takes its resolved cast

## Verification
- gate-stamp lint test (404 files, 3059 tests), validate:schema: green on 60d41bbf
- pre-push (sim, build, 3 browsers): green, pushed
Resumed: 2026-10-15 10:48 UTC
