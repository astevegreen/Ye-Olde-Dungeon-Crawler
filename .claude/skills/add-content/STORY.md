# Story

Story content is data the engine interprets: choices, progress triggers, timed events, boss resolutions and endings. Every word reaches the screen from the manifest, so a beat needs no UI code. Models: `2d03340` with its repairs `26fa781`, `763f170`, `5b9b662` (tile choices), `df4e0d8` (a kill trigger), `1c5e9f8` (a labelled countdown), `9fc8405` (portals and endings).

## Flags and consequences
- **Flags** live in `WorldState.flags` and are saved whole. Name them snake_case with the beat as prefix (`urdr_pool_resolved`, `urdr_pool_blessed`). Content reads them through predicates (`hasFlag`, `min`/`maxCounter`, `min`/`maxFaction`, `and`, `or`, `not`) or `getFlag(engine.worldState, …)` in a hook.
- **The engine sets some itself:** `<handlerId>_resolved` when a tile's choice resolves, `<triggerId>_offered` when a trigger opens its choice, `timed_event_started:<id>`, and the counter `boss_flee_turns:<monsterId>`.
- **Consequences** are the `ChoiceConsequence` union (`src/engine/types/choice.ts`), applied in order by `applyConsequences`. Anything else is a pack post-hook on `ExecuteChoiceAction` that checks `result?.success`, as in `narrative.ts`.
- A permanent stat consequence (`modifyPermanentStat`, `modifyAttribute`) is a balance call: ask the owner first; the Norns' were replaced by gifts.

## Steps by kind
**A choice on a tile.**
1. Add the `ChoiceDefinition` to `COTW_CHOICES` (`choices.ts`), inline or spread from a feature module. Each option sets `<beat>_resolved` and a branch flag; an option with a `predicate` also gets a `disabledReason`. Order `resolvedStates` from specific to general, since the first that applies is shown.
2. Add a tile to `COTW_TILES` (`tiles.ts`) whose `interactionHandlerId` is the choice key, one key per placed tile: `<key>_resolved` is global, so two tiles sharing a key resolve together.
3. Place it: in a scripted vault (`VAULT.md`), or with a `fixedTilePlacements` entry in `index.ts` (`requiresChoiceId` skips it when the choice is missing).
4. Optionally: a `trackedMilestones` entry with its riddle, a renown milestone (`renown.ts`) for `recordMilestone`, a line in `objectives.ts`, `loreEntries`.

**A choice on an NPC.** `TownNpcDefinition` has no `choiceId`, so the NPC comes from a vault placement's `npcs`, the prologue's `aftermathNpcs`, or a `new NPC({ …, choiceId })` built in an action hook (Ivalda's in `ironClans.ts`). An NPC's choice costs no turn and never resolves, so a one-time option carries `{ type: 'hasFlag', flag, value: false }`, and so does a `keepsOpen` one.

**A progress trigger** opens a choice when progress is met, at most one per move, never during the prologue or after the run ends. Its choice is `cancelable: false`: `<id>_offered` is set on offer, so a dismissed one never returns.
- A kill count: a `StoryChoiceTrigger` (`id`, `choiceId`, `monsterDefinitionId`, `killsRequired`, optional `progressStartFlag`, `progressStartMessage`, `when`), defined beside its beat and listed in `index.ts`.
- A hero level: a `LevelMilestoneTrigger` in `COTW_LEVEL_MILESTONES` (`perks.ts`), and the Saga levels list in `perks.test.ts`.
- An attribute: a choice named `milestone_<str|dex|con|int>_<20|25|30>` in `COTW_MILESTONE_CHOICES` (`perks.ts`) is enough; `milestones.ts` builds the triggers, and a new tier goes there.
- Rewriting a shipped trigger keeps its id, so saves that already had the offer never get it again. A `choiceId` that matches no choice is skipped silently: pin it in a test.

**A timed event**, a countdown: a `TimedEventDefinition` (`id`, `startFlag`, `turnLimit`, `resolvedFlag`, `expireConsequences`; optional `label` and `expireMessage`) listed in `index.ts`. Content sets `startFlag` (a consequence or a hook) and `resolvedFlag` on success; on expiry the engine fires the consequences once and sets `resolvedFlag`. Give it a `label`, which shows the countdown in the sidebar: an unlabelled one blocks rest with no explanation. It ticks wherever the hero is, so the expiry consequences must make sense on another floor.

**A boss resolution or an ending.**
- `bossFleeResolutions` in `index.ts` (`monsterDefinitionId`, `fleeTurnsRequired`, `sealedFlag`, optional `portalTileId`, `portalMessage`), for a boss that can flee (`fleeHealthPercent`).
- An `EndingDefinition` in `COTW_QUEST.endings` (`quest.ts`): `id`, `victoryDialogue`, `victoryEpitaph`, and at least one of `relicItemId`, `requiredFlag`, `requiredMonsterKillId`. Endings are checked in order on their `victoryFloor`, and the first eligible wins. The portal is a tile with `interactionHandlerId: 'quest_victory_portal'`; for a kill, the quest's `victoryPortalTileId` is stamped where the boss dies.

## Finish
- **Tests:** nothing checks that a flag set is ever read, or that a beat is reachable; `validateManifest` checks only shapes. Add `<beat>.test.ts` on the real `cotwManifest`: the tile's handler matches the choice key; every flag it sets is read somewhere (a `resolvedStates` entry, a predicate, `trackedMilestones` or a hook); every item, spell, companion and perk it grants exists; stepping on the tile, or the kill, fires the beat on a generated floor; it survives a save round trip.
- **Sprite:** a beat's tile follows `VAULT.md`'s sprite line.
- **Creep:** collected are every `choices` key, the ids of timed events, story triggers, attribute and renown milestones, and every string under a key ending in `flag`. They live in `src/content/cotw/` only and need no allowlist entry; the allowlist holds names the engine itself owns.
- **E2E:** `gameplay.spec.ts` offers `oath_hearth` and `altar_tyr`, `prologue.spec.ts` plays the raid's countdown and choice, `whole-run.spec.ts` both endings: renaming one of those means `npm run gates`.
- **Gates:** `npx vitest run <file>` and `npm run check:engine-creep` while iterating, then `npm run gate-stamp -- run lint test`; `npm run validate:schema` when the save changes shape.
