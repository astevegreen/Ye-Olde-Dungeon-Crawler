# Handoff: narrative review + soak moved after magic
2026-10-13 13:26 UTC · branch main · HEAD 7e23de4d · tree clean

## Goal
Owner asked for a check of Antigravity's narrative assessment (`2026-10-10-narrative-assessment-boosted.md`, an upload) plus Claude's own take, written to a concise Notion page. Then: "Change the soak bot priority. I want to improve the magic system before running any soak bot tests." Both done; no code changed. Next comes the owner's pick from the two review pages.

## Decide first
- Which page goes first, magic or narrative? — recommend: magic, because every soak run waits on it.
- Blood magic: finish or cut? (magic page) — recommend: finish; it carries story weight at the F22 altar, and cutting it affects saves.
- Add one poison spell? (magic page) — recommend: yes; it gives lightning a usable opposite and makes Elementalist (Poison)'s spell bonus work.
- Ending variants: how big? (narrative page) — recommend: 3–5 conditional paragraphs per ending, not new endings.
- Tie Act 2's story back to Act 1? (narrative page) — recommend: yes, through Thrym's blood, the matriarch or the Iron Clans.
- Doom ending scores 9,000 vs 7,000 for sealed: keep it? — recommend: equal scores, or the sealed ending higher.

## Done
- Notion "Narrative review — 13 Oct 2026" (YODC Dev Notes): https://app.notion.com/p/3f8eb012942f81d4b27cf24552ee417d — key facts, 6 action items, open decisions, rejected ideas.
- Notion "Magic system review — 13 Oct 2026": https://app.notion.com/p/3f8eb012942f815aa849c981efb30225 — "Measure magic in play" moved from item 1 to item 9 (last); the "Measure before rebalancing?" question was dropped as answered.
- `.prompts/HANDOFF-soak-fixes.md` (gitignored) — "On hold" line added at the top.
- Memory: `narrative-review-2026-10-13.md`, `soak-after-magic.md`.
- Uncommitted: none.

## Next
1. Ask the Decide-first questions, then start the chosen page's item 1. On the magic page that's blood magic (HUD for Volatile Energy and Corruption, a distinct Blood Tap). Use the `add-content` skill for spells.

## Decisions
- No soak runs (soak-fix Phase D baseline and final overnight included) until the magic changes land — owner: "If I run tests now and then significantly change the magic system then the test resulsts will be obsolete"
- Narrative page lists facts and recommendations only, no implementation plans — owner: "Don't 'plan' specifically how to implement each recommendation yet"

## Read first
- Both Notion pages above: each item's rationale is there.
- `src/content/cotw/hostageRitual.ts:282` — altar tiers, blood-magic grants
- `src/content/cotw/quest.ts:91` — the two endings' fixed text
- `src/content/cotw/narrative.ts:347` — companion barks

## Verification
- No code changed; gates not run.
Resumed: 2026-10-14 03:04 UTC
