# Handoff: playtest notes fix plan
2026-10-12 01:11 UTC · branch main · HEAD eeca77f · tree clean

## Goal
The owner asked to sort the Notion page "Ideas, bugs, and playtest notes" (YODC Dev Notes, id 3daeb012-942f-80fc-ae7a-eb8ae89b401b) into categories with a reply under each note, then to "create a plan for addressing each of these issues in a logical sequence that maximizes token efficiency". Both are done on the page. Next comes carrying out the plan's six sessions, one per fresh session.

## Decide first
- Purse size: how many coins the starting pouch holds (currently 300). Recommend 1,000, with the Quicksilver purse going from 1,500 to 3,000, so the upgrade still matters. Needed before Session 4.
- Trap numbers. Recommend:
  - spotting range 3 tiles (Wayfarer doubles it);
  - spotting chance (INT−5)×2% per turn;
  - dodge chance (DEX−5)×3%, capped at 75%;
  - alarms can't be dodged.
  Needed before Session 4.
- Search (S) and Disarm currently both use INT+DEX. Recommend Search uses INT only and Disarm uses DEX only, to match the owner's split.
- Name format. Recommend the alignment word plus the tier word ("Hexed Doom-touched X"), with no doubled word at tier 1. Plain +N gear has no alignment and stays without a word.
- Which design ideas go into Session 5: knockback perk, ramping defence, packs with alignments, permanent ailments, spell accuracy.

## Done
- Notion page rewritten: the plan at the top, then 25 notes in 5 categories, each with a reply. A collapsed "Code pointers" toggle at the bottom of the page lists where each issue lives.
- Uncommitted: none. No code changed.

## Next
1. Session 1 on Sonnet: read the page's plan, then fix the rings first. Every ring is `slot: 'fingerLeft'` (src/content/cotw/items/rings.ts:9), and `Paperdoll.canEquip` scans for a free slot only when the item has no slot (src/engine/inventory/paperdoll.ts:141). Then do the rest of Session 1: the "mana" strings, Essence-Rune stacking (src/engine/items/stacking.ts:10), the Bestiary sort, the gate guard's Mimir hint, and the pack identification.
2. Sessions 2–6 follow the page's order, one fresh session each.

## Decisions
- Identified items always show a plain alignment word. Owner: "Item name should always show a plain alignment word."
- Owner: "Bigger starting purse." Capacity is read from the item definition on load (src/engine/storage/serializer.ts:198), so there's no save break. The tests at src/engine/economy/__tests__/coinSpace.test.ts:38 pin 300.
- Owner: "Dexterity increases chance of not being affected by a trap if you set it off, and intelligence increases your chance of automatically detecting a trap each turn once you are within a certain number of tiles."
- Plan order: by code area; shared causes fixed once; one soak at the end, after all balance-moving changes.
- Purse 1,000 and Quicksilver purse 3,000; trap numbers (range 3, spot (INT−5)×2%, dodge (DEX−5)×3% cap 75%, alarms undodgeable); Search INT only, Disarm DEX only; name format alignment word plus tier word — all recommendations approved. Owner: "all recommendations approved" (resume, 12 Oct)
- Session 5 scope (which design ideas go in) is not settled: the page lists them cheapest-first but makes no pick. Ask before Session 5; Sessions 1–4 don't need it.

## Read first
- The Notion page: the plan and the Code pointers toggle.
- Memory file playtest-2026-10-11-decisions.md.
- src/engine/actions/movement.ts:194 and :258: where a trap fires and where passive detection happens (Session 4).
Resumed: 2026-10-12 02:18 UTC
