# Handoff: held sprint issues landed by hand
2026-10-27 23:44 UTC · branch main · HEAD eae27e12 · tree clean · folder C:/Antigravity/YODC

## Goal
The owner answered the held questions on #75, #82 and #88 and asked: "Build the #75, #82 and #88 answers here in this session instead of waiting for the lanes." Then: "Make taking a single item out of the worn pack refuse at no cost when it would land straight back in the pack, the same as Take all." Both are pushed and deployed green, #75, #82, #88 and #70 are closed, and the pushes are logged on #19.

## Done
- 742f1b04, 4af817ff K1 #82 soak flags and NPCs met (cherry-picked from sprint/82, as is)
- 58e6e172 F1 #75 belt/purse/pouch Take all; d3864047 Take all on the worn pack refuses at cost 0
- 6377f05d, 99f35dad X7 #88 F1 card; d48e4d9f cap only while a menu's recent-messages strip shows
- da545e0e single take out of the pack refuses when only the pack would take it; eae27e12 its belt/purse tests
- Uncommitted: none

## Next
Complete. #80, #84, #85, #92, #94 and #102 keep their sprint labels as the next sprint's queue, unless the owner works them by hand.

## Decisions
- #75: "Refuse, no turn"; #82: "Ship as is"; #88: "Loosen it with no menu" — owner, in chat on 27 Oct.
- Close the four issues and log on #19 — owner: "Yes, close #75, #82, #88 and #70 with a landed comment each, and log the push on the sprint log #19." Done.
- Review notes left as they are: coins refused from the pack say "already in your pack" (not "purse full"); Take all still appends a refused item; #82 soak notes (non-cancelable choice Escape loop, no in-page NPC-walk test) — owner chose ship as is.

## Read first
- `scripts/sprint/queue-rules.mjs:368` — heldRetry: only the owner's (astevegreen) comment answers a held issue

## Verification
- gate-stamp lint/test/tooling: green on eae27e12 (4136 unit)
- npm run gates incl. Chromium: green on d48e4d9f; pre-push (3 browsers, 110): green on eae27e12
- ci:watch: deploy.yml success on d48e4d9f and eae27e12
Resumed: 2026-10-27 23:59 UTC
