# Handoff: magic 3c, the reason
2026-10-15 19:03 UTC · branch main · HEAD 0c9e1ab · tree clean

## Goal
Magic Phase 3c, "The reason", from the owner's implementation plan: `.prompts/plan-page.txt:395-400`.
- Floor 21: the keeper becomes the named human leader of the Sól-Brand Zealots and states her claim as she dies.
- Floor 22: two captives offer themselves, with an offer line for each prologue stand-in. Her words come back as one line in the hero's memory.
- Later: Mimir confirms Níðhögg after floor 25, and a later runestone or Mimir quotes the Náströnd stanza.
- Also from 3b's split (owner: "Switch readers now, new lines in 3c"): new companion and ending lines that react to the altar's mark.

Done when all of that is in, with `npm run gates` green, pushed.

## Done
- 1648d94 feat(magic): the captive trade buys frith or blood spells and leaves a mark
- 0c9e1ab refactor(magic): retire Volatile Energy and the corruption number
- Uncommitted: none

## Next
1. Read the narrative review page (memory `narrative-review-2026-10-13.md`) and `norse-myth-fidelity.md` before writing any line.
2. Floor 21 keeper: `src/content/cotw/siphonPylon.ts`, then the captives' scene at `hostageRitual.ts:146-171` and the prologue stand-ins in `prologue.ts`.
3. Mimir and runestones: `narrative.ts:199-309`, `runestones.ts`.
4. Mark reactions: read the mark with `altarMark(engine)` (`hostageRitual.ts`), which returns `'none' | 'half' | 'full'`. Today only Torvald (`narrative.ts:186`) and Urðr's Pool (`choices.ts:367`) read it. The companions and endings don't read it yet.

## Model
Opus at high thinking: narrative work across several files, which must stay faithful to the myth and to the pack's own text.

## Decisions
- Mark: half for 1–3 sacrificed, full for 4 (or the old `blood_tainted_hero` flag). Timer deaths leave no mark. Owner: "By captives sacrificed".
- A half mark gets the darker lines. Owner: "Switch readers now, new lines in 3c".
- Memory `altar-trade-decisions.md` has the spell numbers and the standing steps.

## Read first
- `.prompts/plan-page.txt:384-400` — the 3b and 3c spec
- `src/content/cotw/hostageRitual.ts` — the trade, the marks, `altarMark`
- `src/content/cotw/narrative.ts:180-200` — how Torvald reads the mark

## Verification
- `npm run gates`: green on 1648d94. On 0c9e1ab, everything was green except one Chromium e2e flake (the floating heal text in exhaustive-playtest), which passed on rerun.
- pre-push: green on 0c9e1ab (90 Playwright tests in three browsers)
