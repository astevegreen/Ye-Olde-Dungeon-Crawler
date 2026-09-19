# Implementation Plan: P-03 and P-22

> **Source:** ARCHITECTURE.md §9 (Planned Work Register), P-03 and P-22.
> **Author:** Claude Code, 2026-09-19. Based on the code at `21f929e` plus the uncommitted working tree at that time.
> **Status:** Approved (Option a - 2026-09-19). ARCHITECTURE.md is authoritative. If this plan conflicts with it, stop and flag the conflict. Do not pick a side.

---

## Before starting

1. **Uncommitted work in a protected file.** The working tree has uncommitted changes in 17 files, including a new `absorbRuneOfReturn()` method in `src/engine/engine.ts`. No §8.1 exception is stated for it. Every step below also changes `engine.ts`, so review and commit that work first. That keeps each step's diff easy to check.

2. **P-03's register entry lists less work than the code needs.** §9 says the only thing left is the two tile types. But `src/engine/` still contains campaign-specific names and logic:
   - `src/engine/combat/deathResolver.ts:116-127`: a `'boss_hrungnir'` fallback, and it places `TILES.GATEWAY_VALHALLA` itself.
   - `src/engine/actions/movement.ts:211-238`: the `tyr_purified`/`tyr_desecrated` flags, and a hardcoded return to town at `changeFloor(0, { x: 25, y: 23 })`.
   - `src/engine/quest/dungeonArc.ts:211`: the altar is placed on floor 3, and the rune vault (`FLOOR5_RUNE_VAULT_ID`) is placed on floor 5.
   - Outside the engine, `src/rendering/canvas-renderer.ts:763` and `src/ui/flanks/journalModule.ts:86` check for `'gateway_valhalla'` by name.

3. **P-22's register entry is also incomplete, and stage 1 has a design flaw.**
   - The tile registry (`src/engine/grid/tile.ts:156`) is process-wide but missing from P-22's list. P-03 will turn it into a registry that content writes to.
   - `setActiveMonsterStore` makes the **last engine constructed** the owner of every static lookup. If engine A is still running after engine B is built, A's lookups read B's data.
   - `src/content/cotw/monsters/index.ts:100` calls `MonsterRegistry.registerAll()` as a side effect of being imported. That writes into whichever store happens to be active.

---

## Order

| Step | Item | Save format changes? | Protected files (§8.1) |
|---|---|---|---|
| 1 | P-22 stage 2: shared store type and correct activation | No | `engine.ts` (exception 3) |
| 2 | P-03 stage 2: remove campaign logic from the engine | No | `engine.ts` possibly (exception 3) |
| 3 | P-22 stage 3: content registries, including tiles | No | `engine.ts` (exception 3) |
| 4 | P-03 stage 3: move the two tile types to content, schema v11 | **Yes** | `migrator.ts` (exception 2), `engine.ts` (exception 3) |
| 5 | P-22 stage 4: runtime-state registries, static entry points, remove the process default | No | `engine.ts` (exception 3) |

Step 3 comes before step 4 because of §8.3. If content-registered tiles went into a process-wide registry, the P-22 gap would get wider.

Each step is its own commit, or several commits, and each must pass every check in the "Checks for every step" section before the next step starts. State the §8.1 exception in the summary of every change that touches a protected file.

---

## Step 1: P-22 stage 2, shared store type and correct activation

- Add a generic `RegistryStore<K, V>` in `src/engine/registries/`, with `register`, `registerAll`, `get`, `has`, `getAll`, `clear` and `seedFrom`. Rebuild `MonsterRegistryStore` on top of it with the same public API.
- Add an `EngineRegistries` bundle type, typed as `engine.registries`, which step 3 fills in.
- **Fix activation.** Replace the per-registry "last constructed wins" pointer with a single `activateRegistries(engine.registries)` call.
  - Call it at the engine's entry points: the constructor (today's behaviour), `handlePlayerAction`, `advanceWorldUntilPlayerTurn`, `changeFloor`, and the end of deserialization.
  - These are small additions to `engine.ts`. **`actionPipeline.ts` does not change:** player turns go through `handlePlayerAction`, and monster turns run inside it.
- Change the side-effect registration in `src/content/cotw/monsters/index.ts:100` so monsters arrive only through `manifest.monsters`.
- **Tests:** extend `src/engine/registries/__tests__/perEngineRegistries.test.ts`. Build engine A, then engine B with a different manifest, then act on A. A's lookups must resolve against A's data. This case fails today.

---

## Step 2: P-03 stage 2, remove campaign logic from the engine

> Needs the decision in the last section before it starts.

Each of these adds an optional, generic manifest field. A pack that doesn't set it gets the current behaviour or nothing at all. `warcraft` should build with no changes.

- **Victory portal.**
  - Add a manifest field, `quest.victoryPortalTileId`, for which tile to place where the boss dies.
  - Replace the `gateway_valhalla` branch in `movement.ts` with an engine-owned handler ID, `'quest_victory_portal'`. The town return position comes from the manifest, or from the town's spawn point, instead of `{ x: 25, y: 23 }`.
  - Remove the `'boss_hrungnir'` fallback from `deathResolver.ts`.
- **Altar of Tyr.**
  - Delete the `altar_tyr` branch in `movement.ts` and use the generic tile-choice branch below it.
  - Add `ChoiceDefinition.resolvedStates?: { flag: string; message: string }[]` so content keeps the purified/desecrated messages. The generic branch checks these flags before prompting. The existing `tyr_*` flags stay valid, so saves don't change.
  - Move the altar's `resolvedStates` into `src/content/cotw/choices.ts`.
- **Placement.** Add a manifest field, `fixedTilePlacements: { floor: number; tileId: string; placement: 'middle_room_center'; requiresChoiceId?: string }[]`. It replaces the hardcoded floor-3 altar in `dungeonArc.ts`.
- **Floor-5 rune vault.** Move `FLOOR5_RUNE_VAULT_ID` and the floor number into a new field, `manifest.runeOfReturn.acquisition: { floor: number; vaultId: string }`. The Rune of Return mechanic stays in the engine. Only the place where it's found moves to content.
- **Renderer and journal.** Replace the checks for the `'gateway_valhalla'` type with generic `TileDefinition` fields, such as `visual: 'portal'` and `landmarkLabel`.
- **Tests:**
  - Update the existing tests: `src/engine/__tests__/bossPortal.test.ts`, `src/engine/actions/__tests__/genericTileChoice.test.ts`, `src/engine/__tests__/worldState.test.ts` and `src/ui/__tests__/choice-modal.test.ts`.
  - Add one test with a manifest that sets none of the new fields, to confirm nothing campaign-specific fires.
  - Add a grep check: `src/engine` production code contains no `tyr|valhalla|hrungnir`.
    - The exception is `ValhallaEntry` and the `cotw_*` storage key names. Renaming them would break the stored-key format, so record them as a known naming leftover.

---

## Step 3: P-22 stage 3, content registries

Move one registry per commit, in this order. Registries with fewer call sites go first. The number in brackets is how many production files use each one.

1. Traps (2)
2. Action commands (2)
3. Spells (`spellRegistry`)
4. Companions (3)
5. AI strategies (3)
6. AI behaviours (4)
7. Status handlers (4). The override-merge logic in the `GameEngine` constructor must write into the engine's store.
8. **Tiles** (new, and not currently listed in P-22)

The steps for each registry:
- It gets a store in `EngineRegistries`.
- The store is seeded from the process default.
- The static class becomes a facade that forwards to the store. It holds no map of its own, following the stage-1 pattern.
- `engine.ts` switches from `XRegistry.registerAll(...)` to `this.registries.x.registerAll(...)`.

Built-in-only registries get the same treatment: dungeon generators, effect primitives, hook primitives and global hooks. Their built-ins keep registering into the process default when their module loads, so seeding carries them into each engine.

**Main risk:** a test that registers a fixture *after* building engine A, then builds engine B, will stop seeing that fixture. Run `npm test` after every registry. Fix each such fixture by registering before construction or through the manifest, not by weakening the isolation.

---

## Step 4: P-03 stage 3, move the tile types to content (schema v11)

- **Keep the old encoder unchanged.**
  - Rename today's fixed code table and encoder in `src/engine/storage/compaction.ts` to a `legacyTileCodec`.
  - The existing migration steps at `migrator.ts:50` and `migrator.ts:62` call `compactTiles`, and §5 forbids changing existing steps. The legacy codec must stay exactly as it is.
- **Fix a hidden bug.** Today `TILE_TO_CODE[tile] ?? 'W'` silently saves any registered tile that isn't in the fixed table as a **wall**. Nothing registers custom tiles yet, but step 2 will make that normal.
- **New format.**
  - Each serialized map carries its own `tileCodes: string[]` dictionary, and the run-length tokens refer to entries in it. The current `(\d+)([A-Z])` regex only allows 26 single-letter codes.
  - If a map has no `tileCodes`, it is decoded with the legacy table. This matters because **archived floors in IndexedDB (`BulkArchive`) can't be reached by the synchronous migrator**. Each floor record has to describe its own encoding.
- **Types.**
  - Remove `gateway_valhalla` and `altar_tyr` from `CanonicalTileType` in `src/engine/types.ts`.
  - `TileType` is already `CanonicalTileType | (string & {})`, so it doesn't need widening again. The §9 text is out of date on this point.
  - Move the two definitions from `src/engine/grid/tile.ts` to `src/content/cotw/tiles.ts`, registered through a new `manifest.tiles`.
- **Migration.**
  - Raise `CURRENT_SCHEMA_VERSION` to 11 and add a v10→v11 step. It can be a no-op on the data, because legacy decoding is the fallback. The version bump exists so that older builds reject v11 saves as `newer-than-engine`.
  - When the engine decodes a tile type with no registered definition, it records the problem with the flight recorder instead of silently turning the tile into a wall or floor.
- **Tests:**
  - A legacy v10 save containing `G`/`Y` codes must load as the same tiles, with the definitions supplied by content.
  - Extend `scripts/validate-schema.ts` to round-trip a content-registered tile.
  - Test an archived floor without `tileCodes`.
  - Add a step test in `src/engine/storage/__tests__/migrator.test.ts`.
  - Update `src/engine/storage/__tests__/payload-compaction.test.ts`.

---

## Step 5: P-22 stage 4, runtime state and removing the process default

> Needs the decision in the last section before it starts.

- **`containerRegistry` and `itemIndex` hold game state, not content.**
  - They must **not** be seeded from a process default, because that would copy item IDs from one game into another.
  - Each engine gets new, empty instances, and deserialization rebuilds them.
  - Remove the `itemIndex.clear()` workaround for "starting a different game".
- **Static entry points.** `Monster.createFromDefinition`, `createScaledMonster` and `populateDungeonFloor` gain a `registries` parameter, and callers pass `engine.registries`.
- **Cleanup.**
  - Once no code outside tests uses the facades, delete the active pointer and the per-registry process-default stores.
  - What stays is one read-only "built-in seed" per registry, for the entries registered when modules load. That isn't a store content can write to.
- **Tests:** a two-engine test that plays interleaved turns for 200 turns with different manifests, checking for leaks through each registry.

---

## Checks for every step

Run each of these and paste real output. Saying they "should pass" doesn't count.

- `npm test`
- `npm run lint`, which includes `check:engine-purity` and `check:engine-encapsulation`
- `npm run sim`
- `npm run build`
- For steps 2 and 4, also run `npm run validate:schema` and `npm run build:all`, since `warcraft` must stay unaffected.

## Documentation updates (§8.2)

- **Before step 1:** correct both §9 entries in ARCHITECTURE.md so they list the full scope found in "Before starting":
  - the campaign-specific code in P-03
  - the tile registry, runtime-state registries and activation flaw in P-22
  - the out-of-date "widen `TileType` to `string`" wording
- **As each step lands:** update §3 (Content Extensibility Model, Content Registries, No Engine Creep) and §5 (Tiles, schema).
- **Only when step 4 (P-03) or step 5 (P-22) is complete:** remove that item's **[Planned]** tags and delete its §9 entry.

---

## Decision needed from the project owner

Steps 2 and 5 go beyond what the §9 entries currently say. Choose one:

- **(a) Expand the entries.** Expand P-03 and P-22 in §9 to cover steps 2 and 5, then carry out this plan as written.
- **(b) Keep the entries narrow.** Keep P-03 limited to the two tile types (step 4 only, plus the step-2 changes step 4 depends on). Record the other campaign-specific engine code as a new Planned item with its own ID.

Decision: **(a) Expand the entries.** Expand P-03 and P-22 in §9 to cover steps 2 and 5, then carry out this plan as written (approved by project owner 2026-09-19).
