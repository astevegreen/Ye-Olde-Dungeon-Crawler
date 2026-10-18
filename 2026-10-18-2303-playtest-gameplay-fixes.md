# Handoff: playtest gameplay fixes, item 8 owner calls
2026-10-18 23:03 UTC · branch claude/stoic-noether-f2a983 · HEAD e1810bc3 · tree clean · folder C:/Antigravity/YODC/.claude/worktrees/stoic-noether-f2a983

## Goal
Owner: "Play the live game as a player would and fix what breaks." This session built the gameplay fixes from the 2026-10-18 playtest (items 1-7, all pushed). Item 8 ("Look at idle wolf") was investigation only; three owner calls remain. Done when each is answered and any approved change is committed, pushed and green.

## Decide first
- (a) The companion (wolf or hound) stands 2 tiles from the hero and never steps in while foes bite the hero; it only strikes a foe touching itself. Should the default and bodyguard stances step in to strike a foe that is attacking the hero? — recommend: yes, because a companion watching the hero bitten reads as broken; skirmisher stays as is.
- (b) Níðhögg at 15% HP flees (src/content/cotw/index.ts:214 holds its 5-move exit), but its dais pins it against a wall, so it bites when the hero is adjacent and waits otherwise. Five hero moves while it flees drive it off (the "Root Sealed" ending). Change anything? — recommend: keep the mechanic, add a log line when it breaks that pressing it will drive it off, because players don't know moving counts.
- (c) Rest is refused while any hostile is in sight, fleeing or asleep, and nothing regenerates while waiting, so a fled 1-HP monster in view stalled a 0-Seiðr caster ~40 turns. Should Rest ignore fleeing monsters? — recommend: yes (option A), because it is the smallest change and rest still stops on any damage.

## Done
- c67c13b0 fix(hooks): a weapon's proc names the status as the pack names it
- f9b64e83 fix(oath): the matriarch's line comes before the companion answers
- 8cb98638 feat(companions): Rally Howl spends the hero's turn and waits 50 turns
- 27081f52 fix(chasm): a charge into a chasm gives the hero fall damage, not death
- 499e389b fix(spells): a bolt's range counts grid steps, diagonals included
- 82dc68d2 fix(rest): poison and other status ticks no longer stop a rest
- e1810bc3 fix(log): only the hero's wait is logged
- Uncommitted: none

## Next
1. Ask the three questions; for each "yes", change the named spot under Read first, add a test, gate, commit with the owner's words as `Requested:`, push.

## Model
Sonnet 5.5 at medium thinking — each approved change is a small, specified engine edit with a test.

## Decisions
- Hero chasm fall damage keeps the boss formula: half max HP, at least 50, so a hero under ~50 max HP can still die of it — chosen because the owner picked the existing "too big to plunge" damage.
- Rally Howl's ready turn is a world counter (`companion_skill_ready:<id>`), so no save-format change — owner: "Turn + cooldown (Recommended)".
- Bolt flights count steps via `flightLength` in castTrace.ts; bows (rangedAttack.ts) still measure as a circle — chosen because the owner asked about bolt spells.

## Read first
- src/engine/ai/aiRegistry.ts:484 — guardHeroAction, the companion stances (a)
- src/engine/ai/behaviorTree.ts:403 — fleeing and cornered rule (b)
- src/engine/actions/autoRest.ts:115 — findVisibleHostile, what blocks Rest (c)

## Verification
- gate-stamp (lint, test, tooling): green on e1810bc3
- pre-push (sim, build, Playwright 3 browsers): passed; ci:watch: deploy.yml success on e1810bc3
Resumed: 2026-10-18 23:06 UTC
