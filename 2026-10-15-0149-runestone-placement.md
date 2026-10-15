# Handoff: runestone placement and dry run
2026-10-15 01:49 UTC · branch main · HEAD 7e23de4d · tree clean

## Goal
Owner, 15 Oct: "Let's figure out the rune stones locations and do a mental dry run/walkthrough of how a player would learn and apply all the spells in a playthrough". This is talk only: nothing gets built until the owner picks. The proposal and the dry run are written. The task is done when the owner has answered the questions below and each answer is folded into the main magic page's "Learning spells" section (memory `notion-plan-answers`).

## Decide first
- Stones on every even floor from 2 to 48 except 22 (23 stones), with the six lore runestones (floors 8, 14, 20, 28, 38, 48) becoming six of them — recommend: yes, because the rule is easy to explain, stones alternate with the odd-floor altars, and the base slots fill around floor 26
- Zone spell lists, with the first stone fixed as Firebolt or Phase Door — recommend: yes, because new players get the same first choice and later runs still differ
- One carrier list per zone, with one shortcut per monster kind; Gloom-Tarr carries floor 30's shard and Svartr floor 36's; a new shortcut, "kill it in its sleep" — recommend: yes, because every list has a shortcut any hero can do
- A: Týr's floor-4 altar comes before any Essence-Rune — recommend: the first time a hero does a kind's shortcut, it gives a rune (today's rule kept)
- B: hybrids (Odin, Ivalda, Skuld) sit outside the 25-spell list — recommend: a session of its own, leaning towards "the forge adds a second element to a known spell"
- C: Loki's doubled-glyph outcome has nothing to act on — recommend: it doubles one slot's lend
- D: Urðr's Pool still teaches Clairvoyance — recommend: it teaches Hliðskjálf, or gives a rune if the hero already knows it
- E: Fylgja never hits, so its neighbours give it nothing — recommend: it bursts with its neighbours' flavours when struck or when it ends
- F: ground spells have no material for lightning or most arcane neighbours — recommend: lightning makes charged ground, and each arcane school gets its own ground effect (listed on the page)
- G: "not now" still describes the old kill-rite model — recommend: the stone stays readable while the hero is on the floor, and the shard becomes a rune when they leave
- H: a late run may have fewer than two unknown spells left — recommend: the stone shows one face, or gives a rune

## Done
- Tentative mark lifted from the neighbour rules on the main page (the owner's words: "you can remove the tentative mark from spells now"). The "Open decisions" section is gone, and the stale count was fixed to "8 learnable from today".
- New child page with the full proposal, the run, a 25-spell table and gaps A–H: https://app.notion.com/p/3faeb012942f81a48630e644820fb375 (linked from the main page's "Learning spells").
- Memory `magic-review-2026-10-13.md` updated to match.
- Uncommitted: none (Notion and memory only)

## Next
1. Ask the Decide first questions. Fold each answer into the main page's "Learning spells" section, and trim the child page to whatever stays open.
2. If the owner takes B next: a hybrid/forge session, starting from src/content/cotw/hybridSpells.ts:67 (recipes) and the altars at src/content/cotw/index.ts:293.

## Decisions
- Neighbour rules no longer tentative — owner, 15 Oct (quoted above)
- Placement and dry run were the next topic, ahead of the first-wave specs — owner, 15 Oct (Goal quote)
- Every Decide-first recommendation taken, A–H included — owner: "approve all recommendations, but would it be feasible to start rune stones at floor 4 rather than floor 2? Discuss". Folded into the main page; the child page's gaps section became "Still open: the first stone on floor 2 or 4?" (recommend 4).
- First stone on floor 4 (22 stones; Týr's F4 Oath-Stone waits until two spells touch) — owner: "Yes". Folded into both pages; the dry run now starts on 4 and buys Phase Door as a tablet on 10. Task complete.

## Read first
- The child page above (everything in this task)
- The main page https://app.notion.com/p/3f8eb012942f815aa849c981efb30225 — the "Learning spells" section, where the answers go
Resumed: 2026-10-15 01:58 UTC
