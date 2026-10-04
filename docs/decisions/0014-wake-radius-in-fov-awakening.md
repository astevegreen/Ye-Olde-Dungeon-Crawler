# ADR-0014: A Wake Radius Keeps Distant Sleepers Asleep (Protected-File Change)

**Date:** 2026-10-04
**Status:** Accepted (owner decision)
**Related:** `ARCHITECTURE.md` §8.1 (exception 4), §6; [ADR-0005](0005-owner-authorized-exception-and-agent-workflow.md); [ADR-0013](0013-sight-bonus-in-fov-radius.md); [simulation-and-input.md](../architecture/simulation-and-input.md)

## Context
Two approved perks (Q51, Q53) promise stealth. Shadow-Walker (Saga 40) says "a monster that cannot see you does not wake", and Reaver (the folk family's perk) says folk "wake slower to your step". The game has no noise, so a monster that cannot see the hero already stays asleep, unless it is hit or an alarm sounds. A sleeper wakes in two places:
- `GameEngine.updateFov` in `src/engine/engine.ts`, a §8.1 protected file, wakes every sleeping monster on a tile in the hero's sight.
- `MonsterAI.decideAction` wakes a sleeper on its own turn when it has line of sight within 8 tiles.

Nothing the hero wears or holds reaches either check. The question went to the owner as Q57.

## Decision
The owner chose option A on 2026-10-04: "Q57: A". Option A was to authorize a one-line §8.1 exception 4 in `updateFov`, so that a sleeper farther away than the hero's wake radius stays asleep, with the matching check in `behaviorTree.ts`, recorded as an ADR.

Scope is exactly one line of `engine.ts`: the awakening in `updateFov` also asks `entity.wakesOnSight(this)`. Everything else lives outside the protected file:
- `ItemModifier.wakeRadius`, in the shared item and perk vocabulary.
- `wakesOnSight` (`src/engine/ai/stealth.ts`), reached through `Monster.wakesOnSight`. A sleeper wakes on sight unless it is farther off, in Chebyshev tiles, than the smallest wake radius the hero holds. That radius comes from what the hero wears and holds, or from its family perk against the monster's family (`familyModifiers`).
- `MonsterAI.decideAction` asks the same before a sleeper with line of sight wakes.
- cotw: Shadow-Walker carries `wakeRadius: 4`; Reaver carries `wakeRadius: 5` against folk.

Damage and alarms still wake a sleeper. A sleeper kept asleep is still seen, recorded in the bestiary and drawn. This is not a licence for further `engine.ts` edits to waking or perception.

## Alternatives Considered
- **Other second halves with no engine change** (Q57 option B): Shadow-Walker's first blow on a sleeper is a critical; Reaver keeps only its coin bonus. Rejected by the owner.
- **Waking only in `behaviorTree.ts`.** Rejected: `updateFov` wakes the sleeper first, on the hero's own move, so a check in the AI alone would never be reached.

## Consequences
- Any item family or perk can now give stealth by data (`wakeRadius`), with no further engine change.
- A wake radius larger than the hero's sight changes nothing, since a sleeper out of sight never woke on sight anyway.
