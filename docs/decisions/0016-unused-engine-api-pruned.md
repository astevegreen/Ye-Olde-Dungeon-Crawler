# ADR-0016: Unused Engine API Pruned From the Protected Files

**Date:** 2026-10-07
**Status:** Accepted (owner decision)
**Related:** `ARCHITECTURE.md` §4 (Failure Isolation), §8.1 (exception 4); [ADR-0015](0015-planes-and-substances-removed.md); the codebase assessment of 2026-10-07

## Context
On 2026-10-07 a codebase assessment found engine API that nothing in the game calls, and some of it in the protected files. The knip gate hadn't reported any of it, for two reasons: it listed `src/engine/index.ts` as an entry, so every export counted as public API, and knip has no class-member analysis. Some of the members were kept only by tests that exercised them; others had no caller at all. Two sit in `ARCHITECTURE.md` itself: §4 named three presentation callbacks that no subscriber ever assigned, and a static exception counter that nothing reads.

Asked whether to prune it, given that "removing hasFeature and the execute alias touches protected files", the owner answered "4. I authorize it."

## Decision
This is a named, narrowly scoped change under §8.1 exception 4: the protected files lose only the members below. Nothing else in them changes.

**`src/engine/engine.ts`**
- `hasFeature()` and the manifest's `featureFlags`. Only a test read them, and only a since-retired second pack set any.
- `dispatchAction()` and `modifyFactionStanding()`: no caller anywhere.
- `isTileExplored()` and `activate()`: test-only. Tests call `getFloorFov(floor)?.isExplored` and `activateRegistries(engine.registries)`.
- `onVisualEffect`, `onDiscoveryEvent` and `onMessageLogged`, with the `notifyPresentation` calls that fed them. No subscriber assigns them; presentation drains `pendingVisualEffects`, `discoveryEvents` and `messages` instead.
- The registration of `manifest.actionCommands`, with the action-command registry behind it (`ActionRegistry`, `GameAction`, `ActionRegistryStore`). Built-in commands and a pack's own were registered, but nothing ever looked one up or ran one.
- The `bossFloor` written into the per-run quest copy. `QuestArcDefinition.bossFloor` is gone too: the boss lair is `maxFloor`, and nothing read the field.

**`src/engine/actions/actionPipeline.ts`**
- The `execute` alias of `executeWithHooks`.
- `resetCaughtExceptionCount()`, `resetTotalCaughtExceptions()` and the static `totalCaughtExceptions`. Each instance's `caughtExceptionCount` remains the counter: the sim, the triage view and the tests read it.
- `unregisterHook()` and `clearHooks()`, which only their own test called. `getHooks()` stays, because tests use it to see which hooks a manifest registered.

## Alternatives Considered
- **Keep them as public API for a future pack.** Rejected: an extension point that nothing exercises drifts from the engine around it, and §3's No Engine Creep already gives a pack a way to ask for a generic capability when it needs one.
- **Mark them `@deprecated` and leave them.** Rejected: that is what had happened to several of them already, and the marks were stale.

## Consequences
- §4 lists one exception counter and the presentation callbacks that are actually subscribed.
- A pack that wants feature flags, action commands or a separate boss floor would need a new generic capability, added and used in the same change.
- The knip gate now reports a dead export (see `docs/architecture/quality-gates.md`). Class members still need a review like this one.
