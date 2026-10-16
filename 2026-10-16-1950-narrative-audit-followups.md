# Handoff: narrative audit follow-ups
2026-10-16 19:50 UTC · branch main · HEAD 1eb6072a · tree clean · pushed

## Goal
Act on the owner's answers to the Gemini narrative audit (`.prompts/antigravity/2026-10-16-narrative-architecture-audit.md`). All the work is committed and pushed, so it deploys to Pages.

## Decide first
- Is the cold paced right? The town's frost deepens after 3000, 7000, 12000 and 20000 turns spent below without the Hearth-Tear. Those numbers are a guess. Recommend: keep them until P-36's soak shows how long floors 1–25 really take, then retune `src/content/cotw/hearthCold.ts:26`.


## Done
- 4d9c32b1 Ivalda no longer thanks a barrow-robber for keeping faith with the dead
- cd6bb01f Father Torvald says why the temple turns away a desecrator of Tyr's altar
- 3aef8bfc the town and both endings remember which way the Blood-Oath went
- 458ce133 Bjarnarhaven grows colder the longer the hero stays below without the Hearth-Tear
- 1eb6072a defer runestone costs as P-37 until P-36's soak numbers are in
- Uncommitted: none

## Next
Complete. The first push from this repo opens a Credential Manager browser sign-in; the owner checks that it shows astevegreen.

## Decisions
- Ivalda's greeting only; no fame/infamy matrix. Owner: "fix the greeting, skip the rest"
- No companion mutiny; permadeath stays. Owner: "agree"
- Oath: only flags, ending lines and a town line or two. Owner: "do the small half"
- Runestone costs deferred as ARCHITECTURE.md §9 P-37. Owner: "look again after P-36"
- "Elder Olaf" vs "Olaf the Chandler" naming left as is. Owner: "I don't know the answer to your question"
- "Away" counts only the turns spent below town before the Hearth-Tear is won, and town visits don't reset it. Chosen because a reset would keep a hero who shops often at stage one forever.
- Old saves learn their Oath side from the bonded companion (`src/content/cotw/oath.ts:35`), so there is no save-format change.
- First push refused (403, greenbeanbot). Owner: "switch github accounts and push". The switch to astevegreen made Terminal Dusk's bot open its PR #14 as astevegreen. gh was switched back to greenbeanbot at 20:03 UTC. Never `gh auth switch` again (see memory gh-push-account).
- This repo now pushes as astevegreen through Credential Manager (`credential.username` in `.git/config`). Owner: "Yes, set this repo to push as astevegreen; I'll check the browser shows astevegreen on the next push."

## Verification
- lint + full suite (428 files, 3290 tests): green on 1eb6072a
- pre-push sim, build, Playwright in three browsers (91 passed): green on 1eb6072a, pushed 5bf4c25f..1eb6072a
