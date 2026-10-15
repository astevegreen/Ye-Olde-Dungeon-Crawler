# Handoff: magic 3a-2 (raise, pacify, endings)
2026-10-15 17:51 UTC · branch main · HEAD be703cc9 · tree clean

## Goal
Finish Phase 3a, "Allies and endings" (`.prompts/plan-page.txt:377-384`), engine-only and invisible: raise a slain foe as a temporary ally (Draugr-call), pacify (bosses resist), and endings, meaning effects that run when a status or summon ends or when its bearer is struck (Rime-Thurs shattering, Fylgja bursting, a delayed blast). Done = a test per capability, engine gates green, pushed. Then 3b.

## Done
- 381e4c7d friendly summons fight foes and never strike the hero: `ally` routine (`src/engine/ai/aiRegistry.ts`, shared `guardHeroAction`), routed in `MonsterAI.decideAction` for every `faction:'player'` monster that is not `engine.companion` (`src/engine/ai/behaviorTree.ts`); `MeleeAttackAction` refuses player-side vs player-side (`src/engine/actions/combat.ts`).
- be703cc9 monsters go for the nearest of the hero's side they perceive, hero on ties or when none is seen; a perceived `decoy` status comes first (`src/engine/ai/targetSelection.ts`). New built-in `decoy` status (`src/engine/status/statusHandlers.ts`), `SummonEffect.decoy` (`src/engine/magic/types.ts`). Doc: `docs/architecture/content-companions.md` (AI-Targeting).
- Tests: `src/engine/ai/__tests__/allySummon.test.ts` (9).
- Pushed and deployed. Player-visible: monsters now attack your companion when it is nearer than you.
- Uncommitted: none.

## Next
1. Endings first (Fylgja and Rime-Thurs need them): the status manager runs them, not the handler's `onExpire`, because a pack `expireMessage` replaces `onExpire` at `src/engine/engine.ts:350-377`, and that also drops `summoned`'s `removeEntity`, an existing bug. Fix it by wrapping `onExpire` like `onTick` (§8.1 exception 1, with a failing test) or by moving the removal into `statusManager.tick` (`src/engine/status/statusManager.ts:151-205`). Add "on struck" endings where damage lands.
2. Raise a slain foe: hook into `DeathResolver` (`src/engine/combat/deathResolver.ts`) or a spell effect that recreates the dead monster from its definition with `faction:'player'` + `summoned` status. The ally routine already handles it.
3. Pacify: a status that makes a hostile hold (like neutral, `behaviorTree.ts` neutral check), with bosses resisting (find the boss flag on `Monster`).
4. Fixture-pack test per capability, then `npm run gate-stamp -- run lint test`, `npm run sim`, commit, push.

## Model
Opus at high thinking: engine design across status, death and AI, with one possible protected-file change.

## Decisions
- Monsters may attack everyone on the hero's side, companion included. Owner picked "Everyone on your side" over the recommended "summons yes, companion no" (memory `monsters-attack-allies`).
- Friendly summons ignore their own routine's special moves (wands, wind-ups) and only melee via `ally`. Chosen for simplicity; revisit if a summon needs its breath or spell.
- `targetingMode: 'nearest_hostile'` stays: distance-only, needs no sight (3 cotw monsters use it).

## Read first
- `.prompts/plan-page.txt:377-384`: 3a spec
- `src/engine/engine.ts:350-377`: pack expire message replaces `onExpire`
- `src/engine/status/statusManager.ts:151-205`: tick and expiry
- `src/engine/magic/spellPipeline.ts:737-800`: `executeSummonEffect`

## Verification
- lint + test: green on be703cc9 (3089 unit); `npm run sim` green; pre-push passed (91 Playwright, three browsers).
